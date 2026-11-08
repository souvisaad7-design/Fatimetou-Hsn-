import type { ReactNode } from "react";

interface Props {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  full?: boolean;
  children: ReactNode;
}

/** حقل استمارة موحّد: العنوان، التلميح، ورسالة الخطأ */
export function Field({ id, label, optional, hint, error, full, children }: Props) {
  return (
    <div className={full ? "full" : undefined}>
      <label htmlFor={id}>
        {label} {optional && <span className="opt">(اختياري)</span>}
      </label>
      {children}
      {hint && <div className="hint">{hint}</div>}
      <div className="err" id={`${id}-err`}>{error}</div>
    </div>
  );
}
