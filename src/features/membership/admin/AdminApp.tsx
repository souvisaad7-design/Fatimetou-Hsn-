import { useEffect, useState, type FormEvent } from "react";
import { Icon, type IconName } from "../../../shared/Icon";
import { org } from "../../../shared/org";
import { useTheme } from "../../../shared/useTheme";
import { membershipConfig as cfg } from "../config";
import { useDb } from "../hooks/useDb";
import { useHashRoute } from "../hooks/useHashRoute";
import { claimFirstAdmin, dashboardStats, logout as apiLogout, restoreSession, staffLogin } from "../services/api";
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


const NAV: Array<{ id: string; label: string; icon: IconName; supervisor?: boolean }> = [
  { id: "dashboard", label: "لوحة المعلومات", icon: "grid" },
  { id: "mylist", label: "قائمتي", icon: "check", supervisor: true },
  { id: "reminders", label: "التذكيرات", icon: "bell", supervisor: true },
  { id: "requests", label: "الطلبات", icon: "inbox", supervisor: true },
  { id: "members", label: "المنتسبون", icon: "users" },
  { id: "payments", label: "الانتساب الشهري", icon: "wallet" },
  { id: "lists", label: "القوائم والمشرفون", icon: "list" },
  { id: "campaigns", label: "الحملات والتبرعات", icon: "megaphone" },
  { id: "settings", label: "الإعدادات", icon: "settings" },
];

/** لوحة إدارة اللجنة الانتسابية */
/** دور المستخدم في لوحة الإدارة، كما تحدده قاعدة البيانات */
type Session = { role: "admin" } | { role: "supervisor"; listId: string };

export default function AdminApp() {
  const db = useDb();
  useEffect(() => { void restoreSession(); }, []);
  const profile = db.profile;
  const session: Session | null = profile?.isAdmin
    ? { role: "admin" }
    : profile?.listIds.length
      ? { role: "supervisor", listId: profile.listIds[0] }
      : null;
  const logout = async () => { await apiLogout(); window.location.hash = ""; };

  if (db.status === "idle" || db.status === "loading") {
    return <div className="app-message" aria-busy="true"><span className="app-spinner" aria-hidden="true" /><p>جارٍ التحميل...</p></div>;
  }
  if (!profile) return <AdminLogin />;
  if (!session) return <NoAccess adminsExist={profile.adminsExist} onLogout={logout} />;
  return <AdminShell session={session} onLogout={logout} />;
}

function AdminLogin() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = `دخول الإدارة | ${cfg.committeeName}`; }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pe = validatePhone(phone);
    if (pe) return setError(pe);
    if (!pin) return setError("أدخل كلمة المرور");
    setBusy(true);
    try {
      const profile = await staffLogin(phone, pin);
      if (!profile) setError("رقم الهاتف أو كلمة المرور غير صحيحة.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ad-login">
      <form className="ad-login__box" onSubmit={submit} noValidate>
        <img src={org.logo} alt="" width={64} height={64} />
        <h1>لوحة {cfg.committeeName}</h1>
        <p className="ad-muted">لأعضاء اللجنة ومشرفي القوائم</p>
        <Field label="رقم الهاتف" error={null}>
          {(id) => <input id={id} type="tel" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(null); }} dir="ltr" autoComplete="tel" autoFocus />}
        </Field>
        <Field label="كلمة المرور" error={error}>
          {(id, d) => <input id={id} aria-describedby={d} type="password" value={pin} onChange={(e) => { setPin(e.target.value); setError(null); }} dir="ltr" autoComplete="current-password" />}
        </Field>
        <Button type="submit" block disabled={busy}>{busy ? "جارٍ الدخول..." : "دخول"}</Button>
        <Notice>الدخول بحسابك نفسه في بوابة المنتسبين. تظهر لك اللوحة إذا كنت مسؤولاً في اللجنة أو مشرف قائمة.</Notice>
      </form>
    </div>
  );
}

/** حساب بلا صلاحية إدارة. إذا لم يوجد أي مسؤول بعد، يستطيع أول مستخدم أن يصبح المسؤول الأول */
function NoAccess({ adminsExist, onLogout }: { adminsExist: boolean; onLogout: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const claim = async () => {
    setBusy(true);
    try {
      if (!(await claimFirstAdmin())) setError("يوجد مسؤول بالفعل. اطلب منه منحك الصلاحية.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ad-login">
      <div className="ad-login__box">
        <img src={org.logo} alt="" width={64} height={64} />
        <h1>ليست لديك صلاحية إدارة</h1>
        {adminsExist ? (
          <p className="ad-muted">حسابك ليس مسؤولاً في اللجنة ولا مشرفاً لقائمة. اطلب من مسؤول اللجنة أن يجعلك مشرفاً لقائمة من «القوائم والمشرفون».</p>
        ) : (
          <>
            <p className="ad-muted">لا يوجد أي مسؤول في النظام بعد. يمكنك أن تصبح <b>المسؤول الأول</b> للجنة الانتسابية الآن.</p>
            <Button block icon="check" onClick={claim} disabled={busy}>اجعلني المسؤول الأول</Button>
          </>
        )}
        {error && <p className="ui-error">{error}</p>}
        <Button variant="ghost" icon="logout" block onClick={onLogout}>خروج</Button>
      </div>
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
  const badges: Record<string, number> = { requests: supervisor ? stats.pending : stats.pending + stats.pendingPayments + stats.pendingDonations };
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
            : current.id === "requests" ? <RequestsAdmin supervisorListId={supervisor} />
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
