import { useState } from "react";
import { Button, Modal } from "../ui";

/** زر يعرض صورة الإيصال التي رفعها المنتسب */
export function ReceiptButton({ src, label = "الإيصال" }: { src?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <Button small variant="soft" icon="eye" onClick={() => setOpen(true)}>{label}</Button>
      {open && (
        <Modal title="صورة الإيصال" onClose={() => setOpen(false)}>
          <img src={src} alt="إيصال الدفع" className="ad-receipt-img" />
        </Modal>
      )}
    </>
  );
}
