/**
 * معلومات جمعية عون وسند الخيرية الأساسية — مصدر واحد لكل الموقع.
 * المرجع الكامل: docs/assistant-knowledge-base.md
 */
import logoUrl from "../assets/awn-logo.png";
import logoFullUrl from "../assets/awn-logo-full.png";

export const org = {
  name: "جمعية عون وسند الخيرية",
  shortName: "عون وسند",
  city: "نواكشوط، موريتانيا",
  slogan: "عون للمحتاج وسند للضعيف",
  /** رقم الجمعية للتواصل ودفع الانتساب والتبرعات */
  phone: "32203250",
  /** بيانات عامة عن الجمعية */
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
  /** تطبيقات الدفع للتحويل إلى رقم الجمعية */
  paymentApps: ["بنكيلي", "مصرفي", "السداد", "بيم بانك", "غازا بي", "كليك"],
  logo: logoUrl,
  logoFull: logoFullUrl,
} as const;
