import { useMemo, useState } from "react";
import { useDb } from "../../hooks/useDb";
import { confirmed, deletePayment, setPaymentStatus, sum } from "../../services/api";
import { currentMonth, lastMonths, money, monthLabel, recordStatusLabel, statusTone } from "../../lib/format";
import { downloadCsv } from "../../lib/csv";
import { Badge, Button, Card, ConfirmButton, Empty, Progress, Stat } from "../../ui";
import { PaymentFormModal } from "../forms";
import { ReceiptButton } from "../ReceiptButton";

/** متابعة الانتساب الشهري: من دفع ومن لم يدفع في كل شهر، حسب القائمة */
export function PaymentsAdmin() {
  const db = useDb();
  const months = lastMonths(12).reverse();
  const [month, setMonth] = useState(currentMonth());
  const [listId, setListId] = useState("");
  const [paying, setPaying] = useState<{ memberId?: string } | null>(null);

  const approved = db.members.filter((m) => m.status === "approved" && (!listId || m.listId === listId));
  const monthPayments = db.payments.filter((p) => p.month === month && (!listId || approved.some((m) => m.id === p.memberId)));
  const paidIds = useMemo(() => new Set(confirmed(monthPayments).map((p) => p.memberId)), [monthPayments]);
  const unpaid = approved.filter((m) => !paidIds.has(m.id));
  const collected = sum(confirmed(monthPayments));
  const memberName = (id: string) => db.members.find((m) => m.id === id);

  const exportCsv = () =>
    downloadCsv(`الانتساب-${month}.csv`, ["رقم المنتسب", "الاسم", "القائمة", "الشهر", "المبلغ", "الطريقة", "رقم العملية", "الحالة"],
      monthPayments.map((p) => { const m = memberName(p.memberId); return [m?.code, m?.fullName, db.lists.find((l) => l.id === m?.listId)?.name, p.month, p.amount, p.method, p.reference, recordStatusLabel[p.status]]; }));

  return (
    <div className="ad-stack">
      <Card>
        <div className="ad-toolbar">
          <select className="ui-input" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="الشهر">
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select className="ui-input" value={listId} onChange={(e) => setListId(e.target.value)} aria-label="القائمة">
            <option value="">كل القوائم</option>
            {db.lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.supervisor})</option>)}
          </select>
          <Button icon="plus" onClick={() => setPaying({})}>تسجيل دفعة</Button>
          <Button variant="ghost" icon="download" onClick={exportCsv}>تصدير</Button>
        </div>
      </Card>

      <div className="ad-stats">
        <Stat tone="navy" icon="wallet" label={`المحصّل في ${monthLabel(month)}`} value={money(collected, false)} sub="أوقية قديمة (مؤكد)" />
        <Stat icon="check" label="دفعوا" value={`${approved.length - unpaid.length} / ${approved.length}`} sub={<Progress value={approved.length - unpaid.length} max={approved.length} />} />
        <Stat icon="clock" label="بانتظار التأكيد" value={monthPayments.filter((p) => p.status === "pending").length} />
      </div>

      <Card title={<>لم يدفعوا بعد <Badge tone="bad">{unpaid.length}</Badge></>}>
        {unpaid.length === 0 ? <Empty icon="check" title="كل المنتسبين المعتمدين دفعوا هذا الشهر" /> : (
          <div className="ad-rows">
            {unpaid.map((m) => {
              const l = db.lists.find((x) => x.id === m.listId);
              return (
                <div key={m.id} className="ad-row">
                  <div className="ad-row__main"><b>{m.fullName}</b><span className="ad-muted">{m.code} · {l ? `${l.name} — ${l.supervisor}` : "بدون قائمة"}</span></div>
                  <div className="ad-row__side"><span className="ad-muted num">{m.pledge ? money(m.pledge, false) : "حسب القدرة"}</span><Button small onClick={() => setPaying({ memberId: m.id })}>تسجيل دفعة</Button></div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title={`دفعات ${monthLabel(month)}`}>
        {monthPayments.length === 0 ? <Empty icon="wallet" title="لا توجد دفعات لهذا الشهر" /> : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>المنتسب</th><th>المبلغ</th><th>الطريقة</th><th>المصدر</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {monthPayments.map((p) => (
                  <tr key={p.id}>
                    <td><b>{memberName(p.memberId)?.fullName ?? "—"}</b></td>
                    <td className="num">{money(p.amount)}</td>
                    <td>{p.method}{p.reference && <span className="ad-muted num" dir="ltr"> · {p.reference}</span>}</td>
                    <td>{p.source === "member" ? "المنتسب" : "المشرف"}</td>
                    <td><Badge tone={statusTone(p.status)}>{recordStatusLabel[p.status]}</Badge></td>
                    <td><div className="ui-row-actions">
                      <ReceiptButton src={p.receipt} />
                      {p.status === "pending" && <Button small onClick={() => setPaymentStatus(p.id, "confirmed")}>تأكيد</Button>}
                      <ConfirmButton label="حذف" icon="trash" onConfirm={() => deletePayment(p.id)} />
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {paying && <PaymentFormModal memberId={paying.memberId} month={month} onClose={() => setPaying(null)} />}
    </div>
  );
}
