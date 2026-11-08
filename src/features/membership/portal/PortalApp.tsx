import { useEffect, useState } from "react";
import { Icon } from "../../../shared/Icon";
import { org } from "../../../shared/org";
import { useTheme } from "../../../shared/useTheme";
import { membershipConfig as cfg } from "../config";
import { useHashRoute } from "../hooks/useHashRoute";
import { CampaignsPage } from "./pages/CampaignsPage";
import { HomePage } from "./pages/HomePage";
import { RegisterPage } from "./pages/RegisterPage";
import { StatusPage } from "./pages/StatusPage";
import "./portal.css";

const NAV = [
  { id: "home", label: "الرئيسية", icon: "home" },
  { id: "register", label: "التسجيل", icon: "userPlus" },
  { id: "status", label: "وضعيتي", icon: "users" },
  { id: "campaigns", label: "الحملات", icon: "heart" },
] as const;

/** بوابة المنتسبين: التسجيل ومتابعة الوضعية والانتساب والتبرع للحملات */
export default function PortalApp() {
  const { page, go } = useHashRoute("home");
  const { theme, toggle } = useTheme();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const titles: Record<string, string> = { register: "التسجيل", status: "وضعيتي", campaigns: "الحملات" };
    document.title = `${titles[page] ? `${titles[page]} | ` : ""}${cfg.committeeName} — ${cfg.orgName}`;
    setMenu(false);
  }, [page]);

  return (
    <div className="pt">
      <header className="pt-top">
        <div className="pt-wrap pt-top__row">
          <a className="pt-brand" href="#/home">
            <img src={org.logo} alt="" width={42} height={42} />
            <span>
              <b>{cfg.committeeName}</b>
              <small>{cfg.orgName}</small>
            </span>
          </a>
          <nav className={`pt-nav${menu ? " is-open" : ""}`} aria-label="القائمة الرئيسية">
            {NAV.map((n) => (
              <a key={n.id} href={`#/${n.id}`} className={page === n.id ? "is-active" : undefined} aria-current={page === n.id ? "page" : undefined}>
                <Icon name={n.icon} size={18} /> {n.label}
              </a>
            ))}
          </nav>
          <div className="pt-top__tools">
            <button type="button" className="ui-icon-btn" onClick={toggle} aria-label={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <button type="button" className="ui-icon-btn pt-menu-btn" onClick={() => setMenu((v) => !v)} aria-label="القائمة" aria-expanded={menu}>
              <Icon name={menu ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </header>

      <main className="pt-wrap pt-main">
        {page === "register" ? <RegisterPage go={go} />
          : page === "status" ? <StatusPage go={go} />
          : page === "campaigns" ? <CampaignsPage />
          : <HomePage go={go} />}
      </main>

      <footer className="pt-footer">
        <div className="pt-wrap">
          <p><b>{cfg.committeeName}</b> — {cfg.orgName}</p>
          <p>للتواصل ودفع الانتساب والتبرعات: <b className="num" dir="ltr">{cfg.phone}</b></p>
        </div>
      </footer>

      {/* شريط تنقل سفلي على الهاتف */}
      <nav className="pt-tabbar" aria-label="التنقل السريع">
        {NAV.map((n) => (
          <a key={n.id} href={`#/${n.id}`} className={page === n.id ? "is-active" : undefined}>
            <Icon name={n.icon} size={20} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
