import { Icon } from "../../../../shared/Icon";
import { org } from "../../../../shared/org";
import { membershipConfig as cfg } from "../../config";
import { useDb } from "../../hooks/useDb";
import { campaignRaised } from "../../services/api";
import { money } from "../../lib/format";
import { Button, Progress } from "../../ui";
import { t, tValue, useLang } from "../../i18n";

export function HomePage({ go }: { go: (to: string) => void }) {
  const { lang } = useLang();
  const db = useDb();
  const active = db.campaigns.filter((c) => c.active);

  return (
    <div className="pt-stack">
      <section className="pt-hero">
        <img src={org.logoFull} alt={t("org.name")} width={640} height={380} className="pt-hero__logo" />
        <div className="pt-hero__text">
          <span className="pt-eyebrow">{t("org.committee")}</span>
          <h1>{t("home.title")}</h1>
          <p className="pt-motto">«{t("org.motto")}»</p>
          <p className="pt-lead">{t("org.message")}</p>
          <div className="pt-hero__actions">
            <Button icon="users" onClick={() => go("status")}>{t("home.myStatus")}</Button>
            <Button variant="ghost" icon="heart" onClick={() => go("campaigns")}>{t("nav.campaigns")}</Button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="pt-h2">{t("home.how")}</h2>
        <ol className="pt-steps">
          <li><span>1</span><div><b>{t("home.step1t")}</b><p>{t("home.step1d")}</p></div></li>
          <li><span>2</span><div><b>{t("home.step2t")}</b><p>{t("home.step2d")}</p></div></li>
          <li><span>3</span><div><b>{t("home.step3t")}</b><p>{t("home.step3d")}</p></div></li>
        </ol>
      </section>

      <section>
        <div className="pt-section-head">
          <h2 className="pt-h2">{t("home.active")}</h2>
          <a href="#/campaigns" className="pt-link">{t("home.all")}</a>
        </div>
        {active.length === 0 ? (
          <p className="pt-muted">{t("home.noActive")}</p>
        ) : (
          <div className="pt-campaigns">
            {active.slice(0, 3).map((c) => {
              const raised = campaignRaised(db, c.id);
              return (
                <article key={c.id} className="pt-campaign">
                  <h3>{c.title}</h3>
                  {c.goal > 0 && (
                    <>
                      <Progress value={raised} max={c.goal} />
                      <p className="pt-campaign__nums num"><b>{money(raised, false)}</b> {t("home.raisedOf", { goal: money(c.goal) })}</p>
                    </>
                  )}
                  <Button variant="pink" small icon="heart" onClick={() => go(`campaigns`)}>{t("home.donate")}</Button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="pt-pay">
        <Icon name="wallet" size={28} />
        <div>
          <h2 className="pt-h2">{t("home.payTitle")}</h2>
          <p>{t("home.payNumber")} <b className="num" dir="ltr">{cfg.phone}</b></p>
          <p className="pt-muted">{t("home.payVia", { methods: cfg.paymentMethods.map((m) => tValue("pay", m)).join(lang === "ar" ? "، " : ", ") })}</p>
        </div>
      </section>
    </div>
  );
}
