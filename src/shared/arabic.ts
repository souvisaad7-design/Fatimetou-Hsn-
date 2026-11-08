/** تحويل الأرقام اللاتينية إلى أرقام عربية مشرقية: 2026 → ٢٠٢٦ */
export const toArabicDigits = (value: string | number) => String(value).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

/** توحيد النص العربي للمطابقة: إزالة التشكيل وتوحيد الألف والياء والتاء المربوطة */
export function normalizeArabic(text: string): string {
  return String(text)
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[؟?!.,،؛:"'()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
