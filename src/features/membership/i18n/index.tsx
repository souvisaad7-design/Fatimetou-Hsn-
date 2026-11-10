/**
 * اللغة في بوابة المنتسبين: العربية أو الفرنسية.
 * اللغة محفوظة لدى المستخدم، وتغيّر اتجاه الصفحة (RTL / LTR) وكل النصوص.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import "./lang-switch.css";
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

/**
 * زر اللغة: زر واحد صغير (🌐 + اسم اللغة الحالية). الضغط عليه يفتح قائمة فيها «العربية» و«Français»،
 * واختيار لغة يحوّل الموقع إليها مباشرة.
 */
const LANGS: Array<{ code: Lang; label: string }> = [
  { code: "ar", label: "العربية" },
  { code: "fr", label: "Français" },
];

export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang: current } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const choose = (code: Lang) => { setOpen(false); if (code !== current) setLang(code); };
  const currentLabel = LANGS.find((l) => l.code === current)!.label;

  return (
    <div className={`lang-switch ${className}`} ref={ref}>
      <button
        type="button"
        className="lang-switch__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={current === "fr" ? "Langue : Français" : "اللغة: العربية"}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
        <span lang={current}>{currentLabel}</span>
        <svg className="lang-switch__caret" width="10" height="10" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      {open && (
        <div className="lang-switch__menu" role="menu">
          {LANGS.map((l) => (
            <button key={l.code} type="button" role="menuitemradio" aria-checked={l.code === current} lang={l.code} className={l.code === current ? "is-active" : undefined} onClick={() => choose(l.code)}>
              <span>{l.label}</span>
              {l.code === current && <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
