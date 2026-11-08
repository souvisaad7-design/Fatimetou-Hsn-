/**
 * مخزن البيانات — حالياً في متصفح المستخدم (localStorage)، للعرض والتجربة.
 *
 * ⚠️ البيانات المحفوظة هنا لا يراها إلا من يستعمل هذا المتصفح نفسه.
 * للاستعمال الحقيقي (منتسب يسجّل من هاتفه، ومشرف يراجع من هاتف آخر) يجب ربط
 * services/api.ts بخادم مثل Supabase، دون تغيير الصفحات.
 */
import { membershipConfig as cfg } from "../config";
import { seedDatabase } from "../data/seed";
import type { Database } from "../types";

type Listener = () => void;
const listeners = new Set<Listener>();

function load(): Database {
  try {
    const raw = localStorage.getItem(cfg.storageKey);
    if (raw) {
      const db = JSON.parse(raw) as Database;
      if (db.version === 1 && Array.isArray(db.members)) return db;
    }
  } catch {
    /* التخزين غير متاح أو تالف */
  }
  return seedDatabase();
}

let db: Database = load();

function persist() {
  try {
    localStorage.setItem(cfg.storageKey, JSON.stringify(db));
  } catch {
    /* المتصفح يمنع التخزين: تبقى البيانات في الذاكرة فقط */
  }
}

// مزامنة بين تبويبات المتصفح نفسه (بوابة المنتسبين ولوحة الإدارة مفتوحتان معاً)
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === cfg.storageKey) {
      db = load();
      listeners.forEach((l) => l());
    }
  });
}

export const store = {
  get: () => db,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** تعديل البيانات بنسخة جديدة (immutable) ثم الحفظ وإشعار الصفحات */
  update(mutator: (draft: Database) => Database) {
    db = mutator(db);
    persist();
    listeners.forEach((l) => l());
  },
  replace(next: Database) {
    db = next;
    persist();
    listeners.forEach((l) => l());
  },
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
