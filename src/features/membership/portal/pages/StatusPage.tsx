import { useMemo, useState, type FormEvent } from "react";
import { membershipConfig as cfg } from "../../config";
import { useDb } from "../../hooks/useDb";
import { commitment, confirmed, memberMonths, reportPayment, sum, updatePledge } from "../../services/api";
import { dateLabel, lastMonths, memberStatusLabel, money, monthLabel, recordStatusLabel, statusTone } from "../../lib/format";
import { toAmount, validateAmount } from "../../lib/validation";
import type { Member } from "../../types";
import { compressImage } from "../../lib/image";
import { Badge, Button, Card, Empty, Field, Modal, Notice } from "../../ui";
import { useToast } from "../../../../shared/toast";
import { t, tServer, tValue, useLang } from "../../i18n";

export function StatusPage({ member, go }: { member: Member; go: (to: string) => void }) {
  return <MemberDashboard memberId={member.id} go={go} />;
}

function MemberDashboard({ memberId, go }: { memberId: string; go: (to: string) => void }) {
  useLang();
  const db = useDb();
  const member = db.members.find((m) => m.id === memberId)!;
  const list = db.lists.find((l) => l.id === member.listId);
  const months = useMemo(() => memberMonths(db, member, 12), [db, member]);
  const payments = db.payments.filter((p) => p.memberId === member.id).sort((a, b) => b.month.localeCompare(a.month) || b.createdAt.localeCompare(a.createdAt));
  const donations = db.donations.filter((d) => d.memberId === member.id);
  const [reporting, setReporting] = useState(false);
  const [editingPledge, setEditingPledge] = useState(false);
  const unpaid = months.filter((m) => m.state === "unpaid").length;
  const c = commitment(db, member);

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
          <div><dt>{t("st.list")}</dt><dd>{list?.name ?? t("st.notSet")}</dd></div>
          <div><dt>{t("st.supervisor")}</dt><dd>{list ? <>{list.supervisor}{list.supervisorPhone && <span className="num" dir="ltr"> · {list.supervisorPhone}</span>}</> : "—"}</dd></div>
          <div>
            <dt>{t("st.myPledge")}</dt>
            <dd className="num">{member.pledge ? money(member.pledge) : t("st.byCapacity")} <button type="button" className="pt-inline-btn" onClick={() => setEditingPledge(true)}>{t("st.change")}</button></dd>
          </div>
          <div><dt>{t("st.regDate")}</dt><dd className="num">{dateLabel(member.createdAt)}</dd></div>
        </dl>
        {member.status === "pending" && <Notice>{t("st.pendingNotice")}</Notice>}
        {member.status === "rejected" && <Notice tone="warn">{t("st.rejectedNotice", { phone: cfg.phone })}</Notice>}
        {member.status === "suspended" && <Notice tone="warn">{t("st.suspendedNotice")}</Notice>}
      </Card>

      {(member.status === "approved" || member.status === "suspended") && (
        <Card title={t("st.monthly")} actions={<Button small icon="plus" onClick={() => setReporting(true)}>{t("st.report")}</Button>}>
          {c.due > 0 && (
            <div className="pt-commit">
              <div className="pt-commit__ring" style={{ ["--pct" as string]: `${c.pct}%` }}><span className="num">{c.pct}%</span></div>
              <div>
                <b>{t("st.commit", { paid: c.paid, due: c.due, unit: c.due === 1 ? t("st.month1") : t("st.monthN") })}</b>
                <p className="pt-muted pt-small">{t("st.commitNote")}{c.streakPaid >= 3 ? t("st.streak", { n: c.streakPaid }) : ""}</p>
              </div>
            </div>
          )}
          <div className="ui-months">
            {months.map((m) => (
              <div key={m.month} className={`ui-month ui-month--${m.state}`} title={monthLabel(m.month)}>
                <b>{monthLabel(m.month).split(" ")[0]}</b>
                <span className="num">{m.month.slice(0, 4)}</span>
                <div>{m.state === "paid" ? t("st.paid") : m.state === "pending" ? t("st.waiting") : m.state === "unpaid" ? t("st.unpaid") : "—"}</div>
              </div>
            ))}
          </div>
          <p className="pt-muted pt-mt">
            {t("st.total")} <b className="num">{money(sum(confirmed(payments)))}</b>
            {unpaid > 0 && <> · {t("st.unpaidCount")} <b className="num">{unpaid}</b></>}
          </p>
          {payments.length > 0 && (
            <div className="ui-table-wrap pt-mt">
              <table className="ui-table">
                <thead><tr><th>{t("st.thMonth")}</th><th>{t("st.thAmount")}</th><th>{t("st.thMethod")}</th><th>{t("st.thStatus")}</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{monthLabel(p.month)}</td>
                      <td className="num">{money(p.amount)}</td>
                      <td>{tValue("pay", p.method)}</td>
                      <td><Badge tone={statusTone(p.status)}>{recordStatusLabel[p.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card title={t("st.donations")} actions={<Button small variant="pink" icon="heart" onClick={() => go("campaigns")}>{t("st.donate")}</Button>}>
        {donations.length === 0 ? (
          <Empty icon="heart" title={t("st.noDonations")} />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>{t("st.thCampaign")}</th><th>{t("st.thAmount")}</th><th>{t("st.thDate")}</th><th>{t("st.thStatus")}</th></tr></thead>
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
      {editingPledge && <PledgeForm memberId={member.id} current={member.pledge} onClose={() => setEditingPledge(false)} />}
    </div>
  );
}

function ReportPayment({ memberId, defaultAmount, onClose }: { memberId: string; defaultAmount?: number; onClose: () => void }) {
  const toast = useToast();
  const db = useDb();
  // الأشهر التي لم تُدفع بعد فقط (الأحدث أولاً)
  const paidMonths = new Set(db.payments.filter((p) => p.memberId === memberId && p.status === "confirmed").map((p) => p.month));
  const months = lastMonths(6).reverse().filter((m) => !paidMonths.has(m));
  const [f, setF] = useState({ month: months[0] ?? "", amount: defaultAmount ? String(defaultAmount) : "", method: cfg.paymentMethods[0], reference: "" });
  const [receipt, setReceipt] = useState<string>();
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onReceipt = async (file?: File) => {
    setReceiptError(null);
    if (!file) return;
    try { setReceipt(await compressImage(file)); } catch (err) { setReceiptError((err as Error).message); }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateAmount(f.amount);
    if (err) return setError(err);
    if (!f.month) return;
    try {
      await reportPayment({ memberId, ...f, receipt });
    } catch (err) {
      setError(tServer((err as Error).message));
      return;
    }
    toast(t("rp.sent"));
    onClose();
  };
  return (
    <Modal title={t("rp.title")} onClose={onClose}>
      {months.length === 0 ? (
        <div className="pt-stack pt-center"><p>{t("rp.allPaid")}</p><Button block onClick={onClose}>{t("common.close")}</Button></div>
      ) : (
      <form className="ui-form" onSubmit={submit} noValidate>
        <Field label={t("rp.month")}>{(id) => <select id={id} value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })}>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>}</Field>
        <Field label={t("rp.amount")} error={error}>{(id, d) => <input id={id} aria-describedby={d} value={f.amount} onChange={(e) => { setF({ ...f, amount: e.target.value }); setError(null); }} inputMode="numeric" dir="ltr" />}</Field>
        <Field label={t("rp.method")}>{(id) => <select id={id} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{cfg.paymentMethods.map((m) => <option key={m} value={m}>{tValue("pay", m)}</option>)}</select>}</Field>
        <Field label={t("rp.reference")} optional hint={t("rp.referenceHint")}>{(id) => <input id={id} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} dir="ltr" />}</Field>
        <Field label={t("rp.receipt")} optional full hint={t("rp.receiptHint")} error={receiptError}>
          {(id) => (
            <div className="pt-receipt">
              <label htmlFor={id} className={`pt-receipt__drop${receipt ? " has" : ""}`}>
                {receipt ? <img src={receipt} alt={t("rp.receiptPreview")} /> : <span>{t("rp.receiptPick")}</span>}
              </label>
              <input id={id} type="file" accept="image/*" hidden onChange={(e) => onReceipt(e.target.files?.[0])} />
              {receipt && <button type="button" className="pt-inline-btn" onClick={() => setReceipt(undefined)}>{t("rp.receiptRemove")}</button>}
            </div>
          )}
        </Field>
        <div className="ui-field--full"><Notice>{t("rp.notice", { phone: cfg.phone })}</Notice></div>
        <div className="ui-field--full"><Button type="submit" block>{t("common.send")}</Button></div>
      </form>
      )}
    </Modal>
  );
}

/** المنتسب يغيّر مبلغه الشهري بنفسه متى شاء */
function PledgeForm({ memberId, current, onClose }: { memberId: string; current?: number; onClose: () => void }) {
  const toast = useToast();
  const [v, setV] = useState(current ? String(current) : "");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateAmount(v, { required: false });
    if (err) return setError(err);
    try {
      await updatePledge(memberId, v ? toAmount(v) : undefined);
    } catch (err) {
      setError(tServer((err as Error).message));
      return;
    }
    toast(t("pl.updated"));
    onClose();
  };
  return (
    <Modal title={t("pl.title")} onClose={onClose}>
      <form className="pt-stack" onSubmit={submit} noValidate>
        <p className="pt-muted">{t("pl.intro", { motto: t("org.motto") })}</p>
        <Field label={t("pl.label", { currency: t("org.currency") })} optional hint={t("pl.hint")} error={error}>
          {(id, d) => <input id={id} aria-describedby={d} value={v} onChange={(e) => { setV(e.target.value); setError(null); }} inputMode="numeric" dir="ltr" />}
        </Field>
        <Button type="submit" block>{t("common.save")}</Button>
      </form>
    </Modal>
  );
}
