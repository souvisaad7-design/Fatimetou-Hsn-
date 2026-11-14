/** المعلومات التي تقرؤها دالة واتساب من الموقع (wa-bot.json) — تُولَّد عند بناء الموقع */
import { knowledge } from "../data/knowledge";
import lexiconFile from "../data/hassaniyaLexicon.json";

export const botData = { knowledge, lexicon: (lexiconFile as { latin: Record<string, string> }).latin };
