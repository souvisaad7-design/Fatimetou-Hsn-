/**
 * «إدارة الموقع»: المحتوى الذي تتحكم فيه اللجنة من لوحة الإدارة دون برمجة.
 * يُقرأ عند فتح الموقع، ويُطبَّق على النصوص والأرقام وطرق الدفع، ويُعرض في البوابة (إعلانات وصفحات).
 */
import { useSyncExternalStore } from "react";
import { membershipConfig as cfg } from "../config";
import { setTextOverrides } from "../i18n";
import { supabase } from "../services/supabase";

export interface SiteSettings {
  /** أي نص في الموقع (بمفتاحه في القاموس) ← نص اللجنة بالعربية والفرنسية */
  texts?: Record<string, { ar?: string; fr?: string }>;
  /** الأقسام المخفية (مثل home.stats أو nav.campaigns) */
  hidden?: string[];
  /** صورة كبيرة أعلى الصفحة الرئيسية */
  banner?: { image_url?: string; title?: string; link?: string };
  phone?: string;
  payment_methods?: string[];
  email?: string;
  address?: string;
  links?: { facebook?: string; youtube?: string; tiktok?: string; snapchat?: string; whatsapp?: string; website?: string };
}
export interface SitePost { id: string; title: string; body: string; image_url: string | null; link_url: string | null; pinned: boolean; published: boolean; created_at: string }
export interface SitePage { id: string; slug: string; title_ar: string; title_fr: string; body_ar: string; body_fr: string; sort: number; published: boolean }
export interface AssistantFaq { id: string; keywords: string[]; answer_has: string; answer_ar: string; answer_fr: string; active: boolean }

const DEFAULTS = { phone: cfg.phone, paymentMethods: [...cfg.paymentMethods] };

interface SiteState { loaded: boolean; settings: SiteSettings; posts: SitePost[]; pages: SitePage[] }
let state: SiteState = { loaded: false, settings: {}, posts: [], pages: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** تطبيق الإعدادات على الموقع كله (النصوص، رقم الهاتف، طرق الدفع) */
export function applySettings(s: SiteSettings) {
  cfg.phone = /^[234]\d{7}$/.test(s.phone ?? "") ? s.phone! : DEFAULTS.phone;
  const methods = (s.payment_methods ?? []).map((m) => m.trim()).filter(Boolean);
  cfg.paymentMethods = methods.length ? methods : DEFAULTS.paymentMethods;
  setTextOverrides((s.texts ?? {}) as Parameters<typeof setTextOverrides>[0]);
}

export async function loadSite() {
  try {
    const [s, posts, pages] = await Promise.all([
      supabase.from("site_settings").select("data").eq("id", true).maybeSingle(),
      supabase.from("site_posts").select("id, title, body, image_url, link_url, pinned, published, created_at").eq("published", true)
        .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(20),
      supabase.from("site_pages").select("id, slug, title_ar, title_fr, body_ar, body_fr, sort, published").eq("published", true).order("sort").order("created_at"),
    ]);
    const settings = (s.data?.data ?? {}) as SiteSettings;
    applySettings(settings);
    state = { loaded: true, settings, posts: (posts.data ?? []) as SitePost[], pages: (pages.data ?? []) as SitePage[] };
  } catch {
    state = { ...state, loaded: true };
  }
  emit();
}

/** رابط آمن فقط: https أو رابط داخلي يبدأ بـ #/ (يمنع روابط javascript: وغيرها) */
export function safeUrl(u?: string | null): string | undefined {
  const v = (u ?? "").trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(v) || /^#\/[\w\-/]*$/.test(v) ? v : undefined;
}

export function useSite() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => state);
}

/** هل القسم ظاهر؟ (اللجنة تخفي أي قسم من «إدارة الموقع ← الأقسام») */
export function useShow() {
  const { settings } = useSite();
  const hidden = settings.hidden ?? [];
  return (id: string) => !hidden.includes(id);
}

/** رفع صورة إلى مساحة صور الموقع (للجنة فقط). تُصغَّر الصور الكبيرة قبل الرفع. يعيد الرابط العام. */
export async function uploadImage(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error("الصورة يجب أن تكون PNG أو JPG أو WEBP أو GIF");
  let blob: Blob = file;
  let ext = file.type === "image/png" ? "png" : file.type === "image/gif" ? "gif" : file.type === "image/webp" ? "webp" : "jpg";
  if (file.type !== "image/gif") {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      if (scale < 1 || file.size > 900_000) {
        const c = document.createElement("canvas");
        c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
        c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
        blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/jpeg", 0.85));
        ext = "jpg";
      }
    } catch { /* نرفع الملف كما هو */ }
  }
  if (blob.size > 5 * 1024 * 1024) throw new Error("الصورة أكبر من 5 ميغابايت");
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("site").upload(path, blob, { contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}`, upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from("site").getPublicUrl(path).data.publicUrl;
}

/** تنسيق بسيط لنص الصفحات والإعلانات: **غامق**، روابط https، وأسطر */
export function renderRichText(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return esc
    .replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s>])(https:\/\/[^\s<"]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>')
    .replace(/^[-•] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m.replace(/\n/g, "")}</ul>`)
    .replace(/\n/g, "<br />");
}
