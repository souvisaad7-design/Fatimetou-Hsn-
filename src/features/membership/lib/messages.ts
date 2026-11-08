import { membershipConfig as cfg } from "../config";
import type { Member, MemberList } from "../types";
import { monthLabel } from "./format";

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const firstName = (full: string) => full.split(" ")[0];

export const reminderMessage = (m: Member, month: string, tpl = cfg.reminderTemplate) =>
  fill(tpl, { name: firstName(m.fullName), month: monthLabel(month), phone: cfg.phone });

export const supervisorMessage = (m: Member, list: MemberList | undefined, count: number, tpl = cfg.supervisorTemplate) =>
  fill(tpl, { supervisor: list ? firstName(list.supervisor) : "", name: m.fullName, memberPhone: m.phone, count: String(count) });

/** رابط فتح تطبيق الرسائل بنص جاهز (يعمل على الهاتف) */
export const smsLink = (phone: string, body: string) => `sms:${phone}?body=${encodeURIComponent(body)}`;
