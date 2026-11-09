import { getAutoSpeak, speak } from "../lib/speech";
import { useCallback, useRef, useState } from "react";
import { sendChat } from "../services/chatService";
import type { ChatMessage } from "../types";
import { useConversations } from "./useConversations";

export interface PendingReply {
  conversationId: string;
  text: string; // ما وصل من الرد حتى الآن ("" = في انتظار أول كلمة)
}

/** منطق المحادثة: الإرسال، الكتابة التدريجية، الإيقاف، وإعادة التوليد */
export function useAssistant() {
  const store = useConversations();
  const [pending, setPending] = useState<PendingReply | null>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = pending !== null;

  const respond = useCallback(
    async (conversationId: string, history: ChatMessage[]) => {
      const ctrl = new AbortController();
      controller.current = ctrl;
      setPending({ conversationId, text: "" });
      let partial = "";

      try {
        const reply = await sendChat({
          messages: history.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
          signal: ctrl.signal,
          onToken: (text) => {
            partial = text;
            setPending({ conversationId, text });
          },
        });
        store.addMessage(conversationId, { role: "assistant", ...reply });
        if (getAutoSpeak()) speak(reply.content);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          if (partial.trim()) store.addMessage(conversationId, { role: "assistant", content: `${partial}\n\n_تم إيقاف الرد._` });
        } else {
          store.addMessage(conversationId, {
            role: "assistant",
            content: `عذراً، حدث خطأ أثناء الحصول على الرد. ${(err as Error).message ?? ""}`,
            error: true,
          });
        }
      } finally {
        if (controller.current === ctrl) controller.current = null;
        setPending(null);
      }
    },
    [store],
  );

  const ask = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q || busy || !store.current) return;
      const conv = store.current;
      const userMsg = store.addMessage(conv.id, { role: "user", content: q });
      void respond(conv.id, [...conv.messages, userMsg]);
    },
    [busy, store, respond],
  );

  /** بدء محادثة جديدة بسؤال جاهز (من رابط فيه ?q=) */
  const startWith = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      controller.current?.abort();
      const id = store.newConversation();
      const userMsg = store.addMessage(id, { role: "user", content: q });
      void respond(id, [userMsg]);
    },
    [store, respond],
  );

  const regenerate = useCallback(() => {
    const conv = store.current;
    if (busy || !conv) return;
    const msgs = conv.messages[conv.messages.length - 1]?.role === "assistant" ? conv.messages.slice(0, -1) : conv.messages;
    store.dropLastReply(conv.id);
    void respond(conv.id, msgs);
  }, [busy, store, respond]);

  const stop = useCallback(() => controller.current?.abort(), []);

  const newConversation = useCallback(() => { stop(); store.newConversation(); }, [stop, store]);
  const select = useCallback((id: string) => { if (id !== store.current?.id) stop(); store.select(id); }, [stop, store]);
  const remove = useCallback((id: string) => { if (id === store.current?.id) stop(); store.remove(id); }, [stop, store]);

  return {
    conversation: store.current,
    history: store.history,
    pending: pending && pending.conversationId === store.current?.id ? pending : null,
    busy,
    ask,
    startWith,
    stop,
    regenerate,
    newConversation,
    select,
    remove,
  };
}
