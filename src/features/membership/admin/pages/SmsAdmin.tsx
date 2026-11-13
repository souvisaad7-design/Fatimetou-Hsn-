/**
 * «التذكير برسوم الانتساب SMS» — للجنة فقط.
 * الإرسال الفعلي من الخادم (Edge Function: sms-reminders)، ومفاتيح المزوّد في متغيرات البيئة على الخادم.
 * هذه الصفحة تقرأ الإعدادات والسجل (RLS: اللجنة فقط)، وتحفظ الإعدادات عبر دالة آمنة.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../../../../shared/toast";
import { useDb } from "../../hooks/useDb";
import { supabase, errorMessage } from "../../services/supabase";
import { currentMonth, monthLabel } from "../../lib/format";
import { Badge, Button, Card, ConfirmButton, Empty, Field, Notice } from "../../ui";

interface SmsSettings {
  enabled: boolean;
  send_day: number;
  send_hour: number;
  template: string;
  last_run_at: string | null;
  last_run_month: string | null;
  last_run_summary: Record<string, unknown> | null;
  provider: string | null;
  provider_updated_at: string | null;
}
interface SmsMessage {
  id: string;
  kind: "reminder" | "test";
  member_id: string | null;
  month: string | null;
  phone: string;
  network: string | null;
  body: string;
  status: "pending" | "sent" | "failed";
  provider: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  sent_at: string | null;
}
interface ServerStatus {
  provider: string;
  configured: boolean;
  fixedTemplate?: boolean;
  cron: { scheduled: boolean; schedule: string | null; last_run: { at: string; status: string } | null } | null;
}

const STATUS: Record<SmsMessage["status"], { label: string; tone: "ok" | "warn" | "bad" }> = {
  sent: { label: "نجحت", tone: "ok" },
  pending: { label: "قيد الانتظار", tone: "warn" },
  failed: { label: "فشلت", tone: "bad" },
};
const NETWORK: Record<string, string> = { Chinguitel: "شنقيتل", Mattel: "ماتل", Mauritel: "موريتل" };
const PLACEHOLDERS = ["{اسم_المنتسب}", "{الشهر}"];
const fill = (tpl: string, name: string, month: string) =>
  tpl.split("{اسم_المنتسب}").join(name).split("{name}").join(name).split("{الشهر}").join(monthLabel(month));
/** عدد أجزاء الرسالة: العربية تُرسل بترميز UCS-2 (70 حرفاً لرسالة واحدة، و67 لكل جزء بعدها) */
const segments = (text: string) => {
  const unicode = /[^\u0000-\u007f]/.test(text);
  const single = unicode ? 70 : 160, part = unicode ? 67 : 153;
  return text.length <= single ? 1 : Math.ceil(text.length / part);
};
const dateTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

async function callServer<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("sms-reminders", { body });
  if (error) {
    let msg = error.message;
    try { const ctx = (error as { context?: Response }).context; const j = ctx ? await ctx.json() : null; if (j?.error) msg = j.error; } catch { /* */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function SmsAdmin() {
  const db = useDb();
  const toast = useToast();
  const month = currentMonth();
  const [settings, setSettings] = useState<SmsSettings | null>(null);
  const [form, setForm] = useState<{ enabled: boolean; day: number; hour: number; template: string } | null>(null);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [counts, setCounts] = useState({ monthSent: 0, monthFailed: 0, monthPending: 0, allSent: 0, allFailed: 0 });
  const [preview, setPreview] = useState<{ due: number; already_sent: number; remaining: number } | null>(null);
  const [server, setServer] = useState<ServerStatus | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState({ phone: "", name: "", busy: false });
  const [testResult, setTestResult] = useState<SmsMessage | null>(null);
  const [running, setRunning] = useState(false);
  const [keys, setKeys] = useState({ key: "", token: "", show: false, busy: false, editing: false });
  const [filter, setFilter] = useState<"" | SmsMessage["status"]>("");

  const load = useCallback(async () => {
    try {
      const count = (q: ReturnType<typeof base>) => q.then((r) => r.count ?? 0);
      const base = () => supabase.from("sms_messages").select("id", { count: "exact", head: true });
      const [s, list, ms, mf, mp, as, af, pv] = await Promise.all([
        supabase.from("sms_settings").select("*").eq("id", true).single(),
        supabase.from("sms_messages").select("*").order("created_at", { ascending: false }).limit(100),
        count(base().eq("kind", "reminder").eq("month", month).eq("status", "sent")),
        count(base().eq("kind", "reminder").eq("month", month).eq("status", "failed")),
        count(base().eq("kind", "reminder").eq("month", month).eq("status", "pending")),
        count(base().eq("status", "sent")),
        count(base().eq("status", "failed")),
        supabase.rpc("sms_reminder_preview", { p_month: month }),
      ]);
      if (s.error) throw s.error;
      if (list.error) throw list.error;
      setSettings(s.data as SmsSettings);
      setForm((f) => f ?? { enabled: s.data.enabled, day: s.data.send_day, hour: s.data.send_hour, template: s.data.template });
      setMessages(list.data as SmsMessage[]);
      setCounts({ monthSent: ms, monthFailed: mf, monthPending: mp, allSent: as, allFailed: af });
      if (!pv.error) setPreview(pv.data);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [month]);

  useEffect(() => {
    void load();
    callServer<ServerStatus>({ action: "status" }).then(setServer).catch((err) => setServerError((err as Error).message));
  }, [load]);

  const memberName = useCallback((id: string | null) => (id ? db.members.find((m) => m.id === id)?.fullName : undefined), [db.members]);
  const sampleName = useMemo(() => db.members.find((m) => m.status === "approved")?.fullName ?? "محمد أحمد", [db.members]);
  const shown = filter ? messages.filter((m) => m.status === filter) : messages;

  if (loadError && !settings) return <Card><Notice tone="warn">تعذّر تحميل إعدادات الرسائل: {loadError}</Notice></Card>;
  if (!settings || !form) return <div className="app-message" aria-busy="true"><span className="app-spinner" aria-hidden="true" /></div>;

  const dirty = form.enabled !== settings.enabled || form.day !== settings.send_day || form.hour !== settings.send_hour || form.template.trim() !== settings.template;
  const sample = fill(form.template, sampleName, month);
  const providerReady = server?.configured === true;

  const save = async () => {
    if (form.enabled && !settings.enabled && !window.confirm(
      `تفعيل الإرسال التلقائي: ستُرسل رسالة تذكير لكل منتسب معتمد لم يسدد رسوم الشهر، يوم ${form.day} من كل شهر الساعة ${form.hour}:00.\n` +
      (new Date().getUTCDate() >= form.day ? "تنبيه: يوم الإرسال لهذا الشهر قد حلّ، فستُرسل تذكيرات هذا الشهر خلال الساعة القادمة.\n" : "") + "هل تؤكد؟",
    )) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("save_sms_settings", { p_enabled: form.enabled, p_day: form.day, p_hour: form.hour, p_template: form.template });
      if (error) throw error;
      toast("تم حفظ إعدادات التذكير");
      setForm(null);
      await load();
    } catch (err) {
      toast(`تعذّر الحفظ: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTest((t) => ({ ...t, busy: true }));
    setTestResult(null);
    try {
      const res = await callServer<{ ok: boolean; message: SmsMessage }>({ action: "test", phone: test.phone, name: test.name });
      setTestResult(res.message);
      toast(res.ok ? "أُرسلت الرسالة التجريبية" : `فشلت الرسالة التجريبية: ${res.message?.error ?? ""}`);
      await load();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setTest((t) => ({ ...t, busy: false }));
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

  const summary = settings.last_run_summary as { claimed?: number; sent?: number; failed?: number; error?: string } | null;

  return (
    <div className="ad-stack">
      {/* الحالة */}
      <div className="ad-sms-status">
        <span className={`ad-sms-pill ${settings.enabled ? "is-on" : "is-off"}`}>{settings.enabled ? "● الإرسال التلقائي مفعّل" : "○ الإرسال التلقائي متوقف"}</span>
        <span className={`ad-sms-pill ${providerReady ? "is-on" : "is-warn"}`}>
          {server ? (providerReady ? `مزوّد الرسائل: ${server.provider}` : "لم يُربط مزوّد الرسائل بعد") : serverError ? "تعذّر الاتصال بالخادم" : "…"}
        </span>
        <span className={`ad-sms-pill ${server?.cron?.scheduled ? "is-on" : "is-off"}`}>{server?.cron?.scheduled ? "المهمة المجدولة تعمل كل ساعة" : "المهمة المجدولة غير مفعّلة"}</span>
      </div>
      {server && !providerReady && (
        <Notice tone="warn">
          لن تُرسل أي رسالة قبل ربط حساب مزوّد الرسائل: أدخل مفتاح Chinguisoft ورمزه السري في البطاقة «ربط حساب Chinguisoft» أعلاه.
          حتى ذلك الحين تُسجَّل الرسائل التجريبية «فشلت» مع السبب.
        </Notice>
      )}

      {/* ربط Chinguisoft: المفتاح والرمز يُحفظان مشفّرين في Supabase Vault ولا يُعرضان مرة أخرى */}
      <Card title="ربط حساب Chinguisoft">
        {settings.provider === "chinguisoft" && !keys.editing ? (
          <div className="ad-toolbar">
            <Badge tone="ok">✓ مربوط</Badge>
            <span className="ad-muted ad-small">
              المفتاح والرمز السري محفوظان مشفّرين{settings.provider_updated_at ? ` منذ ${dateTime(settings.provider_updated_at)}` : ""}، ولا يمكن عرضهما.
            </span>
            <Button small variant="ghost" icon="edit" onClick={() => setKeys({ ...keys, editing: true })}>تغيير المفاتيح</Button>
          </div>
        ) : (
          <div className="ui-form">
            <p className="ui-field--full ad-muted ad-small">
              من صفحة «حملات» في Chinguisoft: انسخ <b>المفتاح</b> والصقه في الخانة الأولى، وانسخ <b>الرمز السري</b> (الأحمر) والصقه في الثانية، ثم اضغط «حفظ».
              يُحفظان مشفّرين على الخادم، ولا يظهران مرة أخرى لأي أحد.
            </p>
            <Field label="المفتاح (campaign_key)">
              {(id) => <input id={id} value={keys.key} onChange={(e) => setKeys({ ...keys, key: e.target.value })} dir="ltr" autoComplete="off" autoCapitalize="off" spellCheck={false} />}
            </Field>
            <Field label="الرمز السري (Campaign-token)">
              {(id) => <input id={id} type={keys.show ? "text" : "password"} value={keys.token} onChange={(e) => setKeys({ ...keys, token: e.target.value })} dir="ltr" autoComplete="new-password" autoCapitalize="off" spellCheck={false} />}
            </Field>
            <div className="ui-field--full ad-toolbar">
              <Button icon="check" disabled={keys.busy || keys.key.trim().length < 6 || keys.token.trim().length < 10} onClick={async () => {
                setKeys((k) => ({ ...k, busy: true }));
                try {
                  const { error } = await supabase.rpc("sms_set_chinguisoft", { p_key: keys.key, p_token: keys.token });
                  if (error) throw error;
                  setKeys({ key: "", token: "", show: false, busy: false, editing: false });
                  toast("تم ربط Chinguisoft وحفظ المفاتيح مشفّرة");
                  await load();
                  callServer<ServerStatus>({ action: "status" }).then(setServer).catch(() => {});
                } catch (err) {
                  setKeys((k) => ({ ...k, busy: false }));
                  toast(errorMessage(err));
                }
              }}>{keys.busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
              <Button variant="ghost" onClick={() => setKeys({ ...keys, show: !keys.show })}>{keys.show ? "إخفاء الرمز" : "إظهار الرمز"}</Button>
              {keys.editing && <Button variant="ghost" onClick={() => setKeys({ key: "", token: "", show: false, busy: false, editing: false })}>إلغاء</Button>}
            </div>
          </div>
        )}
      </Card>

      {server?.fixedTemplate && (
        <Notice tone="warn">
          مزوّد الرسائل الحالي (Chinguisoft) لا يقبل نصاً حراً: تُرسَل الرسالة بالنص المضبوط في حسابكم لدى Chinguisoft (صفحة «حملات»)،
          فلا يُستعمل النص المكتوب هنا ولا يظهر فيها اسم المنتسب. لإرسال نص مخصّص باسم كل منتسب يلزم اتفاق «Custom SMS» مع Chinguisoft أو مزوّد آخر.
        </Notice>
      )}

      {/* الأرقام */}
      <div className="ad-stats">
        <div className="ui-stat"><span className="ui-stat__label">تحتاج تذكيراً — {monthLabel(month)}</span><strong className="ui-stat__value num">{preview?.due ?? "—"}</strong><span className="ui-stat__sub">لم يسددوا ولا دفعة قيد التأكيد</span></div>
        <div className="ui-stat"><span className="ui-stat__label">أُرسلت هذا الشهر</span><strong className="ui-stat__value num">{counts.monthSent}</strong><span className="ui-stat__sub">المجموع: <span className="num">{counts.allSent}</span></span></div>
        <div className="ui-stat"><span className="ui-stat__label">فشلت هذا الشهر</span><strong className="ui-stat__value num">{counts.monthFailed}</strong><span className="ui-stat__sub">المجموع: <span className="num">{counts.allFailed}</span></span></div>
        <div className="ui-stat"><span className="ui-stat__label">قيد الانتظار</span><strong className="ui-stat__value num">{counts.monthPending}</strong><span className="ui-stat__sub">{settings.last_run_at ? `آخر تشغيل: ${dateTime(settings.last_run_at)}` : "لم يُشغَّل بعد"}</span></div>
      </div>
      {summary?.error && <Notice tone="warn">آخر تشغيل للمهمة: {summary.error}</Notice>}

      <div className="ad-grid-2">
        {/* الإعدادات */}
        <Card title="إعدادات التذكير">
          <div className="ui-form">
            <label className="ui-check ui-field--full">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              <span><b>تفعيل الإرسال التلقائي</b><br /><span className="ad-muted ad-small">يُرسَل التذكير مرة واحدة في الشهر لكل منتسب معتمد لم يسدد، ولا يتكرر أبداً لنفس الشهر.</span></span>
            </label>
            <Field label="يوم الإرسال من كل شهر">
              {(id) => (
                <select id={id} value={form.day} onChange={(e) => setForm({ ...form, day: Number(e.target.value) })}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
            </Field>
            <Field label="الساعة (بتوقيت نواكشوط)">
              {(id) => (
                <select id={id} value={form.hour} onChange={(e) => setForm({ ...form, hour: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, h) => h).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
              )}
            </Field>
            <Field label="نص رسالة التذكير" full>
              {(id) => <textarea id={id} className="ad-template" value={form.template} maxLength={600} onChange={(e) => setForm({ ...form, template: e.target.value })} />}
            </Field>
            <p className="ui-field--full ad-muted ad-small">
                ضع {PLACEHOLDERS.map((p, i) => <span key={p}>{i ? " و" : ""}<button type="button" className="ad-sms-chip" onClick={() => setForm({ ...form, template: `${form.template}${p}` })}>{p}</button></span>)} ليُستبدل باسم المنتسب والشهر.
                {" "}<span className="num">{form.template.length}</span>/600 حرف
            </p>
            <div className="ui-field--full ad-sms-preview">
              <span className="ad-muted ad-small">معاينة (بأول منتسب معتمد) — <span className="num">{segments(sample)}</span> جزء SMS:</span>
              <p>{sample}</p>
            </div>
            <div className="ui-field--full ad-toolbar">
              <Button icon="check" onClick={save} disabled={!dirty || saving}>{saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</Button>
              {dirty && <Button variant="ghost" onClick={() => setForm({ enabled: settings.enabled, day: settings.send_day, hour: settings.send_hour, template: settings.template })}>تراجع</Button>}
            </div>
          </div>
        </Card>

        <div className="ad-stack">
          {/* رسالة تجريبية */}
          <Card title="إرسال رسالة تجريبية">
            <div className="ui-form">
              <Field label="رقم الهاتف">
                {(id) => <input id={id} value={test.phone} onChange={(e) => setTest({ ...test, phone: e.target.value })} inputMode="tel" dir="ltr" placeholder="22 33 44 55" />}
              </Field>
              <Field label="الاسم في الرسالة" optional>
                {(id) => <input id={id} value={test.name} onChange={(e) => setTest({ ...test, name: e.target.value })} placeholder="المنتسب" />}
              </Field>
              <div className="ui-field--full ad-toolbar">
                <Button icon="send" onClick={sendTest} disabled={test.busy || !/^\s*(\+?222)?\s*[234]\d(\s?\d){6}\s*$/.test(test.phone)}>{test.busy ? "جارٍ الإرسال..." : "إرسال الرسالة التجريبية"}</Button>
              </div>
              <p className="ui-field--full ad-muted ad-small">تُرسل بالنص المحفوظ في الإعدادات. احفظ التعديلات أولاً لتجربة النص الجديد.</p>
              {testResult && (
                <div className="ui-field--full ad-sms-preview">
                  <Badge tone={STATUS[testResult.status].tone}>{STATUS[testResult.status].label}</Badge>
                  {testResult.error && <p className="ad-muted ad-small">السبب: {testResult.error}</p>}
                </div>
              )}
            </div>
          </Card>

          {/* إرسال يدوي لتذكيرات الشهر */}
          <Card title={`تذكيرات ${monthLabel(month)}`}>
            <p className="ad-muted">
              بقي <b className="num">{preview?.remaining ?? "—"}</b> منتسباً لم تصلهم رسالة هذا الشهر
              (أُرسلت أو جُهّزت <span className="num">{preview?.already_sent ?? 0}</span>).
            </p>
            <div className="ad-toolbar ad-mt">
              <ConfirmButton
                label={running ? "جارٍ الإرسال..." : "إرسال تذكيرات هذا الشهر الآن"}
                confirmLabel={`تأكيد الإرسال إلى ${preview?.remaining ?? 0} منتسب`}
                variant="ghost"
                icon="send"
                small={false}
                onConfirm={runNow}
              />
            </div>
            {!providerReady && <p className="ad-muted ad-small ad-mt">متاح بعد ربط مزوّد الرسائل.</p>}
          </Card>
        </div>
      </div>

      {/* السجل */}
      <Card title="سجل الإرسال" actions={
        <div className="ad-filters" style={{ margin: 0 }}>
          {(["", "sent", "failed", "pending"] as const).map((s) => (
            <button key={s || "all"} type="button" className={`ad-filter${filter === s ? " is-active" : ""}`} onClick={() => setFilter(s)}>
              {s ? STATUS[s].label : "الكل"}
            </button>
          ))}
        </div>
      }>
        {shown.length === 0 ? <Empty icon="inbox" title="لا توجد رسائل بعد" /> : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>التاريخ</th><th>النوع</th><th>المنتسب / الرقم</th><th>الشبكة</th><th>الشهر</th><th>الحالة</th><th>ملاحظة</th><th /></tr></thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id}>
                    <td className="num">{dateTime(m.sent_at ?? m.created_at)}</td>
                    <td>{m.kind === "test" ? "تجريبية" : "تذكير"}</td>
                    <td>{memberName(m.member_id) ?? "—"} <span className="ad-muted num" dir="ltr">{m.phone}</span></td>
                    <td>{m.network ? NETWORK[m.network] ?? m.network : "—"}</td>
                    <td>{m.month ? monthLabel(m.month) : "—"}</td>
                    <td><Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>{m.attempts > 1 && <span className="ad-muted ad-small num"> ×{m.attempts}</span>}</td>
                    <td className="ad-muted ad-small">{m.error ?? ""}</td>
                    <td>{m.status !== "sent" && <Button small variant="ghost" icon="retry" onClick={() => retry(m.id)}>إعادة</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="ad-muted ad-small">آخر 100 رسالة.</p>
      </Card>
    </div>
  );
}
