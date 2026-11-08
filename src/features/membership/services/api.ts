/**
 * واجهة العمليات (API) لنظام لجنة الانتساب.
 * كل الصفحات تتعامل مع هذه الدوال فقط. لربط النظام بخادم (Supabase مثلاً)
 * يُعاد كتابة جسم الدوال بطلبات للخادم، مع الإبقاء على أسمائها وأنواعها.
 */
import { membershipConfig as cfg } from "../config";
import { currentMonth, lastMonths } from "../lib/format";
import { cleanPhone, toAmount } from "../lib/validation";
import type { Campaign, Database, Donation, Member, MemberList, MemberStatus, Payment, RecordStatus } from "../types";
import { seedDatabase } from "../data/seed";
import { store, uid } from "./store";

const now = () => new Date().toISOString();
const done = <T,>(v: T) => Promise.resolve(v);

/* ======================= المنتسبون ======================= */

/** بصمة كلمة السر مع رقم الهاتف (لا نحفظ كلمة السر نفسها) */
export async function hashPin(phone: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`awn:${cleanPhone(phone)}:${pin.trim()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface RegistrationInput {
  fullName: string;
  /** كلمة السر التي يختارها المنتسب للدخول لاحقاً */
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

export async function registerMember(input: RegistrationInput): Promise<Member> {
  const phone = cleanPhone(input.phone);
  const existing = store.get().members.find((m) => m.phone === phone && m.status !== "rejected");
  if (existing) throw new Error("هذا الرقم مسجّل من قبل. ارجع إلى «تسجيل الدخول» وادخل برقمك وكلمة المرور.");
  const pinHash = input.pin ? await hashPin(phone, input.pin) : undefined;

  let created!: Member;
  store.update((db) => {
    const counter = db.counter + 1;
    created = {
      id: uid(),
      code: `${cfg.codePrefix}-${String(counter).padStart(4, "0")}`,
      fullName: input.fullName.trim().replace(/\s+/g, " "),
      phone,
      nni: input.nni ? cleanPhone(input.nni) : undefined,
      gender: input.gender,
      birthDate: input.birthDate || undefined,
      occupation: input.occupation,
      institution: input.institution?.trim() || undefined,
      address: input.address?.trim() || undefined,
      pledge: input.pledge || undefined,
      pinHash,
      status: "pending",
      createdAt: now(),
    };
    return { ...db, counter, members: [created, ...db.members] };
  });
  return created;
}

/**
 * دخول المنتسب برقم هاتفه وكلمة السر.
 * من سُجّل قبل إضافة كلمات السر (أو أضافته اللجنة يدوياً) يدخل برقم المنتسب بدلها.
 */
export async function loginMember(phone: string, secret: string): Promise<Member | null> {
  const p = cleanPhone(phone);
  const candidates = store.get().members.filter((m) => m.phone === p).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const m of candidates) {
    if (m.pinHash) {
      if ((await hashPin(p, secret)) === m.pinHash) return m;
    } else if (findMember(p, secret)?.id === m.id) {
      return m;
    }
  }
  return null;
}

/** دخول المنتسب إلى صفحته برقم الهاتف ورقم المنتسب */
export function findMember(phone: string, code: string): Member | null {
  const p = cleanPhone(phone);
  const c = code.trim().toUpperCase().replace(/\s/g, "");
  const normalized = /^\d+$/.test(c) ? `${cfg.codePrefix}-${c.padStart(4, "0")}` : c;
  return store.get().members.find((m) => m.phone === p && m.code === normalized) ?? null;
}

export function saveMember(member: Member): Promise<Member> {
  store.update((db) => ({ ...db, members: db.members.map((m) => (m.id === member.id ? member : m)) }));
  return done(member);
}

export function addMemberByAdmin(input: RegistrationInput & { listId?: string }): Promise<Member> {
  return registerMember(input).then((m) => setMemberStatus(m.id, "approved", input.listId));
}

export function setMemberStatus(id: string, status: MemberStatus, listId?: string): Promise<Member> {
  let updated!: Member;
  store.update((db) => ({
    ...db,
    members: db.members.map((m) => {
      if (m.id !== id) return m;
      updated = {
        ...m,
        status,
        listId: listId ?? m.listId,
        approvedAt: status === "approved" && !m.approvedAt ? now() : m.approvedAt,
      };
      return updated;
    }),
  }));
  return done(updated);
}

export function deleteMember(id: string): Promise<void> {
  store.update((db) => ({
    ...db,
    members: db.members.filter((m) => m.id !== id),
    payments: db.payments.filter((p) => p.memberId !== id),
    donations: db.donations.map((d) => (d.memberId === id ? { ...d, memberId: undefined } : d)),
  }));
  return done(undefined);
}

/** المنتسب يغيّر مبلغ انتسابه الشهري متى شاء («انتسب حسب قدرتك») */
export function updatePledge(memberId: string, pledge?: number): Promise<void> {
  store.update((db) => ({ ...db, members: db.members.map((m) => (m.id === memberId ? { ...m, pledge: pledge || undefined } : m)) }));
  return done(undefined);
}

/* ======================= القوائم والمشرفون ======================= */

/** دخول المشرف برقم هاتفه المسجّل في قائمته */
export function findSupervisorList(phone: string): MemberList | null {
  const p = cleanPhone(phone);
  return store.get().lists.find((l) => l.supervisorPhone === p) ?? null;
}

export function saveList(list: Omit<MemberList, "id"> & { id?: string }): Promise<MemberList> {
  const item: MemberList = { ...list, id: list.id ?? uid() };
  store.update((db) => ({
    ...db,
    lists: db.lists.some((l) => l.id === item.id) ? db.lists.map((l) => (l.id === item.id ? item : l)) : [...db.lists, item],
  }));
  return done(item);
}

export function deleteList(id: string): Promise<void> {
  store.update((db) => ({
    ...db,
    lists: db.lists.filter((l) => l.id !== id),
    members: db.members.map((m) => (m.listId === id ? { ...m, listId: undefined } : m)),
  }));
  return done(undefined);
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

/** المنتسب يبلغ عن دفعة (تبقى بانتظار تأكيد اللجنة) */
export function reportPayment(input: PaymentInput): Promise<Payment> {
  return addPayment(input, "member", "pending");
}

/** المشرف يسجّل دفعة مستلمة (مؤكدة مباشرة) */
export function recordPayment(input: PaymentInput): Promise<Payment> {
  return addPayment(input, "admin", "confirmed");
}

function addPayment(input: PaymentInput, source: Payment["source"], status: RecordStatus): Promise<Payment> {
  const payment: Payment = {
    id: uid(),
    memberId: input.memberId,
    month: input.month,
    amount: toAmount(input.amount),
    method: input.method,
    reference: input.reference?.trim() || undefined,
    receipt: input.receipt || undefined,
    status,
    source,
    createdAt: now(),
  };
  store.update((db) => ({ ...db, payments: [payment, ...db.payments] }));
  return done(payment);
}

export function setPaymentStatus(id: string, status: RecordStatus): Promise<void> {
  store.update((db) => ({ ...db, payments: db.payments.map((p) => (p.id === id ? { ...p, status } : p)) }));
  return done(undefined);
}

export function deletePayment(id: string): Promise<void> {
  store.update((db) => ({ ...db, payments: db.payments.filter((p) => p.id !== id) }));
  return done(undefined);
}

/* ======================= الحملات والتبرعات ======================= */

export function saveCampaign(c: Omit<Campaign, "id" | "createdAt"> & { id?: string; createdAt?: string }): Promise<Campaign> {
  const item: Campaign = { ...c, id: c.id ?? uid(), createdAt: c.createdAt ?? now() };
  store.update((db) => ({
    ...db,
    campaigns: db.campaigns.some((x) => x.id === item.id)
      ? db.campaigns.map((x) => (x.id === item.id ? item : x))
      : [item, ...db.campaigns],
  }));
  return done(item);
}

export function deleteCampaign(id: string): Promise<void> {
  store.update((db) => ({
    ...db,
    campaigns: db.campaigns.filter((c) => c.id !== id),
    donations: db.donations.filter((d) => d.campaignId !== id),
  }));
  return done(undefined);
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

/** تبرع يبلغ عنه المتبرع (بانتظار التأكيد) أو يسجّله المشرف (مؤكد) */
export function addDonation(input: DonationInput, confirmed = false): Promise<Donation> {
  const d: Donation = {
    id: uid(),
    campaignId: input.campaignId,
    memberId: input.memberId,
    donorName: input.donorName.trim() || "فاعل خير",
    donorPhone: input.donorPhone ? cleanPhone(input.donorPhone) : undefined,
    amount: toAmount(input.amount),
    method: input.method,
    reference: input.reference?.trim() || undefined,
    status: confirmed ? "confirmed" : "pending",
    createdAt: now(),
  };
  store.update((db) => ({ ...db, donations: [d, ...db.donations] }));
  return done(d);
}

export function setDonationStatus(id: string, status: RecordStatus): Promise<void> {
  store.update((db) => ({ ...db, donations: db.donations.map((d) => (d.id === id ? { ...d, status } : d)) }));
  return done(undefined);
}

export function deleteDonation(id: string): Promise<void> {
  store.update((db) => ({ ...db, donations: db.donations.filter((d) => d.id !== id) }));
  return done(undefined);
}

/* ======================= النسخ الاحتياطي ======================= */

export function exportBackup(): string {
  return JSON.stringify(store.get(), null, 2);
}

export function importBackup(json: string): void {
  const data = JSON.parse(json) as Database;
  if (data?.version !== 1 || !Array.isArray(data.members) || !Array.isArray(data.payments)) {
    throw new Error("الملف ليس نسخة احتياطية صالحة لنظام الانتساب.");
  }
  store.replace(data);
}

export function resetDemo(): void {
  store.replace(seedDatabase());
}

export function clearAll(): void {
  store.replace({ version: 1, members: [], lists: [], payments: [], campaigns: [], donations: [], counter: 0 });
}

/* ======================= حسابات ======================= */

export const confirmed = <T extends { status: RecordStatus }>(rows: T[]) => rows.filter((r) => r.status === "confirmed");
export const sum = (rows: Array<{ amount: number }>) => rows.reduce((s, r) => s + r.amount, 0);

export function campaignRaised(db: Database, campaignId: string) {
  return sum(confirmed(db.donations.filter((d) => d.campaignId === campaignId)));
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
