/**
 * ردود «مساعد عون وسند» على واتساب — نفس منطق المساعد في الموقع وقواعده.
 * يُجمَّع منطق الرد في supabase/functions/whatsapp/bot.js (npm run build:wa-bot)،
 * والمعلومات نفسها (data/knowledge.ts والقاموس الحساني) تُنشر مع الموقع في wa-bot.json
 * فتقرؤها دالة واتساب منه — مصدر معلومات واحد للموقع وواتساب، يتحدّث تلقائياً مع كل نشر للموقع.
 */
import { detectLang, type ReplyLang } from "../lib/detectLang";
import { isArabizi, toArabic } from "../lib/arabizi";
import { isAboutAssociation, matchIntent, normalizeText } from "../lib/matchIntent";
import type { KnowledgeBase } from "../types";

export type { ReplyLang };
export interface BotData { knowledge: KnowledgeBase; lexicon: Record<string, string> }

const PLAYLIST_URL = "https://www.youtube.com/playlist?list=UUtSeTuqXTgjteFqL8XVBz3w";
const GREETING: Record<ReplyLang, string> = { has: "وعليكم السلام ومرحبا بيك! ", ar: "وعليكم السلام ورحمة الله! ", fr: "Bonjour ! " };
const MORE: Record<ReplyLang, string> = { has: "تقدر تسأل حتى:", ar: "يمكنك أن تسأل أيضاً:", fr: "Vous pouvez aussi demander :" };
const JOIN: Record<ReplyLang, string> = { has: "سجّل فبوابة المنتسبين:", ar: "التسجيل في بوابة المنتسبين:", fr: "Inscription sur le portail des membres :" };
const VIDEOS: Record<ReplyLang, string> = { has: "فيديوهات الجمعية:", ar: "فيديوهات الجمعية:", fr: "Vidéos de l'association :" };

/** تحويل تنسيق الموقع (Markdown) إلى تنسيق واتساب */
export function toWhatsApp(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1: $2")
    .replace(/^#{1,6}\s*/gm, "")
    .trim();
}

function detectReplyLang(text: string, lexicon: Record<string, string>): { lang: ReplyLang; question: string } {
  let lang = detectLang(text);
  let question = text;
  if (lang === "fr" && isArabizi(text, lexicon)) {
    lang = "has";
    question = `${toArabic(text, lexicon)} ${text}`;
  }
  return { lang, question };
}

/** نص رد المساعد على رسالة واتساب */
export function botReply(data: BotData, text: string, siteUrl: string): { lang: ReplyLang; text: string; intent: string } {
  const { knowledge } = data;
  const { lang, question } = detectReplyLang(text, data.lexicon);
  const hit = matchIntent(question, knowledge);
  const reply = hit ?? (isAboutAssociation(question, knowledge) ? knowledge.unknown : knowledge.offTopic);
  let answer = reply.answer[lang];
  const greets = /(^| )(السلام|سلام|bonjour|salut|salam)( |$)/.test(normalizeText(question));
  if (greets && reply !== knowledge.offTopic && !answer.startsWith("وعليكم") && !answer.startsWith("Bonjour")) answer = GREETING[lang] + answer;

  const parts = [toWhatsApp(answer)];
  if (reply.playlist) parts.push(`🎬 ${VIDEOS[lang]} ${PLAYLIST_URL}`);
  if (reply.actions?.some((a) => a.type === "membership") && siteUrl) parts.push(`📝 ${JOIN[lang]} ${siteUrl}`);
  for (const a of reply.actions ?? []) if (a.type === "link" && a.url) parts.push(`🔗 ${a.label ? `${a.label}: ` : ""}${a.url}`);
  const followups = (reply.followups ?? []).map((k) => knowledge.questions[k]?.[lang]).filter((x): x is string => !!x).slice(0, 3);
  if (followups.length) parts.push(`${MORE[lang]}\n${followups.map((q) => `• ${q}`).join("\n")}`);
  return { lang, text: parts.join("\n\n").slice(0, 4000), intent: hit?.id ?? (reply === knowledge.unknown ? "unknown" : "offTopic") };
}
