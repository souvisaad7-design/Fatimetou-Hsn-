import { useEffect, useState } from "react";
import { Icon } from "../../../shared/Icon";
import { org } from "../../../shared/org";
import { useTheme } from "../../../shared/useTheme";
import { membershipConfig as cfg } from "../config";
import { LangSwitch, t, useLang } from "../i18n";
import { useDb } from "../hooks/useDb";
import { logout as apiLogout, restoreSession } from "../services/api";
import { useHashRoute } from "../hooks/useHashRoute";
import type { Member } from "../types";
import { AuthGate, WaitingScreen } from "./AuthGate";
import { CampaignsPage } from "./pages/CampaignsPage";
import { HomePage } from "./pages/HomePage";
import { StatusPage } from "./pages/StatusPage";
import "./portal.css";

const NAV = [
  { id: "home", label: "nav.home", icon: "home" },
  { id: "status", label: "nav.status", icon: "users" },
  { id: "campaigns", label: "nav.campaigns", icon: "heart" },
] as const;

/**
 * بوابة المنتسبين. قبل الدخول يختار الزائر «لدي حساب» أو «مستخدم جديد»،
 * ولا يدخل الموقع إلا المنتسب المقبول؛ صاحب الطلب الجديد ينتظر قبول اللجنة أو المشرف.
 */
export default function PortalApp() {
  useLang(); // إعادة الرسم عند تغيير اللغة
  const db = useDb();
  const member = db.members.find((m) => m.id === db.profile?.memberId) ?? null;
  const login = (_m: Member) => { window.location.hash = "/home"; };
  const logout = async () => { await apiLogout(); window.location.hash = ""; };

  useEffect(() => { void restoreSession(); }, []);
  useEffect(() => {
    if (!member || member.status !== "approved") document.title = `${t("org.committee")} — ${t("org.name")}`;
  });

  if (db.status === "idle" || db.status === "loading") return <div className="app-message" aria-busy="true"><span className="app-spinner" aria-hidden="true" /><p>{t("common.loading")}</p></div>;
  if (db.status === "error" && !db.profile) return <div className="app-message" role="alert"><LangSwitch /><h1>{t("common.connError")}</h1><p>{db.error}</p><button type="button" onClick={() => void restoreSession()}>{t("common.retry")}</button></div>;
  if (!member) return <><AuthGate onLogin={login} /><AssistantFab /></>;
  if (member.status !== "approved") return <><WaitingScreen member={member} onLogout={logout} /><AssistantFab /></>;
  return <><PortalShell member={member} onLogout={logout} /><AssistantFab raised /></>;
}

/** زر عائم يفتح المساعد الذكي (أهداف الجمعية وفيديوهات إنجازاتها من قناتها على يوتيوب) */
function AssistantFab({ raised = false }: { raised?: boolean }) {
  return (
    <a className={`pt-fab${raised ? " pt-fab--raised" : ""}`} href="./assistant/" title={t("nav.assistantHint")} aria-label={`${t("nav.assistant")} — ${t("nav.assistantHint")}`}>
      <img src={org.logo} alt="" width={30} height={30} />
      <span>{t("nav.assistant")}</span>
    </a>
  );
}

function PortalShell({ member, onLogout }: { member: Member; onLogout: () => void }) {
  const { page, go } = useHashRoute("home");
  const { lang } = useLang();
  const { theme, toggle } = useTheme();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const titles: Record<string, string> = { status: t("nav.status"), campaigns: t("nav.campaigns") };
    document.title = `${titles[page] ? `${titles[page]} | ` : ""}${t("org.committee")} — ${t("org.name")}`;
    setMenu(false);
  }, [page, lang]);

  return (
    <div className="pt">
      <header className="pt-top">
        <div className="pt-wrap pt-top__row">
          <a className="pt-brand" href="#/home">
            <img src={org.logo} alt="" width={42} height={42} />
            <span>
              <b>{t("org.committee")}</b>
              <small>{t("org.name")}</small>
            </span>
          </a>
          <nav className={`pt-nav${menu ? " is-open" : ""}`} aria-label={t("common.mainMenu")}>
            {NAV.map((n) => (
              <a key={n.id} href={`#/${n.id}`} className={page === n.id ? "is-active" : undefined} aria-current={page === n.id ? "page" : undefined}>
                <Icon name={n.icon} size={18} /> {t(n.label)}
              </a>
            ))}
          </nav>
          <div className="pt-top__tools">
            <LangSwitch className="lang-switch--compact" />
            <span className="pt-hello">{member.fullName.split(" ")[0]}</span>
            <button type="button" className="ui-icon-btn" onClick={onLogout} aria-label={t("common.logout")} title={t("common.logout")}><Icon name="logout" /></button>
            <button type="button" className="ui-icon-btn" onClick={toggle} aria-label={theme === "dark" ? t("common.lightMode") : t("common.darkMode")}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <button type="button" className="ui-icon-btn pt-menu-btn" onClick={() => setMenu((v) => !v)} aria-label={t("common.menu")} aria-expanded={menu}>
              <Icon name={menu ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </header>

      <main className="pt-wrap pt-main">
        {page === "status" ? <StatusPage member={member} go={go} />
          : page === "campaigns" ? <CampaignsPage />
          : <HomePage go={go} />}
      </main>

      <footer className="pt-footer">
        <div className="pt-wrap">
          <p><b>{t("org.committee")}</b> — {t("org.name")}</p>
          <p>{t("footer.contact")} <b className="num" dir="ltr">{cfg.phone}</b></p>
        </div>
      </footer>

      {/* شريط تنقل سفلي على الهاتف */}
      <nav className="pt-tabbar" aria-label={t("common.quickNav")}>
        {NAV.map((n) => (
          <a key={n.id} href={`#/${n.id}`} className={page === n.id ? "is-active" : undefined}>
            <Icon name={n.icon} size={20} />
            <span>{t(n.label)}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
