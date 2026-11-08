/** التحقق من المدخلات (رسائل الخطأ بالعربية) */
export const cleanPhone = (v: string) => v.replace(/\D/g, "");

export function validatePhone(v: string): string | null {
  const p = cleanPhone(v);
  if (!p) return "أدخل رقم الهاتف";
  if (!/^[234]\d{7}$/.test(p)) return "رقم الهاتف 8 أرقام ويبدأ بـ 2 أو 3 أو 4";
  return null;
}

export function validateName(v: string): string | null {
  const n = v.trim();
  if (!n) return "أدخل الاسم الكامل";
  if (n.split(/\s+/).length < 2) return "اكتب الاسم الكامل (الاسم واسم الأب على الأقل)";
  return null;
}

export function validateNni(v: string): string | null {
  if (!v.trim()) return null; // اختياري
  return /^\d{10}$/.test(cleanPhone(v)) ? null : "الرقم الوطني 10 أرقام";
}

export function validateAmount(v: string | number, { required = true } = {}): string | null {
  const s = String(v ?? "").replace(/[,\s]/g, "");
  if (!s) return required ? "أدخل المبلغ" : null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return "أدخل مبلغاً صحيحاً أكبر من صفر";
  return null;
}

export const toAmount = (v: string | number) => Number(String(v ?? "").replace(/[,\s]/g, "")) || 0;

export function validatePin(v: string): string | null {
  const p = v.trim();
  if (!p) return "اختر كلمة سر";
  if (p.length < 6) return "كلمة المرور 6 أحرف أو أرقام على الأقل";
  return null;
}
