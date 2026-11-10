/**
 * إعدادات المساعد الذكي — الملف الوحيد الذي يحتاج تعديلاً عند الربط لاحقاً.
 *
 * provider:
 *   "mock" → ردود محلية من data/knowledge.ts (الوضع الحالي، بدون أي اتصال خارجي)
 *   "http" → إرسال المحادثة إلى Backend الجمعية عبر api.endpoint
 *
 * يمكن أيضاً ضبط القيم من متغيرات البيئة عند البناء (ملف .env):
 *   VITE_ASSISTANT_PROVIDER=http
 *   VITE_ASSISTANT_API=/api/assistant/chat
 *   VITE_MEMBERSHIP_URL=https://...
 */
import { org } from "../../shared/org";

const env = import.meta.env;

export const assistantConfig = {
  provider: (env.VITE_ASSISTANT_PROVIDER as "mock" | "http") || "mock",

  org: {
    name: org.name,
    shortName: org.shortName,
    logo: org.logo, // رمز الشعار (للأيقونات والصور الصغيرة)
    logoFull: org.logoFull, // الشعار الكامل مع اسم الجمعية
  },

  assistant: {
    name: "مساعد عون وسند",
    welcome: [
      "السلام عليكم ومرحبا بيك!",
      "أنا مساعد عون وسند، نجاوبك على أسئلة الجمعية: الانتساب، اللجان، الانتخابات، المعهد، الأنشطة، والتواصل.",
      "تقدر تكلمني بالحسانية، ولا بالفصحى، ولا بالفرنسية.",
    ],
    suggestions: [
      { text: "شنهي جمعية عون وسند؟", icon: "info" },
      { text: "شنهي أهداف الجمعية؟", icon: "target" },
      { text: "كيف نتنسب للجمعية؟", icon: "hands" },
      { text: "فرجني فيديوهات إنجازات الجمعية", icon: "star" },
      { text: "كم الاشتراك الشهري؟", icon: "heart" },
      { text: "كيف نصوّت فالانتخابات؟", icon: "check" },
    ] as const,
    /** النسخة الفرنسية (عند اختيار Français أعلى المساعد) */
    fr: {
      name: "Assistant Aoun wa Sanad",
      welcome: [
        "Bonjour et bienvenue !",
        "Je suis l'assistant de l'association Aoun wa Sanad. Je réponds à vos questions sur l'adhésion, les commissions, les élections, l'institut, les activités et le contact.",
        "Vous pouvez m'écrire en français, en arabe ou en hassaniya.",
      ],
      suggestions: [
        "Qu'est-ce que l'association Aoun wa Sanad ?",
        "Quels sont les objectifs de l'association ?",
        "Comment adhérer à l'association ?",
        "Montrez-moi les vidéos des réalisations",
        "Combien est la cotisation mensuelle ?",
        "Comment voter aux élections ?",
      ],
      membershipLabel: "S'inscrire sur le portail des membres",
    },
  },

  /**
   * رابط صفحة الانتساب (اختياري). المساعد مستقل، فلا يظهر أي زر انتساب ما دام الرابط غير مضبوط.
   * عند ضبط VITE_MEMBERSHIP_URL يظهر زر تحت ردود الانتساب، ورابط في الشريط الجانبي.
   */
  membership: {
    url: (env.VITE_MEMBERSHIP_URL as string | undefined) || "../", // بوابة المنتسبين في الموقع نفسه
    label: "التسجيل في الجمعية",
  },

  api: {
    endpoint: (env.VITE_ASSISTANT_API as string | undefined) || null,
    timeoutMs: 30000,
    headers: {} as Record<string, string>, // لا تضع مفاتيح سرية هنا؛ مكانها الخادم
  },

  /**
   * مشغّل كل فيديوهات قناة الجمعية (قائمة الرفع) داخل فقاعة الرد — دون أي API.
   * يتنقل المستخدم بين الفيديوهات من زر القائمة داخل المشغّل.
   */
  channelPlaylist: {
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=UUtSeTuqXTgjteFqL8XVBz3w&rel=0&playsinline=1",
    title: "فيديوهات جمعية عون وسند الخيرية",
    intro: "هذه فيديوهات جمعية عون وسند الخيرية 🎬",
    buttonLabel: "فيديوهات الجمعية",
  },

  /**
   * فيديوهات قناة الجمعية على يوتيوب (تُعرض داخل البوت).
   * searchUrl: دالة البحث على الخادم (api/youtube/search). على Vercel تعمل كما هي؛
   * وعلى GitHub Pages اضبط VITE_VIDEO_SEARCH_URL برابط مشروع Vercel الكامل.
   * إذا تعذّر البحث، يكمل البوت رده نصياً دون فيديو.
   */
  videos: {
    enabled: env.VITE_VIDEOS_ENABLED !== "false",
    searchUrl: (env.VITE_VIDEO_SEARCH_URL as string | undefined) || "/api/youtube/search",
    timeoutMs: 4000,
  },

  /**
   * المحادثة الصوتية (زر الميكروفون): لغة التعرف على كلام الزائر.
   * لا توجد حسانية في المتصفحات؛ العربية تفهمها جيداً. يتحول تلقائياً إلى الفرنسية إذا تكلم بها الزائر.
   */
  voice: {
    arabicLang: (env.VITE_VOICE_LANG as string | undefined) || "ar-SA",
    frenchLang: "fr-FR",
  },

  mock: { thinkingMs: [500, 1100] as [number, number], tokenMs: 18 },

  storageKey: "awn:assistant:v1",
};
