import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storage } from "../../../shared/storage";
import { assistantConfig as cfg } from "../config";
import type { ChatMessage, Conversation } from "../types";

const NEW_TITLE = "محادثة جديدة";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

interface State {
  conversations: Conversation[];
  currentId: string | null;
}

const emptyConversation = (): Conversation => ({ id: uid(), title: NEW_TITLE, messages: [], createdAt: Date.now(), updatedAt: Date.now() });

function initialState(): State {
  const saved = storage.get<State>(cfg.storageKey);
  const conversations = (saved?.conversations ?? []).filter((c) => c.messages.length);
  const current = conversations.find((c) => c.id === saved?.currentId);
  if (current) return { conversations, currentId: current.id };
  const fresh = emptyConversation();
  return { conversations: [...conversations, fresh], currentId: fresh.id };
}

/**
 * إدارة المحادثات وحفظها في متصفح المستخدم.
 * عند توفر Backend يمكن استبدال الحفظ المحلي بطلبات للخادم دون تغيير المكوّنات.
 */
export function useConversations() {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    // لا نحفظ المحادثات الفارغة
    storage.set(cfg.storageKey, { ...state, conversations: state.conversations.filter((c) => c.messages.length) });
  }, [state]);

  const current = useMemo(() => state.conversations.find((c) => c.id === state.currentId) ?? null, [state]);

  const history = useMemo(
    () => state.conversations.filter((c) => c.messages.length).sort((a, b) => b.updatedAt - a.updatedAt),
    [state.conversations],
  );

  /** يفتح محادثة جديدة ويعيد معرّفها (أو معرّف المحادثة الحالية إن كانت فارغة) */
  const newConversation = useCallback((): string => {
    const s = stateRef.current;
    const cur = s.conversations.find((c) => c.id === s.currentId);
    if (cur && !cur.messages.length) return cur.id;
    const fresh = emptyConversation();
    setState((prev) => ({ conversations: [...prev.conversations.filter((c) => c.messages.length), fresh], currentId: fresh.id }));
    return fresh.id;
  }, []);

  const select = useCallback((id: string) => {
    setState((s) => ({ conversations: s.conversations.filter((c) => c.messages.length || c.id === id), currentId: id }));
  }, []);

  const remove = useCallback((id: string) => {
    setState((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id);
      if (s.currentId !== id) return { ...s, conversations };
      const fresh = emptyConversation();
      return { conversations: [...conversations, fresh], currentId: fresh.id };
    });
  }, []);

  /** إضافة رسالة إلى محادثة محددة */
  const addMessage = useCallback((conversationId: string, msg: Omit<ChatMessage, "id" | "createdAt">) => {
    const message: ChatMessage = { id: uid(), createdAt: Date.now(), ...msg };
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id !== conversationId
          ? c
          : {
              ...c,
              title: c.title === NEW_TITLE && msg.role === "user" ? msg.content.slice(0, 48) : c.title,
              messages: [...c.messages, message],
              updatedAt: Date.now(),
            },
      ),
    }));
    return message;
  }, []);

  /** حذف آخر رد للمساعد (لإعادة التوليد) */
  const dropLastReply = useCallback((conversationId: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === conversationId && c.messages[c.messages.length - 1]?.role === "assistant" ? { ...c, messages: c.messages.slice(0, -1) } : c,
      ),
    }));
  }, []);

  return { current, history, newConversation, select, remove, addMessage, dropLastReply };
}
