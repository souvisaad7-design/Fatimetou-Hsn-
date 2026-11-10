import { useState } from "react";
import { getMemberReceipt, getReceipt } from "../services/api";
import { Button, Modal } from "../ui";

/** فتح الصورة بحجمها الكامل في تبويب جديد (للتكبير والتحقق من التفاصيل) */
function openFullSize(src: string) {
  const [meta, b64] = src.split(",");
  const type = /data:([^;]+)/.exec(meta)?.[1] ?? "image/jpeg";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * زر يعرض صورة الإيصال (تُحمَّل من الخادم عند الضغط فقط).
 * paymentId: إيصال دفعة شهرية — memberId: وصل الدفع المرفق مع طلب الانتساب.
 */
export function ReceiptButton({ paymentId, memberId, has, label = "الإيصال" }: { paymentId?: string; memberId?: string; has?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!has) return null;
  const show = async () => {
    setOpen(true);
    if (src) return;
    try {
      const img = memberId ? await getMemberReceipt(memberId) : paymentId ? await getReceipt(paymentId) : null;
      if (img) setSrc(img);
      else setError("لا توجد صورة");
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <>
      <Button small variant="soft" icon="eye" onClick={show}>{label}</Button>
      {open && (
        <Modal title="صورة الإيصال" onClose={() => setOpen(false)}>
          {error ? <p className="ui-error">{error}</p> : src ? (
            <div className="ad-stack">
              <button type="button" className="ad-receipt-open" onClick={() => openFullSize(src)} title="فتح بالحجم الكامل">
                <img src={src} alt="صورة الإيصال" className="ad-receipt-img" />
              </button>
              <Button small variant="soft" onClick={() => openFullSize(src)}>فتح بالحجم الكامل</Button>
            </div>
          ) : <p className="ad-muted">جارٍ تحميل الصورة...</p>}
        </Modal>
      )}
    </>
  );
}
