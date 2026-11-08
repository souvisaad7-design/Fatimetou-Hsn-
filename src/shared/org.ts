/**
 * معلومات جمعية عون وسند الخيرية الأساسية — مصدر واحد لكل الموقع.
 * المرجع الكامل: docs/assistant-knowledge-base.md
 */
const base = import.meta.env.BASE_URL;

export const org = {
  name: "جمعية عون وسند الخيرية",
  shortName: "عون وسند",
  city: "نواكشوط، موريتانيا",
  slogan: "عون للمحتاج وسند للضعيف",
  /** رقم الجمعية للتواصل ودفع الانتساب والتبرعات */
  phone: "32203250",
  /** موقع الجمعية: نظام الأعضاء والمنتسبين والمالية ولوحة الإدارة والانتخابات */
  siteUrl: "https://aoun-sand.vercel.app/",
  /** من موقع الجمعية الرسمي */
  license: { number: "FA 010000210303202510407", date: "2025-03-05" },
  address: "نواكشوط - كارفور",
  email: "associationaidesoutien@gmail.com",
  whatsapp: "https://wa.me/32203250",
  socials: [
    { name: "فيسبوك", url: "https://www.facebook.com/share/1AxfWAYLhF/" },
    { name: "تيك توك", url: "https://www.tiktok.com/@association645" },
    { name: "يوتيوب", url: "https://youtube.com/@associationaidesoutien" },
    { name: "سناب شات", url: "https://www.snapchat.com/add/jmywnwsnd" },
  ],
  /** تطبيقات الدفع المعتمدة في موقع الجمعية للتحويل إلى رقم الجمعية */
  paymentApps: ["بنكيلي", "مصرفي", "السداد", "بيم بانك", "غازا بي", "كليك"],
  logo: `${base}awn-logo.png`,
  logoFull: `${base}awn-logo-full.png`,
} as const;
