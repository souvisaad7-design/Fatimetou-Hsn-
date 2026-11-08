import { membershipConfig as cfg } from "../config";
import type { MemberStatus, RecordStatus } from "../types";

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** 15000 → "15,000 أوقية قديمة" */
export const money = (n: number, withUnit = true) =>
  `${Math.round(n || 0).toLocaleString("en-US")}${withUnit ? ` ${cfg.currency}` : ""}`;

/** "2026-11" → "نوفمبر 2026" */
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
};

export const currentMonth = () => new Date().toISOString().slice(0, 7);

/** آخر n أشهر حتى الشهر الحالي (الأقدم أولاً) */
export function lastMonths(n: number, from = currentMonth()): string[] {
  const [y, m] = from.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

/** "2026-11-08T..." → "08/11/2026" */
export const dateLabel = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export const memberStatusLabel: Record<MemberStatus, string> = {
  pending: "قيد المراجعة",
  approved: "منتسب معتمد",
  rejected: "مرفوض",
  suspended: "موقوف",
};

export const recordStatusLabel: Record<RecordStatus, string> = {
  pending: "بانتظار التأكيد",
  confirmed: "مؤكد",
  rejected: "مرفوض",
};

export const statusTone = (s: MemberStatus | RecordStatus) =>
  s === "approved" || s === "confirmed" ? "ok" : s === "pending" ? "warn" : "bad";

/** إخفاء جزء من رقم الهاتف في الصفحات العامة: 3220••50 */
export const maskPhone = (p?: string) => (p && p.length >= 8 ? `${p.slice(0, 4)}••${p.slice(-2)}` : p ?? "");
