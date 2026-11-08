import { useMemo, useState } from "react";
import { normalizeArabic } from "../../../../shared/arabic";
import { useToast } from "../../../../shared/toast";
import { useDb } from "../../hooks/useDb";
import { commitment, confirmed, deleteMember, memberMonths, setMemberStatus, setPaymentStatus, sum } from "../../services/api";
import { currentMonth, dateLabel, memberStatusLabel, money, monthLabel, recordStatusLabel, statusTone } from "../../lib/format";
import { downloadCsv } from "../../lib/csv";
import type { MemberStatus } from "../../types";
import { Badge, Button, Card, ConfirmButton, Empty, Modal } from "../../ui";
import { MemberFormModal, PaymentFormModal } from "../forms";
import { ReceiptButton } from "../ReceiptButton";

export function MembersAdmin({ openId, go }: { openId?: string; go: (to: string) => void }) {
  const db = useDb();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<MemberStatus | "">("");
  const [listId, setListId] = useState("");
  const [adding, setAdding] = useState(false);
  const month = currentMonth();
  const paid = useMemo(() => new Set(confirmed(db.payments.filter((p) => p.month === month)).map((p) => p.memberId)), [db.payments, month]);

  const rows = useMemo(() => {
    const nq = normalizeArabic(q);
    return db.members.filter((m) =>
      (!status || m.status === status) &&
      (!listId || (listId === "none" ? !m.listId : m.listId === listId)) &&
      (!nq || normalizeArabic(`${m.fullName} ${m.code} ${m.phone} ${m.institution ?? ""} ${m.address ?? ""}`).includes(nq)),
    );
  }, [db.members, q, status, listId]);

  const exportCsv = () =>
    downloadCsv(`منتسبو-عون-وسند-${month}.csv`, ["رقم المنتسب", "الاسم", "الهاتف", "الجنس", "الوضعية", "الجامعة/العمل", "الحي", "القائمة", "المشرف", "الانتساب الشهري", "الحالة", "تاريخ التسجيل"],
      rows.map((m) => { const l = db.lists.find((x) => x.id === m.listId); return [m.code, m.fullName, m.phone, m.gender, m.occupation, m.institution, m.address, l?.name, l?.supervisor, m.pledge, memberStatusLabel[m.status], dateLabel(m.createdAt)]; }));

  return (
    <div className="ad-stack">
      <Card>
        <div className="ad-toolbar">
          <input className="ui-input ad-toolbar__search" type="search" placeholder="ابحث بالاسم أو الرقم أو الهاتف..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث في المنتسبين" />
          <select className="ui-input" value={status} onChange={(e) => setStatus(e.target.value as MemberStatus | "")} aria-label="الحالة">
            <option value="">كل الحالات</option>
            {(Object.keys(memberStatusLabel) as MemberStatus[]).map((s) => <option key={s} value={s}>{memberStatusLabel[s]}</option>)}
          </select>
          <select className="ui-input" value={listId} onChange={(e) => setListId(e.target.value)} aria-label="القائمة">
            <option value="">كل القوائم</option>
            <option value="none">بدون قائمة</option>
            {db.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <Button icon="plus" onClick={() => setAdding(true)}>إضافة منتسب</Button>
          <Button variant="ghost" icon="download" onClick={exportCsv}>تصدير</Button>
        </div>
        <p className="ad-muted ad-small">{rows.length} منتسب</p>
        {rows.length === 0 ? <Empty icon="users" title="لا يوجد منتسبون بهذه الشروط" /> : (
          <div className="ui-table-wrap">
            <table className="ui-table ad-clickable">
              <thead><tr><th>الرقم</th><th>الاسم</th><th>الهاتف</th><th>القائمة</th><th>الحالة</th><th>{monthLabel(month)}</th><th>الالتزام</th></tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} onClick={() => go(`members/${m.id}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && go(`members/${m.id}`)}>
                    <td className="num" dir="ltr">{m.code}</td>
                    <td><b>{m.fullName}</b></td>
                    <td className="num" dir="ltr">{m.phone}</td>
                    <td>{db.lists.find((l) => l.id === m.listId)?.name ?? <span className="ad-muted">—</span>}</td>
                    <td><Badge tone={statusTone(m.status)}>{memberStatusLabel[m.status]}</Badge></td>
                    <td>{m.status === "approved" ? (paid.has(m.id) ? <Badge tone="ok">مدفوع</Badge> : <Badge tone="bad">غير مدفوع</Badge>) : <span className="ad-muted">—</span>}</td>
                    <td className="num">{m.status === "approved" ? `${commitment(db, m).pct}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {adding && <MemberFormModal onClose={() => setAdding(false)} />}
      {openId && db.members.some((m) => m.id === openId) && <MemberDetail id={openId} onClose={() => go("members")} />}
    </div>
  );
}

function MemberDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  const m = db.members.find((x) => x.id === id)!;
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const list = db.lists.find((l) => l.id === m.listId);
  const months = memberMonths(db, m, 12);
  const payments = db.payments.filter((p) => p.memberId === m.id).sort((a, b) => b.month.localeCompare(a.month));
  const donations = db.donations.filter((d) => d.memberId === m.id);

  return (
    <Modal title={m.fullName} onClose={onClose} wide>
      <div className="ad-stack">
        <div className="ad-detail-head">
          <span className="num" dir="ltr">{m.code}</span>
          <Badge tone={statusTone(m.status)}>{memberStatusLabel[m.status]}</Badge>
          <div className="ad-detail-actions">
            {m.status !== "approved" && <Button small icon="check" onClick={async () => { await setMemberStatus(m.id, "approved"); toast("تم اعتماد المنتسب"); }}>اعتماد</Button>}
            {m.status === "approved" && <ConfirmButton label="إيقاف" confirmLabel="تأكيد الإيقاف" variant="ghost" onConfirm={() => setMemberStatus(m.id, "suspended")} />}
            <Button small variant="ghost" icon="edit" onClick={() => setEditing(true)}>تعديل</Button>
            <ConfirmButton label="حذف" icon="trash" confirmLabel="حذف نهائي" onConfirm={async () => { await deleteMember(m.id); toast("تم حذف المنتسب"); onClose(); }} />
          </div>
        </div>
        <dl className="ad-facts">
          <div><dt>الهاتف</dt><dd className="num" dir="ltr">{m.phone}</dd></div>
          <div><dt>الرقم الوطني</dt><dd className="num" dir="ltr">{m.nni ?? "—"}</dd></div>
          <div><dt>الجنس</dt><dd>{m.gender}</dd></div>
          <div><dt>تاريخ الميلاد</dt><dd className="num">{m.birthDate ? dateLabel(m.birthDate) : "—"}</dd></div>
          <div><dt>الوضعية</dt><dd>{m.occupation}</dd></div>
          <div><dt>الجامعة / العمل</dt><dd>{m.institution ?? "—"}</dd></div>
          <div><dt>الحي</dt><dd>{m.address ?? "—"}</dd></div>
          <div><dt>القائمة / المشرف</dt><dd>{list ? `${list.name} — ${list.supervisor}` : "—"}</dd></div>
          <div><dt>الانتساب الشهري</dt><dd className="num">{m.pledge ? money(m.pledge) : "حسب القدرة"}</dd></div>
          <div><dt>تاريخ التسجيل</dt><dd className="num">{dateLabel(m.createdAt)}</dd></div>
          {m.notes && <div className="ad-facts__full"><dt>ملاحظات</dt><dd>{m.notes}</dd></div>}
        </dl>

        {(m.status === "approved" || m.status === "suspended") && (
          <Card title="الانتساب الشهري (آخر 12 شهراً)" actions={<Button small icon="plus" onClick={() => setPaying(currentMonth())}>تسجيل دفعة</Button>}>
            <div className="ui-months">
              {months.map((x) => (
                <button key={x.month} type="button" className={`ui-month ui-month--${x.state}`} onClick={() => x.state === "unpaid" && setPaying(x.month)} title={x.state === "unpaid" ? "تسجيل دفعة لهذا الشهر" : monthLabel(x.month)}>
                  <b>{monthLabel(x.month).split(" ")[0]}</b>
                  <span className="num">{x.amount ? money(x.amount, false) : x.month.slice(0, 4)}</span>
                </button>
              ))}
            </div>
            <p className="ad-muted ad-small">المجموع المؤكد: <b className="num">{money(sum(confirmed(payments)))}</b> · اضغط على شهر غير مدفوع لتسجيل دفعته.</p>
            {payments.length > 0 && (
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead><tr><th>الشهر</th><th>المبلغ</th><th>الطريقة</th><th>المصدر</th><th>الحالة</th><th /></tr></thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{monthLabel(p.month)}</td>
                        <td className="num">{money(p.amount)}</td>
                        <td>{p.method}{p.reference && <span className="ad-muted num" dir="ltr"> · {p.reference}</span>}</td>
                        <td>{p.source === "member" ? "أبلغ عنها المنتسب" : "سجّلها المشرف"}</td>
                        <td><Badge tone={statusTone(p.status)}>{recordStatusLabel[p.status]}</Badge></td>
                        <td><div className="ui-row-actions"><ReceiptButton src={p.receipt} />{p.status === "pending" && <Button small onClick={() => setPaymentStatus(p.id, "confirmed")}>تأكيد</Button>}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <Card title="التبرعات للحملات">
          {donations.length === 0 ? <p className="ad-muted">لا توجد تبرعات.</p> : (
            <div className="ad-rows">
              {donations.map((d) => (
                <div key={d.id} className="ad-row">
                  <div className="ad-row__main"><b>{db.campaigns.find((c) => c.id === d.campaignId)?.title ?? "—"}</b><span className="ad-muted num">{dateLabel(d.createdAt)}</span></div>
                  <div className="ad-row__side"><span className="num">{money(d.amount)}</span><Badge tone={statusTone(d.status)}>{recordStatusLabel[d.status]}</Badge></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      {editing && <MemberFormModal member={m} onClose={() => setEditing(false)} />}
      {paying && <PaymentFormModal memberId={m.id} month={paying} onClose={() => setPaying(null)} />}
    </Modal>
  );
}
