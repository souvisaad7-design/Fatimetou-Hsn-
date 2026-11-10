import { lazy, Suspense } from "react";
import { useDb } from "../../hooks/useDb";
import { campaignRaised, confirmed, dashboardStats, sum } from "../../services/api";
import { currentMonth, money, monthLabel } from "../../lib/format";
import { Button, Card, Progress, Stat } from "../../ui";

// Chart.js يُحمَّل فقط عند فتح لوحة المعلومات (لا مع شاشة الدخول)
const charts = () => import("../charts");
const GrowthChart = lazy(() => charts().then((m) => ({ default: m.GrowthChart })));
const PlansChart = lazy(() => charts().then((m) => ({ default: m.PlansChart })));
const ReferralsChart = lazy(() => charts().then((m) => ({ default: m.ReferralsChart })));
const MoneyChart = lazy(() => charts().then((m) => ({ default: m.MoneyChart })));
const ChartSlot = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<div className="ad-chart ad-chart--loading" style={{ height: 260 }} />}>{children}</Suspense>;

export function Dashboard({ go }: { go: (to: string) => void }) {
  const db = useDb();
  const s = dashboardStats(db);
  const month = currentMonth();
  const pendingTotal = s.pending + s.pendingPayments + s.pendingDonations;
  const newThisMonth = db.members.filter((m) => m.createdAt.slice(0, 7) === month).length;

  return (
    <div className="ad-stack">
      <div className="ad-hero">
        <div>
          <h2>نظرة عامة</h2>
          <p className="ad-muted">{monthLabel(month)} · <span className="num">{newThisMonth}</span> تسجيل جديد هذا الشهر</p>
        </div>
        <div className="ad-hero__actions">
          <Button variant="ghost" icon="users" onClick={() => go("members")}>جدول المنتسبين</Button>
          <Button variant="ghost" icon="inbox" onClick={() => go("requests")}>الطلبات</Button>
        </div>
      </div>

      <div className="ad-stats">
        <Stat tone="navy" icon="users" label="المنتسبون المعتمدون" value={s.approved} sub={`من أصل ${s.members} مسجل`} />
        <Stat icon="wallet" label={`انتساب ${monthLabel(month)}`} value={money(s.membershipThisMonth, false)} sub={`${s.paidThisMonth} من ${s.approved} دفعوا`} />
        <Stat icon="heart" label="مجموع التبرعات المؤكدة" value={money(s.donationsTotal, false)} sub={`${s.activeCampaigns} حملة جارية`} />
        <Stat tone="pink" icon="inbox" label="طلبات تنتظر المراجعة" value={pendingTotal} sub={`${s.pending} انتساب · ${s.pendingPayments} دفعة · ${s.pendingDonations} تبرع`} />
      </div>

      {pendingTotal > 0 && (
        <div className="ad-alert">
          <span>لديك <b className="num">{pendingTotal}</b> طلباً بانتظار المراجعة.</span>
          <Button small onClick={() => go("requests")}>مراجعة الطلبات</Button>
        </div>
      )}

      <div className="ad-grid-charts">
        <Card title="نمو الأعضاء" actions={<span className="ad-chip">آخر 12 شهراً</span>} className="ad-span-2">
          <ChartSlot><GrowthChart db={db} /></ChartSlot>
        </Card>
        <Card title="توزيع الباقات" actions={<span className="ad-chip">مبلغ الانتساب الشهري</span>}>
          <ChartSlot><PlansChart db={db} /></ChartSlot>
        </Card>
      </div>

      <div className="ad-grid-2">
        <Card title="الإحالات حسب المشرف" actions={<span className="ad-chip">المنتسبون المعتمدون</span>}>
          <ChartSlot><ReferralsChart db={db} /></ChartSlot>
        </Card>
        <Card title="الانتساب والتبرعات" actions={<span className="ad-chip">آخر 6 أشهر · أوقية قديمة</span>}>
          <ChartSlot><MoneyChart data={s.byMonth} /></ChartSlot>
        </Card>
      </div>

      <div className="ad-grid-2">
        <Card title={`القوائم — ${monthLabel(month)}`} actions={<Button small variant="ghost" onClick={() => go("lists")}>الكل</Button>}>
          {db.lists.length === 0 ? <p className="ad-muted">لا توجد قوائم بعد.</p> : (
            <div className="ad-rows">
              {db.lists.map((l) => {
                const members = db.members.filter((m) => m.listId === l.id && m.status === "approved");
                const paid = new Set(confirmed(db.payments.filter((p) => p.month === month)).map((p) => p.memberId));
                const paidCount = members.filter((m) => paid.has(m.id)).length;
                const collected = sum(confirmed(db.payments.filter((p) => p.month === month && members.some((m) => m.id === p.memberId))));
                return (
                  <div key={l.id} className="ad-row">
                    <div className="ad-row__main"><b>{l.name}</b><span className="ad-muted">{l.supervisor}</span></div>
                    <div className="ad-row__side">
                      <span className="num">{paidCount}/{members.length}</span>
                      <Progress value={paidCount} max={members.length} />
                      <span className="ad-muted num">{money(collected, false)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

      <Card title="الحملات الجارية" actions={<Button small variant="ghost" onClick={() => go("campaigns")}>إدارة الحملات</Button>}>
        <div className="ad-rows">
          {db.campaigns.filter((c) => c.active).map((c) => {
            const raised = campaignRaised(db, c.id);
            return (
              <div key={c.id} className="ad-row">
                <div className="ad-row__main"><b>{c.title}</b></div>
                <div className="ad-row__side ad-row__side--wide">
                  {c.goal > 0 && <Progress value={raised} max={c.goal} />}
                  <span className="num">{money(raised, false)}{c.goal > 0 ? ` / ${money(c.goal, false)}` : ""}</span>
                </div>
              </div>
            );
          })}
          {s.activeCampaigns === 0 && <p className="ad-muted">لا توجد حملات جارية.</p>}
        </div>
      </Card>
      </div>
    </div>
  );
}
