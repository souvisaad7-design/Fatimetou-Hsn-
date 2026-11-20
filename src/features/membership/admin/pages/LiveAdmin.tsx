/**
 * «البث المباشر» — للجنة فقط. البث من الموقع نفسه (كاميرا/مايكروفون/مشاركة الشاشة) عبر LiveKit،
 * ويشاهده المنتسبون المعتمدون فقط داخل بوابة المنتسبين.
 */
import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../../shared/toast";
import { supabase, errorMessage } from "../../services/supabase";
import { Badge, Button, Card, ConfirmButton, Empty, Field, Notice } from "../../ui";
import { LiveComments } from "../../live/LiveComments";
import { LiveStage } from "../../live/LiveStage";
import { fetchSessions, type LiveSession } from "../../live/liveApi";
import "../../live/live.css";

interface LiveSettings { livekit_url: string | null; comments_enabled: boolean; connected_at: string | null }

const dateTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
/** قيمة حقل datetime-local من تاريخ ISO (بالتوقيت المحلي) */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const duration = (a: string | null, b: string | null) => {
  if (!a || !b) return "—";
  const m = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} س ${m % 60} د` : `${m} د`;
};
/** رابط LiveKit كما يقبله الخادم: wss://… بلا مسافات ولا «/» في آخره (ويقبل https:// فيحوّله) */
const normalizeUrl = (u: string) => u.trim().replace(/^https:\/\//i, "wss://").replace(/\/+$/, "");
/** المفاتيح حروف وأرقام فقط: نحذف أي مسافة أو سطر جديد أو حرف خفي يأتي مع النسخ */
const clean = (v: string) => v.replace(/[^A-Za-z0-9]/g, "");
const EMPTY = { id: "", title: "", description: "", scheduled_at: "" };

export function LiveAdmin() {
  const toast = useToast();
  const [settings, setSettings] = useState<LiveSettings | null>(null);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keys, setKeys] = useState({ url: "", key: "", secret: "", show: false, busy: false, editing: false });
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, list] = await Promise.all([supabase.from("live_settings").select("livekit_url, comments_enabled, connected_at").eq("id", true).single(), fetchSessions()]);
      if (s.error) throw s.error;
      setSettings(s.data as LiveSettings);
      setSessions(list);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (loadError && !settings) return <Card><Notice tone="warn">تعذّر تحميل البث المباشر: {loadError}</Notice></Card>;
  if (!settings) return <div className="app-message" aria-busy="true"><span className="app-spinner" aria-hidden="true" /></div>;

  const live = sessions.find((s) => s.status === "live") ?? null;
  const upcoming = sessions.filter((s) => s.status === "scheduled").sort((a, b) => (a.scheduled_at ?? "9").localeCompare(b.scheduled_at ?? "9"));
  const past = sessions.filter((s) => s.status === "ended");
  const ready = Boolean(settings.connected_at && settings.livekit_url);

  const rpc = async (fn: string, args: Record<string, unknown>, ok: string) => {
    try {
      const { error } = await supabase.rpc(fn, args);
      if (error) throw error;
      toast(ok);
      await load();
      return true;
    } catch (err) {
      toast(errorMessage(err));
      return false;
    }
  };

  const save = async (startNow = false) => {
    setSaving(true);
    try {
      const scheduled = form.scheduled_at ? new Date(form.scheduled_at).toISOString() : "";
      const { data: id, error } = await supabase.rpc("save_live_session", { p: { id: form.id, title: form.title, description: form.description, scheduled_at: scheduled } });
      if (error) throw error;
      if (startNow) {
        const { error: e2 } = await supabase.rpc("set_live_session_status", { p_id: id, p_status: "live" });
        if (e2) throw e2;
        toast("بدأ البث — اضغط «ابدأ البث بالكاميرا»");
      } else toast(form.id ? "تم تعديل البث" : "تم الإعلان عن البث للمنتسبين");
      setForm(EMPTY);
      await load();
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const connect = async () => {
    setKeys((k) => ({ ...k, busy: true }));
    const ok = await rpc("live_set_credentials", { p_url: normalizeUrl(keys.url), p_key: clean(keys.key), p_secret: clean(keys.secret) }, "تم ربط حساب LiveKit وحفظ المفاتيح مشفّرة");
    setKeys(ok ? { url: "", key: "", secret: "", show: false, busy: false, editing: false } : (k) => ({ ...k, busy: false }));
  };

  return (
    <div className="ad-stack">
      <div className="ad-sms-status">
        <span className={`ad-sms-pill ${ready ? "is-on" : "is-warn"}`}>{ready ? "✓ خدمة البث مربوطة" : "لم تُربط خدمة البث (LiveKit) بعد"}</span>
        <span className={`ad-sms-pill ${live ? "is-on" : "is-off"}`}>{live ? "● بث جارٍ الآن" : "○ لا يوجد بث جارٍ"}</span>
        <span className="ad-sms-pill is-off">🔒 للمنتسبين المعتمدين فقط</span>
      </div>

      {/* البث الجاري */}
      {live && (
        <Card title={`🔴 البث الجاري: ${live.title}`} actions={
          <ConfirmButton label="إنهاء البث للجميع" confirmLabel="تأكيد إنهاء البث" variant="danger" icon="stop" small={false}
            onConfirm={() => void rpc("set_live_session_status", { p_id: live.id, p_status: "ended" }, "انتهى البث")} />
        }>
          <div className="lv-layout lv-layout--admin">
            <div className="lv-main">
              <LiveStage key={live.id} role="publisher" sessionId={live.id} />
              <p className="ad-muted ad-small">
                بدأ {live.started_at ? dateTime(live.started_at) : ""}. اضغط «ابدأ البث بالكاميرا» واسمح للمتصفح باستعمال الكاميرا والمايكروفون.
                «قطع الاتصال» يوقف كاميرتك فقط؛ لإنهاء البث للجميع اضغط «إنهاء البث للجميع».
              </p>
              <label className="ui-check">
                <input type="checkbox" checked={settings.comments_enabled} onChange={(e) => void rpc("set_live_comments", { p_enabled: e.target.checked }, e.target.checked ? "فُعّلت التعليقات" : "أُوقفت التعليقات")} />
                <span>السماح للمنتسبين بالتعليق والأسئلة</span>
              </label>
            </div>
            <LiveComments key={live.id} sessionId={live.id} admin enabled={settings.comments_enabled} />
          </div>
        </Card>
      )}

      <div className="ad-grid-2">
        {/* إعلان بث */}
        <Card title={form.id ? "تعديل البث" : "بث جديد"}>
          <div className="ui-form">
            <Field label="عنوان البث" full>
              {(id) => <input id={id} value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: اجتماع اللجنة الشهري مع المنتسبين" />}
            </Field>
            <Field label="الموعد (اختياري)" full>
              {(id) => <input id={id} type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} dir="ltr" />}
            </Field>
            <Field label="وصف قصير" optional full>
              {(id) => <textarea id={id} value={form.description} maxLength={1000} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />}
            </Field>
            <div className="ui-field--full ad-toolbar">
              <Button icon="calendar" disabled={saving || form.title.trim().length < 2} onClick={() => void save(false)}>{form.id ? "حفظ التعديل" : "إعلان البث للمنتسبين"}</Button>
              {!form.id && <Button variant="pink" icon="play" disabled={saving || form.title.trim().length < 2 || !ready} onClick={() => void save(true)}>ابدأ البث الآن</Button>}
              {form.id && <Button variant="ghost" onClick={() => setForm(EMPTY)}>إلغاء</Button>}
            </div>
            {!ready && <p className="ui-field--full ad-muted ad-small">«ابدأ البث الآن» متاح بعد ربط خدمة البث أدناه. يمكنك الإعلان عن موعد البث من الآن.</p>}
          </div>
        </Card>

        {/* القادمة */}
        <Card title="البثوث القادمة">
          {upcoming.length === 0 ? <Empty icon="calendar" title="لا توجد بثوث معلنة" /> : (
            <ul className="lv-admin-list">
              {upcoming.map((s) => (
                <li key={s.id}>
                  <div>
                    <b>{s.title}</b>
                    <span className="ad-muted ad-small">{s.scheduled_at ? dateTime(s.scheduled_at) : "بدون موعد"}</span>
                  </div>
                  <div className="ad-toolbar">
                    <Button small variant="pink" icon="play" disabled={!ready} onClick={() => void rpc("set_live_session_status", { p_id: s.id, p_status: "live" }, "بدأ البث — اضغط «ابدأ البث بالكاميرا»")}>ابدأ الآن</Button>
                    <Button small variant="ghost" icon="edit" onClick={() => setForm({ id: s.id, title: s.title, description: s.description, scheduled_at: toLocalInput(s.scheduled_at) })}>تعديل</Button>
                    <ConfirmButton label="حذف" confirmLabel="تأكيد الحذف" onConfirm={() => void rpc("delete_live_session", { p_id: s.id }, "حُذف البث")} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="ad-muted ad-small">البث المعلن يظهر للمنتسبين في صفحة «البث المباشر» مع عدّ تنازلي.</p>
        </Card>
      </div>

      {/* ربط LiveKit */}
      <Card title="ربط خدمة البث (LiveKit)">
        {ready && !keys.editing ? (
          <div className="ad-toolbar">
            <Badge tone="ok">✓ مربوطة</Badge>
            <span className="ad-muted ad-small">المشروع <code dir="ltr">{settings.livekit_url}</code> — المفاتيح محفوظة مشفّرة منذ {dateTime(settings.connected_at!)}.</span>
            <Button small variant="ghost" icon="edit" onClick={() => setKeys({ ...keys, editing: true })}>تغيير المفاتيح</Button>
          </div>
        ) : (
          <div className="ui-form">
            <ol className="ui-field--full ad-wa-steps">
              <li>أنشئ حساباً مجانياً في <b>cloud.livekit.io</b> ثم أنشئ مشروعاً (Create project).</li>
              <li>من <b>Settings ← Keys</b> اضغط <b>Create key</b>، وانسخ <b>API Key</b> و<b>API Secret</b> (يظهر مرة واحدة).</li>
              <li>انسخ رابط المشروع <b>Project URL</b> الذي يبدأ بـ <code dir="ltr">wss://</code>.</li>
            </ol>
            <Field label="Project URL" full>
              {(id) => <input id={id} value={keys.url} onChange={(e) => setKeys({ ...keys, url: e.target.value.trim() })}
                onBlur={() => setKeys((k) => ({ ...k, url: normalizeUrl(k.url) }))} dir="ltr" placeholder="wss://awn-xxxx.livekit.cloud" autoComplete="off" spellCheck={false} />}
            </Field>
            <Field label="API Key">
              {(id) => <input id={id} value={keys.key} onChange={(e) => setKeys({ ...keys, key: e.target.value })} dir="ltr" autoComplete="off" spellCheck={false} />}
            </Field>
            <Field label="API Secret">
              {(id) => <input id={id} type={keys.show ? "text" : "password"} value={keys.secret} onChange={(e) => setKeys({ ...keys, secret: e.target.value })} dir="ltr" autoComplete="new-password" spellCheck={false} />}
            </Field>
            <div className="ui-field--full ad-toolbar">
              <Button icon="check" disabled={keys.busy || !/^wss:\/\//.test(keys.url) || clean(keys.key).length < 8 || clean(keys.secret).length < 20} onClick={() => void connect()}>{keys.busy ? "جارٍ الحفظ..." : "حفظ وربط"}</Button>
              <Button variant="ghost" onClick={() => setKeys({ ...keys, show: !keys.show })}>{keys.show ? "إخفاء" : "إظهار"}</Button>
              {keys.editing && <Button variant="ghost" onClick={() => setKeys({ url: "", key: "", secret: "", show: false, busy: false, editing: false })}>إلغاء</Button>}
            </div>
            <p className="ui-field--full ad-muted ad-small">تُحفظ مشفّرة على الخادم (Supabase Vault)، ولا تظهر مرة أخرى، ولا توجد في كود الموقع ولا في GitHub.</p>
          </div>
        )}
      </Card>

      {/* الأرشيف */}
      <Card title="البثوث السابقة">
        {past.length === 0 ? <Empty icon="inbox" title="لا توجد بثوث سابقة" /> : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>العنوان</th><th>البداية</th><th>المدة</th><th>أعلى عدد مشاهدين</th><th /></tr></thead>
              <tbody>
                {past.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.title}</b></td>
                    <td className="num">{s.started_at ? dateTime(s.started_at) : "—"}</td>
                    <td className="num">{duration(s.started_at, s.ended_at)}</td>
                    <td className="num">{s.peak_viewers}</td>
                    <td><ConfirmButton label="حذف" confirmLabel="تأكيد الحذف" onConfirm={() => void rpc("delete_live_session", { p_id: s.id }, "حُذف البث وتعليقاته")} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
