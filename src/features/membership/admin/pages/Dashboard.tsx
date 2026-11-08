import { useDb } from "../../hooks/useDb";
import { campaignRaised, confirmed, dashboardStats, sum } from "../../services/api";
import { currentMonth, money, monthLabel } from "../../lib/format";
import { Button, Card, Progress, Stat } from "../../ui";

export function Dashboard({ go }: { go: (to: string) => void }) {
  const db = useDb();
  const s = dashboardStats(db);
  const month = currentMonth();
  const pendingTotal = s.pending + s.pendingPayments + s.pendingDonations;

  return (
    <div className="ad-stack">
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

      <div className="ad-grid-2">
        <Card title="آخر 6 أشهر (أوقية قديمة)">
          <MonthlyChart data={s.byMonth} />
        </Card>

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
      </div>

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
  );
}

/** رسم أعمدة بسيط: الانتساب الشهري والتبرعات لكل شهر */
function MonthlyChart({ data }: { data: Array<{ month: string; membership: number; donations: number }> }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.membership, d.donations]));
  const W = 600, H = 220, pad = 28, bw = (W - pad * 2) / data.length;
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  return (
    <div className="ad-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="الانتساب الشهري والتبرعات في آخر 6 أشهر">
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={pad} x2={W - pad} y1={y(max * t)} y2={y(max * t)} stroke="var(--line)" strokeDasharray={t ? "4 4" : undefined} />
        ))}
        {data.map((d, i) => {
          const x = W - pad - (i + 1) * bw; // من اليمين إلى اليسار
          return (
            <g key={d.month}>
              <rect x={x + bw * 0.18} y={y(d.membership)} width={bw * 0.3} height={H - pad - y(d.membership)} rx={4} fill="var(--chart-a)">
                <title>{`${monthLabel(d.month)} — انتساب: ${money(d.membership)}`}</title>
              </rect>
              <rect x={x + bw * 0.52} y={y(d.donations)} width={bw * 0.3} height={H - pad - y(d.donations)} rx={4} fill="var(--chart-b)">
                <title>{`${monthLabel(d.month)} — تبرعات: ${money(d.donations)}`}</title>
              </rect>
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--muted)">{monthLabel(d.month).split(" ")[0]}</text>
            </g>
          );
        })}
        <text x={pad} y={14} textAnchor="start" fontSize="11" fill="var(--muted)">{money(max, false)}</text>
      </svg>
      <div className="ad-legend"><span><i style={{ background: "var(--chart-a)" }} /> الانتساب</span><span><i style={{ background: "var(--chart-b)" }} /> التبرعات</span></div>
    </div>
  );
}
