import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { formSteps, jobs, sources, wilayas } from "../data";
import { submitApplication, type ApplicationData } from "../services/membershipService";
import { validateStep, type Errors } from "../validation";
import { Field } from "./Field";

const initial: ApplicationData = {
  fname: "محمد", lname: "عبد الله", nni: "", dob: "", sex: "ذكر", phone: "", email: "", job: jobs[0],
  wilaya: "", moughataa: "", commune: "", unit: "", address: "", source: sources[0], sponsor: "",
  idcard: null, photo: null,
};

interface Props {
  step: number;
  onStepChange: (step: number) => void;
  onTrack: (ref: string) => void;
}

export function ApplicationForm({ step, onStepChange, onTrack }: Props) {
  const [data, setData] = useState<ApplicationData>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [pledge, setPledge] = useState(false);
  const [sending, setSending] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const set = (key: keyof ApplicationData) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target instanceof HTMLInputElement && e.target.type === "file" ? e.target.files?.[0] ?? null : e.target.value;
    setData((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  // خصائص مشتركة لكل حقل: القيمة، التغيير، وحالة الخطأ
  const bind = (key: Exclude<keyof ApplicationData, "idcard" | "photo">) => ({
    id: key,
    name: key,
    value: data[key],
    onChange: set(key),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": `${key}-err`,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateStep(step, data, pledge);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`#${first}`)?.focus();
      return;
    }
    if (step < 3) {
      onStepChange(step + 1);
      formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    setSending(true);
    try {
      const res = await submitApplication(data);
      setRef(res.ref);
      onStepChange(4);
    } finally {
      setSending(false);
    }
  }

  if (ref) {
    return (
      <div className="form-card">
        <div className="success">
          <div className="mark">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </div>
          <h3>تم تسجيل طلبك</h3>
          <p className="muted">احتفظ برقم الطلب لمتابعة حالته. ستصلك رسالة نصية عند قبوله لتحديد موعد استلام البطاقة.</p>
          <div className="ref">{ref}</div>
          <button type="button" className="btn btn-ghost" onClick={() => onTrack(ref)}>متابعة هذا الطلب</button>
          <p className="hint">هذه واجهة تجريبية: الطلب لا يُرسل إلى أي خادم حتى يتم ربطها بقاعدة بيانات اللجنة.</p>
        </div>
      </div>
    );
  }

  const fileLabel = (f: File | null, empty: string) => (f ? `✓ ${f.name}` : empty);

  return (
    <form ref={formRef} className="form-card" onSubmit={onSubmit} noValidate>
      {step === 0 && (
        <fieldset>
          <legend>{formSteps[0].title}</legend>
          <Field id="fname" label="الاسم الشخصي" error={errors.fname}><input {...bind("fname")} autoComplete="given-name" /></Field>
          <Field id="lname" label="اسم العائلة / الأب" error={errors.lname}><input {...bind("lname")} autoComplete="family-name" /></Field>
          <Field id="nni" label="الرقم الوطني للتعريف" error={errors.nni}><input {...bind("nni")} inputMode="numeric" dir="ltr" maxLength={10} placeholder="10 أرقام" /></Field>
          <Field id="dob" label="تاريخ الميلاد" hint="يشترط بلوغ ١٨ سنة" error={errors.dob}><input {...bind("dob")} type="date" /></Field>
          <div className="full">
            <label>الجنس</label>
            <div className="choice">
              {["ذكر", "أنثى"].map((v) => (
                <label key={v}><input type="radio" name="sex" value={v} checked={data.sex === v} onChange={set("sex")} /> {v}</label>
              ))}
            </div>
          </div>
          <Field id="phone" label="رقم الهاتف" hint="٨ أرقام تبدأ بـ ٢ أو ٣ أو ٤" error={errors.phone}><input {...bind("phone")} type="tel" inputMode="tel" dir="ltr" placeholder="مثال: 22 33 44 55" /></Field>
          <Field id="email" label="البريد الإلكتروني" optional error={errors.email}><input {...bind("email")} type="email" dir="ltr" autoComplete="email" /></Field>
          <Field id="job" label="المهنة" full>
            <select {...bind("job")}>{jobs.map((j) => <option key={j}>{j}</option>)}</select>
          </Field>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset>
          <legend>السكن والوحدة القاعدية</legend>
          <Field id="wilaya" label="الولاية" error={errors.wilaya}>
            <select {...bind("wilaya")}>
              <option value="">اختر الولاية</option>
              {wilayas.map((w) => <option key={w}>{w}</option>)}
            </select>
          </Field>
          <Field id="moughataa" label="المقاطعة" error={errors.moughataa}><input {...bind("moughataa")} /></Field>
          <Field id="commune" label="البلدية" error={errors.commune}><input {...bind("commune")} /></Field>
          <Field id="unit" label="الوحدة القاعدية" optional><input {...bind("unit")} placeholder="يحددها المكتب إن تُركت فارغة" /></Field>
          <Field id="address" label="العنوان التفصيلي" optional full><textarea {...bind("address")} rows={2} /></Field>
          <div className="full">
            <label>كيف عرفت عن الحملة؟</label>
            <div className="choice">
              {sources.map((v) => (
                <label key={v}><input type="radio" name="source" value={v} checked={data.source === v} onChange={set("source")} /> {v}</label>
              ))}
            </div>
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset>
          <legend>الوثائق</legend>
          {(["idcard", "photo"] as const).map((k) => (
            <div className="full" key={k}>
              <label htmlFor={k}>{k === "idcard" ? "صورة بطاقة التعريف (الوجهان)" : "صورة شخصية"}</label>
              <label className={`drop${data[k] ? " has" : ""}`} htmlFor={k}>
                {fileLabel(data[k], k === "idcard" ? "اضغط لاختيار ملف — JPG أو PNG أو PDF حتى ٥ ميغابايت" : "اضغط لاختيار صورة — خلفية فاتحة ووجه واضح")}
              </label>
              <input id={k} name={k} type="file" accept={k === "idcard" ? "image/*,application/pdf" : "image/*"} hidden onChange={set(k)} />
              <div className="err">{errors[k]}</div>
            </div>
          ))}
          <Field id="sponsor" label="رقم عضوية المزكّي" optional full><input {...bind("sponsor")} dir="ltr" placeholder="INT-2026-00000" /></Field>
        </fieldset>
      )}

      {step === 3 && (
        <fieldset>
          <legend>مراجعة البيانات</legend>
          <dl className="review full">
            {[
              ["الاسم الكامل", `${data.fname} ${data.lname}`],
              ["الرقم الوطني", data.nni],
              ["تاريخ الميلاد", data.dob],
              ["الجنس", data.sex],
              ["الهاتف", data.phone],
              ["المهنة", data.job],
              ["الولاية", data.wilaya],
              ["المقاطعة / البلدية", `${data.moughataa} — ${data.commune}`],
              ["الوحدة القاعدية", data.unit || "يحددها المكتب"],
              ["الوثائق", [data.idcard?.name, data.photo?.name].filter(Boolean).join("، ")],
            ].map(([k, v]) => (
              <div key={k} className="review__row"><dt>{k}</dt><dd>{v || "—"}</dd></div>
            ))}
          </dl>
          <div className="full">
            <label className="check" htmlFor="pledge">
              <input type="checkbox" id="pledge" checked={pledge} onChange={(e) => { setPledge(e.target.checked); setErrors((er) => ({ ...er, pledge: undefined })); }} />
              أتعهد بصحة البيانات المقدمة، وأقرّ باطلاعي على النظام الأساسي والنظام الداخلي والتزامي بهما.
            </label>
            <div className="err">{errors.pledge}</div>
          </div>
        </fieldset>
      )}

      <div className="form-nav">
        {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => onStepChange(step - 1)}>السابق</button> : <span />}
        <button type="submit" className="btn btn-primary" disabled={sending}>
          {step === 3 ? (sending ? "جارٍ الإرسال..." : "إرسال الطلب") : "التالي"}
        </button>
      </div>
    </form>
  );
}
