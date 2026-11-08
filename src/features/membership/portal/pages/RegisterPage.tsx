import { useState, type FormEvent } from "react";
import { membershipConfig as cfg } from "../../config";
import { registerMember } from "../../services/api";
import { validateAmount, validateName, validateNni, validatePhone, validatePin, toAmount } from "../../lib/validation";
import type { Member } from "../../types";
import { Button, Card, Field } from "../../ui";

const empty = { fullName: "", phone: "", pin: "", pin2: "", nni: "", gender: "ذكر" as Member["gender"], birthDate: "", occupation: cfg.occupations[0], institution: "", address: "", pledge: "" };

/** استمارة المستخدم الجديد؛ بعد الإرسال يبقى الطلب «قيد المراجعة» حتى تقبله اللجنة أو المشرف */
export function RegisterPage({ onDone, onBack }: { onDone: (m: Member) => void; onBack: () => void }) {
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [pledgeOk, setPledgeOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: null }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = {
      fullName: validateName(f.fullName),
      phone: validatePhone(f.phone),
      pin: validatePin(f.pin),
      pin2: f.pin && f.pin !== f.pin2 ? "كلمتا المرور غير متطابقتين" : null,
      nni: validateNni(f.nni),
      pledge: validateAmount(f.pledge, { required: false }),
      agree: pledgeOk ? null : "يجب الموافقة على التعهد",
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      const m = await registerMember({ ...f, pledge: f.pledge ? toAmount(f.pledge) : undefined });
      onDone(m);
    } catch (err) {
      setErrors({ phone: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-stack">
      <div>
        <button type="button" className="pt-back" onClick={onBack}>→ رجوع</button>
        <h1 className="pt-h1">مستخدم جديد</h1>
        <p className="pt-muted">املأ بياناتك كما في بطاقة التعريف. يُراجع طلبك من اللجنة الانتسابية أو المشرف، ولا تدخل الموقع إلا بعد قبوله.</p>
      </div>
      <Card>
        <form className="ui-form" onSubmit={submit} noValidate>
          <Field label="الاسم الكامل" error={errors.fullName} full>
            {(id, d) => <input id={id} aria-describedby={d} value={f.fullName} onChange={set("fullName")} autoComplete="name" />}
          </Field>
          <Field label="رقم الهاتف" hint="8 أرقام" error={errors.phone}>
            {(id, d) => <input id={id} aria-describedby={d} value={f.phone} onChange={set("phone")} inputMode="tel" dir="ltr" autoComplete="tel" placeholder="22 33 44 55" />}
          </Field>
          <Field label="كلمة المرور" hint="6 أحرف أو أرقام على الأقل، للدخول لاحقاً" error={errors.pin}>
            {(id, d) => <input id={id} aria-describedby={d} type="password" value={f.pin} onChange={set("pin")} autoComplete="new-password" dir="ltr" />}
          </Field>
          <Field label="تأكيد كلمة المرور" error={errors.pin2}>
            {(id, d) => <input id={id} aria-describedby={d} type="password" value={f.pin2} onChange={set("pin2")} autoComplete="new-password" dir="ltr" />}
          </Field>
          <Field label="الرقم الوطني" optional error={errors.nni}>
            {(id, d) => <input id={id} aria-describedby={d} value={f.nni} onChange={set("nni")} inputMode="numeric" dir="ltr" maxLength={10} />}
          </Field>
          <Field label="الجنس">
            {() => (
              <div className="ui-choices">
                {(["ذكر", "أنثى"] as const).map((g) => (
                  <label key={g} className="ui-choice"><input type="radio" name="gender" checked={f.gender === g} onChange={() => setF((v) => ({ ...v, gender: g }))} /> {g}</label>
                ))}
              </div>
            )}
          </Field>
          <Field label="تاريخ الميلاد" optional>
            {(id) => <input id={id} type="date" value={f.birthDate} onChange={set("birthDate")} />}
          </Field>
          <Field label="الوضعية">
            {(id) => (
              <select id={id} value={f.occupation} onChange={set("occupation")}>
                {cfg.occupations.map((o) => <option key={o}>{o}</option>)}
              </select>
            )}
          </Field>
          <Field label="الجامعة أو مكان العمل" optional>
            {(id) => <input id={id} value={f.institution} onChange={set("institution")} />}
          </Field>
          <Field label="المقاطعة / الحي" optional>
            {(id) => <input id={id} value={f.address} onChange={set("address")} placeholder="مثال: تفرغ زينة" />}
          </Field>
          <Field label="مبلغ الانتساب الشهري الذي تستطيعه" optional hint={`بالأوقية القديمة — «${cfg.motto}»`} error={errors.pledge}>
            {(id, d) => <input id={id} aria-describedby={d} value={f.pledge} onChange={set("pledge")} inputMode="numeric" dir="ltr" placeholder="مثال: 500" />}
          </Field>
          <div className="ui-field ui-field--full">
            <label className="ui-check">
              <input type="checkbox" checked={pledgeOk} onChange={(e) => { setPledgeOk(e.target.checked); setErrors((x) => ({ ...x, agree: null })); }} />
              أتعهد بصحة بياناتي، وبالالتزام بالنظام الداخلي للجمعية والمساهمة في أنشطتها حسب قدرتي.
            </label>
            {errors.agree && <p className="ui-error" role="alert">{errors.agree}</p>}
          </div>
          <div className="ui-field--full">
            <Button type="submit" block icon="userPlus" disabled={busy}>{busy ? "جارٍ التسجيل..." : "إرسال الطلب"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
