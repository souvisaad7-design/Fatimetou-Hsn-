import { useEffect, useState, type FormEvent } from "react";
import { Icon, type IconName } from "../../../shared/Icon";
import { org } from "../../../shared/org";
import { useTheme } from "../../../shared/useTheme";
import { membershipConfig as cfg } from "../config";
import { useDb } from "../hooks/useDb";
import { useHashRoute } from "../hooks/useHashRoute";
import { dashboardStats, findSupervisorList } from "../services/api";
import { validatePhone } from "../lib/validation";
import { Button, Field, Notice } from "../ui";
import { CampaignsAdmin } from "./pages/CampaignsAdmin";
import { Dashboard } from "./pages/Dashboard";
import { ListsAdmin } from "./pages/ListsAdmin";
import { MembersAdmin } from "./pages/MembersAdmin";
import { MyList } from "./pages/MyList";
import { Reminders } from "./pages/Reminders";
import { PaymentsAdmin } from "./pages/PaymentsAdmin";
import { RequestsAdmin } from "./pages/RequestsAdmin";
import { SettingsAdmin } from "./pages/SettingsAdmin";
import "./admin.css";

const SESSION = "awn:membership:admin";

/** دور المستخدم: عضو اللجنة يرى كل شيء، والمشرف يرى قائمته فقط */
type Session = { role: "admin" } | { role: "supervisor"; listId: string };

const NAV: Array<{ id: string; label: string; icon: IconName; supervisor?: boolean }> = [
  { id: "dashboard", label: "لوحة المعلومات", icon: "grid" },
  { id: "mylist", label: "قائمتي", icon: "check", supervisor: true },
  { id: "reminders", label: "التذكيرات", icon: "bell", supervisor: true },
  { id: "requests", label: "الطلبات", icon: "inbox" },
  { id: "members", label: "المنتسبون", icon: "users" },
  { id: "payments", label: "الانتساب الشهري", icon: "wallet" },
  { id: "lists", label: "القوائم والمشرفون", icon: "list" },
  { id: "campaigns", label: "الحملات والتبرعات", icon: "megaphone" },
  { id: "settings", label: "الإعدادات", icon: "settings" },
];

/** لوحة إدارة اللجنة الانتسابية */
export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION);
      const parsed = raw ? (JSON.parse(raw) as Session) : null;
      return parsed && (parsed.role === "admin" || parsed.role === "supervisor") ? parsed : null;
    } catch { return null; }
  });
  const login = (next: Session) => {
    try { sessionStorage.setItem(SESSION, JSON.stringify(next)); } catch { /* */ }
    setSession(next);
  };
  const logout = () => {
    try { sessionStorage.removeItem(SESSION); } catch { /* */ }
    window.location.hash = "";
    setSession(null);
  };
  if (!session) return <AdminLogin onLogin={login} />;
  return <AdminShell session={session} onLogout={logout} />;
}

function AdminLogin({ onLogin }: { onLogin: (s: Session) => void }) {
  const [mode, setMode] = useState<"admin" | "supervisor">("admin");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { document.title = `دخول الإدارة | ${cfg.committeeName}`; }, []);
  const switchTo = (m: "admin" | "supervisor") => { setMode(m); setValue(""); setError(null); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "admin") {
      if (value.trim() === cfg.adminPin) onLogin({ role: "admin" });
      else setError("الرمز غير صحيح");
      return;
    }
    const pe = validatePhone(value);
    if (pe) return setError(pe);
    const list = findSupervisorList(value);
    if (!list) return setError("هذا الرقم ليس مسجّلاً كمشرف قائمة. تواصل مع اللجنة الانتسابية.");
    onLogin({ role: "supervisor", listId: list.id });
  };
  return (
    <div className="ad-login">
      <form className="ad-login__box" onSubmit={submit}>
        <img src={org.logo} alt="" width={64} height={64} />
        <h1>لوحة {cfg.committeeName}</h1>
        <p className="ad-muted">{cfg.orgName}</p>
        <div className="ad-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "admin"} className={mode === "admin" ? "is-active" : undefined} onClick={() => switchTo("admin")}>عضو اللجنة</button>
          <button type="button" role="tab" aria-selected={mode === "supervisor"} className={mode === "supervisor" ? "is-active" : undefined} onClick={() => switchTo("supervisor")}>مشرف قائمة</button>
        </div>
        <Field label={mode === "admin" ? "رمز الدخول" : "رقم هاتف المشرف"} error={error}>
          {(id, d) => <input id={id} aria-describedby={d} type={mode === "admin" ? "password" : "tel"} inputMode="numeric" value={value} onChange={(e) => { setValue(e.target.value); setError(null); }} dir="ltr" autoFocus />}
        </Field>
        <Button type="submit" block>دخول</Button>
        <Notice tone="warn">نسخة تجريبية: الدخول في الواجهة فقط وليس حماية حقيقية، والبيانات محفوظة في هذا المتصفح. رمز اللجنة الافتراضي <b dir="ltr">2026</b>، والمشرف يدخل برقم هاتفه المسجّل في قائمته.</Notice>
      </form>
    </div>
  );
}

function AdminShell({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const supervisor = session.role === "supervisor" ? session.listId : undefined;
  const { page, params, go } = useHashRoute(supervisor ? "mylist" : "dashboard");
  const { theme, toggle } = useTheme();
  const [menu, setMenu] = useState(false);
  const db = useDb();
  const stats = dashboardStats(db);
  const badges: Record<string, number> = { requests: stats.pending + stats.pendingPayments + stats.pendingDonations };
  const nav = supervisor ? NAV.filter((n) => n.supervisor) : NAV;
  const current = nav.find((n) => n.id === page) ?? nav[0];
  const list = supervisor ? db.lists.find((l) => l.id === supervisor) : undefined;

  useEffect(() => {
    document.title = `${current.label} | إدارة ${cfg.committeeName}`;
    setMenu(false);
  }, [current.label]);

  return (
    <div className="ad">
      <aside className={`ad-side${menu ? " is-open" : ""}`} aria-label="أقسام لوحة الإدارة">
        <div className="ad-side__brand">
          <img src={org.logo} alt="" width={40} height={40} />
          <span><b>{cfg.committeeName}</b><small>{list ? `مشرف: ${list.name}` : "لوحة الإدارة"}</small></span>
        </div>
        <nav className="ad-nav">
          {nav.map((n) => (
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
          {current.id === "mylist" ? <MyList fixedListId={supervisor} />
            : current.id === "reminders" ? <Reminders fixedListId={supervisor} />
            : current.id === "requests" ? <RequestsAdmin />
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
