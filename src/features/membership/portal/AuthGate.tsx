import { useState, type FormEvent } from "react";
import { Icon } from "../../../shared/Icon";
import { org } from "../../../shared/org";
import { copyText, useToast } from "../../../shared/toast";
import { membershipConfig as cfg } from "../config";
import { loginMember } from "../services/api";
import { dateLabel, memberStatusLabel, statusTone } from "../lib/format";
import { validatePhone } from "../lib/validation";
import type { Member } from "../types";
import { Badge, Button, Card, Field, Notice } from "../ui";
import { RegisterPage } from "./pages/RegisterPage";

/**
 * بوابة الدخول: أول ما يراه أي زائر قبل دخول الموقع.
 * «لدي حساب» ← الدخول، «مستخدم جديد» ← التسجيل (يبقى الطلب بانتظار قبول اللجنة أو المشرف).
 */
export function AuthGate({ onLogin }: { onLogin: (m: Member) => void }) {
  const [view, setView] = useState<"choose" | "login" | "register">("choose");

  return (
    <div className="pt-gate">
      <div className="pt-gate__box">
        {view === "choose" && (
          <div className="pt-gate__choose">
            <img src={org.logoFull} alt={cfg.orgName} width={640} height={380} className="pt-gate__logo" />
            <h1>مرحباً بك في {cfg.committeeName}</h1>
            <p className="pt-muted">«{cfg.motto}»</p>
            <button type="button" className="pt-gate__option" onClick={() => setView("login")}>
              <span className="pt-gate__icon"><Icon name="users" size={26} /></span>
              <span><b>لدي حساب</b><small>الدخول برقم الهاتف وكلمة السر</small></span>
            </button>
            <button type="button" className="pt-gate__option pt-gate__option--new" onClick={() => setView("register")}>
              <span className="pt-gate__icon"><Icon name="userPlus" size={26} /></span>
              <span><b>مستخدم جديد</b><small>إنشاء حساب وإرسال طلب انتساب</small></span>
            </button>
          </div>
        )}
        {view === "login" && <LoginForm onLogin={onLogin} onBack={() => setView("choose")} onRegister={() => setView("register")} />}
        {view === "register" && <RegisterPage onDone={onLogin} onBack={() => setView("choose")} />}
      </div>
    </div>
  );
}

function LoginForm({ onLogin, onBack, onRegister }: { onLogin: (m: Member) => void; onBack: () => void; onRegister: () => void }) {
  const [phone, setPhone] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pe = validatePhone(phone);
    if (pe) return setError(pe);
    if (!secret.trim()) return setError("أدخل كلمة السر");
    setBusy(true);
    const m = await loginMember(phone, secret);
    setBusy(false);
    if (!m) return setError("رقم الهاتف أو كلمة السر غير صحيحة.");
    onLogin(m);
  };

  return (
    <div className="pt-stack">
      <div>
        <button type="button" className="pt-back" onClick={onBack}>→ رجوع</button>
        <h1 className="pt-h1">لدي حساب</h1>
        <p className="pt-muted">ادخل برقم هاتفك وكلمة السر التي اخترتها عند التسجيل.</p>
      </div>
      <Card>
        <form className="pt-stack" onSubmit={submit} noValidate>
          <Field label="رقم الهاتف">{(id) => <input id={id} value={phone} onChange={(e) => { setPhone(e.target.value); setError(null); }} inputMode="tel" dir="ltr" autoComplete="tel" />}</Field>
          <Field label="كلمة السر" hint="إن لم تختر كلمة سر من قبل، أدخل رقم المنتسب (مثل AWN-0012)">
            {(id) => <input id={id} type="password" value={secret} onChange={(e) => { setSecret(e.target.value); setError(null); }} autoComplete="current-password" dir="ltr" />}
          </Field>
          {error && <p className="ui-error" role="alert">{error}</p>}
          <Button type="submit" block disabled={busy}>{busy ? "جارٍ الدخول..." : "دخول"}</Button>
        </form>
      </Card>
      <p className="pt-center pt-muted">ليس لديك حساب؟ <button type="button" className="pt-inline-btn" onClick={onRegister}>مستخدم جديد</button></p>
    </div>
  );
}

/** شاشة من لم يُقبل بعد: لا يدخل الموقع حتى تقبله اللجنة أو المشرف */
export function WaitingScreen({ member, onLogout }: { member: Member; onLogout: () => void }) {
  const toast = useToast();
  const rejected = member.status === "rejected";
  const suspended = member.status === "suspended";
  return (
    <div className="pt-gate">
      <div className="pt-gate__box">
        <Card className="pt-waiting">
          <div className={`pt-waiting__icon${rejected || suspended ? " is-bad" : ""}`}><Icon name={rejected || suspended ? "close" : "clock"} size={30} /></div>
          <h1 className="pt-h1">{rejected ? "لم يُقبل طلبك" : suspended ? "حسابك موقوف" : "طلبك قيد المراجعة"}</h1>
          <p className="pt-muted">
            {rejected
              ? `للاستفسار تواصل مع الجمعية على الرقم ${cfg.phone}.`
              : suspended
                ? "تواصل مع مشرف قائمتك أو مع اللجنة الانتسابية."
                : "سيراجع طلبك أحد أعضاء اللجنة الانتسابية أو المشرفين، وستتمكن من دخول الموقع فور قبوله."}
          </p>
          <dl className="pt-facts">
            <div><dt>الاسم</dt><dd>{member.fullName}</dd></div>
            <div><dt>رقم المنتسب</dt><dd className="num" dir="ltr">{member.code} <button type="button" className="pt-inline-btn" onClick={async () => toast((await copyText(member.code)) ? "تم النسخ" : member.code)}>نسخ</button></dd></div>
            <div><dt>الحالة</dt><dd><Badge tone={statusTone(member.status)}>{memberStatusLabel[member.status]}</Badge></dd></div>
            <div><dt>تاريخ الطلب</dt><dd className="num">{dateLabel(member.createdAt)}</dd></div>
          </dl>
          {!rejected && !suspended && <Notice>هذه الصفحة تتحدث تلقائياً عند قبول طلبك.</Notice>}
          <Button variant="ghost" icon="logout" block onClick={onLogout}>خروج</Button>
        </Card>
      </div>
    </div>
  );
}
