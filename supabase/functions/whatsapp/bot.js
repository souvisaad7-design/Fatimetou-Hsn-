// ملف مولَّد تلقائياً من src/features/assistant/server/whatsappBot.ts — لا تعدّله يدوياً (npm run build:wa-bot)

// src/shared/arabic.ts
function normalizeArabic(text) {
  return String(text).replace(/[ً-ٰٟـ]/g, "").replace(/[إأآٱ]/g, "\u0627").replace(/ى/g, "\u064A").replace(/ة/g, "\u0647").replace(/ؤ/g, "\u0648").replace(/ئ/g, "\u064A").replace(/[؟?!.,،؛:"'()]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

// src/features/assistant/lib/detectLang.ts
var HASSANIYA = /* @__PURE__ */ new Set([
  "\u0634\u0646\u0647\u064A",
  "\u0634\u0646\u0647\u0648",
  "\u0627\u0634\u0646\u0647\u064A",
  "\u0627\u0634\u0646\u0647\u0648",
  "\u0634\u0646\u0648",
  "\u0627\u0634\u0646\u0648",
  "\u0645\u0646\u0647\u0648",
  "\u0645\u0646\u0647\u064A",
  "\u0634\u0643\u0648\u0646",
  "\u0643\u064A\u0641\u0627\u0634",
  "\u0645\u0627\u0647\u0648",
  "\u0645\u0627\u0647\u064A",
  "\u0627\u0628\u0644\u0627",
  "\u0639\u0627\u062F",
  "\u0630\u0627\u0643",
  "\u0630\u064A\u0643",
  "\u0647\u0627\u0630",
  "\u0647\u0627\u0630\u0648",
  "\u0647\u0627\u0630\u064A",
  "\u0647\u0627\u0630\u0627",
  "\u062A\u0628\u063A\u064A",
  "\u0646\u0628\u063A\u064A",
  "\u064A\u0628\u063A\u064A",
  "\u06AF\u0648\u0644",
  "\u0646\u06AF\u062F\u0631",
  "\u062A\u06AF\u062F\u0631",
  "\u0646\u0642\u062F\u0631",
  "\u062A\u0642\u062F\u0631",
  "\u0648\u064A\u0646",
  "\u0627\u0634\u062D\u0627\u0644",
  "\u0644\u0627\u0628\u0627\u0633",
  "\u0641\u0631\u062C\u0646\u064A",
  "\u0639\u0637\u064A\u0646\u064A",
  "\u06AF\u0644\u064A",
  "\u0642\u0644\u064A",
  "\u064A\u0627\u0633\u0631",
  "\u0627\u0639\u0644",
  "\u0627\u0639\u0644\u064A",
  "\u0645\u0632\u0627\u0644",
  "\u0646\u0646\u062A\u0633\u0628",
  "\u0646\u062A\u0646\u0633\u0628",
  "\u0646\u0635\u0648\u062A",
  "\u0646\u062A\u0628\u0631\u0639",
  "\u0646\u062A\u0648\u0627\u0635\u0644",
  "\u0646\u062F\u0641\u0639",
  "\u0646\u062A\u0631\u0634\u062D",
  "\u0646\u0639\u0631\u0641",
  "\u0646\u0633\u062C\u0644",
  "\u0646\u0634\u0627\u0631\u0643",
  "\u0646\u062F\u062E\u0644",
  "\u0646\u062A\u0635\u0644",
  "\u062D\u062F",
  "\u0630\u0648"
]);
var FUSHA = /* @__PURE__ */ new Set([
  "\u0645\u0627\u0630\u0627",
  "\u0644\u0645\u0627\u0630\u0627",
  "\u0647\u0644",
  "\u064A\u0645\u0643\u0646",
  "\u064A\u0645\u0643\u0646\u0646\u064A",
  "\u064A\u0645\u0643\u0646\u0646\u0627",
  "\u064A\u0645\u0643\u0646\u0643",
  "\u0627\u0648\u062F",
  "\u0627\u0631\u064A\u062F",
  "\u0627\u0633\u062A\u0637\u064A\u0639",
  "\u0627\u0644\u0630\u064A",
  "\u0627\u0644\u062A\u064A",
  "\u0627\u0644\u0630\u064A\u0646",
  "\u0627\u0646\u062A\u0633\u0628",
  "\u0627\u062A\u0628\u0631\u0639",
  "\u0627\u0635\u0648\u062A",
  "\u0627\u062A\u0631\u0634\u062D",
  "\u0627\u062A\u0648\u0627\u0635\u0644",
  "\u0627\u0633\u062C\u0644",
  "\u0627\u0634\u0627\u0631\u0643",
  "\u0627\u062F\u0641\u0639",
  "\u0627\u0631\u0646\u064A",
  "\u0627\u0639\u0631\u0641",
  "\u062D\u062F\u062B\u0646\u064A",
  "\u0627\u062E\u0628\u0631\u0646\u064A",
  "\u0644\u064A\u0633"
]);
var FUSHA_MA = /(^| )ما (هي|هو|هم|اهداف|ابرز|المناصب|مراحل|شروط|دور|عدد|قيمه|مبلغ)( |$)/;
var FUSHA_MAN = /(^| )من (هو|هي|هم)( |$)/;
function detectLang(text) {
  const latin = (text.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length;
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  if (latin > arabic) return "fr";
  if (/[گڤ]/.test(text)) return "has";
  const q = normalizeArabic(text);
  const words2 = q.split(" ").filter(Boolean);
  const has = words2.filter((w) => HASSANIYA.has(w) || /^فال.{3,}/.test(w)).length;
  const fusha = words2.filter((w) => FUSHA.has(w)).length + (FUSHA_MA.test(q) ? 1 : 0) + (FUSHA_MAN.test(q) ? 1 : 0);
  return fusha > has ? "ar" : "has";
}

// src/features/assistant/lib/arabizi.ts
var FRENCH = /* @__PURE__ */ new Set([
  "le",
  "la",
  "les",
  "de",
  "des",
  "du",
  "un",
  "une",
  "est",
  "et",
  "en",
  "que",
  "qui",
  "quoi",
  "comment",
  "pour",
  "avec",
  "sur",
  "dans",
  "au",
  "aux",
  "ce",
  "cette",
  "ces",
  "je",
  "tu",
  "vous",
  "il",
  "elle",
  "nous",
  "on",
  "pas",
  "plus",
  "ou",
  "mon",
  "ma",
  "mes",
  "ton",
  "ta",
  "votre",
  "vos",
  "quel",
  "quelle",
  "quels",
  "quelles",
  "combien",
  "bonjour",
  "merci",
  "association",
  "sont",
  "suis",
  "peux",
  "puis",
  "faire",
  "qu",
  "l",
  "d",
  "s",
  "c",
  "j",
  "a",
  "y",
  "ne",
  "se",
  "sa",
  "son",
  "par",
  "si",
  "mais",
  "donc",
  "tout",
  "tous",
  "bien",
  "tres",
  "membre",
  "membres",
  "adherer",
  "cotisation",
  "election",
  "elections",
  "president",
  "objectifs",
  "activites",
  "salut",
  "bonsoir",
  "oui",
  "non",
  "aide",
  "aider"
]);
var HASSANIYA2 = /* @__PURE__ */ new Set([
  "salam",
  "slm",
  "esselam",
  "assalam",
  "labas",
  "chokran",
  "choukran",
  "chukran",
  "mechkour",
  "mechkur",
  "jazak",
  "jam3iya",
  "jem3iya",
  "jam3ia",
  "jem3ia",
  "intisab",
  "ntisab",
  "nentesb",
  "ichtirak",
  "echtirak",
  "ishtirak",
  "lejna",
  "lijan",
  "lajna",
  "intikhab",
  "intikhabat",
  "entikhabat",
  "ma3had",
  "me3hed",
  "nachat",
  "chenhou",
  "chniya",
  "chenhi",
  "chkoun",
  "chkon",
  "kiv",
  "kivach",
  "9edech",
  "gedech",
  "nebghi",
  "tebghi",
  "ra2is"
]);
var words = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
function isArabizi(text, lex) {
  if (/[؀-ۿ]/.test(text)) return false;
  const ws = words(text);
  if (!ws.length) return false;
  const accents = /[éèêàçùâîôû]/i.test(text) ? 2 : 0;
  let has = 0;
  let fr = accents;
  for (const w of ws) {
    if (FRENCH.has(w)) fr++;
    else if (HASSANIYA2.has(w)) has += 2;
    else if (/[a-z][2-9]|[2-9][a-z]/.test(w)) has += 2;
    else if (w.length >= 2 && lex[w]) has++;
  }
  return has > fr;
}
function toArabic(text, lex) {
  return words(text).map((w) => lex[w] ?? w).join(" ");
}

// src/features/assistant/lib/matchIntent.ts
function normalizeText(text) {
  return normalizeArabic(String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’`-]/g, " "));
}
function matchIntent(question, kb) {
  const q = ` ${normalizeText(question)} `;
  const has = (k) => q.includes(normalizeText(k));
  const words2 = q.trim().split(" ").filter(Boolean).length;
  let best = null;
  let bestScore = 0;
  for (const intent of kb.intents) {
    if (intent.maxWords && words2 > intent.maxWords) continue;
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
function isAboutAssociation(question, kb) {
  const q = ` ${normalizeText(question)} `;
  return kb.topicWords.some((k) => q.includes(normalizeText(k)));
}

// src/features/assistant/server/whatsappBot.ts
var PLAYLIST_URL = "https://www.youtube.com/playlist?list=UUtSeTuqXTgjteFqL8XVBz3w";
var GREETING = { has: "\u0648\u0639\u0644\u064A\u0643\u0645 \u0627\u0644\u0633\u0644\u0627\u0645 \u0648\u0645\u0631\u062D\u0628\u0627 \u0628\u064A\u0643! ", ar: "\u0648\u0639\u0644\u064A\u0643\u0645 \u0627\u0644\u0633\u0644\u0627\u0645 \u0648\u0631\u062D\u0645\u0629 \u0627\u0644\u0644\u0647! ", fr: "Bonjour ! " };
var MORE = { has: "\u062A\u0642\u062F\u0631 \u062A\u0633\u0623\u0644 \u062D\u062A\u0649:", ar: "\u064A\u0645\u0643\u0646\u0643 \u0623\u0646 \u062A\u0633\u0623\u0644 \u0623\u064A\u0636\u0627\u064B:", fr: "Vous pouvez aussi demander :" };
var JOIN = { has: "\u0633\u062C\u0651\u0644 \u0641\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0646\u062A\u0633\u0628\u064A\u0646:", ar: "\u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0641\u064A \u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0646\u062A\u0633\u0628\u064A\u0646:", fr: "Inscription sur le portail des membres :" };
var VIDEOS = { has: "\u0641\u064A\u062F\u064A\u0648\u0647\u0627\u062A \u0627\u0644\u062C\u0645\u0639\u064A\u0629:", ar: "\u0641\u064A\u062F\u064A\u0648\u0647\u0627\u062A \u0627\u0644\u062C\u0645\u0639\u064A\u0629:", fr: "Vid\xE9os de l'association :" };
function toWhatsApp(md) {
  return md.replace(/\*\*(.+?)\*\*/g, "*$1*").replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1: $2").replace(/^#{1,6}\s*/gm, "").trim();
}
function detectReplyLang(text, lexicon) {
  let lang = detectLang(text);
  let question = text;
  if (lang === "fr" && isArabizi(text, lexicon)) {
    lang = "has";
    question = `${toArabic(text, lexicon)} ${text}`;
  }
  return { lang, question };
}
function botReply(data, text, siteUrl) {
  const { knowledge } = data;
  const { lang, question } = detectReplyLang(text, data.lexicon);
  const hit = matchIntent(question, knowledge);
  const reply = hit ?? (isAboutAssociation(question, knowledge) ? knowledge.unknown : knowledge.offTopic);
  let answer = reply.answer[lang];
  const greets = /(^| )(السلام|سلام|bonjour|salut|salam)( |$)/.test(normalizeText(question));
  if (greets && reply !== knowledge.offTopic && !answer.startsWith("\u0648\u0639\u0644\u064A\u0643\u0645") && !answer.startsWith("Bonjour")) answer = GREETING[lang] + answer;
  const parts = [toWhatsApp(answer)];
  if (reply.playlist) parts.push(`\u{1F3AC} ${VIDEOS[lang]} ${PLAYLIST_URL}`);
  if (reply.actions?.some((a) => a.type === "membership") && siteUrl) parts.push(`\u{1F4DD} ${JOIN[lang]} ${siteUrl}`);
  for (const a of reply.actions ?? []) if (a.type === "link" && a.url) parts.push(`\u{1F517} ${a.label ? `${a.label}: ` : ""}${a.url}`);
  const followups = (reply.followups ?? []).map((k) => knowledge.questions[k]?.[lang]).filter((x) => !!x).slice(0, 3);
  if (followups.length) parts.push(`${MORE[lang]}
${followups.map((q) => `\u2022 ${q}`).join("\n")}`);
  return { lang, text: parts.join("\n\n").slice(0, 4e3), intent: hit?.id ?? (reply === knowledge.unknown ? "unknown" : "offTopic") };
}
export {
  botReply,
  toWhatsApp
};
