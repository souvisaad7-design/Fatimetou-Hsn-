import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./app/App";
import { reloadOnce } from "./app/ErrorBoundary";
import { ToastProvider } from "./shared/toast";
import "./styles/global.css";

// إذا فشل تحميل ملف بسبب نشر نسخة أحدث، نعيد تحميل الصفحة تلقائياً
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnce()) event.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* HashRouter: الروابط تعمل على GitHub Pages دون إعدادات خادم */}
    <HashRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </HashRouter>
  </StrictMode>,
);
