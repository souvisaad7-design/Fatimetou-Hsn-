/**
 * نسخة محلية من البيانات التي يحق للمستخدم الحالي رؤيتها في Supabase (حسب صلاحياته).
 * الصفحات تقرأ منها عبر useDb()، وكل تعديل يمر عبر services/api.ts ثم يُعاد التحميل.
 */
import type { Campaign, Database, Donation, Member, MemberList, Payment, Profile } from "../types";
import { supabase, errorMessage } from "./supabase";

type Listener = () => void;
const listeners = new Set<Listener>();

const empty = (): Database => ({
  members: [], lists: [], payments: [], campaigns: [], donations: [], campaignTotals: {}, profile: null, status: "idle",
});

let db: Database = empty();
const emit = () => listeners.forEach((l) => l());
const set = (next: Database) => { db = next; emit(); };

/* ---------- تحويل الصفوف إلى أنواع الواجهة ---------- */
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const opt = <T,>(v: T | null | undefined) => (v === null ? undefined : v);

const toMember = (r: Row): Member => ({
  id: r.id, userId: r.user_id, code: r.code, fullName: r.full_name, phone: r.phone, nni: opt(r.nni), gender: r.gender,
  birthDate: opt(r.birth_date), occupation: r.occupation, institution: opt(r.institution), address: opt(r.address),
  listId: opt(r.list_id), pledge: opt(r.pledge), status: r.status, createdAt: r.created_at, approvedAt: opt(r.approved_at), notes: opt(r.notes),
  hasReceipt: r.has_receipt ?? false,
});
const toList = (r: Row): MemberList => ({
  id: r.id, name: r.name, supervisor: r.supervisor_name, supervisorPhone: opt(r.supervisor_phone), supervisorUserId: r.supervisor_user_id,
});
const toPayment = (r: Row): Payment => ({
  id: r.id, memberId: r.member_id, month: r.month, amount: r.amount, method: r.method, reference: opt(r.reference),
  hasReceipt: r.has_receipt, status: r.status, source: r.source, createdAt: r.created_at,
});
const toCampaign = (r: Row): Campaign => ({
  id: r.id, title: r.title, description: r.description, goal: r.goal, startDate: r.start_date, endDate: opt(r.end_date), active: r.active, createdAt: r.created_at,
});
const toDonation = (r: Row): Donation => ({
  id: r.id, campaignId: r.campaign_id, memberId: opt(r.member_id), donorName: r.donor_name, donorPhone: opt(r.donor_phone),
  amount: r.amount, method: r.method, reference: opt(r.reference), status: r.status, createdAt: r.created_at,
});

let inflight: Promise<void> | null = null;

/** تحميل كل ما يحق للمستخدم رؤيته (RLS تتكفل بالتصفية) */
async function load(): Promise<void> {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    set({ ...empty(), status: "ready" });
    return;
  }
  if (db.status === "idle") set({ ...db, status: "loading" });
  try {
    const MEMBER_COLS = "id,user_id,code,full_name,phone,nni,gender,birth_date,occupation,institution,address,list_id,pledge,status,notes,created_at,approved_at,has_receipt";
    const PAYMENT_COLS = "id,member_id,month,amount,method,reference,has_receipt,status,source,created_at";
    const [profile, members, lists, payments, campaigns, donations, totals] = await Promise.all([
      supabase.rpc("my_profile"),
      supabase.from("members").select(MEMBER_COLS).order("created_at", { ascending: false }),
      supabase.from("lists").select("*").order("created_at"),
      supabase.from("payments").select(PAYMENT_COLS).order("created_at", { ascending: false }),
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("donations").select("*").order("created_at", { ascending: false }),
      supabase.rpc("campaign_totals"),
    ]);
    const firstError = [profile, members, lists, payments, campaigns, donations, totals].find((r) => r.error)?.error;
    if (firstError) throw firstError;
    const p = profile.data as { member_id: string | null; is_admin: boolean; list_ids: string[]; admins_exist: boolean };
    const prof: Profile = { memberId: p.member_id, isAdmin: p.is_admin, listIds: p.list_ids ?? [], adminsExist: p.admins_exist };
    const campaignTotals: Database["campaignTotals"] = {};
    for (const t of (totals.data ?? []) as Row[]) campaignTotals[t.campaign_id] = { raised: Number(t.raised), donors: t.donors };
    set({
      members: (members.data ?? []).map(toMember),
      lists: (lists.data ?? []).map(toList),
      payments: (payments.data ?? []).map(toPayment),
      campaigns: (campaigns.data ?? []).map(toCampaign),
      donations: (donations.data ?? []).map(toDonation),
      campaignTotals,
      profile: prof,
      status: "ready",
    });
  } catch (err) {
    set({ ...db, status: db.status === "ready" ? "ready" : "error", error: errorMessage(err) });
  }
}

export const store = {
  get: () => db,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  /** إعادة تحميل البيانات من الخادم (طلب واحد في الوقت نفسه) */
  refresh(): Promise<void> {
    if (!inflight) inflight = load().finally(() => { inflight = null; });
    return inflight;
  },
  reset() { set({ ...empty(), status: "ready" }); },
};

// تحديث دوري لرؤية الطلبات والدفعات الجديدة من الأجهزة الأخرى
if (typeof window !== "undefined") {
  window.setInterval(() => {
    if (document.visibilityState === "visible" && db.profile) void store.refresh();
  }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && db.profile) void store.refresh();
  });
}
