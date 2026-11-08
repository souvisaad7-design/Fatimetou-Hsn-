import { useMemo, useState, type FormEvent } from "react";
import { membershipConfig as cfg } from "../../config";
import { useDb } from "../../hooks/useDb";
import { confirmed, findMember, memberMonths, reportPayment, sum } from "../../services/api";
import { dateLabel, lastMonths, memberStatusLabel, money, monthLabel, recordStatusLabel, statusTone } from "../../lib/format";
import { validateAmount, validatePhone } from "../../lib/validation";
import { Badge, Button, Card, Empty, Field, Modal, Notice } from "../../ui";
import { memberSession } from "../session";
import { useToast } from "../../../../shared/toast";

export function StatusPage({ go }: { go: (to: string) => void }) {
  const db = useDb();
  const [memberId, setMemberId] = useState(memberSession.get());
  const member = db.members.find((m) => m.id === memberId) ?? null;

  if (!member) return <MemberLogin onLogin={(id) => { memberSession.set(id); setMemberId(id); }} go={go} />;
  return <MemberDashboard memberId={member.id} onLogout={() => { memberSession.clear(); setMemberId(null); }} go={go} />;
}

function MemberLogin({ onLogin, go }: { onLogin: (id: string) => void; go: (to: string) => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const pe = validatePhone(phone);
    if (pe) return setError(pe);
    if (!code.trim()) return setError("أدخل رقم المنتسب");
    const m = findMember(phone, code);
    if (!m) return setError("لم نجد منتسباً بهذا الهاتف ورقم المنتسب. تأكد من البيانات.");
    onLogin(m.id);
  };
  return (
    <div className="pt-narrow pt-stack">
      <div>
        <h1 className="pt-h1">وضعيتي</h1>
        <p className="pt-muted">ادخل برقم هاتفك ورقم المنتسب الذي حصلت عليه عند التسجيل.</p>
      </div>
      <Card>
        <form className="pt-stack" onSubmit={submit} noValidate>
          <Field label="رقم الهاتف">{(id) => <input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" dir="ltr" autoComplete="tel" />}</Field>
          <Field label="رقم المنتسب" hint="مثال: AWN-0012 أو 12">{(id) => <input id={id} value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" autoCapitalize="characters" />}</Field>
          {error && <p className="ui-error" role="alert">{error}</p>}
          <Button type="submit" block>دخول</Button>
        </form>
      </Card>
      <p className="pt-center pt-muted">لست مسجلاً بعد؟ <a className="pt-link" href="#/register" onClick={() => go("register")}>سجّل الآن</a></p>
    </div>
  );
}

function MemberDashboard({ memberId, onLogout, go }: { memberId: string; onLogout: () => void; go: (to: string) => void }) {
  const db = useDb();
  const member = db.members.find((m) => m.id === memberId)!;
  const list = db.lists.find((l) => l.id === member.listId);
  const months = useMemo(() => memberMonths(db, member, 12), [db, member]);
  const payments = db.payments.filter((p) => p.memberId === member.id).sort((a, b) => b.month.localeCompare(a.month) || b.createdAt.localeCompare(a.createdAt));
  const donations = db.donations.filter((d) => d.memberId === member.id);
  const [reporting, setReporting] = useState(false);
  const unpaid = months.filter((m) => m.state === "unpaid").length;

  return (
    <div className="pt-stack">
      <Card className="pt-member">
        <div className="pt-member__head">
          <div>
            <span className="pt-eyebrow num" dir="ltr">{member.code}</span>
            <h1 className="pt-h1">{member.fullName}</h1>
          </div>
          <Badge tone={statusTone(member.status)}>{memberStatusLabel[member.status]}</Badge>
        </div>
        <dl className="pt-facts">
          <div><dt>القائمة</dt><dd>{list?.name ?? "لم تُحدَّد بعد"}</dd></div>
          <div><dt>المشرف</dt><dd>{list ? <>{list.supervisor}{list.supervisorPhone && <span className="num" dir="ltr"> · {list.supervisorPhone}</span>}</> : "—"}</dd></div>
          <div><dt>الانتساب الشهري</dt><dd className="num">{member.pledge ? money(member.pledge) : "حسب القدرة"}</dd></div>
          <div><dt>تاريخ التسجيل</dt><dd className="num">{dateLabel(member.createdAt)}</dd></div>
        </dl>
        {member.status === "pending" && <Notice>طلبك قيد المراجعة من اللجنة الانتسابية. ستظهر قائمتك ومشرفك هنا بعد القبول.</Notice>}
        {member.status === "rejected" && <Notice tone="warn">لم يُقبل طلبك. للاستفسار تواصل مع الجمعية على <b dir="ltr">{cfg.phone}</b>.</Notice>}
        {member.status === "suspended" && <Notice tone="warn">عضويتك موقوفة حالياً. تواصل مع مشرف قائمتك أو مع الجمعية.</Notice>}
        <div className="pt-member__actions">
          <Button variant="ghost" small icon="logout" onClick={onLogout}>خروج</Button>
        </div>
      </Card>

      {(member.status === "approved" || member.status === "suspended") && (
        <Card title="انتسابي الشهري" actions={<Button small icon="plus" onClick={() => setReporting(true)}>أبلغ عن دفعة</Button>}>
          <div className="ui-months">
            {months.map((m) => (
              <div key={m.month} className={`ui-month ui-month--${m.state}`} title={monthLabel(m.month)}>
                <b>{monthLabel(m.month).split(" ")[0]}</b>
                <span className="num">{m.month.slice(0, 4)}</span>
                <div>{m.state === "paid" ? "✓ مدفوع" : m.state === "pending" ? "بانتظار" : m.state === "unpaid" ? "غير مدفوع" : "—"}</div>
              </div>
            ))}
          </div>
          <p className="pt-muted pt-mt">
            مجموع ما دفعته: <b className="num">{money(sum(confirmed(payments)))}</b>
            {unpaid > 0 && <> · أشهر غير مدفوعة في آخر سنة: <b className="num">{unpaid}</b></>}
          </p>
          {payments.length > 0 && (
            <div className="ui-table-wrap pt-mt">
              <table className="ui-table">
                <thead><tr><th>الشهر</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{monthLabel(p.month)}</td>
                      <td className="num">{money(p.amount)}</td>
                      <td>{p.method}</td>
                      <td><Badge tone={statusTone(p.status)}>{recordStatusLabel[p.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card title="تبرعاتي للحملات" actions={<Button small variant="pink" icon="heart" onClick={() => go("campaigns")}>تبرّع لحملة</Button>}>
        {donations.length === 0 ? (
          <Empty icon="heart" title="لا توجد تبرعات بعد" />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>الحملة</th><th>المبلغ</th><th>التاريخ</th><th>الحالة</th></tr></thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td>{db.campaigns.find((c) => c.id === d.campaignId)?.title ?? "—"}</td>
                    <td className="num">{money(d.amount)}</td>
                    <td className="num">{dateLabel(d.createdAt)}</td>
                    <td><Badge tone={statusTone(d.status)}>{recordStatusLabel[d.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {reporting && <ReportPayment memberId={member.id} defaultAmount={member.pledge} onClose={() => setReporting(false)} />}
    </div>
  );
}

function ReportPayment({ memberId, defaultAmount, onClose }: { memberId: string; defaultAmount?: number; onClose: () => void }) {
  const toast = useToast();
  const months = lastMonths(6).reverse();
  const [f, setF] = useState({ month: months[0], amount: defaultAmount ? String(defaultAmount) : "", method: cfg.paymentMethods[0], reference: "" });
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateAmount(f.amount);
    if (err) return setError(err);
    await reportPayment({ memberId, ...f });
    toast("تم إرسال الدفعة، وستؤكدها اللجنة بعد المراجعة");
    onClose();
  };
  return (
    <Modal title="الإبلاغ عن دفعة انتساب" onClose={onClose}>
      <form className="ui-form" onSubmit={submit} noValidate>
        <Field label="عن شهر">{(id) => <select id={id} value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })}>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>}</Field>
        <Field label="المبلغ" error={error}>{(id, d) => <input id={id} aria-describedby={d} value={f.amount} onChange={(e) => { setF({ ...f, amount: e.target.value }); setError(null); }} inputMode="numeric" dir="ltr" />}</Field>
        <Field label="طريقة الدفع">{(id) => <select id={id} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{cfg.paymentMethods.map((m) => <option key={m}>{m}</option>)}</select>}</Field>
        <Field label="رقم العملية" optional hint="من رسالة التطبيق البنكي">{(id) => <input id={id} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} dir="ltr" />}</Field>
        <div className="ui-field--full"><Notice>حوّل المبلغ إلى رقم الجمعية <b dir="ltr">{cfg.phone}</b> أو سلّمه لمشرف قائمتك، ثم أرسل هذا الإبلاغ.</Notice></div>
        <div className="ui-field--full"><Button type="submit" block>إرسال</Button></div>
      </form>
    </Modal>
  );
}
