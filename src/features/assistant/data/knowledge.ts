/**
 * معلومات «مساعد عون وسند» وردوده — مبنية فقط على تعليمات الإدارة في docs/assistant-knowledge-base.md.
 *
 * قواعد عند التعديل:
 * - الرد بالحسانية افتراضياً (has)، وبالفصحى (ar) أو الفرنسية (fr) إذا تكلم بها السائل.
 * - الجواب قصير: من جملتين إلى أربع.
 * - لا تُضف أي رقم أو تاريخ أو مبلغ أو اسم غير موجود في المعلومات الرسمية.
 * - ما لا نعرفه: «ما عندي خبر عن ذاك، اتصل بالجمعية على 32203250».
 * - الأسماء تُكتب بالعربية كما وردت، حتى في الردود الفرنسية.
 */
import type { Intent, KnowledgeBase, LangText } from "../types";

const PHONE = "32203250";
const T = (has: string, ar: string, fr: string): LangText => ({ has, ar, fr });

const unknownAbout = (has: string, ar: string, fr: string) =>
  T(
    `ما عندي خبر عن ${has}، اتصل بالجمعية على **${PHONE}**.`,
    `لا تتوفر لدي معلومة عن ${ar}، يمكنك الاتصال بالجمعية على **${PHONE}**.`,
    `Je n'ai pas d'information sur ${fr}. Contactez l'association au **${PHONE}**.`,
  );

/** الأسئلة الجاهزة (تظهر كمقترحات تحت الردود بلغة السائل) */
const questions: Record<string, LangText> = {
  about: T("شنهي جمعية عون وسند؟", "ما هي جمعية عون وسند؟", "Qu'est-ce que l'association Aoun wa Sanad ?"),
  join: T("كيف نتنسب للجمعية؟", "كيف أنتسب إلى الجمعية؟", "Comment adhérer à l'association ?"),
  amount: T("كم الاشتراك الشهري؟", "ما مبلغ الاشتراك الشهري؟", "Combien est la cotisation mensuelle ?"),
  vote: T("كيف نصوّت فالانتخابات؟", "كيف أصوّت في الانتخابات؟", "Comment voter aux élections ?"),
  elections: T("شنهي المناصب المنتخبة؟", "ما هي المناصب المنتخبة؟", "Quels sont les postes élus ?"),
  stages: T("شنهي مراحل الانتخابات؟", "ما مراحل الانتخابات؟", "Quelles sont les étapes des élections ?"),
  candidacy: T("كيف نترشح فالانتخابات؟", "كيف أترشح في الانتخابات؟", "Comment se porter candidat ?"),
  institute: T("شنهو معهد المحجة البيضاء؟", "ما هو معهد المحجة البيضاء؟", "Qu'est-ce que l'institut Al-Mahajja Al-Baydha ?"),
  committees: T("شنهي لجان الجمعية؟", "ما هي لجان الجمعية؟", "Quelles sont les commissions de l'association ?"),
  office: T("منهو فالمكتب التنفيذي؟", "من هم أعضاء المكتب التنفيذي؟", "Qui compose le bureau exécutif ?"),
  activities: T("شنهي أنشطة الجمعية؟", "ما هي أنشطة الجمعية؟", "Quelles sont les activités de l'association ?"),
  videos: T("فرجني فيديوهات إنجازات الجمعية", "أرني فيديوهات إنجازات الجمعية", "Montrez-moi les vidéos des réalisations"),
  goals: T("شنهي أهداف الجمعية؟", "ما أهداف الجمعية؟", "Quels sont les objectifs de l'association ?"),
  contact: T("كيف نتواصل مع الجمعية؟", "كيف أتواصل مع الجمعية؟", "Comment contacter l'association ?"),
};

/** كلمات تسأل عن شخص */
const PERSON = ["مسؤول", "رئيس", "منهو", "منهي", "شكون", "من هو", "من هي", "من يقود", "قائد", "اسم", "responsable", "qui ", "chef", "dirige"];

interface Committee {
  id: string;
  ar: string;
  fr: string;
  keywords: string[];
  lead?: LangText;
}

const committees: Committee[] = [
  {
    id: "membership", ar: "اللجنة الانتسابية", fr: "la commission des adhésions",
    keywords: ["انتسابيه", "الانتساب", "لجنه الانتساب", "adhesion"],
    lead: T("مسؤول لجنة الانتساب هو **سعد / صوفي**.", "مسؤول اللجنة الانتسابية هو **سعد / صوفي**.", "Le responsable de la commission des adhésions est **سعد / صوفي**."),
  },
  {
    id: "education", ar: "لجنة التعليم", fr: "la commission de l'enseignement",
    keywords: ["التعليم", "تعليم", "enseignement", "education"],
    lead: T(
      "مسؤول لجنة التعليم هو **عبد الله / الحسن**، وهي الّ تشرف على معهد المحجة البيضاء.",
      "مسؤول لجنة التعليم هو **عبد الله / الحسن**، وهي التي تشرف على معهد المحجة البيضاء.",
      "Le responsable de la commission de l'enseignement est **عبد الله / الحسن** ; elle supervise l'institut Al-Mahajja Al-Baydha.",
    ),
  },
  {
    id: "media", ar: "اللجنة الإعلامية", fr: "la commission des médias",
    keywords: ["اعلام", "اعلاميه", "media"],
    lead: T("مسؤولة الإعلام هي **أميه / حم**.", "مسؤولة الإعلام هي **أميه / حم**.", "La responsable des médias est **أميه / حم**."),
  },
  { id: "finance", ar: "اللجنة المالية", fr: "la commission des finances", keywords: ["ماليه", "المال", "finance"] },
  { id: "digital", ar: "اللجنة الرقمية", fr: "la commission numérique", keywords: ["رقميه", "الرقمي", "numerique"] },
  { id: "organization", ar: "لجنة التنظيم والتنسيق", fr: "la commission organisation et coordination", keywords: ["التنظيم", "التنسيق", "organisation", "coordination"] },
  { id: "external", ar: "لجنة العلاقات الخارجية", fr: "la commission des relations extérieures", keywords: ["العلاقات", "الخارجيه", "relations exterieures"] },
  { id: "patients", ar: "لجنة المرضى", fr: "la commission des malades", keywords: ["المرضي", "مرضي", "malades"] },
];

const committeeIntents: Intent[] = committees.map((c) => ({
  id: `lead-${c.id}`,
  priority: 20,
  requires: PERSON,
  excludes: ["نائب", "adjoint"],
  keywords: c.keywords,
  noVideo: true,
  answer: c.lead ?? unknownAbout(`مسؤول ${c.ar}`, `مسؤول ${c.ar}`, `le responsable de ${c.fr}`),
  followups: ["committees", "office"],
}));

const intents: Intent[] = [
  // ===== التحية والشكر =====
  {
    id: "greeting", priority: 0, maxWords: 5, noVideo: true,
    keywords: ["السلام", "سلام", "مرحبا", "اهلا", "صباح", "مساء", "اشحالك", "شحالك", "لاباس", "كيف حالك", "bonjour", "salut", "bonsoir", "salam"],
    answer: T(
      "وعليكم السلام ومرحبا بيك! أنا مساعد عون وسند، شنهو تبغي تعرف على الجمعية؟",
      "وعليكم السلام ورحمة الله، أهلاً بك! أنا مساعد عون وسند، كيف يمكنني مساعدتك؟",
      "Bonjour et bienvenue ! Je suis l'assistant de l'association Aoun wa Sanad. Comment puis-je vous aider ?",
    ),
    followups: ["about", "join"],
  },
  {
    id: "thanks", priority: 0, maxWords: 6, noVideo: true,
    keywords: ["شكرا", "جزاك", "بارك الله", "مشكور", "الله يجازيك", "merci"],
    answer: T(
      "العفو، الله يجازيك بالخير! الا عندك سؤال آخر على الجمعية، مرحبا بيك.",
      "العفو، وجزاك الله خيراً. إن كان لديك سؤال آخر عن الجمعية فأنا في الخدمة.",
      "Avec plaisir ! Si vous avez une autre question sur l'association, je suis là.",
    ),
  },

  // ===== التعريف =====
  {
    id: "about", priority: 1, noVideo: true,
    keywords: ["شنهي جمعيه", "ما هي جمعيه", "ماهي جمعيه", "عرفني", "تعريف", "نبذه", "عن الجمعيه", "عون وسند", "من انتم", "qu est ce que l association", "presentez", "c est quoi", "aoun"],
    answer: T(
      "جمعية عون وسند جمعية شبابية خيرية، أغلب أعضائها طلاب جامعيين، وشعارها **«عون للمحتاج وسند للضعيف»**. شنهو تبغي تعرف عليها؟",
      "جمعية عون وسند الخيرية جمعية شبابية خيرية، أغلب أعضائها طلاب جامعيون، وشعارها **«عون للمحتاج وسند للضعيف»**. ماذا تود أن تعرف عنها؟",
      "L'association caritative Aoun wa Sanad est une association de jeunes, composée surtout d'étudiants universitaires. Sa devise : **« عون للمحتاج وسند للضعيف »** (un soutien pour le nécessiteux, un appui pour le faible). Que souhaitez-vous savoir ?",
    ),
    followups: ["goals", "join"],
  },
  {
    id: "slogan", priority: 5, noVideo: true,
    keywords: ["شعار", "devise", "slogan"],
    answer: T(
      "شعار الجمعية: **«عون للمحتاج وسند للضعيف»**.",
      "شعار الجمعية هو: **«عون للمحتاج وسند للضعيف»**.",
      "La devise de l'association est **« عون للمحتاج وسند للضعيف »** : un soutien pour le nécessiteux, un appui pour le faible.",
    ),
    followups: ["about"],
  },
  {
    id: "goals", priority: 3, playlist: true,
    keywords: ["هدف", "اهداف", "اهدافها", "غايه", "تسعي", "objectif", "but de", "mission"],
    answer: T(
      "الجمعية تعمل على مساعدة الأسر المحتاجة، وتوفير الماء الصالح للشرب، ودعم التعليم والمحاظر، وبناء المساجد، وإفطار الصائمين، وتشجيع الشباب على التطوع. وهاذو فيديوهات من إنجازاتها 🎬",
      "تعمل الجمعية على مساعدة الأسر المحتاجة، وتوفير الماء الصالح للشرب، ودعم التعليم والمحاظر، وبناء المساجد، وإفطار الصائمين، وتشجيع الشباب على التطوع. وهذه فيديوهات من إنجازاتها 🎬",
      "L'association aide les familles dans le besoin, fournit de l'eau potable, soutient l'enseignement et les mahadras, contribue à la construction de mosquées, organise l'iftar des jeûneurs et encourage le bénévolat des jeunes. Voici des vidéos de ses réalisations 🎬",
    ),
    followups: ["activities", "join"],
  },

  // ===== التواصل =====
  {
    id: "contact", priority: 4, noVideo: true,
    keywords: ["تواصل", "نتواصل", "اتواصل", "اتصل", "نتصل", "رقم الجمعيه", "رقمكم", "رقم الهاتف", "رقم التواصل", "هاتف", "تلفون", "واتساب", "contact", "telephone", "numero", "appeler", "joindre", "whatsapp"],
    answer: T(
      `تقدر تتصل بالجمعية على الرقم **${PHONE}**، ومرحبا بيك.`,
      `يمكنك التواصل مع الجمعية على الرقم **${PHONE}**.`,
      `Vous pouvez contacter l'association au **${PHONE}**.`,
    ),
    followups: ["join", "about"],
  },

  // ===== المكتب التنفيذي =====
  {
    id: "office", priority: 6, noVideo: true,
    keywords: ["المكتب التنفيذي", "المكتب", "القياده", "قياده الجمعيه", "bureau", "direction"],
    answer: T(
      "المكتب التنفيذي: الرئيس **أحمد طالب / عمار**، والأمين العام **محمد أمبارك**.",
      "المكتب التنفيذي للجمعية: الرئيس **أحمد طالب / عمار**، والأمين العام **محمد أمبارك**.",
      "Bureau exécutif : le président est **أحمد طالب / عمار** et le secrétaire général **محمد أمبارك**.",
    ),
    followups: ["committees", "elections"],
  },
  {
    id: "president", priority: 12, noVideo: true,
    keywords: ["رئيس", "الرئيس", "رئيسكم", "president"],
    excludes: ["نائب", "لجنه", "لجان", "vice", "commission", "منتخب", "elus", "elu "],
    answer: T(
      "رئيس الجمعية هو **أحمد طالب / عمار**.",
      "رئيس الجمعية هو **أحمد طالب / عمار**.",
      "Le président de l'association est **أحمد طالب / عمار**.",
    ),
    followups: ["office", "committees"],
  },
  {
    id: "vice-president", priority: 13, noVideo: true,
    keywords: ["نائب الرئيس", "نائبه الرئيس", "vice president", "vice-president"],
    answer: unknownAbout("نائب الرئيس", "نائب الرئيس", "le vice-président"),
    followups: ["office"],
  },
  {
    id: "secretary-general", priority: 12, noVideo: true,
    keywords: ["الامين العام", "امين عام", "الامين", "secretaire general", "secretaire"],
    answer: T(
      "الأمين العام للجمعية هو **محمد أمبارك**.",
      "الأمين العام للجمعية هو **محمد أمبارك**.",
      "Le secrétaire général de l'association est **محمد أمبارك**.",
    ),
    followups: ["office"],
  },

  // ===== اللجان =====
  {
    id: "committees", priority: 6, noVideo: true,
    keywords: ["لجان", "اللجان", "لجنه", "commissions", "comites", "commission"],
    answer: T(
      "الجمعية عندها 8 لجان: الانتسابية، المالية، الإعلامية، الرقمية، التعليم، التنظيم والتنسيق، العلاقات الخارجية، والمرضى. وكل لجنة عندها **مسؤول اللجنة** و**نائب المسؤول**.",
      "للجمعية 8 لجان: اللجنة الانتسابية، والمالية، والإعلامية، والرقمية، ولجنة التعليم، ولجنة التنظيم والتنسيق، ولجنة العلاقات الخارجية، ولجنة المرضى. ولكل لجنة **مسؤول اللجنة** و**نائب المسؤول**.",
      "L'association compte 8 commissions : adhésions, finances, médias, numérique, enseignement, organisation et coordination, relations extérieures, et malades. Chacune a un **responsable** et un **responsable adjoint**.",
    ),
    followups: ["office", "institute"],
  },
  ...committeeIntents,
  {
    id: "committee-deputy", priority: 21, noVideo: true,
    requires: ["نائب", "adjoint"],
    keywords: ["لجنه", "نائب المسؤول", "نائب مسؤول", "نائبه مسؤول", "commission", "adjoint"],
    excludes: ["نائب الرئيس", "vice"],
    answer: unknownAbout("نواب مسؤولي اللجان", "نواب مسؤولي اللجان", "les responsables adjoints des commissions"),
    followups: ["committees"],
  },

  // ===== الانتساب =====
  {
    id: "join", priority: 4, noVideo: true,
    keywords: ["انتساب", "انتسب", "ننتسب", "نتنسب", "منتسب", "نسجل", "تسجيل", "عضويه", "ندخل الجمعيه", "adherer", "adhesion", "inscri", "devenir membre", "rejoindre"],
    answer: T(
      `المنتسبين مقسّمين على لوائح، وكل لائحة عندها مشرف يجمع الاشتراك كل شهر، والمبلغ حسب قدرتك. والمنتسب يقدر يصوّت فالانتخابات. للانتساب ولا أي سؤال عليه، اتصل بالجمعية على **${PHONE}**.`,
      `ينقسم المنتسبون إلى لوائح، ولكل لائحة مشرف يجمع الاشتراك كل شهر، والمبلغ حسب قدرتك. ويحق للمنتسب التصويت في الانتخابات. للانتساب أو لأي سؤال عنه، اتصل بالجمعية على **${PHONE}**.`,
      `Les membres sont répartis en listes ; chaque liste a un superviseur qui collecte la cotisation chaque mois, selon les moyens de chacun. Les membres peuvent voter aux élections. Pour adhérer ou pour toute question, appelez l'association au **${PHONE}**.`,
    ),
    actions: [{ type: "membership" }],
    followups: ["amount", "vote"],
  },
  {
    id: "amount", priority: 9, noVideo: true,
    keywords: ["كم الاشتراك", "مبلغ", "الاشتراك", "اشتراك", "نخلص", "ندفع", "ادفع", "قدرتي", "قيمه الانتساب", "cotisation", "montant", "combien coute", "combien payer", "payer"],
    answer: T(
      "الاشتراك ماهو محدد، كل واحد يدفع حسب قدرتو: 10، ولا 20، حتى 10 آلاف. المهم تختار مبلغ تقدر تداوم عليه، والقليل الدايم خير من الكثير المنقطع.",
      "الاشتراك الشهري غير محدد، فكل واحد يدفع حسب قدرته: 10 أو 20 وحتى 10 آلاف. المهم أن تختار مبلغاً تستطيع المداومة عليه، فالقليل الدائم خير من الكثير المنقطع.",
      "La cotisation mensuelle n'est pas fixe : chacun donne selon ses moyens, 10, 20, jusqu'à 10 000. L'important est de choisir un montant que vous pouvez maintenir chaque mois : peu mais régulier vaut mieux que beaucoup mais irrégulier.",
    ),
    followups: ["join", "contact"],
  },
  {
    id: "lists", priority: 8, noVideo: true,
    keywords: ["لائحه", "لوائح", "اللوائح", "مشرف", "المشرف", "liste", "superviseur"],
    answer: T(
      "المنتسبين مقسّمين على لوائح، وكل لائحة عندها مشرف يجمع الاشتراك كل شهر.",
      "ينقسم المنتسبون إلى لوائح، ولكل لائحة مشرف يجمع الاشتراك كل شهر.",
      "Les membres sont répartis en listes, et chaque liste a un superviseur qui collecte la cotisation chaque mois.",
    ),
    followups: ["amount", "join"],
  },

  // ===== الانتخابات =====
  {
    id: "elections", priority: 5, noVideo: true,
    keywords: ["انتخاب", "انتخابات", "المناصب", "منتخب", "election", "postes", "elus"],
    answer: T(
      "المناصب المنتخبة: الرئيس، نائب الرئيس، الأمين العام، ومسؤول ونائب لكل لجنة. الترشح والتصويت رقمي عبر نظام الجمعية، والعملية كاملة يديرها النظام ابلا تدخل بشري.",
      "المناصب المنتخبة هي: الرئيس، ونائب الرئيس، والأمين العام، ومسؤول ونائب لكل لجنة. ويتم الترشح والتصويت رقمياً عبر نظام الجمعية، ويدير النظام العملية كاملة دون تدخل بشري.",
      "Les postes élus sont : président, vice-président, secrétaire général, et un responsable et un adjoint pour chaque commission. Candidature et vote se font en ligne via le système de l'association, qui gère tout le processus sans intervention humaine.",
    ),
    followups: ["stages", "vote"],
  },
  {
    id: "stages", priority: 18, noVideo: true,
    keywords: ["مراحل", "المراحل", "خطوات", "متي", "كم تدوم", "etapes", "deroulement", "duree"],
    requires: ["انتخاب", "election", "تصويت", "vote", "ترشح", "مراحل", "etapes"],
    answer: T(
      "المراحل: الترشح، ثم حملات المترشحين (24 ساعة)، ثم التصويت (24 ساعة)، ثم النتائج تنشر وحدها.",
      "المراحل: الترشح، ثم حملات المترشحين (24 ساعة)، ثم التصويت (24 ساعة)، ثم تُنشر النتائج تلقائياً.",
      "Les étapes : candidatures, puis campagne des candidats (24 heures), puis vote (24 heures), puis publication automatique des résultats.",
    ),
    followups: ["vote", "candidacy"],
  },
  {
    id: "vote", priority: 10, noVideo: true,
    keywords: ["تصويت", "نصوت", "اصوت", "يصوت", "صوت", "voter", "vote"],
    answer: T(
      "التصويت رقمي عبر نظام الجمعية، ومفتوح للأعضاء والمنتسبين. يبدا بعد حملات المترشحين ويدوم 24 ساعة، والنتائج تطلع وحدها.",
      "التصويت رقمي عبر نظام الجمعية، ومفتوح للأعضاء والمنتسبين. يبدأ بعد حملات المترشحين ويدوم 24 ساعة، ثم تُنشر النتائج تلقائياً.",
      "Le vote se fait en ligne via le système de l'association et il est ouvert aux membres et aux adhérents. Il commence après la campagne des candidats, dure 24 heures, puis les résultats sont publiés automatiquement.",
    ),
    followups: ["candidacy", "elections"],
  },
  {
    id: "candidacy", priority: 10, noVideo: true,
    keywords: ["ترشح", "نترشح", "اترشح", "مترشح", "candidat", "candidature", "se presenter"],
    answer: T(
      "الترشح مفتوح لكل الأعضاء، ويكون رقمياً عبر نظام الجمعية. بعدو تجي حملات المترشحين 24 ساعة، ثم التصويت 24 ساعة.",
      "الترشح مفتوح لكل الأعضاء، ويتم رقمياً عبر نظام الجمعية. تليه حملات المترشحين لمدة 24 ساعة، ثم التصويت لمدة 24 ساعة.",
      "La candidature est ouverte à tous les membres et se fait en ligne via le système de l'association. Viennent ensuite la campagne des candidats (24 heures), puis le vote (24 heures).",
    ),
    followups: ["vote", "elections"],
  },
  {
    id: "results", priority: 10, noVideo: true,
    keywords: ["النتائج", "نتائج", "resultat"],
    answer: T(
      "النتائج تنشر تلقائياً بعد نهاية التصويت، والعملية كاملة يديرها النظام ابلا تدخل بشري.",
      "تُنشر النتائج تلقائياً بعد نهاية التصويت، ويدير النظام العملية كاملة دون تدخل بشري.",
      "Les résultats sont publiés automatiquement à la fin du vote ; tout le processus est géré par le système, sans intervention humaine.",
    ),
    followups: ["elections"],
  },

  // ===== المعهد =====
  {
    id: "institute", priority: 7,
    keywords: ["معهد", "المعهد", "المحجه", "البيضاء", "دروس", "institut", "mahajja"],
    answer: T(
      "معهد المحجة البيضاء فتحتو الجمعية، وبناوه الشباب بجهود تطوعية ابلا دعم خارجي. تشرف عليه لجنة التعليم، ويشرف على دروس شرعية فالأحياء.",
      "معهد المحجة البيضاء أنشأته الجمعية، وبناه الشباب بجهود تطوعية دون دعم خارجي. تشرف عليه لجنة التعليم، ويشرف بدوره على دروس شرعية في الأحياء.",
      "L'institut Al-Mahajja Al-Baydha a été ouvert par l'association et construit par les jeunes, bénévolement, sans aide extérieure. Il est supervisé par la commission de l'enseignement et encadre des cours religieux dans les quartiers.",
    ),
    followups: ["activities", "committees"],
  },

  // ===== الأنشطة والإنجازات =====
  {
    id: "activities", priority: 3, playlist: true,
    keywords: ["نشاط", "انشطه", "الانشطه", "انجاز", "انجازات", "انجازاتها", "مشاريع", "مشروع", "شنهي تعملو", "activite", "realisation", "projet"],
    answer: T(
      "من أنشطة الجمعية: دورة تكوينية فالبرمجة وأدوات الذكاء الاصطناعي (20 مقعد، 3 أيام)، وتطبيق **«شفاء للناس»**، تطبيق طبي خيري تابع للجمعية. وهاذو فيديوهات من أنشطتها وإنجازاتها 🎬",
      "من أنشطة الجمعية: دورة تكوينية في البرمجة وأدوات الذكاء الاصطناعي (20 مقعداً، 3 أيام)، وتطبيق **«شفاء للناس»**، وهو تطبيق طبي خيري تابع للجمعية. وهذه فيديوهات من أنشطتها وإنجازاتها 🎬",
      "Parmi les activités de l'association : une formation en programmation et outils d'intelligence artificielle (20 places, 3 jours), et l'application **« شفاء للناس »**, une application médicale caritative de l'association. Voici des vidéos de ses activités et réalisations 🎬",
    ),
    followups: ["institute", "goals"],
  },
  {
    id: "course", priority: 9, noVideo: true,
    keywords: ["دوره", "تكوين", "برمجه", "الذكاء الاصطناعي", "formation", "programmation", "intelligence artificielle"],
    answer: T(
      `الجمعية عندها دورة تكوينية فالبرمجة وأدوات الذكاء الاصطناعي: 20 مقعد، 3 أيام. للتسجيل ولا التفاصيل، اتصل بالجمعية على **${PHONE}**.`,
      `لدى الجمعية دورة تكوينية في البرمجة وأدوات الذكاء الاصطناعي: 20 مقعداً، 3 أيام. للتسجيل أو التفاصيل، اتصل بالجمعية على **${PHONE}**.`,
      `L'association propose une formation en programmation et outils d'intelligence artificielle : 20 places, 3 jours. Pour s'inscrire ou en savoir plus, appelez le **${PHONE}**.`,
    ),
    followups: ["activities"],
  },
  {
    id: "app", priority: 9, noVideo: true,
    keywords: ["شفاء", "تطبيق", "application", "chifa", "shifa"],
    answer: T(
      `**«شفاء للناس»** تطبيق طبي خيري تابع للجمعية. ما عندي تفاصيل أكثر عليه، اتصل بالجمعية على **${PHONE}**.`,
      `**«شفاء للناس»** تطبيق طبي خيري تابع للجمعية. لا تتوفر لدي تفاصيل أكثر عنه، يمكنك الاتصال بالجمعية على **${PHONE}**.`,
      `**« شفاء للناس »** est une application médicale caritative de l'association. Je n'ai pas plus de détails ; contactez l'association au **${PHONE}**.`,
    ),
    followups: ["activities"],
  },
  {
    id: "videos", priority: 15, playlist: true,
    keywords: ["فيديو", "فيديوهات", "قناه", "يوتيوب", "youtube", "مقاطع", "مقطع", "اشاهد", "نشاهد", "شاهد", "فرجني", "video", "chaine"],
    answer: T(
      "هاذو فيديوهات الجمعية على قناتها فيوتيوب، تقدر تتنقل بيناتهم من زر القائمة فالمشغّل 🎬",
      "هذه فيديوهات الجمعية على قناتها في يوتيوب، ويمكنك التنقل بينها من زر القائمة داخل المشغّل 🎬",
      "Voici les vidéos de la chaîne YouTube de l'association ; passez de l'une à l'autre avec le bouton de liste du lecteur 🎬",
    ),
    followups: ["activities", "goals"],
  },
];

export const knowledge: KnowledgeBase = {
  intents,
  questions,
  topicWords: [
    "جمعيه", "عون", "سند", "انتساب", "انتسب", "منتسب", "لجنه", "لجان", "انتخاب", "معهد", "محجه", "نشاط", "انشطه",
    "اشتراك", "تبرع", "متبرع", "رئيس", "امين", "مسؤول", "مشرف", "لائحه", "دوره", "تطبيق", "مكتب", "عضو", "اعضاء",
    "ترشح", "تصويت", "حمله", "حملات", "كفاله", "سقايه", "مشروع", "مساعده", "متطوع", "تطوع",
    "association", "adhe", "membre", "commission", "election", "vote", "institut", "activit", "cotisation", "don ",
    "president", "formation", "benevol", "campagne",
  ],
  unknown: {
    answer: T(
      `ما عندي خبر عن ذاك، اتصل بالجمعية على **${PHONE}**.`,
      `لا تتوفر لدي معلومة عن ذلك، يمكنك الاتصال بالجمعية على **${PHONE}**.`,
      `Je n'ai pas cette information. Contactez l'association au **${PHONE}**.`,
    ),
    followups: ["about", "join"],
    noVideo: true,
  },
  offTopic: {
    answer: T(
      "سامحني، أنا هون غير نجاوب على أسئلة جمعية عون وسند. الا عندك سؤال على الانتساب ولا الأنشطة، مرحبا بيك!",
      "عذراً، أنا هنا للإجابة عن أسئلة جمعية عون وسند فقط. إن كان لديك سؤال عن الانتساب أو الأنشطة، فمرحباً بك!",
      "Désolé, je réponds uniquement aux questions sur l'association Aoun wa Sanad. Une question sur l'adhésion ou les activités ? Avec plaisir !",
    ),
    followups: ["join", "activities"],
    noVideo: true,
  },
};
