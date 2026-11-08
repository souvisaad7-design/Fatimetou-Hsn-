import { Icon } from "../../../../shared/Icon";
import { org } from "../../../../shared/org";
import { membershipConfig as cfg } from "../../config";
import { useDb } from "../../hooks/useDb";
import { campaignRaised } from "../../services/api";
import { money } from "../../lib/format";
import { Button, Progress } from "../../ui";

export function HomePage({ go }: { go: (to: string) => void }) {
  const db = useDb();
  const active = db.campaigns.filter((c) => c.active);

  return (
    <div className="pt-stack">
      <section className="pt-hero">
        <img src={org.logoFull} alt={cfg.orgName} width={640} height={380} className="pt-hero__logo" />
        <div className="pt-hero__text">
          <span className="pt-eyebrow">{cfg.committeeName}</span>
          <h1>كن جزءاً من «عون وسند»</h1>
          <p className="pt-motto">«{cfg.motto}»</p>
          <p className="pt-lead">{cfg.message}</p>
          <div className="pt-hero__actions">
            <Button icon="userPlus" onClick={() => go("register")}>سجّل منتسباً جديداً</Button>
            <Button variant="ghost" icon="users" onClick={() => go("status")}>تابع وضعيتي</Button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="pt-h2">كيف يتم الانتساب؟</h2>
        <ol className="pt-steps">
          <li><span>1</span><div><b>سجّل بياناتك</b><p>املأ الاستمارة واحصل على رقم المنتسب.</p></div></li>
          <li><span>2</span><div><b>تراجع اللجنة طلبك</b><p>بعد القبول تُضاف إلى قائمة لها مشرف يتابع انتسابك.</p></div></li>
          <li><span>3</span><div><b>انتسب شهرياً حسب قدرتك</b><p>ادفع للمشرف أو عبر التطبيقات البنكية، وتابع كل أشهرك من «وضعيتي».</p></div></li>
        </ol>
      </section>

      <section>
        <div className="pt-section-head">
          <h2 className="pt-h2">الحملات الجارية</h2>
          <a href="#/campaigns" className="pt-link">كل الحملات</a>
        </div>
        {active.length === 0 ? (
          <p className="pt-muted">لا توجد حملات جارية حالياً.</p>
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
                      <p className="pt-campaign__nums num"><b>{money(raised, false)}</b> من {money(c.goal)}</p>
                    </>
                  )}
                  <Button variant="pink" small icon="heart" onClick={() => go(`campaigns`)}>تبرّع</Button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="pt-pay">
        <Icon name="wallet" size={28} />
        <div>
          <h2 className="pt-h2">الدفع</h2>
          <p>رقم الجمعية للانتساب والتبرعات: <b className="num" dir="ltr">{cfg.phone}</b></p>
          <p className="pt-muted">عبر: {cfg.paymentMethods.join("، ")}.</p>
        </div>
      </section>
    </div>
  );
}
