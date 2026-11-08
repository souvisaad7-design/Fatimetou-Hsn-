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
  logo: `${base}awn-logo.png`,
  logoFull: `${base}awn-logo-full.png`,
} as const;
