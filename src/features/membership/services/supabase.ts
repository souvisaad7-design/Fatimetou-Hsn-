/**
 * الاتصال بقاعدة بيانات اللجنة الانتسابية على Supabase.
 * المفتاح هنا «عام» (publishable) ومخصص للمتصفح؛ الحماية الفعلية في صلاحيات قاعدة البيانات (RLS).
 */
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://ddgqbyktpkrgewxrnrdf.supabase.co";
export const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) || "sb_publishable_KzrQa_UxyZqpG5oeBSYc3Q__WdnoIQz";

/** الجلسة تُحفظ في هذا التبويب فقط، فيظهر الدخول من جديد عند كل زيارة */
const sessionStore = (() => {
  try {
    sessionStorage.setItem("awn:t", "1");
    sessionStorage.removeItem("awn:t");
    return sessionStorage;
  } catch {
    return undefined;
  }
})();

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storage: sessionStore, storageKey: "awn:membership:auth" },
});

/** البريد الداخلي المرتبط برقم الهاتف (نفس صيغة دالة التسجيل على الخادم) */
export const emailForPhone = (phone: string) => `${phone.replace(/\D/g, "")}@members.awnwasanad.app`;

/** رسالة خطأ مفهومة من أخطاء Supabase */
export function errorMessage(err: unknown): string {
  const m = (err as { message?: string })?.message ?? String(err);
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "تعذّر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.";
  if (/Invalid login credentials/i.test(m)) return "رقم الهاتف أو كلمة المرور غير صحيحة.";
  return m;
}
