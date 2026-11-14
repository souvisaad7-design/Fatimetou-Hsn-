/**
 * «واتساب» — للجنة فقط (WhatsApp Cloud API الرسمي من Meta).
 * الإرسال والاستقبال على الخادم (Edge Function: whatsapp)، والمفاتيح مشفّرة في Supabase Vault.
 * هذه الصفحة: ربط الحساب، القوالب، الإعدادات، رسالة تجريبية، رسالة جماعية، تذكير الشهر، والسجل.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { copyText, useToast } from "../../../../shared/toast";
import { useDb } from "../../hooks/useDb";
import { supabase, errorMessage } from "../../services/supabase";
import { currentMonth, monthLabel } from "../../lib/format";
import { Badge, Button, Card, ConfirmButton, Empty, Field, Notice } from "../../ui";

interface WaSettings {
  reminders_enabled: boolean;
  notify_approved: boolean;
  notify_payment: boolean;
  bot_enabled: boolean;
  send_day: number;
  send_hour: number;
  template_lang: string;
  tpl_reminder: string;
  tpl_approved: string;
  tpl_payment_confirmed: string;
  tpl_payment_rejected: string;
  tpl_broadcast: string;
  pay_phone: string;
  site_url: string;
  connected_at: string | null;
  phone_display: string | null;
  last_run_at: string | null;
  last_run_summary: { claimed?: number; sent?: number; failed?: number } | null;
}
type Form = Omit<WaSettings, "connected_at" | "phone_display" | "last_run_at" | "last_run_summary">;
interface WaMessage {
  id: string;
  direction: "out" | "in";
  kind: string;
  member_id: string | null;
  phone: string;
  template: string | null;
  params: string[] | null;
  body: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed" | "received";
  error: string | null;
  attempts: number;
  created_at: string;
  sent_at: string | null;
}
interface ServerStatus {
  configured: boolean;
  signed: boolean;
  account: { display_phone_number?: string; verified_name?: string; quality_rating?: string } | null;
  accountError: string | null;
  cron: { scheduled: boolean } | null;
  webhookUrl: string;
}

const STATUS: Record<WaMessage["status"], { label: string; tone: "ok" | "warn" | "bad" | "brand" }> = {
  read: { label: "قُرئت", tone: "ok" },
  delivered: { label: "وصلت", tone: "ok" },
  sent: { label: "أُرسلت", tone: "ok" },
  pending: { label: "قيد الانتظار", tone: "warn" },
  failed: { label: "فشلت", tone: "bad" },
  received: { label: "واردة", tone: "brand" },
};
const KIND: Record<string, string> = {
  reminder: "تذكير شهري", approved: "قبول انتساب", payment_confirmed: "تأكيد دفعة", payment_rejected: "رفض دفعة",
  broadcast: "رسالة جماعية", test: "تجريبية", bot: "رد المساعد", incoming: "رسالة من منتسب",
};

/** القوالب المقترحة: تُنشأ في WhatsApp Manager > Message templates (الفئة: Utility، اللغة: Arabic) */
const TEMPLATES: Array<{ key: keyof Form; title: string; vars: string; body: string; note?: string }> = [
  {
    key: "tpl_reminder", title: "التذكير الشهري بالرسوم", vars: "{{1}} الاسم، {{2}} الشهر، {{3}} المبلغ، {{4}} رقم الدفع",
    body: "السلام عليكم {{1}}،\nنذكّركم بأن اشتراك الانتساب لشهر {{2}} في جمعية عون وسند الخيرية لم يُسجَّل بعد.\nالمبلغ: {{3}}\nرقم الدفع: {{4}}\nبعد الدفع يمكنكم الإبلاغ عنه من بوابة المنتسبين. شكراً لدعمكم.",
  },
  {
    key: "tpl_approved", title: "قبول الانتساب", vars: "{{1}} الاسم، {{2}} رقم العضوية",
    body: "مرحباً {{1}} 🎉\nتم قبول انتسابكم في جمعية عون وسند الخيرية.\nرقم العضوية: {{2}}\nيمكنكم متابعة اشتراكاتكم من بوابة المنتسبين. أهلاً بكم معنا.",
  },
  {
    key: "tpl_payment_confirmed", title: "تأكيد الدفعة", vars: "{{1}} الاسم، {{2}} المبلغ، {{3}} الشهر",
    body: "شكراً {{1}} ✅\nتم تأكيد دفعتكم بمبلغ {{2}} عن شهر {{3}} في جمعية عون وسند الخيرية.\nجزاكم الله خيراً.",
  },
  {
    key: "tpl_payment_rejected", title: "رفض الدفعة", vars: "{{1}} الاسم، {{2}} الشهر، {{3}} رقم الجمعية",
    body: "السلام عليكم {{1}}،\nتعذّر تأكيد دفعتكم عن شهر {{2}} في جمعية عون وسند الخيرية.\nيرجى التواصل مع مشرف لائحتكم أو الاتصال بالجمعية على {{3}}.",
  },
  {
    key: "tpl_broadcast", title: "رسالة اللجنة (للرسائل الجماعية)", vars: "{{1}} نص الرسالة",
    body: "رسالة من اللجنة الانتسابية لجمعية عون وسند الخيرية:\n{{1}}\nللاستفسار تواصلوا مع مشرف لائحتكم.",
    note: "قد تصنّفه Meta «Marketing» (أغلى قليلاً). الأسطر الجديدة داخل نص الرسالة تصبح مسافات.",
  },
];

const TEST_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "hello_world", label: "hello_world (قالب Meta الجاهز — للتجربة الأولى)" },
  { value: "reminder", label: "التذكير الشهري" },
  { value: "approved", label: "قبول الانتساب" },
  { value: "payment_confirmed", label: "تأكيد الدفعة" },
  { value: "payment_rejected", label: "رفض الدفعة" },
  { value: "broadcast", label: "رسالة اللجنة" },
];

const dateTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
const toForm = (s: WaSettings): Form => ({
  reminders_enabled: s.reminders_enabled, notify_approved: s.notify_approved, notify_payment: s.notify_payment, bot_enabled: s.bot_enabled,
  send_day: s.send_day, send_hour: s.send_hour, template_lang: s.template_lang, tpl_reminder: s.tpl_reminder, tpl_approved: s.tpl_approved,
  tpl_payment_confirmed: s.tpl_payment_confirmed, tpl_payment_rejected: s.tpl_payment_rejected, tpl_broadcast: s.tpl_broadcast,
  pay_phone: s.pay_phone, site_url: s.site_url,
});
const SWITCHES: Array<{ key: "bot_enabled" | "notify_approved" | "notify_payment" | "reminders_enabled"; title: string; hint: string }> = [
  { key: "bot_enabled", title: "المساعد الذكي على واتساب", hint: "يرد تلقائياً على من يراسل رقم الجمعية بمعلومات المساعد نفسها، ويعطي المنتسب وضعيته إذا كتب «وضعيتي»." },
  { key: "notify_approved", title: "إشعار قبول الانتساب", hint: "رسالة للمنتسب عند اعتماد طلبه." },
  { key: "notify_payment", title: "إشعار تأكيد الدفعة أو رفضها", hint: "رسالة للمنتسب عند تأكيد دفعته أو رفضها." },
  { key: "reminders_enabled", title: "التذكير الشهري التلقائي", hint: "مرة واحدة في الشهر لكل منتسب معتمد لم يسدد، ولا يتكرر لنفس الشهر." },
];

async function callServer<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("whatsapp", { body });
  if (error) {
    let msg = error.message;
    try { const ctx = (error as { context?: Response }).context; const j = ctx ? await ctx.json() : null; if (j?.error) msg = j.error; } catch { /* */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="ad-wa-copy">
      <span className="ad-muted ad-small">{label}</span>
      <div><code dir="ltr">{value || "…"}</code>
        <Button small variant="ghost" icon="copy" disabled={!value} onClick={async () => toast((await copyText(value)) ? "تم النسخ" : value)}>نسخ</Button>
      </div>
    </div>
  );
}

export function WhatsAppAdmin() {
  const db = useDb();
  const toast = useToast();
  const month = currentMonth();
  const [settings, setSettings] = useState<WaSettings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [preview, setPreview] = useState<{ due: number; already_sent: number; remaining: number; optouts: number } | null>(null);
  const [server, setServer] = useState<ServerStatus | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [keys, setKeys] = useState({ phoneId: "", token: "", secret: "", show: false, busy: false, editing: false });
  const [test, setTest] = useState({ phone: "", name: "", template: "hello_world", busy: false });
  const [testResult, setTestResult] = useState<WaMessage | null>(null);
  const [bc, setBc] = useState({ message: "", listId: "", busy: false, count: null as number | null });
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<"" | "out" | "in" | "failed">("");

  const refreshServer = useCallback(() => {
    callServer<ServerStatus>({ action: "status" }).then((s) => { setServer(s); setServerError(null); }).catch((err) => setServerError((err as Error).message));
  }, []);

  const load = useCallback(async () => {
    try {
      const [s, list, pv, wh] = await Promise.all([
        supabase.from("wa_settings").select("*").eq("id", true).single(),
        supabase.from("wa_messages").select("*").order("created_at", { ascending: false }).limit(150),
        supabase.rpc("wa_reminder_preview", { p_month: month }),
        supabase.rpc("wa_webhook_info"),
      ]);
      if (s.error) throw s.error;
      if (list.error) throw list.error;
      setSettings(s.data as WaSettings);
      setForm((f) => f ?? toForm(s.data as WaSettings));
      setMessages(list.data as WaMessage[]);
      if (!pv.error) setPreview(pv.data);
      if (!wh.error) setVerifyToken(wh.data?.verify_token ?? "");
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [month]);

  useEffect(() => { void load(); refreshServer(); }, [load, refreshServer]);

  // عدد من ستصلهم الرسالة الجماعية
  useEffect(() => {
    let alive = true;
    supabase.rpc("wa_broadcast_preview", { p_list: bc.listId || null }).then(({ data }) => { if (alive) setBc((b) => ({ ...b, count: typeof data === "number" ? data : null })); });
    return () => { alive = false; };
  }, [bc.listId]);

  const memberName = useCallback((id: string | null) => (id ? db.members.find((m) => m.id === id)?.fullName : undefined), [db.members]);
  const shown = useMemo(() => messages.filter((m) => !filter || (filter === "failed" ? m.status === "failed" : m.direction === filter)), [messages, filter]);
  const counts = useMemo(() => ({
    sent: messages.filter((m) => m.direction === "out" && ["sent", "delivered", "read"].includes(m.status)).length,
    failed: messages.filter((m) => m.status === "failed").length,
    incoming: messages.filter((m) => m.direction === "in").length,
  }), [messages]);

  if (loadError && !settings) return <Card><Notice tone="warn">تعذّر تحميل إعدادات واتساب: {loadError}</Notice></Card>;
  if (!settings || !form) return <div className="app-message" aria-busy="true"><span className="app-spinner" aria-hidden="true" /></div>;

  const ready = server?.configured === true && !server.accountError;
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(settings));

  const save = async () => {
    const turnedOn = SWITCHES.filter((sw) => form[sw.key] && !settings[sw.key]).map((sw) => `• ${sw.title}`);
    if (turnedOn.length && !window.confirm(
      `ستُفعَّل الخيارات التالية وتبدأ الرسائل الحقيقية للمنتسبين:\n${turnedOn.join("\n")}\n` +
      (form.reminders_enabled && !settings.reminders_enabled && new Date().getUTCDate() >= form.send_day ? "\nتنبيه: يوم التذكير لهذا الشهر قد حلّ، فستُرسل تذكيرات هذا الشهر خلال الساعة القادمة.\n" : "") +
      (!ready ? "\nملاحظة: الحساب غير مربوط بعد، فلن يُرسل شيء حتى ربطه.\n" : "") + "\nهل تؤكد؟",
    )) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("save_wa_settings", { p: form });
      if (error) throw error;
      toast("تم حفظ إعدادات واتساب");
      setForm(null);
      await load();
    } catch (err) {
      toast(`تعذّر الحفظ: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const connect = async () => {
    setKeys((k) => ({ ...k, busy: true }));
    try {
      const { error } = await supabase.rpc("wa_set_credentials", { p_phone_number_id: keys.phoneId, p_token: keys.token, p_app_secret: keys.secret });
      if (error) throw error;
      setKeys({ phoneId: "", token: "", secret: "", show: false, busy: false, editing: false });
      toast("تم ربط حساب واتساب وحفظ المفاتيح مشفّرة");
      await load();
      refreshServer();
    } catch (err) {
      setKeys((k) => ({ ...k, busy: false }));
      toast(errorMessage(err));
    }
  };

  const sendTest = async () => {
    setTest((t) => ({ ...t, busy: true }));
    setTestResult(null);
    try {
      const res = await callServer<{ ok: boolean; message: WaMessage }>({ action: "test", phone: test.phone, name: test.name, template: test.template });
      setTestResult(res.message);
      toast(res.ok ? "أُرسلت الرسالة التجريبية" : `فشلت الرسالة التجريبية: ${res.message?.error ?? ""}`);
      await load();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setTest((t) => ({ ...t, busy: false }));
    }
  };

  const sendBroadcast = async () => {
    setBc((b) => ({ ...b, busy: true }));
    try {
      const res = await callServer<{ total: number; sent: number; failed: number; done: boolean }>({ action: "broadcast", confirm: true, message: bc.message, list_id: bc.listId || null });
      toast(`أُرسلت ${res.sent} رسالة، وفشلت ${res.failed}${res.done ? "" : " — بقيت رسائل، ستكمل عند إعادة الإرسال"}`);
      setBc((b) => ({ ...b, message: "" }));
      await load();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBc((b) => ({ ...b, busy: false }));
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await callServer<{ claimed: number; sent: number; failed: number }>({ action: "run", confirm: true });
      toast(res.claimed ? `أُرسلت ${res.sent} رسالة، وفشلت ${res.failed}` : "لا يوجد من يحتاج تذكيراً هذا الشهر");
      await load();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const retry = async (id: string) => {
    try {
      const res = await callServer<{ ok: boolean }>({ action: "retry", id });
      toast(res.ok ? "أُرسلت الرسالة" : "فشلت المحاولة مرة أخرى");
      await load();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const setF = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  return (
    <div className="ad-stack">
      {/* الحالة */}
      <div className="ad-sms-status">
        <span className={`ad-sms-pill ${ready ? "is-on" : "is-warn"}`}>
          {server ? (ready ? `✓ الحساب مربوط: ${server.account?.display_phone_number ?? settings.phone_display ?? ""}` : server.configured ? "تعذّر التحقق من الحساب" : "لم يُربط حساب واتساب بعد") : serverError ? "تعذّر الاتصال بالخادم" : "…"}
        </span>
        {SWITCHES.map((sw) => (
          <span key={sw.key} className={`ad-sms-pill ${settings[sw.key] ? "is-on" : "is-off"}`}>{settings[sw.key] ? "●" : "○"} {sw.title}</span>
        ))}
      </div>
      {server?.accountError && <Notice tone="warn">{server.accountError}</Notice>}
      {serverError && <Notice tone="warn">تعذّر الاتصال بدالة واتساب: {serverError}</Notice>}

      {/* 1) ربط الحساب */}
      <Card title="1. ربط حساب WhatsApp Business (Meta)">
        {settings.connected_at && !keys.editing ? (
          <div className="ad-toolbar">
            <Badge tone="ok">✓ مربوط</Badge>
            <span className="ad-muted ad-small">المفاتيح محفوظة مشفّرة منذ {dateTime(settings.connected_at)}، ولا يمكن عرضها.
              {server?.account?.verified_name ? ` الاسم الظاهر: ${server.account.verified_name}.` : ""}
              {server?.account?.quality_rating ? ` جودة الرقم: ${server.account.quality_rating}.` : ""}</span>
            <Button small variant="ghost" icon="edit" onClick={() => setKeys({ ...keys, editing: true })}>تغيير المفاتيح</Button>
          </div>
        ) : (
          <div className="ui-form">
            <ol className="ui-field--full ad-wa-steps">
              <li>من <b>developers.facebook.com</b> افتح تطبيقك ← <b>WhatsApp ← API Setup</b>: انسخ <b>Phone number ID</b>.</li>
              <li>أنشئ <b>رمز وصول دائماً</b> (Business Settings ← System users ← Generate token، بصلاحيتي whatsapp_business_messaging و whatsapp_business_management). الرمز المؤقت ينتهي خلال 24 ساعة.</li>
              <li>من <b>App settings ← Basic</b> انسخ <b>App secret</b> (يحمي الخادم من الرسائل المزيّفة).</li>
            </ol>
            <Field label="Phone number ID">
              {(id) => <input id={id} value={keys.phoneId} onChange={(e) => setKeys({ ...keys, phoneId: e.target.value })} dir="ltr" inputMode="numeric" autoComplete="off" spellCheck={false} />}
            </Field>
            <Field label="App secret">
              {(id) => <input id={id} type={keys.show ? "text" : "password"} value={keys.secret} onChange={(e) => setKeys({ ...keys, secret: e.target.value })} dir="ltr" autoComplete="new-password" spellCheck={false} />}
            </Field>
            <Field label="رمز الوصول (Access token)" full>
              {(id) => <input id={id} type={keys.show ? "text" : "password"} value={keys.token} onChange={(e) => setKeys({ ...keys, token: e.target.value })} dir="ltr" autoComplete="new-password" spellCheck={false} />}
            </Field>
            <div className="ui-field--full ad-toolbar">
              <Button icon="check" disabled={keys.busy || !/^\s*\d{6,25}\s*$/.test(keys.phoneId) || keys.token.trim().length < 50 || keys.secret.trim().length !== 32} onClick={connect}>{keys.busy ? "جارٍ الحفظ..." : "حفظ وربط"}</Button>
              <Button variant="ghost" onClick={() => setKeys({ ...keys, show: !keys.show })}>{keys.show ? "إخفاء" : "إظهار"}</Button>
              {keys.editing && <Button variant="ghost" onClick={() => setKeys({ phoneId: "", token: "", secret: "", show: false, busy: false, editing: false })}>إلغاء</Button>}
            </div>
            <p className="ui-field--full ad-muted ad-small">تُحفظ مشفّرة على الخادم (Supabase Vault)، ولا تظهر مرة أخرى لأي أحد، ولا توجد في كود الموقع ولا في GitHub.</p>
          </div>
        )}
      </Card>

      {/* 2) Webhook */}
      <Card title="2. استقبال الرسائل (Webhook)">
        <p className="ad-muted ad-small">في تطبيقك عند Meta: <b>WhatsApp ← Configuration ← Webhook ← Edit</b>، الصق القيمتين ثم اضغط «Verify and save»، وبعدها فعّل الحقل <b>messages</b> (Subscribe). بدون هذا لا يعمل المساعد ولا تظهر حالة «وصلت/قُرئت».</p>
        <div className="ad-wa-copies">
          <CopyField label="Callback URL" value={server?.webhookUrl ?? ""} />
          <CopyField label="Verify token" value={verifyToken} />
        </div>
      </Card>

      {/* 3) القوالب */}
      <Card title="3. قوالب الرسائل (تُنشأ مرة واحدة وتوافق عليها Meta)">
        <p className="ad-muted ad-small">
          الرسائل التي تبدأها الجمعية (التذكير، الإشعارات، الرسائل الجماعية) لا تُرسل إلا بقالب معتمد. من <b>WhatsApp Manager ← Message templates ← Create template</b>:
          الفئة <b>Utility</b>، اللغة <b>Arabic</b>، والاسم كما هو مكتوب، ثم الصق النص. ردود المساعد لا تحتاج قوالب.
        </p>
        <div className="ad-wa-templates">
          {TEMPLATES.map((tp) => (
            <article key={tp.key} className="ad-wa-template">
              <header><b>{tp.title}</b><code dir="ltr">{String(form[tp.key])}</code></header>
              <pre>{tp.body}</pre>
              <span className="ad-muted ad-small">المتغيرات: {tp.vars}</span>
              {tp.note && <span className="ad-muted ad-small">ملاحظة: {tp.note}</span>}
              <Button small variant="ghost" icon="copy" onClick={async () => toast((await copyText(tp.body)) ? "تم نسخ نص القالب" : "تعذّر النسخ")}>نسخ النص</Button>
            </article>
          ))}
        </div>
      </Card>

      <div className="ad-grid-2">
        {/* 4) الإعدادات */}
        <Card title="4. الإعدادات">
          <div className="ui-form">
            {SWITCHES.map((sw) => (
              <label key={sw.key} className="ui-check ui-field--full">
                <input type="checkbox" checked={form[sw.key]} onChange={(e) => setF(sw.key, e.target.checked)} />
                <span><b>{sw.title}</b><br /><span className="ad-muted ad-small">{sw.hint}</span></span>
              </label>
            ))}
            <Field label="يوم التذكير من كل شهر">
              {(id) => <select id={id} value={form.send_day} onChange={(e) => setF("send_day", Number(e.target.value))}>{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}</select>}
            </Field>
            <Field label="الساعة (بتوقيت نواكشوط)">
              {(id) => <select id={id} value={form.send_hour} onChange={(e) => setF("send_hour", Number(e.target.value))}>{Array.from({ length: 24 }, (_, h) => h).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select>}
            </Field>
            <Field label="رقم الدفع في الرسائل">
              {(id) => <input id={id} value={form.pay_phone} onChange={(e) => setF("pay_phone", e.target.value.replace(/\D/g, "").slice(0, 8))} dir="ltr" inputMode="numeric" />}
            </Field>
            <Field label="لغة القوالب">
              {(id) => <input id={id} value={form.template_lang} onChange={(e) => setF("template_lang", e.target.value.trim())} dir="ltr" placeholder="ar" />}
            </Field>
            <Field label="رابط بوابة المنتسبين" full>
              {(id) => <input id={id} value={form.site_url} onChange={(e) => setF("site_url", e.target.value.trim())} dir="ltr" />}
            </Field>
            <details className="ui-field--full ad-wa-names">
              <summary>أسماء القوالب (إن اخترت أسماء أخرى عند Meta)</summary>
              <div className="ui-form">
                {TEMPLATES.map((tp) => (
                  <Field key={tp.key} label={tp.title}>
                    {(id) => <input id={id} value={String(form[tp.key])} onChange={(e) => setF(tp.key, e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") as never)} dir="ltr" />}
                  </Field>
                ))}
              </div>
            </details>
            <div className="ui-field--full ad-toolbar">
              <Button icon="check" onClick={save} disabled={!dirty || saving}>{saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</Button>
              {dirty && <Button variant="ghost" onClick={() => setForm(toForm(settings))}>تراجع</Button>}
            </div>
            <p className="ui-field--full ad-muted ad-small">من يكتب «توقف» أو STOP لا تصله أي رسالة من الجمعية بعدها (حتى يكتب «ابدأ»). عددهم الآن: <span className="num">{preview?.optouts ?? 0}</span>.</p>
          </div>
        </Card>

        <div className="ad-stack">
          {/* 5) تجربة */}
          <Card title="5. رسالة تجريبية">
            <div className="ui-form">
              <Field label="رقم الهاتف">
                {(id) => <input id={id} value={test.phone} onChange={(e) => setTest({ ...test, phone: e.target.value })} inputMode="tel" dir="ltr" placeholder="22 33 44 55" />}
              </Field>
              <Field label="الاسم في الرسالة" optional>
                {(id) => <input id={id} value={test.name} onChange={(e) => setTest({ ...test, name: e.target.value })} placeholder="المنتسب" />}
              </Field>
              <Field label="القالب" full>
                {(id) => <select id={id} value={test.template} onChange={(e) => setTest({ ...test, template: e.target.value })}>{TEST_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
              </Field>
              <div className="ui-field--full ad-toolbar">
                <Button icon="send" onClick={sendTest} disabled={test.busy || !/^\s*(\+?222)?\s*[234]\d(\s?\d){6}\s*$/.test(test.phone)}>{test.busy ? "جارٍ الإرسال..." : "إرسال"}</Button>
              </div>
              <p className="ui-field--full ad-muted ad-small">في وضع التجربة عند Meta، أضف الرقم أولاً إلى قائمة الأرقام المسموح بها (API Setup ← To).</p>
              {testResult && (
                <div className="ui-field--full ad-sms-preview">
                  <Badge tone={STATUS[testResult.status].tone}>{STATUS[testResult.status].label}</Badge>
                  {testResult.error && <p className="ad-muted ad-small">السبب: {testResult.error}</p>}
                </div>
              )}
            </div>
          </Card>

          {/* 6) تذكير الشهر */}
          <Card title={`تذكيرات ${monthLabel(month)} عبر واتساب`}>
            <p className="ad-muted">
              بقي <b className="num">{preview?.remaining ?? "—"}</b> منتسباً لم تصلهم رسالة هذا الشهر (أُرسلت أو جُهّزت <span className="num">{preview?.already_sent ?? 0}</span>).
            </p>
            <div className="ad-toolbar ad-mt">
              <ConfirmButton label={running ? "جارٍ الإرسال..." : "إرسال تذكيرات هذا الشهر الآن"} confirmLabel={`تأكيد الإرسال إلى ${preview?.remaining ?? 0} منتسب`} variant="ghost" icon="send" small={false} onConfirm={runNow} />
            </div>
            {!ready && <p className="ad-muted ad-small ad-mt">متاح بعد ربط الحساب وموافقة Meta على قالب التذكير.</p>}
          </Card>
        </div>
      </div>

      {/* 7) رسالة جماعية */}
      <Card title="6. رسالة جماعية من اللجنة">
        <div className="ui-form">
          <Field label="إلى">
            {(id) => (
              <select id={id} value={bc.listId} onChange={(e) => setBc({ ...bc, listId: e.target.value })}>
                <option value="">كل المنتسبين المعتمدين</option>
                {db.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </Field>
          <div className="ad-wa-count"><span className="ad-muted ad-small">سيستلمها</span> <b className="num">{bc.count ?? "—"}</b> <span className="ad-muted ad-small">منتسباً</span></div>
          <Field label="نص الرسالة" full>
            {(id) => <textarea id={id} className="ad-template" value={bc.message} maxLength={900} onChange={(e) => setBc({ ...bc, message: e.target.value })} placeholder="مثال: نذكّركم باجتماع الجمعية العامة يوم الجمعة القادم الساعة 5 مساءً." />}
          </Field>
          <div className="ui-field--full ad-sms-preview">
            <span className="ad-muted ad-small">معاينة (قالب «{form.tpl_broadcast}»):</span>
            <p style={{ whiteSpace: "pre-line" }}>{TEMPLATES[4].body.replace("{{1}}", bc.message.replace(/\s+/g, " ").trim() || "…")}</p>
          </div>
          <div className="ui-field--full ad-toolbar">
            <ConfirmButton label={bc.busy ? "جارٍ الإرسال..." : "إرسال الرسالة الجماعية"} confirmLabel={`تأكيد الإرسال إلى ${bc.count ?? 0} منتسب`} variant="ghost" icon="megaphone" small={false}
              onConfirm={() => { if (bc.message.trim().length >= 2 && !bc.busy) void sendBroadcast(); else toast("اكتب نص الرسالة أولاً"); }} />
            <span className="ad-muted ad-small"><span className="num">{bc.message.length}</span>/900</span>
          </div>
        </div>
      </Card>

      {/* السجل */}
      <Card title="سجل واتساب" actions={
        <div className="ad-filters" style={{ margin: 0 }}>
          {([["", "الكل"], ["out", `صادرة (${counts.sent})`], ["in", `واردة (${counts.incoming})`], ["failed", `فشلت (${counts.failed})`]] as const).map(([v, label]) => (
            <button key={v || "all"} type="button" className={`ad-filter${filter === v ? " is-active" : ""}`} onClick={() => setFilter(v)}>{label}</button>
          ))}
        </div>
      }>
        {shown.length === 0 ? <Empty icon="inbox" title="لا توجد رسائل بعد" /> : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>التاريخ</th><th>النوع</th><th>المنتسب / الرقم</th><th>المحتوى</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id}>
                    <td className="num">{dateTime(m.sent_at ?? m.created_at)}</td>
                    <td>{m.direction === "in" ? "⬅ " : ""}{KIND[m.kind] ?? m.kind}</td>
                    <td>{memberName(m.member_id) ?? "—"} <span className="ad-muted num" dir="ltr">+{m.phone}</span></td>
                    <td className="ad-wa-body">{m.body ?? (m.template ? <code dir="ltr">{m.template}</code> : "")}{m.error && <div className="ad-muted ad-small">السبب: {m.error}</div>}</td>
                    <td><Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>{m.attempts > 1 && <span className="ad-muted ad-small num"> ×{m.attempts}</span>}</td>
                    <td>{m.direction === "out" && (m.status === "failed" || m.status === "pending") && <Button small variant="ghost" icon="retry" onClick={() => retry(m.id)}>إعادة</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="ad-muted ad-small">آخر 150 رسالة.</p>
      </Card>
    </div>
  );
}
