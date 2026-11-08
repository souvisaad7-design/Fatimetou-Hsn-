import { assistantConfig as cfg } from "../config";
import type { VideoResult } from "../types";

/**
 * يبحث في فيديوهات الجمعية عبر /api/youtube/search.
 * لا يرمي أخطاء أبداً: عند أي فشل يرجع قائمة فارغة، فيكمل البوت رده نصياً.
 */
export async function searchVideos(question: string, signal?: AbortSignal): Promise<VideoResult[]> {
  if (!cfg.videos.enabled || question.trim().length < 2) return [];
  // GitHub Pages استضافة ثابتة بلا دوال خادم: نبحث فقط إذا ضُبط رابط كامل لمشروع Vercel
  const relative = !/^https?:\/\//.test(cfg.videos.searchUrl);
  if (relative && window.location.hostname.endsWith("github.io")) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.videos.timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const url = new URL(cfg.videos.searchUrl, window.location.href);
    url.searchParams.set("q", question.slice(0, 200));
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("application/json")) return [];
    const data = (await res.json()) as { videos?: VideoResult[] };
    return (data.videos ?? [])
      .filter((v) => v && /^[\w-]{6,20}$/.test(v.id) && v.title)
      .slice(0, 3);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
