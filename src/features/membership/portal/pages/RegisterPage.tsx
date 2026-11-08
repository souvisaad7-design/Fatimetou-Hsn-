import { useState, type FormEvent } from "react";
import { copyText, useToast } from "../../../../shared/toast";
import { membershipConfig as cfg } from "../../config";
import { registerMember } from "../../services/api";
import { validateAmount, validateName, validateNni, validatePhone, toAmount } from "../../lib/validation";
import type { Member } from "../../types";
import { Button, Card, Field, Notice } from "../../ui";
import { memberSession } from "../session";

const empty = { fullName: "", phone: "", nni: "", gender: "ذكر" as Member["gender"], birthDate: "", occupation: cfg.occupations[0], institution: "", address: "", pledge: "" };

export function RegisterPage({ go }: { go: (to: string) => void }) {
  const toast = useToast();
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [pledgeOk, setPledgeOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Member | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: null }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = {
      fullName: validateName(f.fullName),
      phone: validatePhone(f.phone),
      nni: validateNni(f.nni),
      pledge: validateAmount(f.pledge, { required: false }),
      agree: pledgeOk ? null : "يجب الموافقة على التعهد",
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      const m = await registerMember({ ...f, pledge: f.pledge ? toAmount(f.pledge) : undefined });
      memberSession.set(m.id);
      setDone(m);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrors({ phone: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="pt-success">
        <div className="pt-success__mark">✓</div>
        <h1>تم تسجيل طلبك</h1>
        <p>احفظ رقم المنتسب، فستحتاجه مع رقم هاتفك لمتابعة وضعيتك.</p>
        <div className="pt-code num" dir="ltr">{done.code}</div>
        <Button variant="soft" icon="copy" onClick={async () => toast((await copyText(done.code)) ? "تم نسخ رقم المنتسب" : done.code)}>نسخ الرقم</Button>
        <Notice>طلبك الآن <b>قيد المراجعة</b>. بعد قبوله تُضاف إلى قائمة ومشرف يتابع انتسابك الشهري.</Notice>
        <Button block icon="users" onClick={() => go("status")}>الذهاب إلى وضعيتي</Button>
      </Card>
    );
  }

  return (
    <div className="pt-stack">
      <div>
        <h1 className="pt-h1">التسجيل في الجمعية</h1>
        <p className="pt-muted">املأ بياناتك كما في بطاقة التعريف. القبول يخضع لمراجعة اللجنة الانتسابية.</p>
      </div>
      <Card>
        <form className="ui-form" onSubmit={submit} noValidate>
          <Field label="الاسم الكامل" error={errors.fullName} full>
            {(id, d) => <input id={id} aria-describedby={d} value={f.fullName} onChange={set("fullName")} autoComplete="name" />}
          </Field>
          <Field label="رقم الهاتف" hint="8 أرقام" error={errors.phone}>
            {(id, d) => <input id={id} aria-describedby={d} value={f.phone} onChange={set("phone")} inputMode="tel" dir="ltr" autoComplete="tel" placeholder="22 33 44 55" />}
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
            <Button type="submit" block icon="userPlus" disabled={busy}>{busy ? "جارٍ التسجيل..." : "إرسال طلب الانتساب"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
