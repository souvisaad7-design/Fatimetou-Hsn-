import { useEffect, useState, type FormEvent } from "react";
import { Icon, type IconName } from "../../../shared/Icon";
import { org } from "../../../shared/org";
import { useTheme } from "../../../shared/useTheme";
import { membershipConfig as cfg } from "../config";
import { useDb } from "../hooks/useDb";
import { useHashRoute } from "../hooks/useHashRoute";
import { dashboardStats } from "../services/api";
import { Button, Field, Notice } from "../ui";
import { CampaignsAdmin } from "./pages/CampaignsAdmin";
import { Dashboard } from "./pages/Dashboard";
import { ListsAdmin } from "./pages/ListsAdmin";
import { MembersAdmin } from "./pages/MembersAdmin";
import { PaymentsAdmin } from "./pages/PaymentsAdmin";
import { RequestsAdmin } from "./pages/RequestsAdmin";
import { SettingsAdmin } from "./pages/SettingsAdmin";
import "./admin.css";

const SESSION = "awn:membership:admin";
const NAV: Array<{ id: string; label: string; icon: IconName }> = [
  { id: "dashboard", label: "لوحة المعلومات", icon: "grid" },
  { id: "requests", label: "الطلبات", icon: "inbox" },
  { id: "members", label: "المنتسبون", icon: "users" },
  { id: "payments", label: "الانتساب الشهري", icon: "wallet" },
  { id: "lists", label: "القوائم والمشرفون", icon: "list" },
  { id: "campaigns", label: "الحملات والتبرعات", icon: "megaphone" },
  { id: "settings", label: "الإعدادات", icon: "settings" },
];

/** لوحة إدارة اللجنة الانتسابية */
export default function AdminApp() {
  const [authed, setAuthed] = useState(() => {
    try { return sessionStorage.getItem(SESSION) === "1"; } catch { return false; }
  });
  if (!authed) return <AdminLogin onLogin={() => { try { sessionStorage.setItem(SESSION, "1"); } catch { /* */ } setAuthed(true); }} />;
  return <AdminShell onLogout={() => { try { sessionStorage.removeItem(SESSION); } catch { /* */ } setAuthed(false); }} />;
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { document.title = `دخول الإدارة | ${cfg.committeeName}`; }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pin.trim() === cfg.adminPin) onLogin();
    else setError("الرمز غير صحيح");
  };
  return (
    <div className="ad-login">
      <form className="ad-login__box" onSubmit={submit}>
        <img src={org.logo} alt="" width={64} height={64} />
        <h1>لوحة إدارة {cfg.committeeName}</h1>
        <p className="ad-muted">{cfg.orgName}</p>
        <Field label="رمز الدخول" error={error}>
          {(id, d) => <input id={id} aria-describedby={d} type="password" inputMode="numeric" value={pin} onChange={(e) => { setPin(e.target.value); setError(null); }} dir="ltr" autoFocus />}
        </Field>
        <Button type="submit" block>دخول</Button>
        <Notice tone="warn">نسخة تجريبية: رمز الدخول في الواجهة فقط وليس حماية حقيقية، والبيانات محفوظة في هذا المتصفح. الرمز الافتراضي: <b dir="ltr">2026</b></Notice>
      </form>
    </div>
  );
}

function AdminShell({ onLogout }: { onLogout: () => void }) {
  const { page, params, go } = useHashRoute("dashboard");
  const { theme, toggle } = useTheme();
  const [menu, setMenu] = useState(false);
  const db = useDb();
  const stats = dashboardStats(db);
  const badges: Record<string, number> = { requests: stats.pending + stats.pendingPayments + stats.pendingDonations };
  const current = NAV.find((n) => n.id === page) ?? NAV[0];

  useEffect(() => {
    document.title = `${current.label} | إدارة ${cfg.committeeName}`;
    setMenu(false);
  }, [current.label]);

  return (
    <div className="ad">
      <aside className={`ad-side${menu ? " is-open" : ""}`} aria-label="أقسام لوحة الإدارة">
        <div className="ad-side__brand">
          <img src={org.logo} alt="" width={40} height={40} />
          <span><b>{cfg.committeeName}</b><small>لوحة الإدارة</small></span>
        </div>
        <nav className="ad-nav">
          {NAV.map((n) => (
            <a key={n.id} href={`#/${n.id}`} className={current.id === n.id ? "is-active" : undefined} aria-current={current.id === n.id ? "page" : undefined}>
              <Icon name={n.icon} size={19} /> <span>{n.label}</span>
              {badges[n.id] ? <em className="ad-nav__badge num">{badges[n.id]}</em> : null}
            </a>
          ))}
        </nav>
        <div className="ad-side__foot">
          <a href="../" className="ad-side__link"><Icon name="home" size={18} /> بوابة المنتسبين</a>
          <button type="button" className="ad-side__link" onClick={toggle}><Icon name={theme === "dark" ? "sun" : "moon"} size={18} /> {theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}</button>
          <button type="button" className="ad-side__link" onClick={onLogout}><Icon name="logout" size={18} /> خروج</button>
        </div>
      </aside>
      {menu && <div className="ad-scrim" onClick={() => setMenu(false)} />}

      <div className="ad-main">
        <header className="ad-top">
          <button type="button" className="ui-icon-btn ad-menu-btn" aria-label="القائمة" onClick={() => setMenu(true)}><Icon name="menu" /></button>
          <h1>{current.label}</h1>
        </header>
        <main className="ad-content">
          {current.id === "requests" ? <RequestsAdmin />
            : current.id === "members" ? <MembersAdmin openId={params[0]} go={go} />
            : current.id === "payments" ? <PaymentsAdmin />
            : current.id === "lists" ? <ListsAdmin go={go} />
            : current.id === "campaigns" ? <CampaignsAdmin />
            : current.id === "settings" ? <SettingsAdmin />
            : <Dashboard go={go} />}
        </main>
      </div>
    </div>
  );
}
