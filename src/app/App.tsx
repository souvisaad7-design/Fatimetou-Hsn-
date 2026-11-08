import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { routes } from "./routes";

// تحميل كل قسم عند الحاجة فقط لتسريع فتح الموقع
const MembershipPage = lazy(() => import("../features/membership/MembershipPage"));
const AssistantPage = lazy(() => import("../features/assistant/AssistantPage"));

export function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path={routes.home} element={<MembershipPage />} />
        <Route path={routes.assistant} element={<AssistantPage />} />
        <Route path="*" element={<Navigate to={routes.home} replace />} />
      </Routes>
    </Suspense>
  );
}
