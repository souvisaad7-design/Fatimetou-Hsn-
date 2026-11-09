/**
 * فهم الحسانية المكتوبة بالحروف اللاتينية والأرقام (مثل: chenhou jam3iya 3oun w sanad).
 * القاموس مبني من مجموعة بيانات hassan-IA/dah (scripts/build-hassaniya-lexicon.mjs)،
 * ويُحمَّل فقط عندما يكتب الزائر بالحروف اللاتينية.
 */

type Lexicon = Record<string, string>;
let lexicon: Lexicon | null = null;

export async function loadLexicon(): Promise<Lexicon> {
  if (!lexicon) lexicon = (await import("../data/hassaniyaLexicon.json")).default.latin as Lexicon;
  return lexicon;
}

/** كلمات فرنسية شائعة (حتى لا يُظن الفرنسي حسانية) */
const FRENCH = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "est", "et", "en", "que", "qui", "quoi", "comment", "pour", "avec",
  "sur", "dans", "au", "aux", "ce", "cette", "ces", "je", "tu", "vous", "il", "elle", "nous", "on", "pas", "plus", "ou",
  "mon", "ma", "mes", "ton", "ta", "votre", "vos", "quel", "quelle", "quels", "quelles", "combien", "bonjour", "merci",
  "association", "sont", "suis", "peux", "puis", "faire", "qu", "l", "d", "s", "c", "j", "a", "y", "ne", "se", "sa", "son",
  "par", "si", "mais", "donc", "tout", "tous", "bien", "tres", "membre", "membres", "adherer", "cotisation", "election",
  "elections", "president", "objectifs", "activites", "salut", "bonsoir", "oui", "non", "aide", "aider",
]);

/** كلمات حسانية شائعة بالحروف اللاتينية ليست في القاموس (تحية وشكر وكلمات الجمعية) */
const HASSANIYA = new Set([
  "salam", "slm", "esselam", "assalam", "labas", "chokran", "choukran", "chukran", "mechkour", "mechkur", "jazak",
  "jam3iya", "jem3iya", "jam3ia", "jem3ia", "intisab", "ntisab", "nentesb", "ichtirak", "echtirak", "ishtirak",
  "lejna", "lijan", "lajna", "intikhab", "intikhabat", "entikhabat", "ma3had", "me3hed", "nachat", "chenhou",
  "chniya", "chenhi", "chkoun", "chkon", "kiv", "kivach", "9edech", "gedech", "nebghi", "tebghi", "ra2is",
]);

const words = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** هل النص حسانية بحروف لاتينية؟ (أرقام داخل الكلمات مثل 3 و7، أو كلمات من القاموس، أكثر من الكلمات الفرنسية) */
export function isArabizi(text: string, lex: Lexicon): boolean {
  if (/[؀-ۿ]/.test(text)) return false;
  const ws = words(text);
  if (!ws.length) return false;
  const accents = /[éèêàçùâîôû]/i.test(text) ? 2 : 0;
  let has = 0;
  let fr = accents;
  for (const w of ws) {
    if (FRENCH.has(w)) fr++;
    else if (HASSANIYA.has(w)) has += 2;
    else if (/[a-z][2-9]|[2-9][a-z]/.test(w)) has += 2; // 3endek، m3a، 7agalla
    else if (w.length >= 2 && lex[w]) has++;
  }
  return has > fr;
}

/** تحويل الكلمات المعروفة إلى الحروف العربية (والباقي يبقى كما هو) */
export function toArabic(text: string, lex: Lexicon): string {
  return words(text).map((w) => lex[w] ?? w).join(" ");
}
