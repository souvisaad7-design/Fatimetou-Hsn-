/**
 * «إدارة الموقع» — اللجنة تتحكم في محتوى الموقع دون برمجة:
 * معلومات الموقع، الإعلانات، الصفحات، أجوبة المساعد الذكي، وأعضاء اللجنة.
 */
import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../../shared/toast";
import { supabase, errorMessage } from "../../services/supabase";
import { Badge, Button, Card, ConfirmButton, Empty, Field, Notice } from "../../ui";
import { ar, fr } from "../../i18n/dict";
import { applySettings, loadSite, renderRichText, type AssistantFaq, type SitePage, type SitePost, type SiteSettings } from "../../site/siteApi";
import { membershipConfig as cfg } from "../../config";
import "../../site/site.css";

type Tab = "info" | "posts" | "pages" | "faq" | "team";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "info", label: "معلومات الموقع" },
  { id: "posts", label: "الإعلانات" },
  { id: "pages", label: "الصفحات" },
  { id: "faq", label: "أجوبة المساعد" },
  { id: "team", label: "أعضاء اللجنة" },
];

const dateTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/** تنفيذ دالة على الخادم مع رسالة نجاح أو خطأ */
function useRpc() {
  const toast = useToast();
  return useCallback(async (fn: string, args: Record<string, unknown>, ok?: string) => {
    try {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) throw error;
      if (ok) toast(ok);
      return { ok: true as const, data };
    } catch (err) {
      toast(errorMessage(err));
      return { ok: false as const, data: null };
    }
  }, [toast]);
}

export function SiteAdmin() {
  const [tab, setTab] = useState<Tab>("info");
  return (
    <div className="ad-stack">
      <Notice>من هنا تغيّرون محتوى الموقع بأنفسكم: كل تعديل يظهر للمنتسبين مباشرة بعد الحفظ (قد يلزمهم تحديث الصفحة).</Notice>
      <div className="ad-filters" role="tablist">
        {TABS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={`ad-filter${tab === x.id ? " is-active" : ""}`} onClick={() => setTab(x.id)}>{x.label}</button>
        ))}
      </div>
      {tab === "info" ? <InfoTab /> : tab === "posts" ? <PostsTab /> : tab === "pages" ? <PagesTab /> : tab === "faq" ? <FaqTab /> : <TeamTab />}
    </div>
  );
}

/* ================= معلومات الموقع ================= */
const TEXTS: Array<{ key: "org.name" | "org.committee" | "org.motto" | "org.message" | "org.welcome"; label: string; long?: boolean }> = [
  { key: "org.name", label: "اسم الجمعية" },
  { key: "org.committee", label: "اسم اللجنة" },
  { key: "org.motto", label: "العبارة (الشعار المكتوب)" },
  { key: "org.message", label: "رسالة الانتساب", long: true },
  { key: "org.welcome", label: "عبارة الترحيب" },
];
const LINKS: Array<{ key: keyof NonNullable<SiteSettings["links"]>; label: string }> = [
  { key: "facebook", label: "فيسبوك" }, { key: "youtube", label: "يوتيوب" }, { key: "tiktok", label: "تيك توك" },
  { key: "snapchat", label: "سناب شات" }, { key: "whatsapp", label: "واتساب (رابط مجموعة أو قناة)" }, { key: "website", label: "موقع آخر" },
];

function InfoTab() {
  const rpc = useRpc();
  const [s, setS] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void supabase.from("site_settings").select("data").eq("id", true).maybeSingle().then(({ data }) => {
      const d = (data?.data ?? {}) as SiteSettings;
      setS({ ...d, phone: d.phone || cfg.phone, payment_methods: d.payment_methods?.length ? d.payment_methods : [...cfg.paymentMethods] });
    });
  }, []);
  if (!s) return <div className="app-message" aria-busy="true"><span className="app-spinner" aria-hidden="true" /></div>;

  const setText = (key: (typeof TEXTS)[number]["key"], lang: "ar" | "fr", v: string) =>
    setS({ ...s, texts: { ...s.texts, [key]: { ...s.texts?.[key], [lang]: v } } });
  const save = async () => {
    setSaving(true);
    const clean: SiteSettings = { ...s, payment_methods: (s.payment_methods ?? []).map((m) => m.trim()).filter(Boolean) };
    const r = await rpc("save_site_settings", { p: clean }, "تم حفظ معلومات الموقع");
    if (r.ok) { applySettings(clean); void loadSite(); }
    setSaving(false);
  };

  return (
    <>
      <Card title="الأسماء والعبارات">
        <p className="ad-muted ad-small">اترك الخانة فارغة لإبقاء النص الأصلي (يظهر باهتاً داخل الخانة).</p>
        <div className="ui-form">
          {TEXTS.map((x) => (
            <div key={x.key} className="ui-field--full st-admin-pair">
              <Field label={`${x.label} — بالعربية`}>
                {(id) => x.long
                  ? <textarea id={id} rows={2} value={s.texts?.[x.key]?.ar ?? ""} placeholder={ar[x.key]} onChange={(e) => setText(x.key, "ar", e.target.value)} />
                  : <input id={id} value={s.texts?.[x.key]?.ar ?? ""} placeholder={ar[x.key]} onChange={(e) => setText(x.key, "ar", e.target.value)} />}
              </Field>
              <Field label="بالفرنسية" optional>
                {(id) => x.long
                  ? <textarea id={id} rows={2} dir="ltr" value={s.texts?.[x.key]?.fr ?? ""} placeholder={fr[x.key]} onChange={(e) => setText(x.key, "fr", e.target.value)} />
                  : <input id={id} dir="ltr" value={s.texts?.[x.key]?.fr ?? ""} placeholder={fr[x.key]} onChange={(e) => setText(x.key, "fr", e.target.value)} />}
              </Field>
            </div>
          ))}
        </div>
      </Card>

      <Card title="التواصل والدفع">
        <div className="ui-form">
          <Field label="رقم الجمعية (للتواصل ودفع الانتساب)">
            {(id) => <input id={id} value={s.phone ?? ""} inputMode="numeric" dir="ltr" onChange={(e) => setS({ ...s, phone: e.target.value.replace(/\D/g, "").slice(0, 8) })} />}
          </Field>
          <Field label="البريد الإلكتروني" optional>
            {(id) => <input id={id} value={s.email ?? ""} dir="ltr" onChange={(e) => setS({ ...s, email: e.target.value.trim() })} />}
          </Field>
          <Field label="العنوان" optional full>
            {(id) => <input id={id} value={s.address ?? ""} onChange={(e) => setS({ ...s, address: e.target.value })} />}
          </Field>
          <Field label="طرق الدفع (كل طريقة في سطر)" full>
            {(id) => <textarea id={id} rows={5} value={(s.payment_methods ?? []).join("\n")} onChange={(e) => setS({ ...s, payment_methods: e.target.value.split("\n") })} />}
          </Field>
        </div>
      </Card>

      <Card title="روابط التواصل الاجتماعي (تظهر أسفل البوابة)">
        <div className="ui-form">
          {LINKS.map((l) => (
            <Field key={l.key} label={l.label} optional>
              {(id) => <input id={id} value={s.links?.[l.key] ?? ""} dir="ltr" placeholder="https://" onChange={(e) => setS({ ...s, links: { ...s.links, [l.key]: e.target.value.trim() } })} />}
            </Field>
          ))}
        </div>
      </Card>

      <div className="ad-toolbar">
        <Button icon="check" onClick={() => void save()} disabled={saving || !/^[234]\d{7}$/.test(s.phone ?? "")}>{saving ? "جارٍ الحفظ..." : "حفظ معلومات الموقع"}</Button>
      </div>
    </>
  );
}

/* ================= الإعلانات ================= */
const EMPTY_POST = { id: "", title: "", body: "", image_url: "", link_url: "", pinned: false, published: true };

function PostsTab() {
  const rpc = useRpc();
  const [items, setItems] = useState<SitePost[]>([]);
  const [f, setF] = useState(EMPTY_POST);
  const load = useCallback(async () => {
    const { data } = await supabase.from("site_posts").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
    setItems((data ?? []) as SitePost[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    const r = await rpc("save_site_post", { p: f }, f.id ? "تم تعديل الإعلان" : "نُشر الإعلان للمنتسبين");
    if (r.ok) { setF(EMPTY_POST); await load(); void loadSite(); }
  };
  return (
    <div className="ad-grid-2">
      <Card title={f.id ? "تعديل إعلان" : "إعلان جديد"}>
        <div className="ui-form">
          <Field label="العنوان" full>{(id) => <input id={id} value={f.title} maxLength={160} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثال: اجتماع عام يوم الجمعة" />}</Field>
          <Field label="النص" full>{(id) => <textarea id={id} rows={6} value={f.body} maxLength={4000} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field>
          <Field label="رابط صورة" optional full>{(id) => <input id={id} value={f.image_url} dir="ltr" placeholder="https://…jpg" onChange={(e) => setF({ ...f, image_url: e.target.value.trim() })} />}</Field>
          <Field label="رابط «المزيد»" optional full>{(id) => <input id={id} value={f.link_url} dir="ltr" placeholder="https://" onChange={(e) => setF({ ...f, link_url: e.target.value.trim() })} />}</Field>
          <label className="ui-check"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /><span>📌 تثبيت في الأعلى</span></label>
          <label className="ui-check"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /><span>منشور (يظهر للمنتسبين)</span></label>
          <p className="ui-field--full ad-muted ad-small">تنسيق النص: **كلمة** للخط الغامق، و«- » في أول السطر لقائمة نقاط، والروابط https تصبح قابلة للضغط.</p>
          <div className="ui-field--full ad-toolbar">
            <Button icon="check" disabled={f.title.trim().length < 2} onClick={() => void save()}>{f.id ? "حفظ التعديل" : "نشر الإعلان"}</Button>
            {f.id && <Button variant="ghost" onClick={() => setF(EMPTY_POST)}>إلغاء</Button>}
          </div>
        </div>
      </Card>
      <Card title="الإعلانات">
        {items.length === 0 ? <Empty icon="megaphone" title="لا توجد إعلانات" /> : (
          <ul className="lv-admin-list">
            {items.map((p) => (
              <li key={p.id}>
                <div>
                  <b>{p.pinned ? "📌 " : ""}{p.title}</b>
                  <span className="ad-muted ad-small">{dateTime(p.created_at)} {p.published ? "" : "· مخفي"}</span>
                </div>
                <div className="ad-toolbar">
                  <Button small variant="ghost" icon="edit" onClick={() => setF({ id: p.id, title: p.title, body: p.body, image_url: p.image_url ?? "", link_url: p.link_url ?? "", pinned: p.pinned, published: p.published })}>تعديل</Button>
                  <ConfirmButton label="حذف" confirmLabel="تأكيد الحذف" onConfirm={() => void rpc("delete_site_post", { p_id: p.id }, "حُذف الإعلان").then((r) => { if (r.ok) { void load(); void loadSite(); } })} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ================= الصفحات ================= */
const EMPTY_PAGE = { id: "", slug: "", title_ar: "", title_fr: "", body_ar: "", body_fr: "", sort: 0, published: true };
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function PagesTab() {
  const rpc = useRpc();
  const [items, setItems] = useState<SitePage[]>([]);
  const [f, setF] = useState(EMPTY_PAGE);
  const [preview, setPreview] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from("site_pages").select("*").order("sort").order("created_at");
    setItems((data ?? []) as SitePage[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    const p = { ...f, slug: f.slug || `page-${Date.now().toString(36)}` };
    const r = await rpc("save_site_page", { p }, f.id ? "تم حفظ الصفحة" : "أُضيفت الصفحة إلى البوابة");
    if (r.ok) { setF(EMPTY_PAGE); await load(); void loadSite(); }
  };
  return (
    <div className="ad-stack">
      <Card title={f.id ? "تعديل صفحة" : "صفحة جديدة"}>
        <div className="ui-form">
          <Field label="عنوان الصفحة بالعربية">{(id) => <input id={id} value={f.title_ar} maxLength={80} onChange={(e) => setF({ ...f, title_ar: e.target.value })} placeholder="مثال: النظام الداخلي" />}</Field>
          <Field label="العنوان بالفرنسية" optional>{(id) => <input id={id} dir="ltr" value={f.title_fr} maxLength={80} onChange={(e) => setF({ ...f, title_fr: e.target.value, slug: f.id || f.slug ? f.slug : slugify(e.target.value) })} />}</Field>
          <Field label="المحتوى بالعربية" full>{(id) => <textarea id={id} rows={10} value={f.body_ar} onChange={(e) => setF({ ...f, body_ar: e.target.value })} />}</Field>
          <Field label="المحتوى بالفرنسية" optional full>{(id) => <textarea id={id} rows={6} dir="ltr" value={f.body_fr} onChange={(e) => setF({ ...f, body_fr: e.target.value })} />}</Field>
          <Field label="الرابط المختصر (بالإنجليزية)" optional>{(id) => <input id={id} dir="ltr" value={f.slug} placeholder="reglement" onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} />}</Field>
          <Field label="الترتيب" optional>{(id) => <input id={id} type="number" value={f.sort} onChange={(e) => setF({ ...f, sort: Number(e.target.value) || 0 })} />}</Field>
          <label className="ui-check"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /><span>منشورة (تظهر في البوابة)</span></label>
          <p className="ui-field--full ad-muted ad-small">تنسيق: «## عنوان» لعنوان فرعي، **كلمة** للغامق، «- » لقائمة نقاط.</p>
          <div className="ui-field--full ad-toolbar">
            <Button icon="check" disabled={f.title_ar.trim().length < 2} onClick={() => void save()}>{f.id ? "حفظ الصفحة" : "إضافة الصفحة"}</Button>
            <Button variant="ghost" icon="eye" onClick={() => setPreview(!preview)}>{preview ? "إخفاء المعاينة" : "معاينة"}</Button>
            {f.id && <Button variant="ghost" onClick={() => setF(EMPTY_PAGE)}>إلغاء</Button>}
          </div>
          {preview && <div className="ui-field--full st-page"><h2>{f.title_ar}</h2><div className="st-rich" dangerouslySetInnerHTML={{ __html: renderRichText(f.body_ar) }} /></div>}
        </div>
      </Card>
      <Card title="صفحات الموقع">
        {items.length === 0 ? <Empty icon="list" title="لا توجد صفحات بعد" /> : (
          <ul className="lv-admin-list">
            {items.map((p) => (
              <li key={p.id}>
                <div><b>{p.title_ar}</b><span className="ad-muted ad-small" dir="ltr">#/p/{p.slug} {p.published ? "" : "· مخفية"}</span></div>
                <div className="ad-toolbar">
                  <a className="ui-btn ui-btn--ghost ui-btn--sm" href={`../#/p/${p.slug}`} target="_blank" rel="noopener noreferrer">فتح</a>
                  <Button small variant="ghost" icon="edit" onClick={() => setF({ id: p.id, slug: p.slug, title_ar: p.title_ar, title_fr: p.title_fr, body_ar: p.body_ar, body_fr: p.body_fr, sort: p.sort, published: p.published })}>تعديل</Button>
                  <ConfirmButton label="حذف" confirmLabel="تأكيد الحذف" onConfirm={() => void rpc("delete_site_page", { p_id: p.id }, "حُذفت الصفحة").then((r) => { if (r.ok) { void load(); void loadSite(); } })} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ================= أجوبة المساعد ================= */
const EMPTY_FAQ = { id: "", keywords: "", answer_has: "", answer_ar: "", answer_fr: "", active: true };

function FaqTab() {
  const rpc = useRpc();
  const [items, setItems] = useState<AssistantFaq[]>([]);
  const [f, setF] = useState(EMPTY_FAQ);
  const load = useCallback(async () => {
    const { data } = await supabase.from("assistant_faq").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as AssistantFaq[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    const keywords = f.keywords.split(/[,،\n]/).map((k) => k.trim()).filter((k) => k.length >= 2);
    const r = await rpc("save_assistant_faq", { p: { ...f, keywords } }, f.id ? "تم تعديل الجواب" : "أُضيف الجواب إلى المساعد");
    if (r.ok) { setF(EMPTY_FAQ); await load(); }
  };
  return (
    <div className="ad-grid-2">
      <Card title={f.id ? "تعديل جواب" : "سؤال وجواب جديد للمساعد"}>
        <div className="ui-form">
          <Field label="كلمات السؤال (افصل بينها بفاصلة)" full>
            {(id) => <input id={id} value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} placeholder="مثال: اجتماع، موعد الاجتماع، اجتماع عام" />}
          </Field>
          <Field label="الجواب (بالحسانية أو العربية)" full>{(id) => <textarea id={id} rows={4} value={f.answer_has} maxLength={2000} onChange={(e) => setF({ ...f, answer_has: e.target.value })} />}</Field>
          <Field label="الجواب بالفصحى" optional full>{(id) => <textarea id={id} rows={3} value={f.answer_ar} maxLength={2000} onChange={(e) => setF({ ...f, answer_ar: e.target.value })} />}</Field>
          <Field label="الجواب بالفرنسية" optional full>{(id) => <textarea id={id} rows={3} dir="ltr" value={f.answer_fr} maxLength={2000} onChange={(e) => setF({ ...f, answer_fr: e.target.value })} />}</Field>
          <label className="ui-check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /><span>مفعّل</span></label>
          <p className="ui-field--full ad-muted ad-small">إذا كتب الزائر سؤالاً فيه إحدى هذه الكلمات، يجيبه المساعد بهذا الجواب (قبل الأجوبة الجاهزة).</p>
          <div className="ui-field--full ad-toolbar">
            <Button icon="check" disabled={!f.keywords.trim() || f.answer_has.trim().length < 2} onClick={() => void save()}>{f.id ? "حفظ التعديل" : "إضافة"}</Button>
            {f.id && <Button variant="ghost" onClick={() => setF(EMPTY_FAQ)}>إلغاء</Button>}
            <a className="ui-btn ui-btn--ghost" href="../assistant/" target="_blank" rel="noopener noreferrer">تجربة المساعد</a>
          </div>
        </div>
      </Card>
      <Card title="أجوبة اللجنة">
        {items.length === 0 ? <Empty icon="chat" title="لا توجد أجوبة مضافة" /> : (
          <ul className="lv-admin-list">
            {items.map((q) => (
              <li key={q.id}>
                <div>
                  <b>{q.keywords.join("، ")}</b>
                  <span className="ad-muted ad-small">{q.answer_has.slice(0, 90)}{q.answer_has.length > 90 ? "…" : ""} {q.active ? "" : "· متوقف"}</span>
                </div>
                <div className="ad-toolbar">
                  <Button small variant="ghost" icon="edit" onClick={() => setF({ id: q.id, keywords: q.keywords.join("، "), answer_has: q.answer_has, answer_ar: q.answer_ar, answer_fr: q.answer_fr, active: q.active })}>تعديل</Button>
                  <ConfirmButton label="حذف" confirmLabel="تأكيد الحذف" onConfirm={() => void rpc("delete_assistant_faq", { p_id: q.id }, "حُذف الجواب").then((r) => { if (r.ok) void load(); })} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ================= أعضاء اللجنة ================= */
interface Admin { user_id: string; full_name: string; phone: string; created_at: string; is_me: boolean }

function TeamTab() {
  const rpc = useRpc();
  const [items, setItems] = useState<Admin[]>([]);
  const [phone, setPhone] = useState("");
  const load = useCallback(async () => {
    const r = await rpc("list_committee", {});
    if (r.ok) setItems((r.data ?? []) as Admin[]);
  }, [rpc]);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="ad-grid-2">
      <Card title="إضافة عضو للجنة">
        <div className="ui-form">
          <Field label="رقم هاتفه" full>{(id) => <input id={id} value={phone} inputMode="tel" dir="ltr" placeholder="22 33 44 55" onChange={(e) => setPhone(e.target.value)} />}</Field>
          <p className="ui-field--full ad-muted ad-small">يجب أن يكون له حساب في بوابة المنتسبين (سجّل فيها برقمه). بعد الإضافة يدخل لوحة الإدارة بنفس رقمه وكلمة مروره، ويستطيع كل ما تستطيعه أنت.</p>
          <div className="ui-field--full ad-toolbar">
            <Button icon="plus" disabled={phone.replace(/\D/g, "").length < 8} onClick={() => void rpc("add_committee_member", { p_phone: phone }, "أُضيف العضو إلى اللجنة").then((r) => { if (r.ok) { setPhone(""); void load(); } })}>إضافة للجنة</Button>
          </div>
        </div>
      </Card>
      <Card title={`أعضاء اللجنة (${items.length})`}>
        {items.length === 0 ? <Empty icon="users" title="…" /> : (
          <ul className="lv-admin-list">
            {items.map((a) => (
              <li key={a.user_id}>
                <div><b>{a.full_name}{a.is_me && <> <Badge tone="brand">أنت</Badge></>}</b><span className="ad-muted ad-small num" dir="ltr">{a.phone}</span></div>
                {!a.is_me && <ConfirmButton label="إزالة" confirmLabel="تأكيد الإزالة" onConfirm={() => void rpc("remove_committee_member", { p_user: a.user_id }, "أُزيل من اللجنة").then((r) => { if (r.ok) void load(); })} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
