import { normalizeArabic } from "../../../shared/arabic";
import type { KnowledgeBase } from "../types";

/** اختيار أنسب رد تجريبي لسؤال المستخدم بناءً على الكلمات المفتاحية والأولوية */
export function matchIntent(question: string, kb: KnowledgeBase) {
  const q = normalizeArabic(question);
  const words = q.split(" ").filter(Boolean).length;
  let best: (typeof kb.intents)[number] | null = null;
  let bestScore = 0;
  for (const intent of kb.intents) {
    if (intent.maxWords && words > intent.maxWords) continue;
    if (intent.requires && !intent.requires.some((k) => q.includes(normalizeArabic(k)))) continue;
    if (intent.excludes?.some((k) => q.includes(normalizeArabic(k)))) continue;
    const hits = intent.keywords.filter((k) => q.includes(normalizeArabic(k))).length;
    if (!hits) continue;
    const score = hits * 10 + (intent.priority ?? 0);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return best ?? { id: "fallback", keywords: [], ...kb.fallback };
}
