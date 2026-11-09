import { useState, type FormEvent } from "react";
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
  const [contact, setContact] = useState(false);

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
    <div className="lg">
      <div className="lg-lang"><LangSwitch /></div>
      <header className="lg-hero">
        <MosqueSilhouette />
        <img src={org.logoFull} alt={t("org.name")} width={640} height={380} className="lg-hero__logo" />
        <svg className="lg-wave" viewBox="0 0 400 90" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 40 C 90 95, 170 0, 260 30 S 380 70, 400 20 L400 90 L0 90 Z" fill="var(--lg-coral)" opacity="0.55" />
          <path d="M0 60 C 100 100, 190 20, 280 50 S 380 80, 400 45 L400 90 L0 90 Z" fill="var(--lg-bg)" />
        </svg>
      </header>

      <main className="lg-body">
        <h1>{t("login.title")}</h1>
        <p className="lg-sub">{t("org.welcome")}</p>

        <form className="lg-form" onSubmit={submit} noValidate>
          <label className="lg-field">
            <span className="visually-hidden">{t("login.phone")}</span>
            <input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(null); }}
              placeholder={t("login.phone")}
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={!!error && !phone ? true : undefined}
            />
            <Icon name="phone" className="lg-field__icon" />
          </label>

          <label className="lg-field">
            <span className="visually-hidden">{t("login.password")}</span>
            <button type="button" className="lg-field__toggle" onClick={() => setShow((v) => !v)} aria-label={show ? t("login.hide") : t("login.show")}>
              <Icon name={show ? "eye" : "eyeOff"} />
            </button>
            <input
              type={show ? "text" : "password"}
              value={secret}
              onChange={(e) => { setSecret(e.target.value); setError(null); }}
              placeholder={t("login.password")}
              autoComplete="current-password"
            />
            <Icon name="lock" className="lg-field__icon" />
          </label>

          {error && <p className="lg-error" role="alert">{error}</p>}

          <button type="submit" className="lg-btn" disabled={busy}>{busy ? t("login.submitting") : t("login.submit")}</button>
        </form>

        <p className="lg-or">{t("login.or")}</p>
        <button type="button" className="lg-btn lg-btn--outline" onClick={onRegister}>
          <Icon name="userPlus" /> {t("login.create")}
        </button>

        <button type="button" className="lg-contact" onClick={() => setContact((v) => !v)} aria-expanded={contact}>
          <Icon name="headset" size={18} /> {t("login.contact")}
        </button>
        {contact && (
          <div className="lg-contact__box">
            <p>{t("login.contactText")}</p>
            <b className="num" dir="ltr">{cfg.phone}</b>
            <div className="lg-contact__links">
              <a href={`tel:${cfg.phone}`}>{t("login.call")}</a>
              <a href={`https://wa.me/${cfg.phone}`} target="_blank" rel="noopener noreferrer">{t("login.whatsapp")}</a>
            </div>
          </div>
        )}
      </main>

      <Leaves />
    </div>
  );
}

/** رسم مسجد بسيط في خلفية الرأس */
function MosqueSilhouette() {
  return (
    <svg className="lg-mosque" viewBox="0 0 220 130" aria-hidden="true">
      <g fill="currentColor">
        {/* المئذنتان */}
        <rect x="18" y="38" width="12" height="92" rx="2" />
        <path d="M16 40 L24 14 L32 40 Z" />
        <rect x="16" y="56" width="16" height="4" rx="1" />
        <rect x="190" y="30" width="12" height="100" rx="2" />
        <path d="M188 32 L196 4 L204 32 Z" />
        <rect x="188" y="50" width="16" height="4" rx="1" />
        {/* القبة الكبرى */}
        <path d="M70 86 C 70 50, 150 50, 150 86 Z" />
        <path d="M106 52 L110 38 L114 52 Z" />
        {/* قبتان صغيرتان */}
        <path d="M40 98 C 40 76, 76 76, 76 98 Z" />
        <path d="M144 98 C 144 76, 180 76, 180 98 Z" />
        {/* المبنى */}
        <rect x="36" y="86" width="148" height="44" />
        <rect x="64" y="96" width="10" height="20" rx="5" fill="var(--lg-hero)" opacity="0.6" />
        <rect x="105" y="96" width="10" height="20" rx="5" fill="var(--lg-hero)" opacity="0.6" />
        <rect x="146" y="96" width="10" height="20" rx="5" fill="var(--lg-hero)" opacity="0.6" />
      </g>
    </svg>
  );
}

/** أوراق زخرفية في زاويتي الشاشة */
function Leaves() {
  const leaf = "M0 0 C 18 -22, 50 -22, 64 0 C 50 22, 18 22, 0 0 Z";
  return (
    <>
      <svg className="lg-leaves lg-leaves--start" viewBox="0 0 120 120" aria-hidden="true">
        <g fill="currentColor">
          <path d={leaf} transform="translate(10 100) rotate(-55)" />
          <path d={leaf} transform="translate(30 112) rotate(-20) scale(.8)" />
          <path d={leaf} transform="translate(4 70) rotate(-85) scale(.7)" />
        </g>
      </svg>
      <svg className="lg-leaves lg-leaves--end" viewBox="0 0 120 120" aria-hidden="true">
        <g fill="currentColor">
          <path d={leaf} transform="translate(110 100) rotate(-125)" />
          <path d={leaf} transform="translate(90 114) rotate(-160) scale(.8)" />
        </g>
      </svg>
    </>
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
