/**
 * إعدادات المساعد الذكي — الملف الوحيد الذي يحتاج تعديلاً عند الربط لاحقاً.
 *
 * provider:
 *   "mock" → ردود تجريبية محلية من data/mockKnowledge.ts (الوضع الحالي، بدون أي اتصال خارجي)
 *   "http" → إرسال المحادثة إلى Backend الجمعية عبر api.endpoint
 *
 * يمكن أيضاً ضبط القيم من متغيرات البيئة عند البناء (ملف .env):
 *   VITE_ASSISTANT_PROVIDER=http
 *   VITE_ASSISTANT_API=/api/assistant/chat
 *   VITE_MEMBERSHIP_URL=https://...
 */
const env = import.meta.env;

export const assistantConfig = {
  provider: (env.VITE_ASSISTANT_PROVIDER as "mock" | "http") || "mock",

  org: {
    name: "جمعية عون وسند الخيرية",
    shortName: "عون وسند",
    nameLatin: "Awn wa Sanad",
    logo: `${env.BASE_URL}awn-logo.svg`,
  },

  assistant: {
    name: "المساعد الذكي",
    welcome: [
      "السلام عليكم ورحمة الله وبركاته.",
      "مرحباً بكم في المساعد الذكي لجمعية عون وسند الخيرية.",
      "أنا هنا لمساعدتكم والإجابة عن استفساراتكم حول الجمعية وأنشطتها ومشاريعها.",
    ],
    suggestions: [
      { text: "ما هي جمعية عون وسند الخيرية؟", icon: "info" },
      { text: "ما أهداف الجمعية؟", icon: "target" },
      { text: "كيف يمكنني المشاركة في الأنشطة؟", icon: "hands" },
      { text: "ما أبرز مشاريع الجمعية؟", icon: "star" },
      { text: "كيف يمكنني دعم مشاريع الجمعية؟", icon: "heart" },
      { text: "كيف أتواصل مع إدارة الجمعية؟", icon: "phone" },
    ] as const,
  },

  /**
   * الربط المستقبلي بموقع انتساب الجمعية.
   * اتركه null حتى يصبح الموقع جاهزاً؛ عند تعيينه يظهر زر "الانتقال إلى صفحة الانتساب"
   * تحت ردود الانتساب، ورابط في الشريط الجانبي.
   */
  membership: {
    url: (env.VITE_MEMBERSHIP_URL as string | undefined) || null,
    label: "الانتقال إلى صفحة الانتساب",
  },

  api: {
    endpoint: (env.VITE_ASSISTANT_API as string | undefined) || null,
    timeoutMs: 30000,
    headers: {} as Record<string, string>, // لا تضع مفاتيح سرية هنا؛ مكانها الخادم
  },

  mock: { thinkingMs: [500, 1100] as [number, number], tokenMs: 18 },

  storageKey: "awn:assistant:v1",
};
