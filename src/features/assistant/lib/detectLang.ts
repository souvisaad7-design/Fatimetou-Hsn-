import { normalizeArabic } from "../../../shared/arabic";

/** لغة الرد: الحسانية افتراضياً، والفصحى أو الفرنسية إذا تكلم بها السائل */
export type ReplyLang = "has" | "ar" | "fr";

/** كلمات حسانية واضحة (بعد توحيد الحروف) */
const HASSANIYA = new Set([
  "شنهي", "شنهو", "اشنهي", "اشنهو", "شنو", "اشنو", "منهو", "منهي", "شكون", "كيفاش", "ماهو", "ماهي", "ابلا", "عاد",
  "ذاك", "ذيك", "هاذ", "هاذو", "هاذي", "هاذا", "تبغي", "نبغي", "يبغي", "گول", "نگدر", "تگدر", "نقدر", "تقدر", "وين",
  "اشحال", "لاباس", "فرجني", "عطيني", "گلي", "قلي", "ياسر", "اعل", "اعلي", "مزال", "ننتسب", "نتنسب", "نصوت", "نتبرع",
  "نتواصل", "ندفع", "نترشح", "نعرف", "نسجل", "نشارك", "ندخل", "نتصل", "حد", "ذو",
]);

/** علامات الفصحى */
const FUSHA = new Set([
  "ماذا", "لماذا", "هل", "يمكن", "يمكنني", "يمكننا", "يمكنك", "اود", "اريد", "استطيع", "الذي", "التي", "الذين",
  "انتسب", "اتبرع", "اصوت", "اترشح", "اتواصل", "اسجل", "اشارك", "ادفع", "ارني", "اعرف", "حدثني", "اخبرني", "ليس",
]);
const FUSHA_MA = /(^| )ما (هي|هو|هم|اهداف|ابرز|المناصب|مراحل|شروط|دور|عدد|قيمه|مبلغ)( |$)/;
const FUSHA_MAN = /(^| )من (هو|هي|هم)( |$)/;

export function detectLang(text: string): ReplyLang {
  const latin = (text.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length;
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  if (latin > arabic) return "fr";
  if (/[گڤ]/.test(text)) return "has";
  const q = normalizeArabic(text);
  const words = q.split(" ").filter(Boolean);
  // «فالانتخابات» و«فالمعهد» حسانية؛ الفصحى تقول «في الانتخابات»
  const has = words.filter((w) => HASSANIYA.has(w) || /^فال.{3,}/.test(w)).length;
  const fusha = words.filter((w) => FUSHA.has(w)).length + (FUSHA_MA.test(q) ? 1 : 0) + (FUSHA_MAN.test(q) ? 1 : 0);
  return fusha > has ? "ar" : "has";
}
