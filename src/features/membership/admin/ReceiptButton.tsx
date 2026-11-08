import { useState } from "react";
import { getReceipt } from "../services/api";
import { Button, Modal } from "../ui";

/** زر يعرض صورة الإيصال التي رفعها المنتسب (تُحمَّل من الخادم عند الضغط فقط) */
export function ReceiptButton({ paymentId, has, label = "الإيصال" }: { paymentId: string; has?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!has) return null;
  const show = async () => {
    setOpen(true);
    if (src) return;
    try {
      setSrc(await getReceipt(paymentId));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <>
      <Button small variant="soft" icon="eye" onClick={show}>{label}</Button>
      {open && (
        <Modal title="صورة الإيصال" onClose={() => setOpen(false)}>
          {error ? <p className="ui-error">{error}</p> : src ? <img src={src} alt="إيصال الدفع" className="ad-receipt-img" /> : <p className="ad-muted">جارٍ تحميل الصورة...</p>}
        </Modal>
      )}
    </>
  );
}
