import { useState } from "react";
import { useToast } from "../../../../shared/toast";
import { membershipConfig as cfg } from "../../config";
import { useDb } from "../../hooks/useDb";
import { commitment, confirmed, deletePayment, recordPayment, setPaymentStatus, sum } from "../../services/api";
import { currentMonth, money, monthLabel } from "../../lib/format";
import { reminderMessage, smsLink } from "../../lib/messages";
import { Badge, Button, Card, ConfirmButton, Empty, Progress } from "../../ui";
import { PaymentFormModal } from "../forms";
import { ReceiptButton } from "../ReceiptButton";

/**
 * «قائمتي»: شاشة المشرف لتحصيل الانتساب الشهري.
 * أخضر = دفع هذا الشهر، أصفر = أبلغ عن دفعة تنتظر التأكيد، أحمر = لم يدفع.
 * تسجيل الدفعة بضغطة واحدة بمبلغ المنتسب الذي اختاره.
 */
export function MyList({ fixedListId }: { fixedListId?: string }) {
  const db = useDb();
  const toast = useToast();
  const [chosen, setChosen] = useState(() => fixedListId ?? db.lists[0]?.id ?? "");
  const [askAmount, setAskAmount] = useState<string | null>(null);
  const listId = fixedListId ?? chosen;
  const list = db.lists.find((l) => l.id === listId);
  const month = currentMonth();

  if (!list) return <Card><Empty icon="list" title="لا توجد قوائم بعد">أنشئ قائمة من «القوائم والمشرفون».</Empty></Card>;

  const members = db.members.filter((m) => m.listId === list.id && m.status === "approved");
  const rows = members.map((m) => {
    const ps = db.payments.filter((p) => p.memberId === m.id && p.month === month && p.status !== "rejected");
    const paid = ps.find((p) => p.status === "confirmed");
    const pending = ps.find((p) => p.status === "pending");
    return { m, paid, pending, state: paid ? "paid" : pending ? "pending" : "unpaid", c: commitment(db, m) } as const;
  });
  const order = { unpaid: 0, pending: 1, paid: 2 };
  rows.sort((a, b) => order[a.state] - order[b.state] || a.m.fullName.localeCompare(b.m.fullName, "ar"));
  const paidCount = rows.filter((r) => r.state === "paid").length;
  const collected = sum(confirmed(db.payments.filter((p) => p.month === month && members.some((m) => m.id === p.memberId))));

  // دفعات أبلغ عنها منتسبو القائمة لأشهر سابقة وتنتظر التأكيد
  const olderPending = db.payments
    .filter((p) => p.status === "pending" && p.month !== month && members.some((m) => m.id === p.memberId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const quickPay = async (memberId: string, amount?: number) => {
    if (!amount) return setAskAmount(memberId);
    await recordPayment({ memberId, month, amount, method: "نقداً عبر المشرف" });
    toast(`تم تسجيل ${money(amount)}`);
  };

  return (
    <div className="ad-stack">
      {!fixedListId && db.lists.length > 1 && (
        <select className="ui-input ad-list-select" value={listId} onChange={(e) => setChosen(e.target.value)} aria-label="القائمة">
          {db.lists.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.supervisor}</option>)}
        </select>
      )}
      <Card className="ad-mylist-head">
        <div>
          <h2>{list.name}</h2>
          <p className="ad-muted">المشرف: {list.supervisor} · {monthLabel(month)}</p>
        </div>
        <div className="ad-mylist-sum">
          <strong className="num">{paidCount}/{members.length}</strong>
          <span className="ad-muted">دفعوا</span>
        </div>
        <Progress value={paidCount} max={members.length} />
        <p className="ad-muted ad-small">المحصّل هذا الشهر: <b className="num">{money(collected)}</b></p>
      </Card>

      {olderPending.length > 0 && (
        <Card title={<>دفعات أشهر سابقة تنتظر التأكيد <Badge tone="warn">{olderPending.length}</Badge></>}>
          <div className="ad-rows">
            {olderPending.map((p) => (
              <div key={p.id} className="ad-row">
                <div className="ad-row__main"><b>{db.members.find((m) => m.id === p.memberId)?.fullName}</b><span className="ad-muted">{monthLabel(p.month)} · {p.method}</span></div>
                <div className="ad-row__side">
                  <ReceiptButton src={p.receipt} />
                  <Button small icon="check" onClick={async () => { await setPaymentStatus(p.id, "confirmed"); toast("تم تأكيد الدفعة"); }}>تأكيد {money(p.amount, false)}</Button>
                  <ConfirmButton label="رفض" onConfirm={() => setPaymentStatus(p.id, "rejected")} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {rows.length === 0 ? <Card><Empty icon="users" title="لا يوجد منتسبون معتمدون في هذه القائمة" /></Card> : (
        <div className="ad-mylist">
          {rows.map(({ m, paid, pending, state, c }) => (
            <div key={m.id} className={`ad-member ad-member--${state}`}>
              <span className="ad-member__dot" aria-hidden="true" />
              <div className="ad-member__info">
                <b>{m.fullName}</b>
                <span className="ad-muted num" dir="ltr">{m.phone}</span>
                <span className="ad-member__meta">
                  <span className="num">{m.pledge ? money(m.pledge) : "حسب القدرة"}</span>
                  <span>· التزام {c.pct}%</span>
                  {c.streakUnpaid >= cfg.lateAfterMonths && <Badge tone="bad">متأخر {c.streakUnpaid} أشهر</Badge>}
                </span>
              </div>
              <div className="ad-member__actions">
                {state === "paid" && paid && (
                  <>
                    <Badge tone="ok">✓ {money(paid.amount, false)}</Badge>
                    {paid.source === "admin" && <ConfirmButton label="تراجع" confirmLabel="حذف الدفعة" onConfirm={() => deletePayment(paid.id)} />}
                  </>
                )}
                {state === "pending" && pending && (
                  <>
                    <ReceiptButton src={pending.receipt} />
                    <Button small icon="check" onClick={async () => { await setPaymentStatus(pending.id, "confirmed"); toast("تم تأكيد الدفعة"); }}>تأكيد {money(pending.amount, false)}</Button>
                  </>
                )}
                {state === "unpaid" && (
                  <>
                    <a className="ui-btn ui-btn--ghost ui-btn--sm" href={smsLink(m.phone, reminderMessage(m, month))} aria-label={`تذكير ${m.fullName} برسالة`}>تذكير</a>
                    <Button small onClick={() => quickPay(m.id, m.pledge)}>دفع{m.pledge ? ` ${money(m.pledge, false)}` : ""}</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {askAmount && <PaymentFormModal memberId={askAmount} month={month} onClose={() => setAskAmount(null)} />}
    </div>
  );
}
