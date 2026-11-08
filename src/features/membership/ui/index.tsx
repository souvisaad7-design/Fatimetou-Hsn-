/** مكوّنات واجهة مشتركة بين بوابة المنتسبين ولوحة الإدارة */
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "../../../shared/Icon";
import "./ui.css";

type Variant = "primary" | "ghost" | "soft" | "danger" | "pink";

export function Button({
  variant = "primary",
  icon,
  block,
  small,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName; block?: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`ui-btn ui-btn--${variant}${block ? " ui-btn--block" : ""}${small ? " ui-btn--sm" : ""} ${className}`}
    >
      {icon && <Icon name={icon} size={small ? 16 : 18} />}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  optional,
  children,
  full,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  children: (id: string, describedBy?: string) => ReactNode;
  full?: boolean;
}) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className={`ui-field${full ? " ui-field--full" : ""}${error ? " has-error" : ""}`}>
      <label htmlFor={id}>
        {label} {optional && <span className="ui-optional">(اختياري)</span>}
      </label>
      {children(id, error ? errId : undefined)}
      {hint && !error && <p className="ui-hint">{hint}</p>}
      {error && <p className="ui-error" id={errId} role="alert">{error}</p>}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "ok" | "warn" | "bad" | "neutral" | "brand"; children: ReactNode }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`ui-card ${className}`}>
      {(title || actions) && (
        <header className="ui-card__head">
          {title && <h2>{title}</h2>}
          {actions && <div className="ui-card__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: IconName; tone?: "pink" | "navy" }) {
  return (
    <div className={`ui-stat${tone ? ` ui-stat--${tone}` : ""}`}>
      {icon && <span className="ui-stat__icon"><Icon name={icon} size={20} /></span>}
      <span className="ui-stat__label">{label}</span>
      <strong className="ui-stat__value num">{value}</strong>
      {sub && <span className="ui-stat__sub">{sub}</span>}
    </div>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="ui-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ icon = "info", title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="ui-empty">
      <Icon name={icon} size={28} />
      <p className="ui-empty__title">{title}</p>
      {children && <div className="ui-empty__body">{children}</div>}
    </div>
  );
}

/** نافذة منبثقة بسيطة (تُغلق بزر الإغلاق أو Esc أو الضغط خارجها) */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="ui-modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`ui-modal__box${wide ? " ui-modal__box--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="ui-modal__head">
          <h2>{title}</h2>
          <button type="button" className="ui-icon-btn" aria-label="إغلاق" onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="ui-modal__body">{children}</div>
      </div>
    </div>
  );
}

/** زر يطلب تأكيداً داخل الصفحة قبل تنفيذ إجراء حساس (حذف، رفض...) */
export function ConfirmButton({ label, confirmLabel = "تأكيد", onConfirm, variant = "danger", icon, small = true }: {
  label: string; confirmLabel?: string; onConfirm: () => void; variant?: Variant; icon?: IconName; small?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(t);
  }, [asking]);
  return asking ? (
    <span className="ui-confirm">
      <Button small={small} variant="danger" onClick={() => { setAsking(false); onConfirm(); }}>{confirmLabel}</Button>
      <Button small={small} variant="ghost" onClick={() => setAsking(false)}>إلغاء</Button>
    </span>
  ) : (
    <Button small={small} variant={variant === "danger" ? "ghost" : variant} icon={icon} onClick={() => setAsking(true)}>{label}</Button>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return <div className={`ui-notice ui-notice--${tone}`} role="note">{children}</div>;
}
