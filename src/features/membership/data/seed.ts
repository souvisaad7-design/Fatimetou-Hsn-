/**
 * بيانات تجريبية لأول تشغيل (للعرض فقط). الأسماء وهمية.
 * الحملات مأخوذة من معلومات الجمعية: كفالة المعهد (60,000 + 60,000 + 140,000) ونداء لجنة المرضى (11,000).
 */
import type { Database } from "../types";
import { currentMonth, lastMonths } from "../lib/format";

export function seedDatabase(): Database {
  const now = new Date();
  const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString();
  const months = lastMonths(3);

  const lists = [
    { id: "l1", name: "القائمة الأولى", supervisor: "مشرف تجريبي 1", supervisorPhone: "22000001" },
    { id: "l2", name: "القائمة الثانية", supervisor: "مشرفة تجريبية 2", supervisorPhone: "33000002" },
    { id: "l3", name: "القائمة الثالثة", supervisor: "مشرف تجريبي 3", supervisorPhone: "44000003" },
  ];

  const people: Array<[string, "ذكر" | "أنثى", string, string, string | undefined, number | undefined, string]> = [
    ["أحمد سالم", "ذكر", "22110011", "طالب جامعي", "l1", 1000, "approved"],
    ["مريم محمد", "أنثى", "33110022", "طالب جامعي", "l1", 500, "approved"],
    ["سيدي عبد الله", "ذكر", "44110033", "موظف", "l2", 3000, "approved"],
    ["خديجة أحمد", "أنثى", "22110044", "طالب جامعي", "l2", 1000, "approved"],
    ["محمد الأمين", "ذكر", "33110055", "عامل حر", "l3", 2000, "approved"],
    ["عائشة سيدي", "أنثى", "44110066", "طالب ثانوي", "l3", 200, "approved"],
    ["إبراهيم محمود", "ذكر", "22110077", "طالب جامعي", "l1", undefined, "suspended"],
    ["آمنة الشيخ", "أنثى", "33110088", "طالب جامعي", undefined, 500, "pending"],
    ["عمر يحيى", "ذكر", "44110099", "موظف", undefined, 2000, "pending"],
    ["زينب محمد", "أنثى", "22110100", "بدون عمل", undefined, undefined, "rejected"],
  ];

  const members = people.map(([fullName, gender, phone, occupation, listId, pledge, status], i) => ({
    id: `m${i + 1}`,
    code: `AWN-${String(i + 1).padStart(4, "0")}`,
    fullName,
    gender,
    phone,
    occupation,
    institution: occupation.startsWith("طالب") ? "جامعة نواكشوط" : undefined,
    address: ["تفرغ زينة", "كارفور", "عرفات", "دار النعيم", "لكصر"][i % 5],
    listId,
    pledge,
    status: status as Database["members"][number]["status"],
    createdAt: iso(120 - i * 9),
    approvedAt: status === "approved" || status === "suspended" ? iso(115 - i * 9) : undefined,
  }));

  const payments: Database["payments"] = [];
  let p = 1;
  for (const m of members.filter((x) => x.status === "approved")) {
    months.forEach((month, j) => {
      // بعض الأشهر غير مدفوعة لإظهار المتأخرات
      if ((Number(m.id.slice(1)) + j) % 4 === 0) return;
      payments.push({
        id: `p${p++}`, memberId: m.id, month, amount: m.pledge ?? 500,
        method: j % 2 ? "بنكيلي" : "نقداً عبر المشرف", status: "confirmed", source: "admin", createdAt: iso(60 - j * 25),
      });
    });
  }
  payments.push({ id: `p${p++}`, memberId: "m2", month: currentMonth(), amount: 500, method: "مصرفي", reference: "TX-58213", status: "pending", source: "member", createdAt: iso(1) });

  const campaigns = [
    { id: "c1", title: "كفالة معهد المحجة البيضاء", description: "حملة شهرية لتسيير المعهد: كفالة القسم الأول (60,000) والقسم الثاني (60,000) وتسيير المعهد (140,000)، وكفالة التلميذ 3,000 للكفالة الواحدة.", goal: 260000, startDate: iso(30).slice(0, 10), active: true, createdAt: iso(30) },
    { id: "c2", title: "نداء لجنة المرضى: علاج حالة مرض مزمن", description: "تكلفة دواء حالة إنسانية لمرض مزمن.", goal: 11000, startDate: iso(10).slice(0, 10), active: true, createdAt: iso(10) },
  ];

  const donations: Database["donations"] = [
    { id: "d1", campaignId: "c1", memberId: "m3", donorName: "سيدي عبد الله", amount: 60000, method: "بنكيلي", status: "confirmed", createdAt: iso(20) },
    { id: "d2", campaignId: "c1", donorName: "متبرع من خارج الجمعية", donorPhone: "22999999", amount: 9000, method: "مصرفي", status: "confirmed", createdAt: iso(12) },
    { id: "d3", campaignId: "c1", memberId: "m1", donorName: "أحمد سالم", amount: 3000, method: "السداد", status: "confirmed", createdAt: iso(8) },
    { id: "d4", campaignId: "c2", memberId: "m5", donorName: "محمد الأمين", amount: 5000, method: "بنكيلي", status: "confirmed", createdAt: iso(5) },
    { id: "d5", campaignId: "c2", donorName: "فاعل خير", amount: 2000, method: "غازا بي", reference: "GZ-1102", status: "pending", createdAt: iso(1) },
  ];

  return { version: 1, members, lists, payments, campaigns, donations, counter: members.length };
}
