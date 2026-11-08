import { assistantConfig as cfg } from "../config";
import type { ChatProvider, ChatReply, ChatRequest } from "../types";
import { httpProvider } from "./httpProvider";
import { mockProvider } from "./mockProvider";

/**
 * نقطة الدخول الوحيدة للحصول على الردود.
 * الواجهة لا تعرف هل الرد من بيانات تجريبية أم من الخادم.
 */
const providers: Record<string, ChatProvider> = { mock: mockProvider, http: httpProvider };

export function sendChat(request: ChatRequest): Promise<ChatReply> {
  const provider = providers[cfg.provider];
  if (!provider) return Promise.reject(new Error(`مزوّد غير معروف: ${cfg.provider}`));
  return provider.send(request);
}
