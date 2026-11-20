/**
 * صفحة البث للزوار برابط المشاهدة (…/live/?s=…&k=…).
 * الخادم يتحقق من الرابط ويعطي إذن مشاهدة فقط؛ لا تعليقات ولا بث.
 */
import { useEffect, useState } from "react";
import { Icon } from "../../../shared/Icon";
import { org } from "../../../shared/org";
import { useTheme } from "../../../shared/useTheme";
import { LangToggle, t, useLang } from "../i18n";
import { Countdown, whenLabel } from "../portal/pages/LivePage";
import { LiveStage } from "./LiveStage";
import { getGuestInfo, type GuestInfo } from "./liveApi";
import "../portal/portal.css";
import "./live.css";

const params = new URLSearchParams(window.location.search);
const S = params.get("s") ?? "";
const K = params.get("k") ?? "";

export default function GuestLivePage() {
  const { lang } = useLang();
  const { theme, toggle } = useTheme();
  const [info, setInfo] = useState<GuestInfo | null>(null);
  const [error, setError] = useState<string | null>(S && K ? null : t("live.badLink"));

  useEffect(() => {
    if (!S || !K) return;
    let alive = true;
    const load = async () => {
      try {
        const g = await getGuestInfo(S, K);
        if (alive) { setInfo((old) => (old?.status === g.status ? { ...old, ...g, token: undefined } : g)); setError(null); }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    void load();
    const timer = setInterval(load, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  useEffect(() => { document.title = `${info?.title ? `${info.title} | ` : ""}${t("live.nav")} — ${t("org.name")}`; }, [info?.title, lang]);

  return (
    <div className="pt lv-guest">
      <header className="pt-top">
        <div className="pt-wrap pt-top__row">
          <span className="pt-brand">
            <img src={org.logo} alt="" width={42} height={42} />
            <span><b>{t("org.committee")}</b><small>{t("org.name")}</small></span>
          </span>
          <div className="pt-top__tools">
            <LangToggle />
            <button type="button" className="ui-icon-btn" onClick={toggle} aria-label={theme === "dark" ? t("common.lightMode") : t("common.darkMode")}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
          </div>
        </div>
      </header>

      <main className="pt-wrap pt-main">
        <div className="pt-stack">
          <header className="lv-head">
            <div>
              <h1 className="pt-h1">{t("live.title")}</h1>
              {info?.title && <p className="pt-muted">{info.title}</p>}
            </div>
            {info?.status === "live" && <span className="lv-badge lv-badge--live lv-badge--big">● {t("live.nowShort")}</span>}
          </header>

          {error && !info ? (
            <section className="lv-empty">
              <span className="lv-empty__icon" aria-hidden="true"><Icon name="lock" size={30} /></span>
              <h2>{t("live.badLinkTitle")}</h2>
              <p className="pt-muted">{error}</p>
            </section>
          ) : !info ? (
            <div className="app-message" aria-busy="true"><span className="app-spinner" aria-hidden="true" /></div>
          ) : info.status === "live" ? (
            <div className="lv-main">
              <LiveStage key={info.session_id} role="viewer" sessionId={info.session_id} guest={{ s: S, k: K }} />
              {info.description && <div className="lv-info"><p>{info.description}</p></div>}
            </div>
          ) : (
            <section className="lv-empty">
              <span className="lv-empty__icon" aria-hidden="true"><Icon name="play" size={34} /></span>
              {info.status === "ended" ? (
                <><h2>{t("live.ended")}</h2></>
              ) : (
                <>
                  <h2>{t("live.notStarted")}</h2>
                  {info.scheduled_at && (
                    <div className="lv-next">
                      <span className="pt-muted">{whenLabel(info.scheduled_at, lang)}</span>
                      <Countdown to={info.scheduled_at} />
                    </div>
                  )}
                  <p className="pt-muted">{t("live.autoStart")}</p>
                </>
              )}
            </section>
          )}
          <p className="pt-muted lv-small" style={{ textAlign: "center" }}>{t("live.guestNote")}</p>
        </div>
      </main>
    </div>
  );
}
