import { assistantConfig as cfg } from "../config";
import type { ReplyAction } from "../types";

export const abortError = () => new DOMException("Aborted", "AbortError");

export const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); reject(abortError()); }, { once: true });
  });

/** إكمال أزرار الانتساب برابط الموقع، أو إخفاؤها إن لم يكن الرابط متوفراً بعد */
export function resolveActions(actions: ReplyAction[] = []): ReplyAction[] {
  return actions.flatMap((a) => {
    if (a.type !== "membership") return a.url ? [a] : [];
    return cfg.membership.url ? [{ ...a, url: cfg.membership.url, label: a.label ?? cfg.membership.label }] : [];
  });
}
