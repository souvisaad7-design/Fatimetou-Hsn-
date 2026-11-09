import { normalizeArabic } from "../../../shared/arabic";
import type { KnowledgeBase, Intent } from "../types";

/** توحيد النص للمطابقة: العربية (الحروف والتشكيل) والفرنسية (الحروف الكبيرة والنبرات) */
export function normalizeText(text: string): string {
  return normalizeArabic(String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’`-]/g, " "));
}

/** اختيار أنسب رد لسؤال المستخدم بناءً على الكلمات المفتاحية والأولوية؛ null إذا لم يُعرف السؤال */
export function matchIntent(question: string, kb: KnowledgeBase): Intent | null {
  const q = ` ${normalizeText(question)} `;
  const has = (k: string) => q.includes(normalizeText(k));
  const words = q.trim().split(" ").filter(Boolean).length;
  let best: Intent | null = null;
  let bestScore = 0;
  for (const intent of kb.intents) {
    if (intent.maxWords && words > intent.maxWords) continue;
    if (intent.requires && !intent.requires.some(has)) continue;
    if (intent.excludes?.some(has)) continue;
    const hits = intent.keywords.filter(has).length;
    if (!hits) continue;
    const score = hits * 10 + (intent.priority ?? 0);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return best;
}

/** هل يتعلق السؤال بالجمعية؟ (للتفريق بين «ما عندي خبر» و«سؤال خارج موضوع الجمعية») */
export function isAboutAssociation(question: string, kb: KnowledgeBase): boolean {
  const q = ` ${normalizeText(question)} `;
  return kb.topicWords.some((k) => q.includes(normalizeText(k)));
}
