import { useEffect } from "react";
import { Link } from "react-router-dom";
import { routes } from "../../app/routes";
import { Icon } from "../../shared/Icon";
import { org } from "../../shared/org";
import { copyText, useToast } from "../../shared/toast";
import { institute, instituteFocus, membershipMotto, program } from "./data";
import "./home.css";

/** الصفحة الرئيسية: بسيطة، بثلاثة أزرار واضحة (تبرّع، انتسب، اسأل) */
export default function HomePage() {
  const toast = useToast();

  useEffect(() => {
    document.title = org.name;
  }, []);

  const copyPhone = async () =>
    toast((await copyText(org.phone)) ? "تم نسخ الرقم" : `الرقم: ${org.phone}`);

  return (
    <div className="hm">
      <header className="hm-top">
        <div className="hm-wrap hm-top__row">
          <span className="hm-brand">
            <img src={org.logo} alt="" width={46} height={46} />
            <b>{org.name}</b>
          </span>
          <Link className="hm-top__ask" to={routes.assistant}>
            <Icon name="chat" size={18} /> المساعد
          </Link>
        </div>
      </header>

      <main>
        {/* البداية: من نحن + الأزرار الثلاثة */}
        <section className="hm-hero">
          <div className="hm-wrap">
            <img className="hm-hero__logo" src={org.logoFull} alt={org.name} width={640} height={380} />
            <p className="hm-slogan">«{org.slogan}»</p>
            <p className="hm-lead">جمعية خيرية شبابية في {org.city}، أغلب أعضائها طلاب جامعيون.</p>

            <div className="hm-actions">
              <a className="hm-btn hm-btn--main" href="#donate">
                <Icon name="heart" /> تبرّع
              </a>
              <a className="hm-btn" href={org.siteUrl} target="_blank" rel="noopener noreferrer">
                <Icon name="userPlus" /> انتسب إلى الجمعية
              </a>
              <Link className="hm-btn" to={routes.assistant}>
                <Icon name="chat" /> اسأل المساعد الذكي
              </Link>
            </div>
          </div>
        </section>

        {/* معهد المحجة البيضاء وكفالته */}
        <section className="hm-section">
          <div className="hm-wrap">
            <h2>{institute.name}</h2>
            <p className="hm-text">{institute.about}</p>
            <blockquote className="hm-quote">«{institute.hadith}»</blockquote>

            <div className="hm-card">
              <h3>اكفل المعهد شهرياً</h3>
              <ul className="hm-prices">
                {institute.sponsorships.map((s) => (
                  <li key={s.label}>
                    <span>{s.label}{s.note && <small> ({s.note})</small>}</span>
                    <b className="num">{s.amount} <small>أوقية قديمة</small></b>
                  </li>
                ))}
              </ul>
              <p className="hm-note">تُجمع مبالغ الكفالة شهرياً لتسيير المعهد فقط.</p>
            </div>
          </div>
        </section>

        {/* البرنامج السنوي */}
        <section className="hm-section hm-section--soft">
          <div className="hm-wrap">
            <h2>ماذا نفعل؟</h2>
            <ul className="hm-tags">
              {program.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <p className="hm-text">
              وفي عام 2026–2027 نركّز على المعهد تحت شعار <b>«{institute.theme}»</b>: {instituteFocus.join("، ")}.
            </p>
          </div>
        </section>

        {/* التبرع والانتساب */}
        <section className="hm-section" id="donate">
          <div className="hm-wrap">
            <div className="hm-donate">
              <h2>ساهم معنا</h2>
              <p>رقم الجمعية للتبرعات ودفع الانتساب والتواصل:</p>
              <div className="hm-phone num" dir="ltr">{org.phone}</div>
              <div className="hm-donate__btns">
                <button type="button" className="hm-btn hm-btn--light" onClick={copyPhone}>
                  <Icon name="copy" /> نسخ الرقم
                </button>
                <a className="hm-btn hm-btn--light" href={`tel:${org.phone}`}>
                  <Icon name="phone" /> اتصال
                </a>
              </div>
              <p className="hm-motto">«{membershipMotto}»</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="hm-footer">
        <div className="hm-wrap">
          <p>{org.name} — {org.city}</p>
          <p>
            <a href={org.siteUrl} target="_blank" rel="noopener noreferrer">موقع الأعضاء والمنتسبين</a>
            {" · "}
            <Link to={routes.assistant}>المساعد الذكي</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
