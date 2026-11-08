import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { routes } from "../../app/routes";
import { Icon } from "../../shared/Icon";
import { copyText, useToast } from "../../shared/toast";
import { ApplicationForm } from "./components/ApplicationForm";
import { StatusLookup } from "./components/StatusLookup";
import { campaign, contact, faq, formSteps, news, requiredDocuments, stats } from "./data";
import "./membership.css";

const toArabicIndex = (i: number) => "١٢٣٤"[i];

export default function MembershipPage() {
  const [step, setStep] = useState(0);
  const [trackQuery, setTrackQuery] = useState<{ ref: string; nonce: number } | null>(null);
  const statusRef = useRef<HTMLElement>(null);
  const toast = useToast();

  useEffect(() => {
    document.title = "بوابة لجنة الانتساب";
  }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const track = (ref: string) => {
    setTrackQuery({ ref, nonce: Date.now() });
    statusRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const copy = async (text: string) => toast((await copyText(text)) ? "تم النسخ" : "تعذّر النسخ، حدّد النص وانسخه يدوياً");

  // روابط داخل الصفحة: نستخدم أزراراً لأن الموقع يعتمد على # في التنقل بين الصفحات
  const nav = [
    ["join", "طلب الانتساب"],
    ["status", "متابعة الطلب"],
    ["news", "الإعلانات"],
    ["faq", "الأسئلة الشائعة"],
    ["contact", "اتصل بنا"],
  ];

  return (
    <div className="mp">
      <header>
        <div className="wrap bar">
          <button type="button" className="logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="لجنة الانتساب - أعلى الصفحة">
            <svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="var(--brand)" /><path d="M12 27c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="var(--brand-ink)" strokeWidth="2.6" fill="none" strokeLinecap="round" /><circle cx="20" cy="13.5" r="4" fill="var(--accent)" /></svg>
            <span><b>لجنة الانتساب</b><small>البوابة الرقمية للعضوية</small></span>
          </button>
          <nav aria-label="القائمة الرئيسية">
            {nav.map(([id, label]) => (
              <button key={id} type="button" onClick={() => scrollTo(id)}>{label}</button>
            ))}
            <Link to={routes.assistant}>المساعد الذكي</Link>
          </nav>
          <button type="button" className="btn btn-primary" onClick={() => scrollTo("join")}>انتسب الآن</button>
        </div>
      </header>

      <main>
        <div className="wrap hero">
          <div className="hero-grid">
            <div>
              <span className="eyebrow">{campaign.title}</span>
              <h1>عضويتك تبدأ <em>بخطوة واحدة</em></h1>
              <p className="lead">قدّم طلب انتسابك إلكترونياً في دقائق، وتابع حالته حتى استلام بطاقة العضوية من مكتب الانتساب في ولايتك.</p>
              <div className="cta">
                <button type="button" className="btn btn-primary" onClick={() => scrollTo("join")}>ابدأ طلب الانتساب</button>
                <button type="button" className="btn btn-ghost" onClick={() => scrollTo("status")}>لدي رقم طلب</button>
              </div>
              <div className="deadline"><span>آخر أجل لاستقبال الطلبات</span><strong className="num">{campaign.deadline}</strong></div>
            </div>
            <div className="card-id" aria-label="نموذج بطاقة العضوية">
              <div className="top"><span>بطاقة عضوية</span><span className="tag">نموذج</span></div>
              <div className="name">محمد عبد الله</div>
              <span className="muted" style={{ fontSize: ".9rem" }}>منتسب جديد</span>
              <dl>
                <dt>رقم العضوية</dt><dd className="num" dir="ltr" style={{ textAlign: "right" }}>INT-2026-04817</dd>
                <dt>الولاية</dt><dd>نواكشوط الغربية</dd>
                <dt>الوحدة القاعدية</dt><dd>تفرغ زينة ٣</dd>
                <dt>تاريخ الانتساب</dt><dd className="num">١٢ / ١١ / ٢٠٢٦</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="stats" aria-label="أرقام الحملة (أرقام توضيحية)">
          {stats.map((s) => <div key={s.label}><b className="num">{s.value}</b><span>{s.label}</span></div>)}
        </div>

        <section id="join">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">طلب الانتساب</span>
              <h2>أربع مراحل لإتمام طلبك</h2>
              <p>املأ البيانات بدقة كما وردت في بطاقة التعريف الوطنية. يمكنك الرجوع لأي مرحلة قبل الإرسال.</p>
            </div>
            <div className="join">
              <div className="join-aside">
                <ol className="steps">
                  {formSteps.map((s, i) => (
                    <li key={s.title} className={i === step ? "on" : i < step ? "done" : undefined} aria-current={i === step ? "step" : undefined}>
                      <span className="n num">{toArabicIndex(i)}</span>
                      <div><h3>{s.title}</h3><p>{s.hint}</p></div>
                    </li>
                  ))}
                </ol>
                <div className="docs">
                  <strong>الوثائق المطلوبة</strong>
                  <ul>{requiredDocuments.map((d) => <li key={d}>{d}</li>)}</ul>
                </div>
              </div>
              <ApplicationForm step={step} onStepChange={setStep} onTrack={track} />
            </div>
          </div>
        </section>

        <section id="status" ref={statusRef} style={{ paddingTop: 0 }}>
          <div className="wrap"><StatusLookup query={trackQuery} /></div>
        </section>

        <section id="news" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head"><span className="eyebrow">الإعلانات</span><h2>آخر مستجدات اللجنة</h2></div>
            <div className="news">
              {news.map((n) => (
                <article key={n.title}><time className="num">{n.date}</time><h3>{n.title}</h3><p>{n.body}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head"><span className="eyebrow">الأسئلة الشائعة</span><h2>قبل أن تسأل</h2></div>
            <div className="faq">
              {faq.map((f, i) => (
                <details key={f.q} open={i === 0}><summary>{f.q}</summary><p>{f.a}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head"><span className="eyebrow">اتصل بنا</span><h2>نحن هنا للمساعدة</h2></div>
            <div className="contact">
              <div><h3>الرقم الأخضر</h3><p><span className="num" dir="ltr">{contact.phone}</span><button className="copy" type="button" onClick={() => copy(contact.phone)}>نسخ</button></p><p>مجاني، من ٨ صباحاً إلى ١٠ مساءً</p></div>
              <div><h3>البريد الإلكتروني</h3><p><span dir="ltr">{contact.email}</span><button className="copy" type="button" onClick={() => copy(contact.email)}>نسخ</button></p><p>نرد خلال ٢٤ ساعة</p></div>
              <div><h3>المقر المركزي</h3><p>{contact.address}</p><p>من الاثنين إلى الجمعة</p></div>
            </div>
          </div>
        </section>
      </main>

      <footer><div className="wrap"><span>© ٢٠٢٦ لجنة الانتساب. جميع الحقوق محفوظة.</span><span>واجهة تجريبية — البيانات والأرقام للتوضيح</span></div></footer>

      <Link className="assistant-fab" to={routes.assistant}><Icon name="chat" /> اسأل المساعد</Link>
    </div>
  );
}
