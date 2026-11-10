/** نماذج مشتركة في لوحة الإدارة: منتسب، دفعة، حملة، تبرع، قائمة */
import { useState, type FormEvent } from "react";
import { membershipConfig as cfg } from "../config";
import { useDb } from "../hooks/useDb";
import { addDonation, addMemberByAdmin, recordPayment, saveCampaign, saveList, saveMember } from "../services/api";
import { currentMonth, lastMonths, monthLabel } from "../lib/format";
import { toAmount, validateAmount, validateName, validateNni, validatePhone } from "../lib/validation";
import type { Campaign, Member, MemberList } from "../types";
import { Button, Field, Modal } from "../ui";
import { useToast } from "../../../shared/toast";

type Errors = Record<string, string | null>;
const hasErrors = (e: Errors) => Object.values(e).some(Boolean);

export function MemberFormModal({ member, onClose }: { member?: Member; onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  const [f, setF] = useState({
    fullName: member?.fullName ?? "", phone: member?.phone ?? "", nni: member?.nni ?? "", gender: member?.gender ?? ("ذكر" as Member["gender"]),
    birthDate: member?.birthDate ?? "", occupation: member?.occupation ?? cfg.occupations[0], institution: member?.institution ?? "",
    address: member?.address ?? "", pledge: member?.pledge ? String(member.pledge) : "", listId: member?.listId ?? "", notes: member?.notes ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Errors = { fullName: validateName(f.fullName), phone: validatePhone(f.phone), nni: validateNni(f.nni), pledge: validateAmount(f.pledge, { required: false }) };
    const dup = db.members.find((m) => m.phone === f.phone.replace(/\D/g, "") && m.id !== member?.id && m.status !== "rejected");
    if (!errs.phone && dup) errs.phone = `الرقم مسجّل للمنتسب ${dup.code}`;
    setErrors(errs);
    if (hasErrors(errs)) return;
    const data = { ...f, phone: f.phone.replace(/\D/g, ""), pledge: f.pledge ? toAmount(f.pledge) : undefined, listId: f.listId || undefined, notes: f.notes || undefined, nni: f.nni || undefined, birthDate: f.birthDate || undefined, institution: f.institution || undefined, address: f.address || undefined };
    try {
      if (member) { await saveMember({ ...member, ...data }); toast("تم حفظ التعديلات"); }
      else { const m = await addMemberByAdmin(data); toast(`تمت إضافة المنتسب ${m.code}`); }
      onClose();
    } catch (err) { setErrors({ fullName: (err as Error).message }); }
  };

  return (
    <Modal title={member ? `تعديل: ${member.fullName}` : "إضافة منتسب"} onClose={onClose}>
      <form className="ui-form" onSubmit={submit} noValidate>
        <Field label="الاسم الكامل" error={errors.fullName} full>{(id, d) => <input id={id} aria-describedby={d} value={f.fullName} onChange={set("fullName")} />}</Field>
        <Field label="الهاتف" error={errors.phone}>{(id, d) => <input id={id} aria-describedby={d} value={f.phone} onChange={set("phone")} inputMode="tel" dir="ltr" />}</Field>
        <Field label="الرقم الوطني" optional error={errors.nni}>{(id, d) => <input id={id} aria-describedby={d} value={f.nni} onChange={set("nni")} inputMode="numeric" dir="ltr" />}</Field>
        <Field label="الجنس">{(id) => <select id={id} value={f.gender} onChange={set("gender")}><option>ذكر</option><option>أنثى</option></select>}</Field>
        <Field label="تاريخ الميلاد" optional>{(id) => <input id={id} type="date" value={f.birthDate} onChange={set("birthDate")} />}</Field>
        <Field label="الوضعية">{(id) => <select id={id} value={f.occupation} onChange={set("occupation")}>{cfg.occupations.map((o) => <option key={o}>{o}</option>)}</select>}</Field>
        <Field label="الجامعة أو مكان العمل" optional>{(id) => <input id={id} value={f.institution} onChange={set("institution")} />}</Field>
        <Field label="المقاطعة / الحي" optional>{(id) => <input id={id} value={f.address} onChange={set("address")} />}</Field>
        <Field label="الانتساب الشهري" optional error={errors.pledge}>{(id, d) => <input id={id} aria-describedby={d} value={f.pledge} onChange={set("pledge")} inputMode="numeric" dir="ltr" />}</Field>
        <Field label="القائمة">{(id) => <select id={id} value={f.listId} onChange={set("listId")}><option value="">— بدون قائمة —</option>{db.lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.supervisor})</option>)}</select>}</Field>
        <Field label="ملاحظات" optional full>{(id) => <textarea id={id} value={f.notes} onChange={set("notes")} />}</Field>
        <div className="ui-field--full"><Button type="submit" block>{member ? "حفظ" : "إضافة واعتماد"}</Button></div>
      </form>
    </Modal>
  );
}

export function PaymentFormModal({ memberId, month, onClose }: { memberId?: string; month?: string; onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  const approved = db.members.filter((m) => m.status === "approved" || m.id === memberId);
  const first = approved.find((m) => m.id === memberId);
  const months = lastMonths(12).reverse();
  const [f, setF] = useState({ memberId: memberId ?? approved[0]?.id ?? "", month: month ?? currentMonth(), amount: first?.pledge ? String(first.pledge) : "", method: cfg.paymentMethods[cfg.paymentMethods.length - 1], reference: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return; // ضغطة واحدة فقط
    const err = validateAmount(f.amount);
    if (err) return setError(err);
    if (!f.memberId) return setError("اختر المنتسب");
    setSaving(true);
    try { await recordPayment(f); } catch (err) { setSaving(false); return setError((err as Error).message); }
    toast("تم تسجيل الدفعة");
    onClose();
  };
  return (
    <Modal title="تسجيل دفعة انتساب" onClose={onClose}>
      <form className="ui-form" onSubmit={submit} noValidate>
        <Field label="المنتسب" full>{(id) => (
          <select id={id} value={f.memberId} disabled={!!memberId} onChange={(e) => { const m = db.members.find((x) => x.id === e.target.value); setF({ ...f, memberId: e.target.value, amount: m?.pledge ? String(m.pledge) : f.amount }); }}>
            {approved.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.fullName}</option>)}
          </select>
        )}</Field>
        <Field label="الشهر">{(id) => <select id={id} value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })}>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>}</Field>
        <Field label="المبلغ" error={error}>{(id, d) => <input id={id} aria-describedby={d} value={f.amount} onChange={(e) => { setF({ ...f, amount: e.target.value }); setError(null); }} inputMode="numeric" dir="ltr" />}</Field>
        <Field label="طريقة الدفع">{(id) => <select id={id} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{cfg.paymentMethods.map((m) => <option key={m}>{m}</option>)}</select>}</Field>
        <Field label="رقم العملية" optional>{(id) => <input id={id} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} dir="ltr" />}</Field>
        <div className="ui-field--full"><Button type="submit" block disabled={saving}>{saving ? "جارٍ التسجيل..." : "تسجيل (مؤكدة)"}</Button></div>
      </form>
    </Modal>
  );
}

export function CampaignFormModal({ campaign, onClose }: { campaign?: Campaign; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ title: campaign?.title ?? "", description: campaign?.description ?? "", goal: campaign?.goal ? String(campaign.goal) : "", startDate: campaign?.startDate ?? new Date().toISOString().slice(0, 10), endDate: campaign?.endDate ?? "", active: campaign?.active ?? true });
  const [errors, setErrors] = useState<Errors>({});
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = { title: f.title.trim() ? null : "أدخل عنوان الحملة", goal: validateAmount(f.goal, { required: false }) };
    setErrors(errs);
    if (hasErrors(errs)) return;
    try {
      await saveCampaign({ ...campaign, title: f.title.trim(), description: f.description.trim(), goal: toAmount(f.goal), startDate: f.startDate, endDate: f.endDate || undefined, active: f.active });
    } catch (err) { return setErrors({ title: (err as Error).message }); }
    toast(campaign ? "تم حفظ الحملة" : "تمت إضافة الحملة");
    onClose();
  };
  return (
    <Modal title={campaign ? "تعديل الحملة" : "حملة جديدة"} onClose={onClose}>
      <form className="ui-form" onSubmit={submit} noValidate>
        <Field label="عنوان الحملة" error={errors.title} full>{(id, d) => <input id={id} aria-describedby={d} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
        <Field label="الوصف" optional full>{(id) => <textarea id={id} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
        <Field label="الهدف (أوقية قديمة)" optional hint="اتركه فارغاً إذا لم يكن للحملة هدف محدد" error={errors.goal}>{(id, d) => <input id={id} aria-describedby={d} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} inputMode="numeric" dir="ltr" />}</Field>
        <Field label="الحالة">{(id) => <select id={id} value={f.active ? "1" : "0"} onChange={(e) => setF({ ...f, active: e.target.value === "1" })}><option value="1">جارية</option><option value="0">منتهية</option></select>}</Field>
        <Field label="تاريخ البداية">{(id) => <input id={id} type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />}</Field>
        <Field label="تاريخ النهاية" optional>{(id) => <input id={id} type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />}</Field>
        <div className="ui-field--full"><Button type="submit" block>حفظ</Button></div>
      </form>
    </Modal>
  );
}

export function DonationFormModal({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  const [f, setF] = useState({ memberId: "", donorName: "", donorPhone: "", amount: "", method: cfg.paymentMethods[0], reference: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return; // ضغطة واحدة فقط
    const err = validateAmount(f.amount);
    if (err) return setError(err);
    const m = db.members.find((x) => x.id === f.memberId);
    setSaving(true);
    try {
      await addDonation({ campaignId, ...f, memberId: m?.id, donorName: m?.fullName ?? f.donorName, donorPhone: m?.phone ?? f.donorPhone }, true);
    } catch (err) { setSaving(false); return setError((err as Error).message); }
    toast("تم تسجيل التبرع");
    onClose();
  };
  return (
    <Modal title="تسجيل تبرع" onClose={onClose}>
      <form className="ui-form" onSubmit={submit} noValidate>
        <Field label="المتبرع منتسب؟" full>{(id) => <select id={id} value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })}><option value="">— متبرع من خارج الجمعية —</option>{db.members.filter((m) => m.status === "approved").map((m) => <option key={m.id} value={m.id}>{m.code} — {m.fullName}</option>)}</select>}</Field>
        {!f.memberId && <>
          <Field label="اسم المتبرع" optional>{(id) => <input id={id} value={f.donorName} onChange={(e) => setF({ ...f, donorName: e.target.value })} />}</Field>
          <Field label="الهاتف" optional>{(id) => <input id={id} value={f.donorPhone} onChange={(e) => setF({ ...f, donorPhone: e.target.value })} dir="ltr" inputMode="tel" />}</Field>
        </>}
        <Field label="المبلغ" error={error}>{(id, d) => <input id={id} aria-describedby={d} value={f.amount} onChange={(e) => { setF({ ...f, amount: e.target.value }); setError(null); }} inputMode="numeric" dir="ltr" />}</Field>
        <Field label="طريقة الدفع">{(id) => <select id={id} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{cfg.paymentMethods.map((m) => <option key={m}>{m}</option>)}</select>}</Field>
        <Field label="رقم العملية" optional full>{(id) => <input id={id} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} dir="ltr" />}</Field>
        <div className="ui-field--full"><Button type="submit" block disabled={saving}>{saving ? "جارٍ التسجيل..." : "تسجيل (مؤكد)"}</Button></div>
      </form>
    </Modal>
  );
}

export function ListFormModal({ list, onClose }: { list?: MemberList; onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  // المشرف يجب أن يكون منتسباً لديه حساب دخول، حتى يدخل لوحة «قائمتي» بحسابه
  const candidates = db.members.filter((m) => m.status === "approved" && m.userId);
  const current = candidates.find((m) => m.userId && m.userId === list?.supervisorUserId);
  const [f, setF] = useState({ name: list?.name ?? "", supervisorMemberId: current?.id ?? "" });
  const [errors, setErrors] = useState<Errors>({});
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sup = candidates.find((m) => m.id === f.supervisorMemberId);
    const errs = { name: f.name.trim() ? null : "أدخل اسم القائمة", supervisor: sup ? null : "اختر المشرف" };
    setErrors(errs);
    if (hasErrors(errs) || !sup) return;
    try {
      await saveList({ id: list?.id, name: f.name.trim(), supervisor: sup.fullName, supervisorPhone: sup.phone, supervisorMemberId: sup.id });
    } catch (err) { return setErrors({ name: (err as Error).message }); }
    toast(list ? "تم حفظ القائمة" : "تمت إضافة القائمة");
    onClose();
  };
  return (
    <Modal title={list ? "تعديل القائمة" : "قائمة جديدة"} onClose={onClose}>
      <form className="ui-form" onSubmit={submit} noValidate>
        <Field label="اسم القائمة" error={errors.name} full>{(id, d) => <input id={id} aria-describedby={d} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="المشرف" full error={errors.supervisor} hint="منتسب معتمد لديه حساب؛ يدخل لوحة «قائمتي» برقم هاتفه وكلمة مروره">
          {(id, d) => (
            <select id={id} aria-describedby={d} value={f.supervisorMemberId} onChange={(e) => setF({ ...f, supervisorMemberId: e.target.value })}>
              <option value="">اختر المشرف</option>
              {candidates.map((m) => <option key={m.id} value={m.id}>{m.fullName} — {m.phone}</option>)}
            </select>
          )}
        </Field>
        {candidates.length === 0 && <div className="ui-field--full"><p className="ui-hint">لا يوجد منتسبون معتمدون لديهم حساب بعد. يجب أن يسجّل المشرف من بوابة المنتسبين ثم تقبله.</p></div>}
        <div className="ui-field--full"><Button type="submit" block>حفظ</Button></div>
      </form>
    </Modal>
  );
}
