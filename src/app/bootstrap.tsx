import { StrictMode, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../shared/toast";
import { clearReloadFlag, ErrorBoundary, reloadOnce } from "./ErrorBoundary";
import "../styles/global.css";

function Root({ children }: { children: ReactNode }) {
  // الصفحة عملت بنجاح: نسمح بإعادة التحميل التلقائية مرة أخرى عند تحديث قادم
  useEffect(() => {
    const t = setTimeout(clearReloadFlag, 5000);
    return () => clearTimeout(t);
  }, []);
  return (
    <ErrorBoundary>
      <ToastProvider>{children}</ToastProvider>
    </ErrorBoundary>
  );
}

/** تشغيل موقع مستقل (الصفحة الرئيسية أو المساعد) في عنصر #root */
/** هل الصفحة معروضة داخل إطار من موقع آخر؟ (حماية من خداع الضغطات) */
function framedByOtherSite(): boolean {
  try { return window.top !== window.self && window.top!.location.origin !== window.location.origin; } catch { return true; }
}

export function mount(page: ReactNode) {
  if (framedByOtherSite()) {
    document.getElementById("root")!.textContent = "لأمانك، افتح الموقع مباشرة من المتصفح.";
    try { window.top!.location.href = window.location.href; } catch { /* المتصفح منع ذلك */ }
    return;
  }
  // إذا فشل تحميل ملف بسبب نشر نسخة أحدث، نعيد تحميل الصفحة تلقائياً
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadOnce()) event.preventDefault();
  });
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Root>{page}</Root>
    </StrictMode>,
  );
}
