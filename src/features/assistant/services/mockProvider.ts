import { assistantConfig as cfg } from "../config";
import { mockKnowledge } from "../data/mockKnowledge";
import { matchIntent } from "../lib/matchIntent";
import type { ChatProvider } from "../types";
import { resolveActions, sleep } from "./utils";
import { matchChannelVideos } from "../lib/videoMatch";
import { searchVideos } from "./videoSearch";

/** أسئلة لا معنى لعرض فيديو معها (معلومة قصيرة أو تحية) */
const NO_VIDEO = new Set([
  "greeting", "thanks", "phone", "email", "address", "socials", "contact", "website", "slogan",
  "vision", "vision-only", "mission-only", "values", "founding", "office", "committees", "committee-deputy",
  "president", "vice-president", "secretary-general", "help-request",
]);

/** مزوّد تجريبي: يختار رداً من البيانات المحلية ويحاكي الكتابة التدريجية */
export const mockProvider: ChatProvider = {
  async send({ messages, signal, onToken }) {
    const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const intent = matchIntent(lastQuestion, mockKnowledge);
    // البحث عن فيديو مناسب يجري بالتوازي مع كتابة الرد
    const skipVideos = intent.playlist || NO_VIDEO.has(intent.id) || intent.id.startsWith("lead-");
    const videosPromise = intent.playlist
      ? // مع معرض القناة: إن ذكر السؤال فيديو بعينه (مثل «السقاية رقم 36») يبدأ المشغّل به
        Promise.resolve(matchChannelVideos(lastQuestion, 1).map((v) => ({ id: v.id, title: v.title })))
      : skipVideos
        ? Promise.resolve([])
        : searchVideos(lastQuestion, signal);
    const [min, max] = cfg.mock.thinkingMs;
    await sleep(min + Math.random() * (max - min), signal);

    let text = "";
    for (const part of intent.answer.split(/(\s+)/)) {
      text += part;
      onToken?.(text);
      if (part.trim()) await sleep(cfg.mock.tokenMs * (1 + Math.random()), signal);
    }
    const videos = await videosPromise;
    return { content: intent.answer, followups: intent.followups ?? [], actions: resolveActions(intent.actions), videos, playlist: intent.playlist ?? false };
  },
};
