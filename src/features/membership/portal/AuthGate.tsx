import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../../shared/Icon";
import { org } from "../../../shared/org";
import { copyText, useToast } from "../../../shared/toast";
import { membershipConfig as cfg } from "../config";
import { LangSwitch, t, tServer, useLang } from "../i18n";
import { loginMember } from "../services/api";
import { dateLabel, memberStatusLabel, statusTone } from "../lib/format";
import { validatePhone } from "../lib/validation";
import type { Member } from "../types";
import { Badge, Button, Card, Notice } from "../ui";
import { RegisterPage } from "./pages/RegisterPage";

/**
 * بوابة الدخول: أول ما يراه أي زائر قبل دخول الموقع.
 * شاشة «تسجيل الدخول» (الهاتف وكلمة المرور)، ومنها «إنشاء حساب جديد» ← طلب ينتظر قبول اللجنة أو المشرف.
 */
export function AuthGate({ onLogin }: { onLogin: (m: Member) => void }) {
  useLang();
  const [view, setView] = useState<"login" | "register">("login");
  if (view === "register") {
    return (
      <div className="pt-gate">
        <div className="pt-gate__lang"><LangSwitch /></div>
        <div className="pt-gate__box"><RegisterPage onDone={onLogin} onBack={() => setView("login")} /></div>
      </div>
    );
  }
  return <LoginScreen onLogin={onLogin} onRegister={() => setView("register")} />;
}

function LoginScreen({ onLogin, onRegister }: { onLogin: (m: Member) => void; onRegister: () => void }) {
  const [phone, setPhone] = useState("");
  const [secret, setSecret] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const { lang } = useLang();
  useEffect(() => setError(null), [lang]); // رسالة الخطأ تُكتب بلغة لحظة ظهورها

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pe = validatePhone(phone);
    if (pe) return setError(pe);
    if (!secret.trim()) return setError(t("login.errPassword"));
    setBusy(true);
    try {
      const m = await loginMember(phone, secret);
      if (!m) setError(t("srv.creds"));
      else onLogin(m);
    } catch (err) {
      setError(tServer((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lx">
      <div className="lx-lang"><LangSwitch /></div>
      <main className="lx-card">
        {/* شعار الجمعية الكامل مع اسمها كما هو */}
        <div className="lx-logo">
          <img src={org.logoFull} alt={t("org.name")} width={640} height={380} />
        </div>

        <h1 className="lx-title">{t("login.welcomeBack")}</h1>
        <p className="lx-sub">{t("login.welcomeSub")}</p>

        {/* المساعد الذكي: معلومات الجمعية متاحة دون تسجيل دخول */}
        <a className="lx-assistant" href="./assistant/" aria-label={`${t("nav.assistant")} — ${t("nav.assistantHint")}`}>
          <AssistantMascot />
          <span className="lx-assistant__bubble">
            <b>{t("login.assistantHi")}</b>
            <small>{t("login.assistantCta")}</small>
          </span>
        </a>

        <form className="lx-form" onSubmit={submit} noValidate>
          <div className="lx-field">
            <label htmlFor="lx-phone" className="lx-label">{t("login.phone")}</label>
            <div className={`lx-input${error && !phone ? " is-error" : ""}`}>
              <span className="lx-prefix" dir="ltr">+222</span>
              <input
                id="lx-phone"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(null); }}
                placeholder="XX XX XX XX"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
              />
            </div>
          </div>

          <div className="lx-field">
            <div className="lx-label-row">
              <label htmlFor="lx-pass" className="lx-label">{t("login.password")}</label>
              <button type="button" className="lx-link" onClick={() => setForgot((v) => !v)} aria-expanded={forgot}>{t("login.forgot")}</button>
            </div>
            <div className="lx-input">
              <Icon name="lock" className="lx-input__icon" />
              <input
                id="lx-pass"
                type={show ? "text" : "password"}
                value={secret}
                onChange={(e) => { setSecret(e.target.value); setError(null); }}
                placeholder={t("login.passwordPh")}
                autoComplete="current-password"
              />
              <button type="button" className="lx-eye" onClick={() => setShow((v) => !v)} aria-label={show ? t("login.hide") : t("login.show")}>
                <Icon name={show ? "eyeOff" : "eye"} />
              </button>
            </div>
          </div>

          {forgot && (
            <div className="lx-help" role="status">
              <p>{t("login.forgotText")}</p>
              <b className="num" dir="ltr">{cfg.phone}</b>
              <div className="lx-help__links">
                <a href={`tel:${cfg.phone}`}><Icon name="phone" size={16} /> {t("login.call")}</a>
                <a href={`https://wa.me/222${cfg.phone}`} target="_blank" rel="noopener noreferrer">{t("login.whatsapp")}</a>
              </div>
            </div>
          )}

          {error && <p className="lx-error" role="alert">{error}</p>}

          <button type="submit" className="lx-btn" disabled={busy}>{busy ? t("login.submitting") : t("login.submit")}</button>
        </form>

        <p className="lx-foot">
          {t("login.noAccount")} <button type="button" className="lx-link lx-link--strong" onClick={onRegister}>{t("login.createShort")}</button>
        </p>
      </main>
    </div>
  );
}

/** شخصية المساعد الذكي (بألوان الجمعية) تلوّح بيدها */
function AssistantMascot() {
  return (
    <svg className="lx-mascot" viewBox="0 0 120 110" aria-hidden="true">
      <ellipse cx="56" cy="100" rx="38" ry="6" fill="currentColor" opacity="0.12" />
      <g className="lx-mascot__hand">
        <circle cx="98" cy="30" r="13" fill="#f4aa9c" />
        <circle cx="98" cy="30" r="13" fill="url(#lxShade)" />
      </g>
      <path d="M18 62 C 18 32, 40 20, 58 20 C 80 20, 96 34, 96 60 C 96 84, 80 96, 57 96 C 34 96, 18 86, 18 62 Z" fill="#f4aa9c" />
      <path d="M18 62 C 18 32, 40 20, 58 20 C 80 20, 96 34, 96 60 C 96 84, 80 96, 57 96 C 34 96, 18 86, 18 62 Z" fill="url(#lxShade)" />
      <circle cx="44" cy="56" r="5" fill="#27244f" />
      <circle cx="70" cy="56" r="5" fill="#27244f" />
      <circle cx="45.5" cy="54.5" r="1.6" fill="#fff" />
      <circle cx="71.5" cy="54.5" r="1.6" fill="#fff" />
      <path d="M48 70 Q 57 78, 66 70" stroke="#27244f" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <circle cx="36" cy="68" r="4" fill="#e8806c" opacity="0.45" />
      <circle cx="78" cy="68" r="4" fill="#e8806c" opacity="0.45" />
      <defs>
        <linearGradient id="lxShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#c76b58" stopOpacity="0.25" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** شاشة من لم يُقبل بعد: لا يدخل الموقع حتى تقبله اللجنة أو المشرف */
export function WaitingScreen({ member, onLogout }: { member: Member; onLogout: () => void }) {
  useLang();
  const toast = useToast();
  const rejected = member.status === "rejected";
  const suspended = member.status === "suspended";
  return (
    <div className="pt-gate">
      <div className="pt-gate__lang"><LangSwitch /></div>
      <div className="pt-gate__box">
        <Card className="pt-waiting">
          <div className={`pt-waiting__icon${rejected || suspended ? " is-bad" : ""}`}><Icon name={rejected || suspended ? "close" : "clock"} size={30} /></div>
          <h1 className="pt-h1">{rejected ? t("wait.rejectedTitle") : suspended ? t("wait.suspendedTitle") : t("wait.pendingTitle")}</h1>
          <p className="pt-muted">
            {rejected
              ? t("wait.rejectedText", { phone: cfg.phone })
              : suspended
                ? t("wait.suspendedText")
                : t("wait.pendingText")}
          </p>
          <dl className="pt-facts">
            <div><dt>{t("wait.name")}</dt><dd>{member.fullName}</dd></div>
            <div><dt>{t("wait.code")}</dt><dd className="num" dir="ltr">{member.code} <button type="button" className="pt-inline-btn" onClick={async () => toast((await copyText(member.code)) ? t("common.copied") : member.code)}>{t("common.copy")}</button></dd></div>
            <div><dt>{t("wait.status")}</dt><dd><Badge tone={statusTone(member.status)}>{memberStatusLabel[member.status]}</Badge></dd></div>
            <div><dt>{t("wait.date")}</dt><dd className="num">{dateLabel(member.createdAt)}</dd></div>
          </dl>
          {!rejected && !suspended && <Notice>{t("wait.auto")}</Notice>}
          <Button variant="ghost" icon="logout" block onClick={onLogout}>{t("common.logout")}</Button>
        </Card>
      </div>
    </div>
  );
}
