import { useState, type FormEvent } from "react";
import { membershipConfig as cfg } from "../../config";
import { registerMember } from "../../services/api";
import { compressImage } from "../../lib/image";
import { validateAmount, validateName, validateNni, validatePhone, validatePin, toAmount } from "../../lib/validation";
import type { Member } from "../../types";
import { t, tServer, tValue, useLang } from "../../i18n";
import { Button, Card, Field } from "../../ui";

const empty = { fullName: "", phone: "", pin: "", pin2: "", nni: "", gender: "ذكر" as Member["gender"], birthDate: "", occupation: cfg.occupations[0], institution: "", address: "", pledge: "" };

/** استمارة المستخدم الجديد؛ بعد الإرسال يبقى الطلب «قيد المراجعة» حتى تقبله اللجنة أو المشرف */
export function RegisterPage({ onDone, onBack }: { onDone: (m: Member) => void; onBack: () => void }) {
  useLang();
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [pledgeOk, setPledgeOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string>();
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const onReceipt = async (file?: File) => {
    setReceiptError(null);
    if (!file) return;
    try { setReceipt(await compressImage(file)); } catch (err) { setReceipt(undefined); setReceiptError((err as Error).message); }
  };
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
      pin2: f.pin && f.pin !== f.pin2 ? t("reg.mismatch") : null,
      nni: validateNni(f.nni),
      pledge: validateAmount(f.pledge, { required: false }),
      agree: pledgeOk ? null : t("reg.agreeError"),
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      const m = await registerMember({ ...f, pledge: f.pledge ? toAmount(f.pledge) : undefined, receipt });
      onDone(m);
    } catch (err) {
      setErrors({ phone: tServer((err as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-stack">
      <div>
        <button type="button" className="pt-back" onClick={onBack}>{t("common.back")}</button>
        <h1 className="pt-h1">{t("reg.title")}</h1>
        <p className="pt-muted">{t("reg.intro")}</p>
      </div>
      <Card>
        <form className="ui-form" onSubmit={submit} noValidate>
          <Field label={t("reg.fullName")} error={errors.fullName} full>
            {(id, d) => <input id={id} aria-describedby={d} value={f.fullName} onChange={set("fullName")} autoComplete="name" />}
          </Field>
          <Field label={t("reg.phone")} hint={t("reg.phoneHint")} error={errors.phone}>
            {(id, d) => <input id={id} aria-describedby={d} value={f.phone} onChange={set("phone")} inputMode="tel" dir="ltr" autoComplete="tel" placeholder="22 33 44 55" />}
          </Field>
          <Field label={t("reg.password")} hint={t("reg.passwordHint")} error={errors.pin}>
            {(id, d) => <input id={id} aria-describedby={d} type="password" value={f.pin} onChange={set("pin")} autoComplete="new-password" dir="ltr" />}
          </Field>
          <Field label={t("reg.password2")} error={errors.pin2}>
            {(id, d) => <input id={id} aria-describedby={d} type="password" value={f.pin2} onChange={set("pin2")} autoComplete="new-password" dir="ltr" />}
          </Field>
          <Field label={t("reg.nni")} optional error={errors.nni}>
            {(id, d) => <input id={id} aria-describedby={d} value={f.nni} onChange={set("nni")} inputMode="numeric" dir="ltr" maxLength={10} />}
          </Field>
          <Field label={t("reg.gender")}>
            {() => (
              <div className="ui-choices">
                {(["ذكر", "أنثى"] as const).map((g) => (
                  <label key={g} className="ui-choice"><input type="radio" name="gender" checked={f.gender === g} onChange={() => setF((v) => ({ ...v, gender: g }))} /> {tValue("gender", g)}</label>
                ))}
              </div>
            )}
          </Field>
          <Field label={t("reg.birthDate")} optional>
            {(id) => <input id={id} type="date" value={f.birthDate} onChange={set("birthDate")} />}
          </Field>
          <Field label={t("reg.occupation")}>
            {(id) => (
              <select id={id} value={f.occupation} onChange={set("occupation")}>
                {cfg.occupations.map((o) => <option key={o} value={o}>{tValue("occ", o)}</option>)}
              </select>
            )}
          </Field>
          <Field label={t("reg.institution")} optional>
            {(id) => <input id={id} value={f.institution} onChange={set("institution")} />}
          </Field>
          <Field label={t("reg.address")} optional>
            {(id) => <input id={id} value={f.address} onChange={set("address")} placeholder={t("reg.addressPh")} />}
          </Field>
          <Field label={t("reg.pledge")} optional hint={t("reg.pledgeHint", { motto: t("org.motto") })} error={errors.pledge}>
            {(id, d) => <input id={id} aria-describedby={d} value={f.pledge} onChange={set("pledge")} inputMode="numeric" dir="ltr" placeholder={t("reg.pledgePh")} />}
          </Field>
          <Field label={t("reg.receipt")} optional full hint={t("reg.receiptHint")} error={receiptError}>
            {(id) => (
              <div className="pt-receipt">
                <label htmlFor={id} className={`pt-receipt__drop${receipt ? " has" : ""}`}>
                  {receipt ? <img src={receipt} alt={t("rp.receiptPreview")} /> : <span>{t("rp.receiptPick")}</span>}
                </label>
                <input id={id} type="file" accept="image/*" hidden onChange={(e) => { onReceipt(e.target.files?.[0]); e.target.value = ""; }} />
                {receipt && <button type="button" className="pt-inline-btn" onClick={() => setReceipt(undefined)}>{t("rp.receiptRemove")}</button>}
              </div>
            )}
          </Field>
          <div className="ui-field ui-field--full">
            <label className="ui-check">
              <input type="checkbox" checked={pledgeOk} onChange={(e) => { setPledgeOk(e.target.checked); setErrors((x) => ({ ...x, agree: null })); }} />
              {t("reg.agree")}
            </label>
            {errors.agree && <p className="ui-error" role="alert">{errors.agree}</p>}
          </div>
          <div className="ui-field--full">
            <Button type="submit" block icon="userPlus" disabled={busy}>{busy ? t("reg.submitting") : t("reg.submit")}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
