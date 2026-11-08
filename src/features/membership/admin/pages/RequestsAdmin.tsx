import { useState } from "react";
import { useToast } from "../../../../shared/toast";
import { useDb } from "../../hooks/useDb";
import { setDonationStatus, setMemberStatus, setPaymentStatus } from "../../services/api";
import { dateLabel, money, monthLabel } from "../../lib/format";
import { Badge, Button, Card, ConfirmButton, Empty } from "../../ui";
import { ReceiptButton } from "../ReceiptButton";

/**
 * كل ما ينتظر القرار: طلبات المستخدمين الجدد، والدفعات والتبرعات التي أبلغ عنها أصحابها.
 * المشرف (supervisorListId) يرى طلبات المستخدمين الجدد فقط، ومن يقبله يُضاف إلى قائمته مباشرة.
 */
export function RequestsAdmin({ supervisorListId }: { supervisorListId?: string } = {}) {
  const db = useDb();
  const toast = useToast();
  const [listFor, setListFor] = useState<Record<string, string>>({});
  const pendingMembers = db.members.filter((m) => m.status === "pending");
  const pendingPayments = db.payments.filter((p) => p.status === "pending");
  const pendingDonations = db.donations.filter((d) => d.status === "pending");
  const name = (id?: string) => db.members.find((m) => m.id === id);

  return (
    <div className="ad-stack">
      <Card title={<>طلبات المستخدمين الجدد <Badge tone="warn">{pendingMembers.length}</Badge></>}>
        {supervisorListId && <p className="ad-muted ad-small">من تقبله يُضاف إلى قائمتك: <b>{db.lists.find((l) => l.id === supervisorListId)?.name}</b>.</p>}
        {pendingMembers.length === 0 ? <Empty icon="check" title="لا توجد طلبات انتساب جديدة" /> : (
          <div className="ad-requests">
            {pendingMembers.map((m) => (
              <div key={m.id} className="ad-request">
                <div className="ad-request__info">
                  <b>{m.fullName}</b>
                  <span className="ad-muted num" dir="ltr">{m.code} · {m.phone}</span>
                  <span className="ad-muted">{m.occupation}{m.institution ? ` — ${m.institution}` : ""}{m.address ? ` · ${m.address}` : ""}</span>
                  <span className="ad-muted">الانتساب المقترح: {m.pledge ? money(m.pledge) : "حسب القدرة"} · سجّل في {dateLabel(m.createdAt)}</span>
                </div>
                <div className="ad-request__actions">
                  {!supervisorListId && (
                    <select className="ui-input" aria-label={`قائمة ${m.fullName}`} value={listFor[m.id] ?? ""} onChange={(e) => setListFor({ ...listFor, [m.id]: e.target.value })}>
                      <option value="">اختر القائمة</option>
                      {db.lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.supervisor})</option>)}
                    </select>
                  )}
                  <Button small icon="check" onClick={async () => { await setMemberStatus(m.id, "approved", supervisorListId ?? (listFor[m.id] || undefined)); toast(`تم قبول ${m.fullName}`); }}>{supervisorListId ? "قبول في قائمتي" : "قبول"}</Button>
                  <ConfirmButton label="رفض" confirmLabel="تأكيد الرفض" onConfirm={async () => { await setMemberStatus(m.id, "rejected"); toast("تم رفض الطلب"); }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {!supervisorListId && <>
      <Card title={<>دفعات انتساب بانتظار التأكيد <Badge tone="warn">{pendingPayments.length}</Badge></>}>
        {pendingPayments.length === 0 ? <Empty icon="check" title="لا توجد دفعات تنتظر التأكيد" /> : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>المنتسب</th><th>الشهر</th><th>المبلغ</th><th>الطريقة</th><th>رقم العملية</th><th /></tr></thead>
              <tbody>
                {pendingPayments.map((p) => (
                  <tr key={p.id}>
                    <td><b>{name(p.memberId)?.fullName ?? "—"}</b><br /><span className="ad-muted num" dir="ltr">{name(p.memberId)?.code}</span></td>
                    <td>{monthLabel(p.month)}</td>
                    <td className="num">{money(p.amount)}</td>
                    <td>{p.method}</td>
                    <td className="num" dir="ltr">{p.reference ?? "—"}</td>
                    <td><div className="ui-row-actions">
                      <ReceiptButton src={p.receipt} />
                      <Button small icon="check" onClick={async () => { await setPaymentStatus(p.id, "confirmed"); toast("تم تأكيد الدفعة"); }}>تأكيد</Button>
                      <ConfirmButton label="رفض" onConfirm={() => setPaymentStatus(p.id, "rejected")} />
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={<>تبرعات بانتظار التأكيد <Badge tone="warn">{pendingDonations.length}</Badge></>}>
        {pendingDonations.length === 0 ? <Empty icon="check" title="لا توجد تبرعات تنتظر التأكيد" /> : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>المتبرع</th><th>الحملة</th><th>المبلغ</th><th>الطريقة</th><th>رقم العملية</th><th /></tr></thead>
              <tbody>
                {pendingDonations.map((d) => (
                  <tr key={d.id}>
                    <td><b>{d.donorName}</b>{d.memberId && <><br /><Badge tone="brand">منتسب</Badge></>}</td>
                    <td>{db.campaigns.find((c) => c.id === d.campaignId)?.title ?? "—"}</td>
                    <td className="num">{money(d.amount)}</td>
                    <td>{d.method}</td>
                    <td className="num" dir="ltr">{d.reference ?? "—"}</td>
                    <td><div className="ui-row-actions">
                      <Button small icon="check" onClick={async () => { await setDonationStatus(d.id, "confirmed"); toast("تم تأكيد التبرع"); }}>تأكيد</Button>
                      <ConfirmButton label="رفض" onConfirm={() => setDonationStatus(d.id, "rejected")} />
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </>}
    </div>
  );
}
