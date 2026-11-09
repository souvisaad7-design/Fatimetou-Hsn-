import { assistantConfig as cfg } from "../config";
import { knowledge } from "../data/knowledge";
import { detectLang, type ReplyLang } from "../lib/detectLang";
import { isAboutAssociation, matchIntent, normalizeText } from "../lib/matchIntent";
import type { ChatProvider, Intent, LangText } from "../types";
import { resolveActions, sleep } from "./utils";
import { matchChannelVideos } from "../lib/videoMatch";
import { searchVideos } from "./videoSearch";

type Reply = Omit<Intent, "id" | "keywords">;

/** إن بدأ السائل بالسلام ثم سأل، نرد السلام قبل الجواب */
const GREETING_PREFIX: LangText = { has: "وعليكم السلام ومرحبا بيك! ", ar: "وعليكم السلام ورحمة الله! ", fr: "Bonjour ! " };
const greets = (q: string) => /(^| )(السلام|سلام|bonjour|salut|salam)( |$)/.test(normalizeText(q));

/** رد بفيديو من القناة عندما يذكر السؤال نشاطاً بعينه (مثل «السقاية رقم 36») */
const VIDEO_ONLY: LangText = {
  has: "هاذا فيديو من قناة الجمعية على ذاك 🎬",
  ar: "هذا فيديو من قناة الجمعية عن ذلك 🎬",
  fr: "Voici une vidéo de la chaîne de l'association à ce sujet 🎬",
};

/** مزوّد تجريبي: «مساعد عون وسند» يجيب بلغة السائل (الحسانية افتراضياً) من المعلومات الرسمية فقط */
export const mockProvider: ChatProvider = {
  async send({ messages, signal, onToken }) {
    const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const lang: ReplyLang = detectLang(question);
    const about = isAboutAssociation(question, knowledge);

    let reply: Reply | null = matchIntent(question, knowledge);
    let startVideo = reply?.playlist ? matchChannelVideos(question, 1) : [];
    if (!reply) {
      // فقط لسؤال عن نشاط مرقّم بعينه، حتى لا يُعرض فيديو عام بدل «ما عندي خبر»
      const hit = /\d/.test(question) ? matchChannelVideos(question, 1) : [];
      if (hit.length) {
        reply = { answer: VIDEO_ONLY, playlist: true, followups: ["activities", "goals"] };
        startVideo = hit;
      } else {
        reply = about ? knowledge.unknown : knowledge.offTopic;
      }
    }

    let answer = reply.answer[lang];
    if (greets(question) && reply !== knowledge.offTopic && !answer.startsWith("وعليكم") && !answer.startsWith("Bonjour")) {
      answer = GREETING_PREFIX[lang] + answer;
    }

    // البحث عن فيديو مناسب يجري بالتوازي مع كتابة الرد
    const videosPromise = reply.playlist
      ? Promise.resolve(startVideo.map((v) => ({ id: v.id, title: v.title })))
      : reply.noVideo
        ? Promise.resolve([])
        : searchVideos(question, signal);

    const [min, max] = cfg.mock.thinkingMs;
    await sleep(min + Math.random() * (max - min), signal);
    let text = "";
    for (const part of answer.split(/(\s+)/)) {
      text += part;
      onToken?.(text);
      if (part.trim()) await sleep(cfg.mock.tokenMs * (1 + Math.random()), signal);
    }
    const videos = await videosPromise;
    const followups = (reply.followups ?? []).map((k) => knowledge.questions[k]?.[lang]).filter((x): x is string => !!x);
    const actions = resolveActions(reply.actions).map((a) => (a.type === "membership" ? { ...a, label: MEMBERSHIP_LABEL[lang] } : a));
    return { content: answer, followups, actions, videos, playlist: reply.playlist ?? false };
  },
};

const MEMBERSHIP_LABEL: LangText = { has: "سجّل فبوابة المنتسبين", ar: "التسجيل في بوابة المنتسبين", fr: "S'inscrire sur le portail des membres" };
