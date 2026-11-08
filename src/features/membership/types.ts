/** نماذج بيانات نظام لجنة الانتساب */

export type MemberStatus = "pending" | "approved" | "rejected" | "suspended";
export type RecordStatus = "pending" | "confirmed" | "rejected";
export type Gender = "ذكر" | "أنثى";

export interface Member {
  id: string;
  code: string; // رقم المنتسب: AWN-0001
  fullName: string;
  phone: string; // 8 أرقام
  nni?: string; // الرقم الوطني (اختياري)
  gender: Gender;
  birthDate?: string; // YYYY-MM-DD
  occupation: string;
  institution?: string; // الجامعة أو مكان العمل
  address?: string; // المقاطعة / الحي
  listId?: string; // قائمة المنتسب (يحددها المشرف)
  pledge?: number; // مبلغ الانتساب الشهري الذي يختاره حسب قدرته (اختياري)
  status: MemberStatus;
  createdAt: string; // ISO
  approvedAt?: string;
  notes?: string;
}

/** قائمة منتسبين لها مشرف يجمع الانتساب الشهري */
export interface MemberList {
  id: string;
  name: string;
  supervisor: string;
  supervisorPhone?: string;
}

/** دفعة انتساب شهري */
export interface Payment {
  id: string;
  memberId: string;
  month: string; // YYYY-MM
  amount: number;
  method: string;
  reference?: string;
  /** صورة الإيصال (مضغوطة) يرفعها المنتسب كإثبات للدفع */
  receipt?: string;
  status: RecordStatus;
  source: "member" | "admin"; // أبلغ عنها المنتسب أم سجّلها المشرف
  createdAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  goal: number;
  startDate: string;
  endDate?: string;
  active: boolean;
  createdAt: string;
}

/** تبرع لحملة (من منتسب أو من متبرع خارجي) */
export interface Donation {
  id: string;
  campaignId: string;
  memberId?: string;
  donorName: string;
  donorPhone?: string;
  amount: number;
  method: string;
  reference?: string;
  status: RecordStatus;
  createdAt: string;
}

export interface Database {
  version: 1;
  members: Member[];
  lists: MemberList[];
  payments: Payment[];
  campaigns: Campaign[];
  donations: Donation[];
  counter: number; // لتوليد رقم المنتسب
}
