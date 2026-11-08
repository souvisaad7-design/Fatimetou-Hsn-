import { useRef } from "react";
import { useToast } from "../../../../shared/toast";
import { membershipConfig as cfg } from "../../config";
import { useDb } from "../../hooks/useDb";
import { clearAll, exportBackup, importBackup, resetDemo } from "../../services/api";
import { downloadText } from "../../lib/csv";
import { Button, Card, ConfirmButton, Notice } from "../../ui";

export function SettingsAdmin() {
  const db = useDb();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);

  const onImport = async (f?: File) => {
    if (!f) return;
    try {
      importBackup(await f.text());
      toast("تم استرجاع النسخة الاحتياطية");
    } catch (err) {
      toast((err as Error).message);
    } finally {
      if (file.current) file.current.value = "";
    }
  };

  return (
    <div className="ad-stack">
      <Notice tone="warn">
        <b>نسخة واجهة فقط:</b> كل البيانات محفوظة في هذا المتصفح وحده. المنتسب الذي يسجّل من هاتفه لا تصل بياناته إلى هاتف المشرف.
        للاستعمال الحقيقي يجب ربط النظام بقاعدة بيانات على الخادم (مثل Supabase) — طبقة البيانات جاهزة لذلك في
        <code dir="ltr"> src/features/membership/services/api.ts</code>.
      </Notice>

      <Card title="النسخ الاحتياطي">
        <p className="ad-muted">حمّل نسخة من كل البيانات ({db.members.length} منتسب، {db.payments.length} دفعة، {db.donations.length} تبرع)، أو استرجع نسخة سابقة.</p>
        <div className="ad-toolbar ad-mt">
          <Button icon="download" onClick={() => downloadText(`نسخة-الانتساب-${new Date().toISOString().slice(0, 10)}.json`, exportBackup())}>تحميل نسخة احتياطية</Button>
          <Button variant="ghost" icon="upload" onClick={() => file.current?.click()}>استرجاع نسخة</Button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
      </Card>

      <Card title="البيانات التجريبية">
        <p className="ad-muted">الأسماء الحالية تجريبية. قبل البدء الفعلي امسح البيانات، ثم أضف القوائم والمشرفين والحملات الحقيقية.</p>
        <div className="ad-toolbar ad-mt">
          <ConfirmButton label="إعادة البيانات التجريبية" confirmLabel="تأكيد الإعادة" variant="ghost" small={false} onConfirm={() => { resetDemo(); toast("تمت إعادة البيانات التجريبية"); }} />
          <ConfirmButton label="مسح كل البيانات" icon="trash" confirmLabel="مسح نهائي" small={false} onConfirm={() => { clearAll(); toast("تم مسح كل البيانات"); }} />
        </div>
      </Card>

      <Card title="معلومات">
        <dl className="ad-facts">
          <div><dt>رقم الدفع</dt><dd className="num" dir="ltr">{cfg.phone}</dd></div>
          <div><dt>العملة</dt><dd>{cfg.currency}</dd></div>
          <div><dt>طرق الدفع</dt><dd>{cfg.paymentMethods.join("، ")}</dd></div>
          <div><dt>رمز دخول الإدارة</dt><dd>يُغيَّر من المتغير <code dir="ltr">VITE_ADMIN_PIN</code> عند البناء</dd></div>
        </dl>
      </Card>
    </div>
  );
}
