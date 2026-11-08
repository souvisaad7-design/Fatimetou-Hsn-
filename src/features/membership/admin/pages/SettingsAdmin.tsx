import { useToast } from "../../../../shared/toast";
import { membershipConfig as cfg } from "../../config";
import { useDb } from "../../hooks/useDb";
import { exportBackup } from "../../services/api";
import { SUPABASE_URL } from "../../services/supabase";
import { downloadText } from "../../lib/csv";
import { Button, Card, Notice } from "../../ui";

export function SettingsAdmin() {
  const db = useDb();
  const toast = useToast();
  return (
    <div className="ad-stack">
      <Notice>
        البيانات محفوظة في قاعدة بيانات اللجنة على الخادم (Supabase)، ويراها كل مستخدم حسب صلاحياته: المنتسب بياناته فقط،
        والمشرف قائمته وطلبات التسجيل الجديدة، ومسؤولو اللجنة كل شيء.
      </Notice>

      <Card title="النسخ الاحتياطي">
        <p className="ad-muted">حمّل نسخة من البيانات ({db.members.length} منتسب، {db.payments.length} دفعة، {db.donations.length} تبرع) في ملف JSON.</p>
        <div className="ad-toolbar ad-mt">
          <Button icon="download" onClick={() => { downloadText(`نسخة-الانتساب-${new Date().toISOString().slice(0, 10)}.json`, exportBackup()); toast("تم تحميل النسخة"); }}>تحميل نسخة احتياطية</Button>
        </div>
      </Card>

      <Card title="الصلاحيات">
        <ul className="ad-muted ad-list">
          <li><b>مسؤول اللجنة:</b> أول من ضغط «اجعلني المسؤول الأول»، ويمكن إضافة مسؤولين آخرين من لوحة Supabase (جدول admins).</li>
          <li><b>مشرف القائمة:</b> يعيّنه المسؤول من «القوائم والمشرفون» باختيار منتسب لديه حساب.</li>
          <li><b>المنتسب:</b> يسجّل من بوابة المنتسبين، ولا يدخل حتى يُقبل.</li>
        </ul>
      </Card>

      <Card title="معلومات">
        <dl className="ad-facts">
          <div><dt>رقم الدفع</dt><dd className="num" dir="ltr">{cfg.phone}</dd></div>
          <div><dt>العملة</dt><dd>{cfg.currency}</dd></div>
          <div><dt>طرق الدفع</dt><dd>{cfg.paymentMethods.join("، ")}</dd></div>
          <div><dt>الخادم</dt><dd className="num" dir="ltr">{SUPABASE_URL.replace("https://", "")}</dd></div>
        </dl>
      </Card>
    </div>
  );
}
