import { useState } from "react";
import { useToast } from "../../../../shared/toast";
import { useDb } from "../../hooks/useDb";
import { confirmed, deleteList, sum } from "../../services/api";
import { currentMonth, money, monthLabel } from "../../lib/format";
import type { MemberList } from "../../types";
import { Button, Card, ConfirmButton, Empty, Progress } from "../../ui";
import { ListFormModal } from "../forms";

export function ListsAdmin({ go }: { go: (to: string) => void }) {
  const db = useDb();
  const toast = useToast();
  const [editing, setEditing] = useState<MemberList | "new" | null>(null);
  const month = currentMonth();
  const paid = new Set(confirmed(db.payments.filter((p) => p.month === month)).map((p) => p.memberId));
  const unassigned = db.members.filter((m) => m.status === "approved" && !m.listId).length;

  return (
    <div className="ad-stack">
      <div className="ad-toolbar ad-toolbar--end">
        {unassigned > 0 && <span className="ad-muted">{unassigned} منتسب معتمد بدون قائمة</span>}
        <Button icon="plus" onClick={() => setEditing("new")}>قائمة جديدة</Button>
      </div>
      {db.lists.length === 0 ? <Card><Empty icon="list" title="لا توجد قوائم بعد">أنشئ قائمة وحدد مشرفها، ثم وزّع المنتسبين عليها.</Empty></Card> : (
        <div className="ad-cards">
          {db.lists.map((l) => {
            const members = db.members.filter((m) => m.listId === l.id && m.status === "approved");
            const paidCount = members.filter((m) => paid.has(m.id)).length;
            const collected = sum(confirmed(db.payments.filter((p) => p.month === month && members.some((m) => m.id === p.memberId))));
            return (
              <Card key={l.id} title={l.name} actions={<>
                <Button small variant="ghost" icon="edit" onClick={() => setEditing(l)}>تعديل</Button>
                <ConfirmButton label="حذف" icon="trash" onConfirm={async () => { await deleteList(l.id); toast("تم حذف القائمة"); }} />
              </>}>
                <p><b>المشرف:</b> {l.supervisor}{l.supervisorPhone && <span className="num" dir="ltr"> · {l.supervisorPhone}</span>}</p>
                <p className="ad-muted">{members.length} منتسب معتمد</p>
                <div className="ad-list-progress">
                  <span>{monthLabel(month)}: <b className="num">{paidCount}/{members.length}</b> دفعوا</span>
                  <Progress value={paidCount} max={members.length} />
                  <span className="ad-muted num">{money(collected)}</span>
                </div>
                <Button small variant="soft" block onClick={() => go("members")}>عرض المنتسبين</Button>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <ListFormModal list={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
