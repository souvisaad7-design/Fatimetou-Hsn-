/**
 * الصفحة الرئيسية للمنتسب بعد الدخول: لوحة شخصية.
 * التحية، بطاقة المنتسب الرقمية (تُحفظ صورةً)، حالة الشهر الحالي، أرقامه الشخصية،
 * إجراءات سريعة، آخر 6 أشهر، الحملات الجارية، ورقم الدفع مع زر النسخ.
 * كل البيانات من حساب المنتسب نفسه (RLS: لا يرى إلا بياناته).
 */
import { useMemo, useState } from "react";
import { Icon } from "../../../../shared/Icon";
import { org } from "../../../../shared/org";
import { copyText, useToast } from "../../../../shared/toast";
import { membershipConfig as cfg } from "../../config";
import { useDb } from "../../hooks/useDb";
import { campaignRaised, commitment, confirmed, memberMonths, sum } from "../../services/api";
import { currentMonth, dateLabel, memberStatusLabel, money, monthLabel, statusTone } from "../../lib/format";
import type { Member } from "../../types";
import { Badge, Button, Progress } from "../../ui";
import { t, tValue, useLang } from "../../i18n";
import { PledgeForm, ReportPayment } from "./StatusPage";
import { Announcements, HomeBanner, PageLinks } from "../../site/SiteBlocks";
import { useShow } from "../../site/siteApi";

export function HomePage({ member: m0, go }: { member: Member; go: (to: string) => void }) {
  const { lang } = useLang();
  const db = useDb();
  const show = useShow();
  const toast = useToast();
  const member = db.members.find((x) => x.id === m0.id) ?? m0;
  const list = db.lists.find((l) => l.id === member.listId);
  const month = currentMonth();
  const months = useMemo(() => memberMonths(db, member, 6), [db, member]);
  const c = useMemo(() => commitment(db, member), [db, member]);
  const myPayments = db.payments.filter((p) => p.memberId === member.id);
  const thisMonth = months[months.length - 1];
  const yearTotal = sum(confirmed(myPayments.filter((p) => p.month.startsWith(month.slice(0, 4)))));
  const myDonations = confirmed(db.donations.filter((d) => d.memberId === member.id));
  const active = db.campaigns.filter((x) => x.active);
  const [reporting, setReporting] = useState(false);
  const [editingPledge, setEditingPledge] = useState(false);
  const [saving, setSaving] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dash.morning") : hour < 18 ? t("dash.afternoon") : t("dash.evening");
  const firstName = member.fullName.trim().split(/\s+/)[0];
  const supPhone = list?.supervisorPhone;

  const saveCard = async () => {
    setSaving(true);
    try {
      const blob = await drawMemberCard({
        name: member.fullName, code: member.code, status: memberStatusLabel[member.status], list: list?.name ?? t("st.notSet"),
        since: dateLabel(member.approvedAt ?? member.createdAt), pledge: member.pledge ? money(member.pledge) : t("st.byCapacity"),
        labels: { title: t("dash.cardTitle"), org: t("org.name"), list: t("st.list"), since: t("dash.since"), pledge: t("st.myPledge"), status: t("dash.status") },
        rtl: lang === "ar",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${member.code}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(t("dash.cardSaved"));
    } catch {
      toast(t("dash.cardFailed"));
    } finally {
      setSaving(false);
    }
  };

  const monthState = thisMonth?.state ?? "unpaid";

  return (
    <div className="pt-stack pd">
      <HomeBanner />

      {/* التحية */}
      {show("home.hello") && (
      <section className="pd-hello">
        <span className="pd-hello__logo"><img src={org.logoFull} alt="" width={640} height={380} /></span>
        <div>
          <p className="pd-hello__greet">{greeting}</p>
          <h1 className="pd-hello__name">{firstName} 👋</h1>
          <p className="pd-hello__motto">«{t("org.motto")}»</p>
        </div>
      </section>
      )}

      <div className="pd-grid">
        {/* بطاقة المنتسب الرقمية */}
        {show("home.card") && (
        <section className="pd-card" aria-label={t("dash.cardTitle")}>
          <div className="pd-card__top">
            <span className="pd-card__logo"><img src={org.logoFull} alt="" width={640} height={380} /></span>
            <div className="pd-card__org">
              <small>{t("dash.cardTitle")}</small>
              <b>{t("org.name")}</b>
            </div>
          </div>
          <p className="pd-card__name">{member.fullName}</p>
          <p className="pd-card__code num" dir="ltr">{member.code}</p>
          <dl className="pd-card__facts">
            <div><dt>{t("st.list")}</dt><dd>{list?.name ?? t("st.notSet")}</dd></div>
            <div><dt>{t("dash.since")}</dt><dd className="num">{dateLabel(member.approvedAt ?? member.createdAt)}</dd></div>
            <div><dt>{t("st.myPledge")}</dt><dd className="num">{member.pledge ? money(member.pledge) : t("st.byCapacity")}</dd></div>
          </dl>
          <div className="pd-card__foot">
            <span className={`pd-card__status is-${member.status}`}>● {memberStatusLabel[member.status]}</span>
            <button type="button" className="pd-card__save" onClick={saveCard} disabled={saving}>
              <Icon name="download" size={16} /> {saving ? t("dash.saving") : t("dash.saveCard")}
            </button>
          </div>
        </section>
        )}

        {/* حالة الشهر الحالي */}
        {show("home.month") && (
        <section className={`pd-month is-${monthState}`}>
          <span className="pd-month__icon" aria-hidden="true">{monthState === "paid" ? "✓" : monthState === "pending" ? "⏳" : "!"}</span>
          <div className="pd-month__body">
            <small>{t("dash.thisMonth", { month: monthLabel(month) })}</small>
            <b>{monthState === "paid" ? t("dash.paidTitle") : monthState === "pending" ? t("dash.pendingTitle") : t("dash.unpaidTitle")}</b>
            <p>
              {monthState === "paid" ? t("dash.paidText", { amount: money(thisMonth.amount) })
                : monthState === "pending" ? t("dash.pendingText")
                : t("dash.unpaidText", { amount: member.pledge ? money(member.pledge) : t("st.byCapacity") })}
            </p>
          </div>
          {monthState === "unpaid" && <Button icon="plus" onClick={() => setReporting(true)}>{t("st.report")}</Button>}
        </section>
        )}
      </div>

      {/* أرقامي */}
      {show("home.stats") && (
      <section className="pd-stats" aria-label={t("dash.myNumbers")}>
        <div className="pd-stat">
          <div className="pd-ring" style={{ ["--pct" as string]: `${c.pct}%` }}><span className="num">{c.pct}%</span></div>
          <div><b>{t("dash.commitment")}</b><small className="num">{t("st.commit", { paid: c.paid, due: c.due, unit: c.due === 1 ? t("st.month1") : t("st.monthN") })}</small></div>
        </div>
        <div className="pd-stat"><span className="pd-stat__icon">🔥</span><div><b className="num">{c.streakPaid}</b><small>{t("dash.streak")}</small></div></div>
        <div className="pd-stat"><span className="pd-stat__icon">💰</span><div><b className="num">{money(yearTotal, false)}</b><small>{t("dash.yearTotal", { year: month.slice(0, 4) })}</small></div></div>
        <div className="pd-stat"><span className="pd-stat__icon">🤍</span><div><b className="num">{myDonations.length}</b><small>{t("dash.donations", { total: money(sum(myDonations), false) })}</small></div></div>
      </section>
      )}

      {/* إعلانات اللجنة (من «إدارة الموقع») */}
      {show("home.news") && <Announcements />}

      {/* إجراءات سريعة */}
      {show("home.quick") && (
      <section>
        <h2 className="pt-h2">{t("dash.quick")}</h2>
        <div className="pd-actions">
          <button type="button" className="pd-action" onClick={() => setReporting(true)}><span><Icon name="wallet" /></span>{t("st.report")}</button>
          <button type="button" className="pd-action" onClick={() => setEditingPledge(true)}><span><Icon name="edit" /></span>{t("dash.changePledge")}</button>
          <button type="button" className="pd-action" onClick={() => go("campaigns")}><span><Icon name="heart" /></span>{t("home.donate")}</button>
          <a className="pd-action" href="./assistant/"><span><Icon name="chat" /></span>{t("nav.assistant")}</a>
          {supPhone ? (
            <a className="pd-action" href={`https://wa.me/222${supPhone}`} target="_blank" rel="noopener noreferrer"><span><Icon name="phone" /></span>{t("dash.mySupervisor")}</a>
          ) : (
            <a className="pd-action" href={`tel:${cfg.phone}`}><span><Icon name="phone" /></span>{t("login.contact")}</a>
          )}
          <button type="button" className="pd-action" onClick={() => go("status")}><span><Icon name="list" /></span>{t("nav.status")}</button>
        </div>
      </section>
      )}

      {/* آخر 6 أشهر */}
      {show("home.last6") && (
      <section className="pd-panel">
        <div className="pt-section-head">
          <h2 className="pt-h2">{t("dash.last6")}</h2>
          <a href="#/status" className="pt-link">{t("dash.details")}</a>
        </div>
        <ol className="pd-timeline">
          {months.map((x) => (
            <li key={x.month} className={`is-${x.state}`}>
              <span className="pd-timeline__dot" aria-hidden="true">{x.state === "paid" ? "✓" : x.state === "pending" ? "…" : x.state === "unpaid" ? "×" : ""}</span>
              <b>{monthLabel(x.month).split(" ")[0]}</b>
              <small>{x.state === "paid" ? money(x.amount, false) : x.state === "pending" ? t("st.waiting") : x.state === "unpaid" ? t("st.unpaid") : "—"}</small>
            </li>
          ))}
        </ol>
      </section>
      )}

      {/* الحملات الجارية */}
      {show("home.campaigns") && (
      <section>
        <div className="pt-section-head">
          <h2 className="pt-h2">{t("home.active")}</h2>
          <a href="#/campaigns" className="pt-link">{t("home.all")}</a>
        </div>
        {active.length === 0 ? (
          <p className="pt-muted">{t("home.noActive")}</p>
        ) : (
          <div className="pt-campaigns">
            {active.slice(0, 3).map((x) => {
              const raised = campaignRaised(db, x.id);
              return (
                <article key={x.id} className="pt-campaign">
                  <h3>{x.title}</h3>
                  {x.goal > 0 && (
                    <>
                      <Progress value={raised} max={x.goal} />
                      <p className="pt-campaign__nums num"><b>{money(raised, false)}</b> {t("home.raisedOf", { goal: money(x.goal) })}</p>
                    </>
                  )}
                  <Button variant="pink" small icon="heart" onClick={() => go("campaigns")}>{t("home.donate")}</Button>
                </article>
              );
            })}
          </div>
        )}
      </section>
      )}

      {show("home.pages") && <PageLinks />}

      {/* الدفع */}
      {show("home.pay") && (
      <section className="pt-pay">
        <Icon name="wallet" size={28} />
        <div className="pd-pay__body">
          <h2 className="pt-h2">{t("home.payTitle")}</h2>
          <p>
            {t("home.payNumber")} <b className="num" dir="ltr">{cfg.phone}</b>{" "}
            <button type="button" className="pd-copy" onClick={async () => toast((await copyText(cfg.phone)) ? t("dash.copied") : cfg.phone)}>
              <Icon name="copy" size={14} /> {t("dash.copy")}
            </button>
          </p>
          <p className="pt-muted">{t("home.payVia", { methods: cfg.paymentMethods.map((x) => tValue("pay", x)).join(lang === "ar" ? "، " : ", ") })}</p>
        </div>
      </section>
      )}

      {member.status !== "approved" && <Badge tone={statusTone(member.status)}>{memberStatusLabel[member.status]}</Badge>}
      {reporting && <ReportPayment memberId={member.id} defaultAmount={member.pledge} onClose={() => setReporting(false)} />}
      {editingPledge && <PledgeForm memberId={member.id} current={member.pledge} onClose={() => setEditingPledge(false)} />}
    </div>
  );
}

/** رسم بطاقة المنتسب على لوحة رسم وحفظها صورة PNG (دون أي خادم) */
async function drawMemberCard(d: {
  name: string; code: string; status: string; list: string; since: string; pledge: string;
  labels: { title: string; org: string; list: string; since: string; pledge: string; status: string }; rtl: boolean;
}): Promise<Blob> {
  const W = 1050, H = 640, R = 44;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  await document.fonts?.ready;
  const font = (w: number, s: number) => `${w} ${s}px Cairo, Tahoma, sans-serif`;

  // الخلفية
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#3b3478"); g.addColorStop(1, "#1f1c42");
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, R); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.globalAlpha = 0.12; ctx.fillStyle = "#f4aa9c";
  ctx.beginPath(); ctx.arc(W - 60, 70, 220, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(80, H + 40, 200, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;

  // الشعار الدائري
  const logo = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = org.logoFull; });
  const cx = d.rtl ? W - 130 : 130, cy = 130, r = 82;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = "#29244c"; ctx.fill(); ctx.clip();
  const lw = r * 2 * 0.94, lh = lw * (logo.height / logo.width);
  ctx.drawImage(logo, cx - lw / 2, cy - lh / 2 - 3, lw, lh);
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = "#f4aa9c"; ctx.stroke();

  ctx.direction = d.rtl ? "rtl" : "ltr";
  ctx.textAlign = d.rtl ? "right" : "left";
  const x = d.rtl ? W - 250 : 250;
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = font(600, 28); ctx.fillText(d.labels.title, x, 112);
  ctx.fillStyle = "#ffffff"; ctx.font = font(800, 38); ctx.fillText(d.labels.org, x, 162);

  const tx = d.rtl ? W - 70 : 70;
  ctx.fillStyle = "#ffffff"; ctx.font = font(800, 58); ctx.fillText(d.name, tx, 320, W - 140);
  ctx.direction = "ltr"; ctx.textAlign = d.rtl ? "right" : "left";
  ctx.fillStyle = "#f4aa9c"; ctx.font = font(800, 46); ctx.fillText(d.code, tx, 385);

  ctx.direction = d.rtl ? "rtl" : "ltr";
  const cols = [[d.labels.list, d.list], [d.labels.since, d.since], [d.labels.pledge, d.pledge]];
  const colW = (W - 140) / 3;
  cols.forEach(([label, value], i) => {
    const cxp = d.rtl ? W - 70 - i * colW : 70 + i * colW;
    ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.font = font(600, 24); ctx.fillText(label, cxp, 480);
    ctx.fillStyle = "#ffffff"; ctx.font = font(700, 30); ctx.fillText(value, cxp, 522, colW - 20);
  });
  ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = font(700, 26);
  ctx.fillText(`${d.labels.status}: ${d.status}`, tx, 598);

  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
}
