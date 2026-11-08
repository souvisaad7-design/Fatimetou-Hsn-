import { normalizeArabic } from "../../../shared/arabic";
import { channelVideos, type ChannelVideo } from "../data/channelVideos";

/** كلمات لا تميّز فيديو عن آخر */
const STOPWORDS = new Set([
  "جمعيه", "الجمعيه", "عون", "وسند", "سند", "خيريه", "الخيريه", "جمعيتكم",
  "كيف", "ماذا", "متي", "اين", "هل", "هي", "هو", "من", "في", "علي", "عن", "الي", "ان", "التي", "الذي",
  "يمكنني", "اريد", "لكم", "لنا", "هذا", "هذه", "ذلك", "كان", "عند", "مع", "او", "ثم", "ما", "كم", "اي",
  "شنهو", "شنهي", "عندكم", "فيديو", "فيديوهات", "مقطع", "مقاطع", "اعرض", "عرض", "شاهد", "اشاهد", "ارني", "اريني",
  "اليوم", "رقم", "حول", "بعض", "كل", "انا", "انت", "لا", "يا", "قد", "لم", "لن", "به", "له", "لي", "بك", "عليكم", "السلام",
]);

/** تبسيط خفيف: حذف أداة التعريف وبعض اللواحق حتى تتطابق «السقاية» مع «سقايات» */
function stem(word: string): string {
  if (/^\d+$/.test(word)) return word;
  let w = word.replace(/^(وال|بال|فال|كال|لل|ال)(?=.{2,})/, "");
  w = w.replace(/^(.{3,}?)(ات|ون|ين|ه)$/, "$1");
  return w;
}

const tokens = (text: string) =>
  normalizeArabic(text)
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));

const index = channelVideos.map((v) => ({ video: v, words: new Set(tokens(v.title)) }));

const hit = (words: Set<string>, t: string) =>
  [...words].some((w) => w === t || (t.length >= 3 && !/^\d+$/.test(t) && w.startsWith(t)));

/**
 * يبحث في عناوين فيديوهات القناة محلياً (دون أي API).
 * يرجع حتى 3 فيديوهات. الكلمة النادرة في العناوين أثقل وزناً من الشائعة،
 * والأرقام أثقل من غيرها، حتى يُفضَّل «السقاية رقم 36» و«التبرع بالدم» على العناوين العامة.
 */
export function matchChannelVideos(question: string, max = 3): ChannelVideo[] {
  const q = [...new Set(tokens(question))];
  if (!q.length) return [];
  const n = index.length;
  const weight = new Map(
    q.map((t) => {
      const df = index.filter(({ words }) => hit(words, t)).length;
      return [t, df === 0 ? 0 : Math.log(1 + n / df) * (/^\d+$/.test(t) ? 2 : 1)];
    }),
  );
  const scored = index
    .map(({ video, words }) => ({ video, score: q.reduce((sum, t) => sum + (hit(words, t) ? weight.get(t)! : 0), 0) }))
    .filter((x) => x.score > 0);
  if (!scored.length) return [];
  const best = Math.max(...scored.map((x) => x.score));
  // نُبقي فقط النتائج القريبة من الأفضل
  return scored
    .filter((x) => x.score >= best * 0.75)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.video);
}

/** تصفية قائمة الفيديوهات في المعرض حسب ما يكتبه المستخدم */
export function filterChannelVideos(query: string): ChannelVideo[] {
  const q = normalizeArabic(query);
  if (!q) return channelVideos;
  const parts = q.split(" ").filter(Boolean).map(stem);
  return channelVideos.filter((v) => {
    const t = normalizeArabic(v.title);
    return parts.every((p) => t.includes(p));
  });
}
