/**
 * قيادة جمعية عون وسند الخيرية 2026–2027 — حسب نتائج الانتخابات الرسمية عبر موقع الجمعية.
 * تُستعمل كما هي، ولا تُضاف أسماء غير موجودة. name = null تعني: لم يُحدَّد بعد.
 * يُسمى قائد اللجنة «مسؤول اللجنة» وليس «رئيس اللجنة»، ونائبه «نائب المسؤول».
 */
import type { Intent } from "../types";

export const TERM = "2026–2027";
const SOURCE = "حسب نتائج الانتخابات الرسمية عبر موقع الجمعية";

interface Role {
  id: string;
  title: string; // كما يُكتب في الرد
  name: string | null;
  keywords: string[];
  excludes?: string[];
}

export const executive: Role[] = [
  { id: "president", title: "رئيس الجمعية", name: "أحمد طالب عمار (عمار)", keywords: ["رئيس", "الرئيس", "رئيسكم", "يراس", "يرأس"], excludes: ["نائب", "لجنه", "لجان"] },
  { id: "vice-president", title: "نائبة الرئيس", name: "ازغيلينة عبد القادر", keywords: ["نائب الرئيس", "نائبه الرئيس", "نائبه", "نائب"], excludes: ["لجنه", "مسؤول"] },
  { id: "secretary-general", title: "الأمين العام", name: "محمد امبارك / الداه / احمدلمده", keywords: ["الامين العام", "امين عام", "الامين", "امين الجمعيه"] },
];

interface Committee {
  id: string;
  name: string; // "اللجنة الإعلامية"
  leadTitle: string; // "مسؤولة" أو "مسؤول"
  lead: string | null;
  keywords: string[];
  note?: string;
}

export const committees: Committee[] = [
  { id: "media", name: "اللجنة الإعلامية", leadTitle: "مسؤولة", lead: "فاطمة براهيم اكًليلد", keywords: ["اعلاميه", "الاعلام", "اعلام"] },
  { id: "digital", name: "اللجنة الرقمية", leadTitle: "مسؤول", lead: "سيدي محمد عبد الرحمن", keywords: ["رقميه", "الرقمي"] },
  { id: "patients", name: "لجنة المرضى", leadTitle: "مسؤولة", lead: "أغلانه الزبير", keywords: ["المرضي", "مرضي", "المرضى"] },
  { id: "organization", name: "لجنة التنظيم والتنسيق", leadTitle: "مسؤول", lead: "امعيدله ابيلي", keywords: ["التنظيم", "التنسيق"] },
  { id: "finance", name: "اللجنة المالية", leadTitle: "مسؤول", lead: null, keywords: ["الماليه", "ماليه", "المال"] },
  { id: "membership", name: "اللجنة الانتسابية", leadTitle: "مسؤول", lead: null, keywords: ["الانتسابيه", "انتسابيه", "الانتساب"] },
  { id: "education", name: "لجنة التعليم", leadTitle: "مسؤول", lead: null, keywords: ["التعليم", "تعليم"], note: "تشرف على معهد المحجة البيضاء" },
  { id: "external", name: "لجنة العلاقات الخارجية", leadTitle: "مسؤول", lead: null, keywords: ["العلاقات الخارجيه", "العلاقات", "الخارجيه"] },
];

/** كلمات تدل على أن السؤال عن شخص (من يقود اللجنة) */
const PERSON_CUES = ["مسؤول", "من يقود", "قائد", "رئيس", "من هو", "من هي", "من يتولي", "اسم", "شكون", "منهو"];

const leadLine = (c: Committee) =>
  c.lead ? `**${c.leadTitle} ${c.name}:** ${c.lead}.` : `**مسؤول ${c.name}:** لم يُحدَّد بعد.`;

/** القائمة الكاملة (عند السؤال عن القيادة أو المكتب عموماً) */
export const fullLeadershipAnswer =
  `تشكيلة قيادة الجمعية للعام **${TERM}**، ${SOURCE}:\n\n` +
  "**المكتب التنفيذي**\n" +
  executive.map((r) => `- **${r.title === "رئيس الجمعية" ? "الرئيس" : r.title}:** ${r.name}.`).join("\n") +
  "\n\n**مسؤولو اللجان**\n" +
  committees.map((c) => `- ${leadLine(c)}`).join("\n") +
  "\n\n_يُسمى قائد اللجنة «مسؤول اللجنة» وليس «رئيس اللجنة»، ونائبه «نائب المسؤول»._";

export const committeesListAnswer =
  `للجمعية **ثماني لجان**، ومسؤولوها للعام ${TERM}:\n\n` +
  committees
    .map((c, i) => `${i + 1}. **${c.name}**${c.note ? ` (${c.note})` : ""}: ${c.lead ?? "لم يُحدَّد مسؤولها بعد"}.`)
    .join("\n") +
  "\n\nيُسمى قائد اللجنة **«مسؤول اللجنة»** وليس «رئيس اللجنة»، ونائبه **«نائب المسؤول»**.";

/** ردود قصيرة: سؤال عن شخص واحد ← جواب عن هذا الشخص فقط */
export const leadershipIntents: Intent[] = [
  ...executive.map<Intent>((r) => ({
    id: r.id,
    priority: 12,
    keywords: r.keywords,
    excludes: r.excludes,
    answer: `${r.title} للعام ${TERM} ${r.title.startsWith("نائبة") ? "هي" : "هو"} **${r.name}**، ${SOURCE}.`,
    followups: ["من هم أعضاء المكتب التنفيذي؟"],
  })),
  ...committees.map<Intent>((c) => ({
    id: `lead-${c.id}`,
    priority: 20,
    requires: PERSON_CUES,
    excludes: ["نائب"],
    keywords: c.keywords,
    answer: c.lead
      ? `${c.leadTitle} ${c.name} للعام ${TERM}: **${c.lead}**.`
      : `لم يُحدَّد مسؤول ${c.name} للعام ${TERM} بعد.`,
    followups: ["ما هي لجان الجمعية؟", "من هم أعضاء المكتب التنفيذي؟"],
  })),
  {
    id: "committee-deputy",
    priority: 21,
    requires: ["نائب"],
    keywords: ["لجنه", "نائب المسؤول", "نائب مسؤول", "نائبه مسؤول"],
    answer: "أسماء نواب مسؤولي اللجان لم تُنشر لدي بعد، وهذه المعلومة تحتاج إلى تأكيد من إدارة الجمعية.",
    followups: ["ما هي لجان الجمعية؟"],
  },
];
