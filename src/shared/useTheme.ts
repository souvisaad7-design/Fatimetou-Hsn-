import { useSyncExternalStore } from "react";
import { storage } from "./storage";

export type Theme = "light" | "dark";
const KEY = "awn:theme";

/**
 * الوضع الفاتح/الداكن: يتبع إعداد الجهاز ما لم يختر المستخدم وضعاً بنفسه.
 * الحالة مشتركة بين كل المكوّنات (زر في الشريط الجانبي وآخر في الأعلى يبقيان متطابقين،
 * والرسوم البيانية تعرف متى تتغير الألوان).
 */
const mq = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : undefined;
let chosen: Theme | null = storage.get<Theme>(KEY);
const listeners = new Set<() => void>();

const resolved = (): Theme => chosen ?? (mq?.matches ? "dark" : "light");
const emit = () => listeners.forEach((l) => l());

function apply() {
  if (typeof document === "undefined") return;
  if (chosen) document.documentElement.dataset.theme = chosen;
  else delete document.documentElement.dataset.theme;
}
apply();
mq?.addEventListener?.("change", emit);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function setTheme(next: Theme) {
  chosen = next;
  storage.set(KEY, next);
  apply();
  emit();
}

export const getTheme = resolved;

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, resolved, () => "light" as Theme);
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  return { theme, toggle };
}
