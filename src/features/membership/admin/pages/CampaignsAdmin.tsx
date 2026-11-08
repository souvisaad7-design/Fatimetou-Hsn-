import { useState } from "react";
import { useToast } from "../../../../shared/toast";
import { useDb } from "../../hooks/useDb";
import { campaignRaised, deleteCampaign, deleteDonation, saveCampaign, setDonationStatus } from "../../services/api";
import { dateLabel, money, recordStatusLabel, statusTone } from "../../lib/format";
import { downloadCsv } from "../../lib/csv";
import type { Campaign } from "../../types";
import { Badge, Button, Card, ConfirmButton, Empty, Modal, Progress } from "../../ui";
import { CampaignFormModal, DonationFormModal } from "../forms";

export function CampaignsAdmin() {
  const db = useDb();
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const campaigns = [...db.campaigns].sort((a, b) => Number(b.active) - Number(a.active) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="ad-stack">
      <div className="ad-toolbar ad-toolbar--end"><Button icon="plus" onClick={() => setEditing("new")}>حملة جديدة</Button></div>
      {campaigns.length === 0 ? <Card><Empty icon="megaphone" title="لا توجد حملات بعد" /></Card> : (
        <div className="ad-cards">
          {campaigns.map((c) => {
            const raised = campaignRaised(db, c.id);
            const ds = db.donations.filter((d) => d.campaignId === c.id);
            return (
              <Card key={c.id} title={c.title} actions={<Badge tone={c.active ? "ok" : "neutral"}>{c.active ? "جارية" : "منتهية"}</Badge>}>
                {c.goal > 0 && <Progress value={raised} max={c.goal} />}
                <p className="num ad-mt"><b>{money(raised, false)}</b>{c.goal > 0 ? ` من ${money(c.goal)}` : " أوقية قديمة"}</p>
                <p className="ad-muted ad-small">{ds.filter((d) => d.status === "confirmed").length} تبرع مؤكد · {ds.filter((d) => d.status === "pending").length} بانتظار التأكيد</p>
                <div className="ad-card-actions">
                  <Button small onClick={() => setOpen(c.id)}>التبرعات</Button>
                  <Button small variant="ghost" icon="edit" onClick={() => setEditing(c)}>تعديل</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <CampaignFormModal campaign={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {open && db.campaigns.some((c) => c.id === open) && <CampaignDetail id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CampaignDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  const c = db.campaigns.find((x) => x.id === id)!;
  const [adding, setAdding] = useState(false);
  const ds = db.donations.filter((d) => d.campaignId === c.id);
  const raised = campaignRaised(db, c.id);
  const exportCsv = () => downloadCsv(`تبرعات-${c.title}.csv`, ["المتبرع", "الهاتف", "منتسب", "المبلغ", "الطريقة", "رقم العملية", "التاريخ", "الحالة"],
    ds.map((d) => [d.donorName, d.donorPhone, d.memberId ? "نعم" : "لا", d.amount, d.method, d.reference, dateLabel(d.createdAt), recordStatusLabel[d.status]]));

  return (
    <Modal title={c.title} onClose={onClose} wide>
      <div className="ad-stack">
        {c.description && <p className="ad-muted">{c.description}</p>}
        {c.goal > 0 && <Progress value={raised} max={c.goal} />}
        <p className="num"><b>{money(raised)}</b>{c.goal > 0 ? ` من ${money(c.goal)}` : ""}</p>
        <div className="ad-toolbar">
          <Button small icon="plus" onClick={() => setAdding(true)}>تسجيل تبرع</Button>
          <Button small variant="ghost" icon="download" onClick={exportCsv}>تصدير</Button>
          <Button small variant="ghost" onClick={() => saveCampaign({ ...c, active: !c.active })}>{c.active ? "إنهاء الحملة" : "إعادة فتح الحملة"}</Button>
          <ConfirmButton label="حذف الحملة" icon="trash" confirmLabel="حذف مع تبرعاتها" onConfirm={async () => { await deleteCampaign(c.id); toast("تم حذف الحملة"); onClose(); }} />
        </div>
        {ds.length === 0 ? <Empty icon="heart" title="لا توجد تبرعات لهذه الحملة بعد" /> : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>المتبرع</th><th>المبلغ</th><th>الطريقة</th><th>التاريخ</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {ds.map((d) => (
                  <tr key={d.id}>
                    <td><b>{d.donorName}</b>{d.memberId && <> <Badge tone="brand">منتسب</Badge></>}{d.donorPhone && <><br /><span className="ad-muted num" dir="ltr">{d.donorPhone}</span></>}</td>
                    <td className="num">{money(d.amount)}</td>
                    <td>{d.method}{d.reference && <span className="ad-muted num" dir="ltr"> · {d.reference}</span>}</td>
                    <td className="num">{dateLabel(d.createdAt)}</td>
                    <td><Badge tone={statusTone(d.status)}>{recordStatusLabel[d.status]}</Badge></td>
                    <td><div className="ui-row-actions">
                      {d.status === "pending" && <Button small onClick={() => setDonationStatus(d.id, "confirmed")}>تأكيد</Button>}
                      <ConfirmButton label="حذف" icon="trash" onConfirm={() => deleteDonation(d.id)} />
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {adding && <DonationFormModal campaignId={c.id} onClose={() => setAdding(false)} />}
    </Modal>
  );
}
