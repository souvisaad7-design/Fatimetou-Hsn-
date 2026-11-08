import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { clearReloadFlag, ErrorBoundary } from "./ErrorBoundary";
import { routes } from "./routes";

// تحميل كل قسم عند الحاجة فقط لتسريع فتح الموقع
const HomePage = lazy(() => import("../features/home/HomePage"));
const AssistantPage = lazy(() => import("../features/assistant/AssistantPage"));

function Loading() {
  return (
    <div className="app-message" aria-busy="true">
      <span className="app-spinner" aria-hidden="true" />
      <p>جارٍ التحميل...</p>
    </div>
  );
}

export function App() {
  // الصفحة عملت بنجاح: نسمح بإعادة التحميل التلقائية مرة أخرى عند تحديث قادم
  useEffect(() => {
    const t = setTimeout(clearReloadFlag, 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path={routes.home} element={<HomePage />} />
          <Route path={routes.assistant} element={<AssistantPage />} />
          <Route path="*" element={<Navigate to={routes.home} replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
