import { useState } from "react";
import { copyText, useToast } from "../../../../shared/toast";
import { membershipConfig as cfg } from "../../config";
import { useDb } from "../../hooks/useDb";
import { reminderLists } from "../../services/api";
import { money, monthLabel } from "../../lib/format";
import { reminderMessage, smsLink, supervisorMessage } from "../../lib/messages";
import { Badge, Button, Card, Empty, Notice } from "../../ui";

/**
 * التذكير اللطيف:
 * 1) من لم يدفع هذا الشهر — رسالة ودّية جاهزة (نسخ، أو SMS، أو كل الأرقام لنظام الرسائل الجماعية).
 * 2) من تأخر شهرين فأكثر — ينبَّه مشرفه ليتواصل معه ويطمئن عليه، لا ليطالبه.
 */
export function Reminders({ fixedListId }: { fixedListId?: string }) {
  const db = useDb();
  const toast = useToast();
  const [listId, setListId] = useState(fixedListId ?? "");
  const [template, setTemplate] = useState(cfg.reminderTemplate);
  const { month, unpaidThisMonth, late } = reminderLists(db, fixedListId ?? (listId || undefined));
  const copy = async (text: string, done = "تم النسخ") => toast((await copyText(text)) ? done : "تعذّر النسخ");
  const generic = template.replace("{name}", "").replace(/\s+🤍/, " 🤍").replace("{month}", monthLabel(month)).replace("{phone}", cfg.phone).replace("السلام عليكم  ", "السلام عليكم ");

  return (
    <div className="ad-stack">
      <Notice>
        الإرسال الآلي في آخر الشهر يحتاج ربط النظام بخادم ومزوّد رسائل. حالياً: انسخ الرسالة وأرقام من لم يدفع إلى نظام الرسائل الجماعية عندكم، أو أرسل لكل منتسب بضغطة «SMS».
      </Notice>

      {!fixedListId && (
        <select className="ui-input ad-list-select" value={listId} onChange={(e) => setListId(e.target.value)} aria-label="القائمة">
          <option value="">كل القوائم</option>
          {db.lists.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.supervisor}</option>)}
        </select>
      )}

      <Card title={<>لم يدفعوا انتساب {monthLabel(month)} <Badge tone="bad">{unpaidThisMonth.length}</Badge></>}>
        {unpaidThisMonth.length === 0 ? <Empty icon="check" title="الكل دفع هذا الشهر، جزاهم الله خيراً 🤍" /> : (
          <>
            <div className="ui-field">
              <label htmlFor="reminder-tpl">نص الرسالة <span className="ui-optional">({"{name}"} = اسم المنتسب)</span></label>
              <textarea id="reminder-tpl" className="ui-input ad-template" value={template} onChange={(e) => setTemplate(e.target.value)} rows={4} />
            </div>
            <div className="ad-toolbar ad-mt">
              <Button small icon="copy" onClick={() => copy(unpaidThisMonth.map((m) => m.phone).join(", "), `تم نسخ ${unpaidThisMonth.length} رقماً`)}>نسخ كل الأرقام</Button>
              <Button small variant="ghost" icon="copy" onClick={() => copy(generic, "تم نسخ الرسالة العامة")}>نسخ الرسالة العامة</Button>
            </div>
            <div className="ad-rows ad-mt">
              {unpaidThisMonth.map((m) => {
                const msg = reminderMessage(m, month, template);
                return (
                  <div key={m.id} className="ad-row">
                    <div className="ad-row__main"><b>{m.fullName}</b><span className="ad-muted num" dir="ltr">{m.phone} · {m.pledge ? money(m.pledge, false) : "حسب القدرة"}</span></div>
                    <div className="ad-row__side">
                      <Button small variant="ghost" icon="copy" onClick={() => copy(msg, "تم نسخ الرسالة")}>نسخ</Button>
                      <a className="ui-btn ui-btn--primary ui-btn--sm" href={smsLink(m.phone, msg)}>SMS</a>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Card title={<>متأخرون {cfg.lateAfterMonths} أشهر فأكثر <Badge tone="warn">{late.length}</Badge></>}>
        <p className="ad-muted ad-small">رسالة لمشرف كل منتسب ليتواصل معه ويطمئن عليه؛ الهدف السؤال عنه لا مطالبته بالمال.</p>
        {late.length === 0 ? <Empty icon="check" title="لا يوجد منتسبون متأخرون" /> : (
          <div className="ad-rows">
            {late.map(({ member: m, months }) => {
              const list = db.lists.find((l) => l.id === m.listId);
              const msg = supervisorMessage(m, list, months);
              return (
                <div key={m.id} className="ad-row">
                  <div className="ad-row__main">
                    <b>{m.fullName} <Badge tone="bad">{months} أشهر</Badge></b>
                    <span className="ad-muted">{list ? `المشرف: ${list.supervisor}` : "بدون قائمة"}</span>
                  </div>
                  <div className="ad-row__side">
                    <Button small variant="ghost" icon="copy" onClick={() => copy(msg, "تم نسخ رسالة المشرف")}>نسخ</Button>
                    {list?.supervisorPhone && <a className="ui-btn ui-btn--primary ui-btn--sm" href={smsLink(list.supervisorPhone, msg)}>إرسال للمشرف</a>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
