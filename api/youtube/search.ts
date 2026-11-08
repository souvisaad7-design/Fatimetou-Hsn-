/**
 * البحث في فيديوهات الجمعية: /api/youtube/search?q=...
 * يرجع أفضل 3 نتائج كحد أقصى: { videos: [{ id, title, thumbnail }] }
 * القراءة عامة (بيانات منشورة على القناة)، لذلك يُسمح بالطلب من أي موقع.
 */
import { json } from "../_lib/env";
import { searchVideos } from "../_lib/supabase";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request): Promise<Response> {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 200);
  if (q.length < 2) return json({ videos: [] }, { headers: CORS });

  try {
    const videos = await searchVideos(q, 3);
    return json(
      { videos },
      { headers: { ...CORS, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  } catch (err) {
    console.error(err);
    // البوت يكمل الرد نصياً إذا فشل البحث
    return json({ videos: [], error: "تعذّر البحث حالياً" }, { status: 502, headers: CORS });
  }
}
