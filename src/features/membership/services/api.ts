/**
 * واجهة العمليات (API) لنظام اللجنة الانتسابية — متصلة بـ Supabase.
 * القراءة من store (ما تسمح به صلاحيات المستخدم)، وكل تعديل عبر دوال آمنة في قاعدة البيانات
 * تتحقق من الدور (منتسب، مشرف، مسؤول)، ثم يُعاد تحميل البيانات.
 */
import { membershipConfig as cfg } from "../config";
import { currentMonth, lastMonths } from "../lib/format";
import { cleanPhone, toAmount } from "../lib/validation";
import type { Campaign, Database, Member, MemberList, MemberStatus, Profile, RecordStatus } from "../types";
import { store } from "./store";
import { SUPABASE_KEY, SUPABASE_URL, emailForPhone, errorMessage, supabase } from "./supabase";

async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(errorMessage(error));
  await store.refresh();
  return data;
}

const currentMember = (): Member | null => {
  const db = store.get();
  return db.members.find((m) => m.id === db.profile?.memberId) ?? null;
};

/* ======================= الدخول والتسجيل ======================= */

export interface RegistrationInput {
  fullName: string;
  pin?: string;
  phone: string;
  nni?: string;
  gender: Member["gender"];
  birthDate?: string;
  occupation: string;
  institution?: string;
  address?: string;
  pledge?: number;
}

/** تسجيل مستخدم جديد: ينشئ الحساب والطلب على الخادم، ثم يدخل به (يبقى «قيد المراجعة») */
export async function registerMember(input: RegistrationInput): Promise<Member> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
      body: JSON.stringify({ ...input, phone: cleanPhone(input.phone) }),
    });
  } catch (err) {
    throw new Error(errorMessage(err));
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "تعذّر إرسال الطلب، حاول مرة أخرى.");
  const m = await loginMember(input.phone, input.pin ?? "");
  if (!m) throw new Error("تم إرسال الطلب، لكن تعذّر الدخول. جرّب تسجيل الدخول.");
  return m;
}

/** الدخول برقم الهاتف وكلمة المرور؛ يرجع ملف المنتسب أو null إذا كانت البيانات خاطئة */
export async function loginMember(phone: string, pin: string): Promise<Member | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: emailForPhone(phone), password: pin });
  if (error) {
    if (/Invalid login credentials/i.test(error.message)) return null;
    throw new Error(errorMessage(error));
  }
  await store.refresh();
  return currentMember();
}

/** دخول لوحة الإدارة: يرجع دور المستخدم (مسؤول، مشرف، أو لا صلاحية) */
export async function staffLogin(phone: string, pin: string): Promise<Profile | null> {
  await loginMember(phone, pin);
  return store.get().profile;
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
  store.reset();
}

/** استرجاع جلسة سابقة في هذا التبويب (عند فتح الصفحة) */
export function restoreSession(): Promise<void> {
  return store.refresh();
}

/** أول مستخدم يطلب ذلك يصبح المسؤول الأول (فقط إذا لم يوجد أي مسؤول) */
export async function claimFirstAdmin(): Promise<boolean> {
  return Boolean(await rpc("claim_first_admin"));
}

/* ======================= المنتسبون ======================= */

const memberPayload = (m: Partial<Member> & { id?: string }) => ({
  id: m.id ?? "",
  full_name: m.fullName,
  phone: m.phone ? cleanPhone(m.phone) : m.phone,
  nni: m.nni ?? "",
  gender: m.gender,
  birth_date: m.birthDate ?? "",
  occupation: m.occupation,
  institution: m.institution ?? "",
  address: m.address ?? "",
  list_id: m.listId ?? "",
  pledge: m.pledge ? String(m.pledge) : "",
  notes: m.notes ?? "",
});

export async function saveMember(member: Member): Promise<Member> {
  await rpc("admin_save_member", { p: memberPayload(member) });
  return member;
}

/** المسؤول يضيف منتسباً يدوياً (معتمد، بلا حساب دخول) */
export async function addMemberByAdmin(input: RegistrationInput & { listId?: string; notes?: string }): Promise<Member> {
  const id = (await rpc("admin_save_member", { p: memberPayload(input) })) as string;
  return store.get().members.find((m) => m.id === id) ?? ({ id, code: "", ...input, status: "approved", createdAt: new Date().toISOString() } as Member);
}

/** قبول (مع القائمة) أو رفض أو إيقاف منتسب */
export async function setMemberStatus(id: string, status: MemberStatus, listId?: string): Promise<void> {
  if (status === "approved") await rpc("approve_member", { p_member: id, p_list: listId ?? null });
  else await rpc("set_member_status", { p_member: id, p_status: status });
}

export async function deleteMember(id: string): Promise<void> {
  await rpc("delete_member", { p_member: id });
}

/** المنتسب يغيّر مبلغ انتسابه الشهري متى شاء («انتسب حسب قدرتك») */
export async function updatePledge(_memberId: string, pledge?: number): Promise<void> {
  await rpc("update_my_pledge", { p_pledge: pledge ?? null });
}

/* ======================= القوائم والمشرفون ======================= */

export async function saveList(list: Omit<MemberList, "id"> & { id?: string; supervisorMemberId?: string }): Promise<void> {
  await rpc("save_list", {
    p_id: list.id ?? null,
    p_name: list.name,
    p_supervisor_member: list.supervisorMemberId ?? null,
    p_supervisor_name: list.supervisor,
    p_supervisor_phone: list.supervisorPhone ?? "",
  });
}

export async function deleteList(id: string): Promise<void> {
  await rpc("delete_list", { p_id: id });
}

/* ======================= الانتساب الشهري ======================= */

export interface PaymentInput {
  memberId: string;
  month: string;
  amount: number | string;
  method: string;
  reference?: string;
  receipt?: string;
}

/** المنتسب يبلغ عن دفعة (تبقى بانتظار تأكيد المشرف أو اللجنة) */
export async function reportPayment(input: PaymentInput): Promise<void> {
  await rpc("report_payment", {
    p_month: input.month, p_amount: toAmount(input.amount), p_method: input.method, p_reference: input.reference ?? "", p_receipt: input.receipt ?? "",
  });
}

/** المشرف يسجّل دفعة مستلمة (مؤكدة مباشرة) */
export async function recordPayment(input: PaymentInput): Promise<void> {
  await rpc("record_payment", {
    p_member: input.memberId, p_month: input.month, p_amount: toAmount(input.amount), p_method: input.method, p_reference: input.reference ?? "",
  });
}

export async function setPaymentStatus(id: string, status: RecordStatus): Promise<void> {
  await rpc("set_payment_status", { p_id: id, p_status: status });
}

export async function deletePayment(id: string): Promise<void> {
  await rpc("delete_payment", { p_id: id });
}

/** صورة الإيصال (تُحمَّل عند الحاجة فقط) */
export async function getReceipt(paymentId: string): Promise<string | null> {
  const { data, error } = await supabase.from("payments").select("receipt").eq("id", paymentId).maybeSingle();
  if (error) throw new Error(errorMessage(error));
  return (data?.receipt as string | null) ?? null;
}

/* ======================= الحملات والتبرعات ======================= */

export async function saveCampaign(c: Omit<Campaign, "id" | "createdAt"> & { id?: string; createdAt?: string }): Promise<void> {
  await rpc("save_campaign", {
    p: { id: c.id ?? "", title: c.title, description: c.description, goal: c.goal, start_date: c.startDate, end_date: c.endDate ?? "", active: c.active },
  });
}

export async function deleteCampaign(id: string): Promise<void> {
  await rpc("delete_campaign", { p_id: id });
}

export interface DonationInput {
  campaignId: string;
  memberId?: string;
  donorName: string;
  donorPhone?: string;
  amount: number | string;
  method: string;
  reference?: string;
}

/** تبرع: من المنتسب (بانتظار التأكيد) أو يسجّله المسؤول (مؤكد تلقائياً على الخادم) */
export async function addDonation(input: DonationInput, _confirmed = false): Promise<void> {
  await rpc("add_donation", {
    p_campaign: input.campaignId,
    p_donor_name: input.donorName,
    p_donor_phone: input.donorPhone ? cleanPhone(input.donorPhone) : "",
    p_amount: toAmount(input.amount),
    p_method: input.method,
    p_reference: input.reference ?? "",
    p_member: input.memberId ?? null,
  });
}

export async function setDonationStatus(id: string, status: RecordStatus): Promise<void> {
  await rpc("set_donation_status", { p_id: id, p_status: status });
}

export async function deleteDonation(id: string): Promise<void> {
  await rpc("delete_donation", { p_id: id });
}

/* ======================= التصدير ======================= */

export function exportBackup(): string {
  const { members, lists, payments, campaigns, donations } = store.get();
  return JSON.stringify({ exportedAt: new Date().toISOString(), members, lists, payments, campaigns, donations }, null, 2);
}

/* ======================= حسابات ======================= */

export const confirmed = <T extends { status: RecordStatus }>(rows: T[]) => rows.filter((r) => r.status === "confirmed");
export const sum = (rows: Array<{ amount: number }>) => rows.reduce((s, r) => s + r.amount, 0);

/** ما جُمع للحملة (من الخادم، فيشمل تبرعات الجميع دون كشف أسمائهم) */
export function campaignRaised(db: Database, campaignId: string) {
  return db.campaignTotals[campaignId]?.raised ?? sum(confirmed(db.donations.filter((d) => d.campaignId === campaignId)));
}

export function campaignDonors(db: Database, campaignId: string) {
  return db.campaignTotals[campaignId]?.donors ?? confirmed(db.donations.filter((d) => d.campaignId === campaignId)).length;
}

/** حالة كل شهر للمنتسب: مدفوع / بانتظار التأكيد / غير مدفوع (منذ اعتماده) */
export function memberMonths(db: Database, member: Member, count = 6) {
  const start = (member.approvedAt ?? member.createdAt).slice(0, 7);
  return lastMonths(count).map((month) => {
    const rows = db.payments.filter((p) => p.memberId === member.id && p.month === month && p.status !== "rejected");
    const state =
      month < start ? "before" : rows.some((p) => p.status === "confirmed") ? "paid" : rows.length ? "pending" : "unpaid";
    return { month, state, amount: sum(confirmed(rows)) } as const;
  });
}

/**
 * الالتزام: نسبة الأشهر المدفوعة من الأشهر المستحقة (منذ الاعتماد، في آخر 12 شهراً).
 * يُقاس الانتظام لا قيمة المبلغ: من يدفع 100 كل شهر ملتزم مثل من يدفع 1000.
 */
export function commitment(db: Database, member: Member) {
  const months = memberMonths(db, member, 12).filter((m) => m.state !== "before");
  const paid = months.filter((m) => m.state === "paid").length;
  // الأشهر المتتالية غير المدفوعة حتى الشهر الحالي
  let streakUnpaid = 0;
  for (let i = months.length - 1; i >= 0 && months[i].state === "unpaid"; i--) streakUnpaid++;
  let streakPaid = 0;
  for (let i = months.length - 1; i >= 0 && months[i].state === "paid"; i--) streakPaid++;
  return { due: months.length, paid, pct: months.length ? Math.round((paid / months.length) * 100) : 0, streakUnpaid, streakPaid };
}

/** من لم يدفع شهره الحالي، ومن تأخر عدداً من الأشهر المتتالية (للتذكير وتنبيه المشرفين) */
export function reminderLists(db: Database, listId?: string) {
  const month = currentMonth();
  const approved = db.members.filter((m) => m.status === "approved" && (!listId || m.listId === listId));
  const settled = new Set(db.payments.filter((p) => p.month === month && p.status !== "rejected").map((p) => p.memberId));
  const unpaidThisMonth = approved.filter((m) => !settled.has(m.id));
  const late = approved
    .map((m) => ({ member: m, months: commitment(db, m).streakUnpaid }))
    .filter((x) => x.months >= cfg.lateAfterMonths)
    .sort((a, b) => b.months - a.months);
  return { month, unpaidThisMonth, late };
}

export function dashboardStats(db: Database) {
  const month = currentMonth();
  const approved = db.members.filter((m) => m.status === "approved");
  const paidThisMonth = new Set(confirmed(db.payments.filter((p) => p.month === month)).map((p) => p.memberId));
  return {
    members: db.members.length,
    approved: approved.length,
    pending: db.members.filter((m) => m.status === "pending").length,
    membershipThisMonth: sum(confirmed(db.payments.filter((p) => p.month === month))),
    paidThisMonth: approved.filter((m) => paidThisMonth.has(m.id)).length,
    membershipTotal: sum(confirmed(db.payments)),
    donationsTotal: sum(confirmed(db.donations)),
    activeCampaigns: db.campaigns.filter((c) => c.active).length,
    pendingPayments: db.payments.filter((p) => p.status === "pending").length,
    pendingDonations: db.donations.filter((d) => d.status === "pending").length,
    byMonth: lastMonths(6).map((m) => ({
      month: m,
      membership: sum(confirmed(db.payments.filter((p) => p.month === m))),
      donations: sum(confirmed(db.donations.filter((d) => d.createdAt.slice(0, 7) === m))),
    })),
  };
}
