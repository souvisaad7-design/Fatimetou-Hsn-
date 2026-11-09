/** التحقق من المدخلات (رسائل الخطأ بلغة المستخدم) */
import { t } from "../i18n";
export const cleanPhone = (v: string) => v.replace(/\D/g, "");

export function validatePhone(v: string): string | null {
  const p = cleanPhone(v);
  if (!p) return t("v.phoneEmpty");
  if (!/^[234]\d{7}$/.test(p)) return t("v.phoneFormat");
  return null;
}

export function validateName(v: string): string | null {
  const n = v.trim();
  if (!n) return t("v.nameEmpty");
  if (n.split(/\s+/).length < 2) return t("v.nameFull");
  return null;
}

export function validateNni(v: string): string | null {
  if (!v.trim()) return null; // اختياري
  return /^\d{10}$/.test(cleanPhone(v)) ? null : t("v.nni");
}

export function validateAmount(v: string | number, { required = true } = {}): string | null {
  const s = String(v ?? "").replace(/[,\s]/g, "");
  if (!s) return required ? t("v.amountEmpty") : null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return t("v.amountInvalid");
  return null;
}

export const toAmount = (v: string | number) => Number(String(v ?? "").replace(/[,\s]/g, "")) || 0;

export function validatePin(v: string): string | null {
  const p = v.trim();
  if (!p) return t("v.pinEmpty");
  if (p.length < 6) return t("v.pinShort");
  return null;
}
