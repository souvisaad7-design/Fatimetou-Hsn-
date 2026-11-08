/** جلسة المنتسب في بوابة المنتسبين (في هذا التبويب فقط) */
const KEY = "awn:membership:session";
export const memberSession = {
  get: (): string | null => { try { return sessionStorage.getItem(KEY); } catch { return null; } },
  set: (id: string) => { try { sessionStorage.setItem(KEY, id); } catch { /* */ } },
  clear: () => { try { sessionStorage.removeItem(KEY); } catch { /* */ } },
};
