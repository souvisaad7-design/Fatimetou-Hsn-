import { assistantConfig as cfg } from "../config";
import { mockKnowledge } from "../data/mockKnowledge";
import { matchIntent } from "../lib/matchIntent";
import type { ChatProvider } from "../types";
import { resolveActions, sleep } from "./utils";

/** مزوّد تجريبي: يختار رداً من البيانات المحلية ويحاكي الكتابة التدريجية */
export const mockProvider: ChatProvider = {
  async send({ messages, signal, onToken }) {
    const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const intent = matchIntent(lastQuestion, mockKnowledge);
    const [min, max] = cfg.mock.thinkingMs;
    await sleep(min + Math.random() * (max - min), signal);

    let text = "";
    for (const part of intent.answer.split(/(\s+)/)) {
      text += part;
      onToken?.(text);
      if (part.trim()) await sleep(cfg.mock.tokenMs * (1 + Math.random()), signal);
    }
    return { content: intent.answer, followups: intent.followups ?? [], actions: resolveActions(intent.actions) };
  },
};
