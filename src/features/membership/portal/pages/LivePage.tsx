/** البث المباشر الخاص باللجنة — للمنتسبين المعتمدين فقط (الخادم يتحقق قبل إعطاء إذن المشاهدة) */
import { useEffect, useState } from "react";
import { Icon } from "../../../../shared/Icon";
import { supabase } from "../../services/supabase";
import { t, useLang } from "../../i18n";
import { LiveComments } from "../../live/LiveComments";
import { LiveStage } from "../../live/LiveStage";
import { useLiveStatus, type LiveSession } from "../../live/liveApi";
import "../../live/live.css";

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <b>{t("live.soon")}</b>;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const cell = (v: number, k: Parameters<typeof t>[0]) => <span className="lv-cd__cell"><b className="num">{String(v).padStart(2, "0")}</b><small>{t(k)}</small></span>;
  return <span className="lv-cd" dir="ltr">{d > 0 && cell(d, "live.d")}{cell(h, "live.h")}{cell(m, "live.m")}{cell(sec, "live.s")}</span>;
}

export const whenLabel = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "ar-MR-u-nu-latn", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function LivePage() {
  const { lang } = useLang();
  const { live, next, loaded } = useLiveStatus(15000);
  const [commentsOn, setCommentsOn] = useState(true);
  useEffect(() => {
    void supabase.from("live_settings").select("comments_enabled").eq("id", true).maybeSingle().then(({ data }) => setCommentsOn(data?.comments_enabled !== false));
  }, [live?.id]);

  if (!loaded) return <div className="app-message" aria-busy="true"><span className="app-spinner" aria-hidden="true" /></div>;

  return (
    <div className="pt-stack">
      <header className="lv-head">
        <div>
          <h1 className="pt-h1">{t("live.title")}</h1>
          <p className="pt-muted"><Icon name="lock" size={14} /> {t("live.private")}</p>
        </div>
        {live && <span className="lv-badge lv-badge--live lv-badge--big">● {t("live.nowShort")}</span>}
      </header>

      {live ? (
        <div className="lv-layout">
          <div className="lv-main">
            <LiveStage key={live.id} role="viewer" sessionId={live.id} />
            <div className="lv-info">
              <h2>{live.title}</h2>
              {live.description && <p>{live.description}</p>}
            </div>
          </div>
          <LiveComments key={live.id} sessionId={live.id} enabled={commentsOn} />
        </div>
      ) : (
        <NoLive next={next} lang={lang} />
      )}
    </div>
  );
}

function NoLive({ next, lang }: { next: LiveSession | null; lang: string }) {
  return (
    <section className="lv-empty">
      <span className="lv-empty__icon" aria-hidden="true"><Icon name="play" size={34} /></span>
      <h2>{t("live.noLive")}</h2>
      {next?.scheduled_at ? (
        <div className="lv-next">
          <small>{t("live.next")}</small>
          <b className="lv-next__title">{next.title}</b>
          <span className="pt-muted">{whenLabel(next.scheduled_at, lang)}</span>
          <Countdown to={next.scheduled_at} />
          {next.description && <p className="pt-muted">{next.description}</p>}
        </div>
      ) : <p className="pt-muted">{t("live.noLiveHint")}</p>}
    </section>
  );
}
