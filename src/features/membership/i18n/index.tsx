/**
 * اللغة في بوابة المنتسبين: العربية أو الفرنسية.
 * اللغة محفوظة لدى المستخدم، وتغيّر اتجاه الصفحة (RTL / LTR) وكل النصوص.
 */
import { useSyncExternalStore } from "react";
import { ar, fr, MONTHS, type DictKey } from "./dict";

export type Lang = "ar" | "fr";
const KEY = "awn:lang";
const listeners = new Set<() => void>();

const read = (): Lang => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "ar" || v === "fr") return v;
  } catch { /* */ }
  return "ar";
};

let lang: Lang = read();

function applyDocument() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

export const getLang = () => lang;

export function setLang(next: Lang, { persist = true } = {}) {
  lang = next;
  if (persist) {
    try { localStorage.setItem(KEY, next); } catch { /* */ }
  }
  applyDocument();
  listeners.forEach((l) => l());
}

/** يُستدعى عند تشغيل البوابة لتطبيق اللغة المحفوظة */
export function initLang() {
  applyDocument();
}

/** ترجمة نص بمفتاحه، مع استبدال {المتغيرات} */
export function t(key: DictKey, vars?: Record<string, string | number>): string {
  const text = (lang === "fr" ? fr[key] : ar[key]) ?? ar[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "")) : text;
}

/** ترجمة قيمة محفوظة بالعربية (الجنس، الوضعية، طريقة الدفع) عند عرضها */
export function tValue(prefix: "gender" | "occ" | "pay", value: string): string {
  const key = `${prefix}.${value}` as DictKey;
  return key in ar ? t(key) : value;
}

/** رسالة خطأ من الخادم (بالعربية) ← بلغة المستخدم إن كانت معروفة */
export function tServer(message: string): string {
  if (lang === "ar") return message;
  const entry = (Object.keys(ar) as DictKey[]).find((k) => ar[k] === message);
  return entry ? t(entry) : message;
}

export const monthName = (m: number) => MONTHS[lang][m];

/** للمكوّنات: تعيد الرسم عند تغيير اللغة */
export function useLang() {
  const current = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => lang,
    () => lang,
  );
  return { lang: current, t, setLang };
}

/** زر اللغة: زر واحد «العربية | Français»؛ الضغط عليه يبدّل بين اللغتين، واللغة الحالية بارزة */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang: current } = useLang();
  const next: Lang = current === "ar" ? "fr" : "ar";
  const label = (code: Lang, text: string) => (
    <span lang={code} className={current === code ? "is-active" : undefined}>{text}</span>
  );
  return (
    <button
      type="button"
      className={`lang-switch ${className}`}
      onClick={() => setLang(next)}
      aria-label={next === "fr" ? "Passer au français" : "التبديل إلى العربية"}
      title={next === "fr" ? "Français" : "العربية"}
    >
      {label("ar", "العربية")}
      <span className="lang-switch__sep" aria-hidden="true">|</span>
      {label("fr", "Français")}
    </button>
  );
}
