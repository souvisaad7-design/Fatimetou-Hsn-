import { useState, type FormEvent } from "react";
import { useToast } from "../../../../shared/toast";
import { membershipConfig as cfg } from "../../config";
import { useDb } from "../../hooks/useDb";
import { addDonation, campaignRaised } from "../../services/api";
import { dateLabel, money } from "../../lib/format";
import { validateAmount, validatePhone } from "../../lib/validation";
import type { Campaign } from "../../types";
import { Badge, Button, Empty, Field, Modal, Notice, Progress } from "../../ui";
import { memberSession } from "../session";

export function CampaignsPage() {
  const db = useDb();
  const [donating, setDonating] = useState<Campaign | null>(null);
  const campaigns = [...db.campaigns].sort((a, b) => Number(b.active) - Number(a.active) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="pt-stack">
      <div>
        <h1 className="pt-h1">حملات التبرع</h1>
        <p className="pt-muted">ساهم في حملات الجمعية، وتابع ما جُمع لكل حملة.</p>
      </div>
      {campaigns.length === 0 ? (
        <Empty icon="heart" title="لا توجد حملات حالياً" />
      ) : (
        <div className="pt-campaigns">
          {campaigns.map((c) => {
            const raised = campaignRaised(db, c.id);
            const donors = db.donations.filter((d) => d.campaignId === c.id && d.status === "confirmed").length;
            return (
              <article key={c.id} className={`pt-campaign${c.active ? "" : " is-closed"}`}>
                <div className="pt-campaign__top">
                  <h3>{c.title}</h3>
                  <Badge tone={c.active ? "ok" : "neutral"}>{c.active ? "جارية" : "منتهية"}</Badge>
                </div>
                <p className="pt-muted">{c.description}</p>
                {c.goal > 0 && <Progress value={raised} max={c.goal} />}
                <p className="pt-campaign__nums num">
                  <b>{money(raised, false)}</b>{c.goal > 0 ? ` من ${money(c.goal)}` : ` ${cfg.currency}`} · {donors} متبرع
                </p>
                <p className="pt-muted pt-small">منذ {dateLabel(c.startDate)}{c.endDate ? ` حتى ${dateLabel(c.endDate)}` : ""}</p>
                {c.active && <Button variant="pink" icon="heart" block onClick={() => setDonating(c)}>تبرّع لهذه الحملة</Button>}
              </article>
            );
          })}
        </div>
      )}
      {donating && <DonateForm campaign={donating} onClose={() => setDonating(null)} />}
    </div>
  );
}

function DonateForm({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  const me = db.members.find((m) => m.id === memberSession.get());
  const [f, setF] = useState({ donorName: me?.fullName ?? "", donorPhone: me?.phone ?? "", amount: "", method: cfg.paymentMethods[0], reference: "" });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = { amount: validateAmount(f.amount), donorPhone: f.donorPhone ? validatePhone(f.donorPhone) : null };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    await addDonation({ campaignId: campaign.id, memberId: me?.id, ...f });
    setSent(true);
    toast("شكراً لك! تم تسجيل تبرعك");
  };

  return (
    <Modal title={`تبرّع: ${campaign.title}`} onClose={onClose}>
      {sent ? (
        <div className="pt-stack pt-center">
          <div className="pt-success__mark">✓</div>
          <p><b>جزاك الله خيراً.</b> سيُؤكَّد تبرعك بعد أن تراجعه اللجنة.</p>
          <Button block onClick={onClose}>إغلاق</Button>
        </div>
      ) : (
        <form className="ui-form" onSubmit={submit} noValidate>
          <div className="ui-field--full">
            <Notice>حوّل تبرعك إلى رقم الجمعية <b dir="ltr">{cfg.phone}</b> عبر التطبيق البنكي، ثم سجّل بياناته هنا.</Notice>
          </div>
          <Field label="الاسم" optional hint="اتركه فارغاً ليظهر «فاعل خير»">{(id) => <input id={id} value={f.donorName} onChange={(e) => setF({ ...f, donorName: e.target.value })} />}</Field>
          <Field label="الهاتف" optional error={errors.donorPhone}>{(id, d) => <input id={id} aria-describedby={d} value={f.donorPhone} onChange={(e) => setF({ ...f, donorPhone: e.target.value })} inputMode="tel" dir="ltr" />}</Field>
          <Field label="المبلغ (أوقية قديمة)" error={errors.amount}>{(id, d) => <input id={id} aria-describedby={d} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} inputMode="numeric" dir="ltr" />}</Field>
          <Field label="طريقة الدفع">{(id) => <select id={id} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{cfg.paymentMethods.map((m) => <option key={m}>{m}</option>)}</select>}</Field>
          <Field label="رقم العملية" optional full>{(id) => <input id={id} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} dir="ltr" />}</Field>
          <div className="ui-field--full"><Button type="submit" variant="pink" block icon="heart">تسجيل التبرع</Button></div>
        </form>
      )}
    </Modal>
  );
}
