/**
 * «إدارة الموقع»: المحتوى الذي تتحكم فيه اللجنة من لوحة الإدارة دون برمجة.
 * يُقرأ عند فتح الموقع، ويُطبَّق على النصوص والأرقام وطرق الدفع، ويُعرض في البوابة (إعلانات وصفحات).
 */
import { useSyncExternalStore } from "react";
import { membershipConfig as cfg } from "../config";
import { setTextOverrides } from "../i18n";
import { supabase } from "../services/supabase";

export interface SiteSettings {
  texts?: Partial<Record<"org.name" | "org.committee" | "org.motto" | "org.message" | "org.welcome", { ar?: string; fr?: string }>>;
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
  setTextOverrides(s.texts ?? {});
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

export function useSite() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => state);
}

/** تنسيق بسيط لنص الصفحات والإعلانات: **غامق**، روابط https، وأسطر */
export function renderRichText(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return esc
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^[-•] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m.replace(/\n/g, "")}</ul>`)
    .replace(/\n/g, "<br />");
}
