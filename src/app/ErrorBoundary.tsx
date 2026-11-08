import { Component, type ReactNode } from "react";

const RELOAD_KEY = "awn:reloaded-after-update";

/** هل الخطأ سببه ملف قديم لم يعد موجوداً بعد نشر تحديث جديد؟ */
export const isStaleChunkError = (err: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|ChunkLoadError|Unable to preload/i.test(
    String((err as Error)?.message ?? err),
  );

/** إعادة تحميل الصفحة مرة واحدة فقط لجلب أحدث نسخة من الموقع */
export function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    /* التخزين غير متاح: نعيد التحميل على أي حال */
  }
  window.location.reload();
  return true;
}

/** يُستدعى بعد نجاح تحميل الصفحة، حتى تعمل إعادة التحميل التلقائية مجدداً مع تحديث قادم */
export function clearReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* تجاهل */
  }
}

interface State {
  error: unknown;
}

/** يمنع ظهور صفحة فارغة عند حدوث خطأ، ويعرض رسالة مع زر لإعادة المحاولة */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown) {
    if (isStaleChunkError(error)) reloadOnce();
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-message" role="alert">
        <h1>تعذّر عرض الصفحة</h1>
        <p>ربما صدر تحديث جديد للموقع. أعد تحميل الصفحة للحصول على أحدث نسخة.</p>
        <button type="button" onClick={() => { clearReloadFlag(); window.location.reload(); }}>إعادة تحميل الصفحة</button>
      </div>
    );
  }
}
