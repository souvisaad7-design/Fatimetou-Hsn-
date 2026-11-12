/**
 * التذكير برسوم الانتساب عبر SMS — جمعية عون وسند الخيرية.
 * يعمل على الخادم فقط؛ مفاتيح مزوّد الرسائل في متغيرات البيئة (Supabase → Edge Functions → Secrets)، لا في الواجهة ولا في GitHub.
 *
 * من يستدعيها:
 *  - المهمة المجدولة (pg_cron كل ساعة) مع الترويسة x-cron-secret (سرّ عشوائي محفوظ مشفّراً في Supabase Vault) → action: "scheduled"
 *    ترسل فقط إذا كان الإرسال التلقائي مفعّلاً، وحلّ يوم الإرسال وساعته، ولم تُكمَل دفعة هذا الشهر.
 *  - لوحة الإدارة بحساب عضو في اللجنة (JWT) → status | test | run | retry
 *
 * منع التكرار: الدالة sms_claim_reminders في قاعدة البيانات «تحجز» رسالة واحدة لكل منتسب عن كل شهر
 * (فهرس فريد)، ولا تُرسَل إلا الرسائل المحجوزة حديثاً. إعادة التشغيل لا ترسل شيئاً مكرراً.
 *
 * المزوّد (SMS_PROVIDER):
 *  chinguisoft: CHINGUISOFT_CAMPAIGN_KEY, CHINGUISOFT_CAMPAIGN_TOKEN (Chinguisoft SMS Campaign API — موريتل وماتل وشنقيتل)
 *              ملاحظة: نص الرسالة هو القالب المضبوط في حساب Chinguisoft نفسه؛ الـ API لا يقبل نصاً حراً.
 *  twilio  : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (رقم أو Messaging Service SID يبدأ بـ MG)
 *  infobip : INFOBIP_BASE_URL (مثل xxxxx.api.infobip.com), INFOBIP_API_KEY, INFOBIP_FROM (اختياري)
 *  http    : مزوّد محلي عام — SMS_HTTP_URL, SMS_HTTP_AUTH (قيمة ترويسة Authorization، اختياري),
 *            SMS_HTTP_BODY (قالب JSON فيه {to} و{to_local} و{text})، SMS_HTTP_SENDER (اختياري، يُستبدل به {sender})
 *  غير مضبوط: لا يُرسَل شيء، وتُسجَّل الرسالة «فشلت» مع السبب.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = env("SUPABASE_ANON_KEY");
const BATCH_LIMIT = 300;
const TZ = "Africa/Nouakchott"; // = UTC

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const monthOf = (d = new Date()) => d.toISOString().slice(0, 7);
const networkOf = (phone: string) => ({ "2": "Chinguitel", "3": "Mattel", "4": "Mauritel" } as Record<string, string>)[phone[0]] ?? null;
const validPhone = (p: string) => /^[234][0-9]{7}$/.test(p);
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const fill = (tpl: string, name: string, month: string) =>
  tpl.replaceAll("{اسم_المنتسب}", name).replaceAll("{name}", name).replaceAll("{الشهر}", monthLabel(month)).slice(0, 700);

/* ======================= مزوّدو الرسائل ======================= */
type SendResult = { ok: true; id?: string } | { ok: false; error: string };
type Provider = { name: string; configured: boolean; send: (phone: string, text: string) => Promise<SendResult> };

async function withTimeout(p: Promise<Response>, ms = 20000): Promise<Response> {
  return await Promise.race([p, new Promise<Response>((_, rej) => setTimeout(() => rej(new Error("انتهت مهلة الاتصال بالمزوّد")), ms))]);
}
const errText = async (res: Response) => `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`;

function providerFromEnv(): Provider {
  const name = env("SMS_PROVIDER").toLowerCase();
  const intl = (phone: string) => `+222${phone}`;

  if (name === "chinguisoft") {
    // https://chinguisoft.com/sms/campaign/guide — POST /api/sms/campaign/{key}، الترويسة Campaign-token
    const key = env("CHINGUISOFT_CAMPAIGN_KEY"), token = env("CHINGUISOFT_CAMPAIGN_TOKEN"), lang = env("CHINGUISOFT_LANG") || "ar";
    const reasons: Record<number, string> = {
      401: "Chinguisoft: مفتاح أو رمز الحملة غير صحيح (401)",
      402: "Chinguisoft: الرصيد غير كافٍ، يلزم شحن الحساب (402)",
      422: "Chinguisoft: بيانات غير مقبولة (422)",
      429: "Chinguisoft: طلبات كثيرة، أعد المحاولة بعد قليل (429)",
      503: "Chinguisoft: الخدمة غير متاحة حالياً (503)",
    };
    return {
      name, configured: Boolean(key && token),
      async send(phone, _text) {
        const call = () => withTimeout(fetch(`https://chinguisoft.com/api/sms/campaign/${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Campaign-token": token, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ phone, lang, reference: 0 }),
        }));
        let res = await call();
        if (res.status === 429) { await sleep(2500); res = await call(); } // محاولة واحدة بعد التمهّل
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          return { ok: true, id: data?.balance !== undefined ? `balance:${data.balance}` : undefined };
        }
        const detail = (await res.text().catch(() => "")).slice(0, 200);
        return { ok: false, error: `${reasons[res.status] ?? `Chinguisoft: HTTP ${res.status}`} ${detail}`.trim() };
      },
    };
  }

  if (name === "twilio") {
    const sid = env("TWILIO_ACCOUNT_SID"), token = env("TWILIO_AUTH_TOKEN"), from = env("TWILIO_FROM");
    return {
      name, configured: Boolean(sid && token && from),
      async send(phone, text) {
        const form = new URLSearchParams({ To: intl(phone), Body: text });
        form.set(from.startsWith("MG") ? "MessagingServiceSid" : "From", from);
        const res = await withTimeout(fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST", body: form,
          headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        }));
        if (!res.ok) return { ok: false, error: await errText(res) };
        const data = await res.json();
        return data.status === "failed" || data.status === "undelivered" ? { ok: false, error: data.error_message ?? data.status } : { ok: true, id: data.sid };
      },
    };
  }

  if (name === "infobip") {
    const base = env("INFOBIP_BASE_URL").replace(/^https?:\/\//, "").replace(/\/$/, ""), key = env("INFOBIP_API_KEY"), from = env("INFOBIP_FROM");
    return {
      name, configured: Boolean(base && key),
      async send(phone, text) {
        const res = await withTimeout(fetch(`https://${base}/sms/2/text/advanced`, {
          method: "POST",
          headers: { Authorization: `App ${key}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ messages: [{ destinations: [{ to: `222${phone}` }], text, ...(from ? { from } : {}) }] }),
        }));
        if (!res.ok) return { ok: false, error: await errText(res) };
        const data = await res.json();
        const msg = data.messages?.[0];
        const group = msg?.status?.groupName;
        return group === "REJECTED" || group === "UNDELIVERABLE" ? { ok: false, error: msg?.status?.description ?? group } : { ok: true, id: msg?.messageId };
      },
    };
  }

  if (name === "http") {
    const url = env("SMS_HTTP_URL"), auth = env("SMS_HTTP_AUTH"), tpl = env("SMS_HTTP_BODY"), sender = env("SMS_HTTP_SENDER");
    return {
      name, configured: Boolean(url && tpl),
      async send(phone, text) {
        const esc = (v: string) => JSON.stringify(v).slice(1, -1);
        const body = tpl.replaceAll("{to}", esc(intl(phone))).replaceAll("{to_local}", esc(phone)).replaceAll("{text}", esc(text)).replaceAll("{sender}", esc(sender));
        const res = await withTimeout(fetch(url, {
          method: "POST", body,
          headers: { "Content-Type": "application/json", Accept: "application/json", ...(auth ? { Authorization: auth } : {}) },
        }));
        if (!res.ok) return { ok: false, error: await errText(res) };
        const raw = await res.text();
        let id: string | undefined;
        try { const d = JSON.parse(raw); id = String(d.id ?? d.message_id ?? d.messageId ?? "") || undefined; } catch { /* نص عادي */ }
        return { ok: true, id };
      },
    };
  }

  return { name: name || "none", configured: false, send: async () => ({ ok: false, error: "لم يُضبط مزوّد الرسائل بعد (SMS_PROVIDER)" }) };
}

/* ======================= الإرسال والتسجيل ======================= */
async function deliver(db: SupabaseClient, provider: Provider, row: { id: string; phone: string; body: string; attempts: number }) {
  let result: SendResult;
  try {
    result = provider.configured ? await provider.send(row.phone, row.body) : { ok: false, error: "لم يُضبط مزوّد الرسائل بعد (SMS_PROVIDER)" };
  } catch (err) {
    result = { ok: false, error: (err as Error).message || "خطأ غير معروف" };
  }
  const patch = result.ok
    ? { status: "sent", provider: provider.name, provider_message_id: result.id ?? null, error: null, sent_at: new Date().toISOString(), attempts: row.attempts + 1 }
    : { status: "failed", provider: provider.name, error: result.error.slice(0, 500), attempts: row.attempts + 1 };
  const { error } = await db.from("sms_messages").update(patch).eq("id", row.id);
  if (error) console.error("تعذّر تحديث حالة الرسالة", row.id, error.message);
  return result.ok;
}

/** دفعة تذكيرات الشهر: تحجز الرسائل غير المرسلة بعد (بلا تكرار) ثم ترسلها */
async function runMonth(db: SupabaseClient, provider: Provider, month: string) {
  const { data: claimed, error } = await db.rpc("sms_claim_reminders", { p_month: month, p_limit: BATCH_LIMIT });
  if (error) throw new Error(`تعذّر تجهيز الرسائل: ${error.message}`);
  const rows = (claimed ?? []) as Array<{ id: string; phone: string; body: string; attempts: number }>;
  let sent = 0, failed = 0;
  for (const row of rows) {
    if (await deliver(db, provider, row)) sent++; else failed++;
    await sleep(provider.name === "chinguisoft" ? 400 : 150);
  }
  const done = rows.length < BATCH_LIMIT; // أقل من الحد = لم يبقَ أحد لهذا الشهر
  const summary = { month, claimed: rows.length, sent, failed, provider: provider.name, done, at: new Date().toISOString() };
  await db.from("sms_settings").update({ last_run_at: summary.at, last_run_summary: summary, ...(done ? { last_run_month: month } : {}) }).eq("id", true);
  return summary;
}

/** هل المستخدم صاحب الطلب عضو في اللجنة؟ (من حسابه في قاعدة البيانات) */
async function adminUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const userDb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: user } = await userDb.auth.getUser();
  if (!user?.user) return null;
  const { data: isAdmin } = await userDb.rpc("is_admin");
  return isAdmin === true ? user.user.id : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "طريقة غير مسموحة" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "إعدادات الخادم ناقصة" }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* بلا جسم */ }
  const action = String(body.action ?? "");
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const provider = providerFromEnv();

  try {
    /* ---------- المهمة المجدولة ---------- */
    if (action === "scheduled") {
      // السرّ يُقارَن داخل قاعدة البيانات (Vault) ولا يظهر في الكود ولا في GitHub
      const { data: okSecret } = await db.rpc("sms_check_cron_secret", { p_secret: req.headers.get("x-cron-secret") ?? "" });
      if (okSecret !== true) return json({ error: "غير مصرّح" }, 401);
      const { data: s } = await db.from("sms_settings").select("*").eq("id", true).single();
      const now = new Date(); // نواكشوط = UTC
      const month = monthOf(now);
      if (!s?.enabled) return json({ skipped: "الإرسال التلقائي معطّل" });
      if (now.getUTCDate() < s.send_day || (now.getUTCDate() === s.send_day && now.getUTCHours() < s.send_hour)) return json({ skipped: "لم يحن موعد الإرسال" });
      if (s.last_run_month === month) return json({ skipped: "أُرسلت تذكيرات هذا الشهر" });
      if (!provider.configured) {
        await db.from("sms_settings").update({ last_run_at: now.toISOString(), last_run_summary: { month, error: "لم يُضبط مزوّد الرسائل بعد", at: now.toISOString() } }).eq("id", true);
        return json({ skipped: "لم يُضبط مزوّد الرسائل بعد" });
      }
      return json(await runMonth(db, provider, month));
    }

    /* ---------- طلبات لوحة الإدارة (اللجنة فقط) ---------- */
    const userId = await adminUser(req);
    if (!userId) return json({ error: "هذه الخدمة لأعضاء اللجنة فقط" }, 403);

    if (action === "status") {
      const { data: cron } = await db.rpc("sms_cron_status");
      return json({ provider: provider.name, configured: provider.configured, fixedTemplate: provider.name === "chinguisoft", cron: cron ?? null, timezone: TZ, month: monthOf() });
    }

    if (action === "test") {
      const phone = String(body.phone ?? "").replace(/\D/g, "").replace(/^222(?=\d{8}$)/, "");
      if (!validPhone(phone)) return json({ error: "رقم غير صحيح: 8 أرقام تبدأ بـ 2 أو 3 أو 4" }, 400);
      const { data: s } = await db.from("sms_settings").select("template").eq("id", true).single();
      const name = String(body.name ?? "").trim().slice(0, 60) || "المنتسب";
      const text = String(body.text ?? "").trim() ? String(body.text).trim().slice(0, 700) : fill(s?.template ?? "", name, monthOf());
      const { data: row, error } = await db.from("sms_messages")
        .insert({ kind: "test", phone, network: networkOf(phone), body: text, created_by: userId })
        .select("id, phone, body, attempts").single();
      if (error) throw new Error(error.message);
      const ok = await deliver(db, provider, row);
      const { data: saved } = await db.from("sms_messages").select("*").eq("id", row.id).single();
      return json({ ok, message: saved });
    }

    if (action === "run") {
      if (body.confirm !== true) return json({ error: "يلزم تأكيد صريح للإرسال الجماعي" }, 400);
      if (!provider.configured) return json({ error: "لم يُضبط مزوّد الرسائل بعد" }, 400);
      return json(await runMonth(db, provider, monthOf()));
    }

    if (action === "retry") {
      const id = String(body.id ?? "");
      const { data: row } = await db.from("sms_messages").select("id, phone, body, attempts, status").eq("id", id).maybeSingle();
      if (!row) return json({ error: "الرسالة غير موجودة" }, 404);
      if (row.status === "sent") return json({ error: "أُرسلت هذه الرسالة من قبل" }, 400);
      const ok = await deliver(db, provider, row);
      return json({ ok });
    }

    return json({ error: "طلب غير معروف" }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || "خطأ في الخادم" }, 500);
  }
});
