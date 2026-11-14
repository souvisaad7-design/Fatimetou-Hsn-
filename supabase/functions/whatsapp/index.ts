/**
 * واتساب — جمعية عون وسند الخيرية (WhatsApp Cloud API الرسمي من Meta).
 * يعمل على الخادم فقط؛ المفاتيح مشفّرة في Supabase Vault (تُدخلها اللجنة من لوحة الإدارة)، لا في الواجهة ولا في GitHub.
 *
 * من يستدعيها:
 *  - Meta (Webhook): GET للتحقق (hub.verify_token)، وPOST للرسائل الواردة وحالات التسليم.
 *    كل POST من Meta يُتحقق من توقيعه (X-Hub-Signature-256) بالمفتاح السري للتطبيق؛ بدونه يُرفض.
 *  - المهمة المجدولة والمشغّلات في قاعدة البيانات (الترويسة x-cron-secret) → scheduled | notify
 *  - لوحة الإدارة بحساب عضو في اللجنة (JWT) → status | test | run | broadcast | retry
 *
 * كل خيار (التذكير، الإشعارات، المساعد) لا يعمل إلا إذا فعّلته اللجنة في الإعدادات.
 * الرسائل التي تبدأها الجمعية تُرسل بقوالب وافقت عليها Meta؛ ردود المساعد نص حر داخل نافذة 24 ساعة.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import { botReply } from "./bot.js";

/** معلومات المساعد كما في src/features/assistant/server/whatsappBot.ts */
type BotData = { knowledge: { intents: unknown[] } & Record<string, unknown>; lexicon: Record<string, string> };

const GRAPH = "https://graph.facebook.com/v21.0";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = env("SUPABASE_ANON_KEY");
const BATCH = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const monthOf = (d = new Date()) => d.toISOString().slice(0, 7);
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
/** رقم موريتاني محلي (8 أرقام) أو دولي → صيغة واتساب 222xxxxxxxx */
const toIntl = (raw: string) => {
  const d = String(raw ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (/^[234]\d{7}$/.test(d)) return `222${d}`;
  if (/^222[234]\d{7}$/.test(d)) return d;
  return null;
};
const localOf = (intl: string) => (intl.startsWith("222") ? intl.slice(3) : intl);
/** Meta ترفض في متغيرات القوالب الأسطر الجديدة والمسافات المتتالية */
const param = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 1000) || "-";

type Settings = Record<string, any>;
type Row = { id: string; phone: string; template: string | null; params: unknown[] | null; body: string | null; attempts: number };

/* ======================= Meta Graph API ======================= */
type Config = { phoneNumberId: string; token: string; appSecret: string; verifyToken: string };
type SendResult = { ok: true; id: string } | { ok: false; error: string };

async function loadConfig(db: SupabaseClient): Promise<Config> {
  const { data } = await db.rpc("wa_provider_config");
  return {
    phoneNumberId: String(data?.phone_number_id ?? ""), token: String(data?.token ?? ""),
    appSecret: String(data?.app_secret ?? ""), verifyToken: String(data?.verify_token ?? ""),
  };
}
const configured = (c: Config) => Boolean(c.phoneNumberId && c.token && c.phoneNumberId !== "null" && c.token !== "null");

const KNOWN_ERRORS: Record<number, string> = {
  190: "رمز الوصول (Access token) منتهٍ أو غير صحيح — أنشئ رمزاً دائماً وأعد ربط الحساب",
  10: "الصلاحيات ناقصة في رمز الوصول (يلزم whatsapp_business_messaging)",
  100: "قيمة غير مقبولة (تأكد من معرّف رقم الهاتف واسم القالب)",
  131030: "هذا الرقم غير مضاف إلى قائمة الأرقام المسموح بها في وضع التجربة عند Meta",
  131026: "تعذّر التسليم: الرقم ليس على واتساب أو لم يقبل شروط واتساب الجديدة",
  131047: "مرّت أكثر من 24 ساعة على آخر رسالة من هذا الشخص؛ يلزم قالب معتمد",
  131051: "نوع رسالة غير مدعوم",
  131056: "رسائل كثيرة لنفس الرقم في وقت قصير، أعد المحاولة بعد قليل",
  131049: "لم تُسلَّم: Meta تحدّ من الرسائل التسويقية لهذا الرقم",
  132000: "عدد المتغيرات لا يطابق القالب المعتمد",
  132001: "القالب غير موجود أو لم توافق عليه Meta بعد (أو اللغة مختلفة)",
  132005: "نص القالب بعد التعبئة طويل جداً",
  132007: "محتوى القالب يخالف سياسة Meta",
  132012: "صيغة متغيرات القالب غير صحيحة",
  133010: "رقم الجمعية غير مسجّل في WhatsApp Cloud API بعد",
  368: "الحساب مقيّد مؤقتاً من Meta بسبب مخالفة السياسة",
  131042: "مشكلة في الدفع: أضف وسيلة دفع في حساب WhatsApp Business عند Meta",
  131031: "الحساب مقفل من Meta",
};

async function graphSend(cfg: Config, payload: Record<string, unknown>): Promise<SendResult> {
  try {
    const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.messages?.[0]?.id) return { ok: true, id: String(data.messages[0].id) };
    const e = data?.error ?? {};
    const code = Number(e.code ?? res.status);
    const label = KNOWN_ERRORS[code] ?? "رفضت Meta الإرسال";
    const detail = e.error_data?.details ?? e.message ?? "";
    return { ok: false, error: `${label} (${code}) — ${String(detail)}`.slice(0, 480) };
  } catch (err) {
    return { ok: false, error: `تعذّر الاتصال بـ Meta: ${(err as Error).message}`.slice(0, 480) };
  }
}

const templatePayload = (to: string, name: string, lang: string, params: unknown[] | null) => ({
  to, type: "template",
  template: {
    name, language: { code: lang },
    ...(params && params.length ? { components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: param(p) })) }] } : {}),
  },
});
const textPayload = (to: string, body: string) => ({ to, type: "text", text: { body: body.slice(0, 4096), preview_url: true } });

/** إرسال صف محجوز في السجل وتحديث حالته */
async function deliver(db: SupabaseClient, cfg: Config, s: Settings, row: Row): Promise<boolean> {
  let result: SendResult;
  if (!configured(cfg)) result = { ok: false, error: "لم يُربط حساب واتساب بعد" };
  else if (row.template) {
    const lang = row.template === "hello_world" ? "en_US" : s.template_lang;
    result = await graphSend(cfg, templatePayload(row.phone, row.template, lang, row.params));
  } else result = await graphSend(cfg, textPayload(row.phone, row.body ?? ""));
  const now = new Date().toISOString();
  const patch = result.ok
    ? { status: "sent", wa_message_id: result.id, error: null, sent_at: now, updated_at: now, attempts: row.attempts + 1 }
    : { status: "failed", error: result.error, updated_at: now, attempts: row.attempts + 1 };
  const { error } = await db.from("wa_messages").update(patch).eq("id", row.id);
  if (error) console.error("تعذّر تحديث حالة الرسالة", row.id, error.message);
  return result.ok;
}

async function sendRows(db: SupabaseClient, cfg: Config, s: Settings, rows: Row[]) {
  let sent = 0, failed = 0;
  for (const row of rows) {
    if (await deliver(db, cfg, s, row)) sent++; else failed++;
    await sleep(120);
  }
  return { sent, failed };
}

async function loadSettings(db: SupabaseClient): Promise<Settings> {
  const { data, error } = await db.from("wa_settings").select("*").eq("id", true).single();
  if (error) throw new Error(`تعذّر قراءة الإعدادات: ${error.message}`);
  return data;
}

/* ======================= التذكير الشهري ======================= */
async function runMonth(db: SupabaseClient, cfg: Config, s: Settings, month: string) {
  let claimed = 0, sent = 0, failed = 0, done = false;
  const started = Date.now();
  while (Date.now() - started < 110_000) {
    const { data, error } = await db.rpc("wa_claim_reminders", { p_month: month, p_limit: BATCH });
    if (error) throw new Error(`تعذّر تجهيز الرسائل: ${error.message}`);
    const rows = (data ?? []) as Row[];
    claimed += rows.length;
    const r = await sendRows(db, cfg, s, rows);
    sent += r.sent; failed += r.failed;
    if (rows.length < BATCH) { done = true; break; }
  }
  const summary = { month, claimed, sent, failed, done, at: new Date().toISOString() };
  await db.from("wa_settings").update({ last_run_at: summary.at, last_run_summary: summary, ...(done ? { last_run_month: month } : {}) }).eq("id", true);
  return summary;
}

/* ======================= الرسائل الجماعية ======================= */
async function runBroadcast(db: SupabaseClient, cfg: Config, s: Settings, id: string) {
  let sent = 0, failed = 0, total = 0;
  const started = Date.now();
  let done = false;
  while (Date.now() - started < 110_000) {
    const { data, error } = await db.rpc("wa_claim_broadcast", { p_broadcast: id, p_limit: BATCH });
    if (error) throw new Error(`تعذّر تجهيز الرسائل: ${error.message}`);
    const rows = (data ?? []) as Row[];
    total += rows.length;
    const r = await sendRows(db, cfg, s, rows);
    sent += r.sent; failed += r.failed;
    if (rows.length < BATCH) { done = true; break; }
  }
  const { data: b } = await db.from("wa_broadcasts").select("total, sent, failed").eq("id", id).single();
  await db.from("wa_broadcasts").update({
    total: (b?.total ?? 0) + total, sent: (b?.sent ?? 0) + sent, failed: (b?.failed ?? 0) + failed,
    ...(done ? { status: "done", finished_at: new Date().toISOString() } : {}),
  }).eq("id", id);
  return { total, sent, failed, done };
}

/* ======================= الإشعارات التلقائية ======================= */
async function notify(db: SupabaseClient, cfg: Config, s: Settings, kind: string, refId: string) {
  let member: any = null, params: unknown[] = [], template = "";
  if (kind === "approved") {
    if (!s.notify_approved) return { skipped: "إشعار القبول معطّل" };
    const { data } = await db.from("members").select("id, full_name, code, phone, status").eq("id", refId).maybeSingle();
    if (!data || data.status !== "approved") return { skipped: "المنتسب غير معتمد" };
    member = data; template = s.tpl_approved; params = [data.full_name, data.code];
  } else if (kind === "payment_confirmed" || kind === "payment_rejected") {
    if (!s.notify_payment) return { skipped: "إشعار الدفعات معطّل" };
    const { data: p } = await db.from("payments").select("id, member_id, month, amount, status").eq("id", refId).maybeSingle();
    if (!p || p.status !== (kind === "payment_confirmed" ? "confirmed" : "rejected")) return { skipped: "حالة الدفعة تغيّرت" };
    const { data } = await db.from("members").select("id, full_name, code, phone").eq("id", p.member_id).maybeSingle();
    if (!data) return { skipped: "المنتسب غير موجود" };
    member = data;
    template = kind === "payment_confirmed" ? s.tpl_payment_confirmed : s.tpl_payment_rejected;
    params = kind === "payment_confirmed" ? [data.full_name, `${p.amount} أوقية قديمة`, monthLabel(p.month)] : [data.full_name, monthLabel(p.month), s.pay_phone];
  } else return { error: "نوع إشعار غير معروف" };

  const phone = toIntl(member.phone);
  if (!phone) return { skipped: "رقم غير صالح" };
  const { data: out } = await db.from("wa_optouts").select("phone").eq("phone", phone).maybeSingle();
  if (out) return { skipped: "طلب المنتسب إيقاف الرسائل" };
  const { data: row, error } = await db.from("wa_messages")
    .insert({ kind, member_id: member.id, ref_id: refId, phone, template, params })
    .select("id, phone, template, params, body, attempts").single();
  if (error) return { skipped: error.code === "23505" ? "أُرسل هذا الإشعار من قبل" : error.message };
  return { ok: await deliver(db, cfg, s, row as Row) };
}

/* ======================= معلومات المساعد (من الموقع) ======================= */
// تُنشر مع الموقع (wa-bot.json) فيبقى للمساعد مصدر معلومات واحد في الموقع وواتساب. تُحفظ في الذاكرة 10 دقائق.
let botCache: { at: number; url: string; data: BotData } | null = null;
async function loadBot(siteUrl: string): Promise<BotData | null> {
  const url = new URL("wa-bot.json", siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`).href;
  if (botCache && botCache.url === url && Date.now() - botCache.at < 10 * 60_000) return botCache.data;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.knowledge?.intents) throw new Error("ملف غير صالح");
    botCache = { at: Date.now(), url, data };
    return data;
  } catch (e) {
    console.error("تعذّر تحميل معلومات المساعد", url, (e as Error).message);
    return botCache?.data ?? null; // آخر نسخة ناجحة إن وُجدت
  }
}

/* ======================= Webhook: الرسائل الواردة ======================= */
async function validSignature(req: Request, raw: string, secret: string) {
  const header = req.headers.get("x-hub-signature-256") ?? "";
  if (!secret || secret === "null" || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7);
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

const norm = (t: string) => t.normalize("NFKD").replace(/[ً-ٰٟ]/g, "").replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();
const STOP = /^(stop|توقف|اوقف|ايقاف|الغاء|الغاء الاشتراك|لا اريد|unsubscribe|arret|arrêt)$/;
const START = /^(start|ابدا|ابدأ|تفعيل|اشترك)$/;
const STATUS_Q = /(وضعيتي|حالتي|اشتراكي|انتسابي|حسابي|دفعتي|شحالي|كم علي|كم عندي|ma situation|mon statut|mon compte|ma cotisation)/;

async function memberStatusReply(db: SupabaseClient, s: Settings, member: any, fr: boolean) {
  const month = monthOf();
  const { data: pays } = await db.from("payments").select("month, amount, status").eq("member_id", member.id).order("month", { ascending: false }).limit(12);
  const cur = (pays ?? []).find((p: any) => p.month === month && p.status !== "rejected");
  const lastPaid = (pays ?? []).find((p: any) => p.status === "confirmed");
  const st: Record<string, [string, string]> = {
    approved: ["معتمد ✅", "approuvé ✅"], pending: ["قيد المراجعة ⏳", "en attente ⏳"], suspended: ["موقوف", "suspendu"], rejected: ["مرفوض", "refusé"],
  };
  const curText = cur
    ? (cur.status === "confirmed" ? (fr ? `payée ✅ (${cur.amount})` : `مدفوع ✅ (${cur.amount} أوقية قديمة)`) : (fr ? "en vérification ⏳" : "قيد التأكيد ⏳"))
    : (fr ? "pas encore payée" : "لم يُسدَّد بعد");
  const lines = fr
    ? [`*${member.full_name}* — ${member.code}`, `Statut : ${st[member.status]?.[1] ?? member.status}`, `Cotisation de ${month} : ${curText}`,
       lastPaid ? `Dernier paiement confirmé : ${lastPaid.month}` : "", `Payer : ${s.pay_phone}`, `Portail : ${s.site_url}`]
    : [`*${member.full_name}* — ${member.code}`, `حالة الانتساب: ${st[member.status]?.[0] ?? member.status}`, `اشتراك ${monthLabel(month)}: ${curText}`,
       lastPaid ? `آخر دفعة مؤكدة: ${monthLabel(lastPaid.month)}` : "", `رقم الدفع: ${s.pay_phone}`, `بوابة المنتسبين: ${s.site_url}`];
  return lines.filter(Boolean).join("\n");
}

async function handleIncoming(db: SupabaseClient, cfg: Config, s: Settings, msg: any) {
  const phone = String(msg.from ?? "").replace(/\D/g, "");
  if (!/^[0-9]{8,15}$/.test(phone)) return;
  const text = msg.type === "text" ? String(msg.text?.body ?? "") : msg.type === "button" ? String(msg.button?.text ?? "") : msg.type === "interactive" ? String(msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? "") : "";
  const { data: member } = await db.from("members").select("id, full_name, code, phone, status").eq("phone", localOf(phone)).neq("status", "rejected").maybeSingle();

  const { error: dup } = await db.from("wa_messages").insert({
    direction: "in", kind: "incoming", phone, member_id: member?.id ?? null, body: (text || `[${msg.type}]`).slice(0, 4096),
    status: "received", wa_message_id: String(msg.id ?? ""), sent_at: new Date().toISOString(),
  });
  if (dup) return; // رسالة مكررة من Meta (إعادة المحاولة) أو خطأ: لا نرد مرتين

  const n = norm(text);
  let reply: string | null = null;
  if (STOP.test(n)) {
    await db.from("wa_optouts").upsert({ phone });
    reply = "تم إيقاف رسائل الجمعية إلى رقمك. لإعادتها اكتب: ابدأ\nVous ne recevrez plus nos messages. Pour les réactiver : START";
  } else if (START.test(n)) {
    await db.from("wa_optouts").delete().eq("phone", phone);
    reply = "تم تفعيل رسائل الجمعية لرقمك من جديد ✅";
  } else if (!s.bot_enabled) {
    return; // المساعد معطّل: تُسجَّل الرسالة فقط وتراها اللجنة في السجل
  } else if (!text) {
    reply = "شكراً لرسالتك! المساعد يفهم الرسائل المكتوبة فقط، اكتب سؤالك عن الجمعية 🙏";
  } else if (STATUS_Q.test(n)) {
    const fr = /[a-z]/i.test(text) && !/[؀-ۿ]/.test(text);
    reply = member ? await memberStatusReply(db, s, member, fr)
      : (fr ? `Ce numéro n'est pas inscrit comme membre. Inscription : ${s.site_url}` : `رقمك غير مسجّل كمنتسب. للتسجيل: ${s.site_url}`);
  } else {
    const data = await loadBot(s.site_url);
    reply = data ? botReply(data, text, s.site_url).text
      : `شكراً لرسالتك! للاستفسار اتصل بالجمعية على ${s.pay_phone}، أو زر بوابة المنتسبين: ${s.site_url}`;
  }
  if (!reply) return;
  const { data: row } = await db.from("wa_messages")
    .insert({ kind: "bot", phone, member_id: member?.id ?? null, body: reply.slice(0, 4096) })
    .select("id, phone, template, params, body, attempts").single();
  if (row) await deliver(db, cfg, s, row as Row);
}

async function handleWebhook(db: SupabaseClient, cfg: Config, payload: any) {
  const s = await loadSettings(db);
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const v = change?.value ?? {};
      for (const st of v.statuses ?? []) {
        const map: Record<string, string> = { sent: "sent", delivered: "delivered", read: "read", failed: "failed" };
        const status = map[st.status];
        if (!status || !st.id) continue;
        const err = st.errors?.[0];
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (status === "failed") { patch.status = "failed"; patch.error = `${KNOWN_ERRORS[Number(err?.code)] ?? "لم تُسلَّم"} (${err?.code ?? "?"}) — ${err?.error_data?.details ?? err?.title ?? ""}`.slice(0, 480); }
        else patch.status = status;
        // لا نرجع من «قُرئت» إلى «سُلّمت» إن وصلت الحالات بترتيب مختلف
        const order = status === "sent" ? ["pending", "failed"] : status === "delivered" ? ["pending", "sent", "failed"] : status === "read" ? ["pending", "sent", "delivered", "failed"] : ["pending", "sent"];
        await db.from("wa_messages").update(patch).eq("wa_message_id", st.id).eq("direction", "out").in("status", order);
      }
      for (const msg of v.messages ?? []) {
        try { await handleIncoming(db, cfg, s, msg); } catch (e) { console.error("رسالة واردة", e); }
      }
    }
  }
}

/* ======================= صلاحية اللجنة ======================= */
async function adminUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const userDb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: user } = await userDb.auth.getUser();
  if (!user?.user) return null;
  const { data: isAdmin } = await userDb.rpc("is_admin");
  return isAdmin === true ? user.user.id : null;
}

const SAMPLE: Record<string, (s: Settings, name: string) => unknown[]> = {
  reminder: (s, name) => [name, monthLabel(monthOf()), "200 أوقية قديمة", s.pay_phone],
  approved: (_s, name) => [name, "AWN-0000"],
  payment_confirmed: (_s, name) => [name, "200 أوقية قديمة", monthLabel(monthOf())],
  payment_rejected: (s, name) => [name, monthLabel(monthOf()), s.pay_phone],
  broadcast: () => ["هذه رسالة تجريبية من اللجنة الانتسابية."],
};
const TEMPLATE_OF: Record<string, string> = {
  reminder: "tpl_reminder", approved: "tpl_approved", payment_confirmed: "tpl_payment_confirmed", payment_rejected: "tpl_payment_rejected", broadcast: "tpl_broadcast",
};

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "إعدادات الخادم ناقصة" }, 500);
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const cfg = await loadConfig(db);
  const url = new URL(req.url);

  /* ---------- تحقق Meta من الـ Webhook ---------- */
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && cfg.verifyToken && url.searchParams.get("hub.verify_token") === cfg.verifyToken;
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return json({ error: "طريقة غير مسموحة" }, 405);

  const raw = await req.text();
  let body: Record<string, any> = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { return json({ error: "طلب غير صالح" }, 400); }

  /* ---------- أحداث Meta ---------- */
  if (req.headers.has("x-hub-signature-256") || body.object === "whatsapp_business_account") {
    if (!(await validSignature(req, raw, cfg.appSecret))) return new Response("Invalid signature", { status: 401 });
    const work = handleWebhook(db, cfg, body).catch((e) => console.error("webhook", e));
    // نرد على Meta فوراً (وإلا أعادت الإرسال)، ونكمل المعالجة في الخلفية
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work); else await work;
    return new Response("OK", { status: 200 });
  }

  const action = String(body.action ?? "");
  try {
    /* ---------- الاستدعاءات الداخلية (المهمة المجدولة والمشغّلات) ---------- */
    if (action === "scheduled" || action === "notify") {
      const { data: okSecret } = await db.rpc("wa_check_cron_secret", { p_secret: req.headers.get("x-cron-secret") ?? "" });
      if (okSecret !== true) return json({ error: "غير مصرّح" }, 401);
      const s = await loadSettings(db);
      if (action === "notify") return json(await notify(db, cfg, s, String(body.kind ?? ""), String(body.ref_id ?? "")));
      const now = new Date(), month = monthOf(now);
      if (!s.reminders_enabled) return json({ skipped: "التذكير التلقائي معطّل" });
      if (now.getUTCDate() < s.send_day || (now.getUTCDate() === s.send_day && now.getUTCHours() < s.send_hour)) return json({ skipped: "لم يحن موعد الإرسال" });
      if (s.last_run_month === month) return json({ skipped: "أُرسلت تذكيرات هذا الشهر" });
      if (!configured(cfg)) return json({ skipped: "لم يُربط حساب واتساب بعد" });
      return json(await runMonth(db, cfg, s, month));
    }

    /* ---------- لوحة الإدارة (اللجنة فقط) ---------- */
    const userId = await adminUser(req);
    if (!userId) return json({ error: "هذه الخدمة لأعضاء اللجنة فقط" }, 403);
    const s = await loadSettings(db);

    if (action === "status") {
      const { data: cron } = await db.rpc("wa_cron_status");
      let account: Record<string, unknown> | null = null, accountError: string | null = null;
      if (configured(cfg)) {
        try {
          const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`, {
            headers: { Authorization: `Bearer ${cfg.token}` }, signal: AbortSignal.timeout(15000),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            account = data;
            if (data.display_phone_number && data.display_phone_number !== s.phone_display) await db.from("wa_settings").update({ phone_display: data.display_phone_number }).eq("id", true);
          } else accountError = `${KNOWN_ERRORS[Number(data?.error?.code)] ?? "تعذّر التحقق من الحساب"} — ${data?.error?.message ?? res.status}`;
        } catch (e) { accountError = `تعذّر الاتصال بـ Meta: ${(e as Error).message}`; }
      }
      return json({ configured: configured(cfg), signed: Boolean(cfg.appSecret && cfg.appSecret !== "null"), account, accountError, cron: cron ?? null, webhookUrl: `${SUPABASE_URL}/functions/v1/whatsapp`, month: monthOf() });
    }

    if (action === "test") {
      const phone = toIntl(String(body.phone ?? ""));
      if (!phone) return json({ error: "رقم غير صحيح: 8 أرقام تبدأ بـ 2 أو 3 أو 4" }, 400);
      const which = String(body.template ?? "hello_world");
      const name = String(body.name ?? "").trim().slice(0, 60) || "المنتسب";
      const template = which === "hello_world" ? "hello_world" : s[TEMPLATE_OF[which] ?? ""];
      if (!template) return json({ error: "قالب غير معروف" }, 400);
      const params = which === "hello_world" ? null : SAMPLE[which](s, name);
      const { data: row, error } = await db.from("wa_messages")
        .insert({ kind: "test", phone, template, params, created_by: userId })
        .select("id, phone, template, params, body, attempts").single();
      if (error) throw new Error(error.message);
      const ok = await deliver(db, cfg, s, row as Row);
      const { data: saved } = await db.from("wa_messages").select("*").eq("id", row.id).single();
      return json({ ok, message: saved });
    }

    if (action === "run") {
      if (body.confirm !== true) return json({ error: "يلزم تأكيد صريح للإرسال الجماعي" }, 400);
      if (!configured(cfg)) return json({ error: "لم يُربط حساب واتساب بعد" }, 400);
      return json(await runMonth(db, cfg, s, monthOf()));
    }

    if (action === "broadcast") {
      if (body.confirm !== true) return json({ error: "يلزم تأكيد صريح للإرسال الجماعي" }, 400);
      if (!configured(cfg)) return json({ error: "لم يُربط حساب واتساب بعد" }, 400);
      const message = String(body.message ?? "").trim();
      if (message.length < 2 || message.length > 900) return json({ error: "نص الرسالة من 2 إلى 900 حرف" }, 400);
      const target = body.list_id ? "list" : "all";
      const { data: b, error } = await db.from("wa_broadcasts")
        .insert({ message, target, list_id: body.list_id || null, created_by: userId }).select("id").single();
      if (error) throw new Error(error.message);
      return json({ id: b.id, ...(await runBroadcast(db, cfg, s, b.id)) });
    }

    if (action === "resume_broadcast") {
      const id = String(body.id ?? "");
      if (!configured(cfg)) return json({ error: "لم يُربط حساب واتساب بعد" }, 400);
      return json({ id, ...(await runBroadcast(db, cfg, s, id)) });
    }

    if (action === "retry") {
      const { data: row } = await db.from("wa_messages").select("id, phone, template, params, body, attempts, status, direction").eq("id", String(body.id ?? "")).maybeSingle();
      if (!row || row.direction !== "out") return json({ error: "الرسالة غير موجودة" }, 404);
      if (row.status !== "failed" && row.status !== "pending") return json({ error: "أُرسلت هذه الرسالة من قبل" }, 400);
      return json({ ok: await deliver(db, cfg, s, row as Row) });
    }

    return json({ error: "طلب غير معروف" }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || "خطأ في الخادم" }, 500);
  }
});
