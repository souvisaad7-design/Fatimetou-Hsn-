import { useSyncExternalStore } from "react";
import { store } from "../services/store";
import type { Database } from "../types";

/** قراءة البيانات في أي صفحة؛ تتحدث الصفحة تلقائياً عند أي تغيير */
export function useDb(): Database {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
