import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number>();
  const show = useCallback((text: string) => {
    setMessage(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 3200);
  }, []);
  // أي عملية تفشل دون معالجة (مثل رفض الخادم لصلاحية) تظهر رسالتها للمستخدم بدل أن تضيع بصمت
  useEffect(() => {
    const onReject = (e: PromiseRejectionEvent) => {
      const msg = (e.reason as Error)?.message;
      if (msg && !/dynamically imported module|Importing a module/i.test(msg)) show(msg);
    };
    window.addEventListener("unhandledrejection", onReject);
    return () => window.removeEventListener("unhandledrejection", onReject);
  }, [show]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && <div className="toast" role="status">{message}</div>}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** نسخ نص إلى الحافظة مع بديل للمتصفحات القديمة */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = Object.assign(document.createElement("textarea"), { value: text });
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
