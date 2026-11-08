import { assistantConfig as cfg } from "../config";
import type { ChatProvider, ChatReply } from "../types";
import { resolveActions } from "./utils";

/**
 * مزوّد الـ Backend (غير مفعّل حالياً).
 * الطلب:  POST { messages: [{ role, content }] }
 * الرد:   JSON { content, followups?, actions?, videos? }   (videos: [{ id, title, thumbnail }] من أداة search_association_videos)
 *     أو  SSE  أسطر "data: {\"delta\":\"...\"}" ثم اختيارياً "data: {\"followups\":[...]}"
 *     أو  نص متدفق خام
 */
export const httpProvider: ChatProvider = {
  async send({ messages, signal, onToken }) {
    if (!cfg.api.endpoint) throw new Error("لم يتم ضبط عنوان الخادم (api.endpoint).");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.api.timeoutMs);
    signal.addEventListener("abort", () => ctrl.abort(), { once: true });

    try {
      const res = await fetch(cfg.api.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cfg.api.headers },
        body: JSON.stringify({ messages }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`تعذّر الحصول على رد من الخادم (${res.status}).`);

      const type = res.headers.get("content-type") ?? "";
      if (type.includes("application/json")) {
        const data = (await res.json()) as ChatReply;
        onToken?.(data.content ?? "");
        return { content: data.content ?? "", followups: data.followups ?? [], actions: resolveActions(data.actions), videos: data.videos ?? [] };
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      const isSSE = type.includes("text/event-stream");
      let text = "";
      let buffer = "";
      let extra: Partial<ChatReply> = {};

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!isSSE) { text += chunk; onToken?.(text); continue; }
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload) as { delta?: string } & Partial<ChatReply>;
            if (obj.delta) { text += obj.delta; onToken?.(text); }
            if (obj.followups || obj.actions || obj.videos) extra = { ...extra, ...obj };
          } catch {
            text += payload;
            onToken?.(text);
          }
        }
      }
      return { content: text, followups: extra.followups ?? [], actions: resolveActions(extra.actions), videos: extra.videos ?? [] };
    } finally {
      clearTimeout(timer);
    }
  },
};
