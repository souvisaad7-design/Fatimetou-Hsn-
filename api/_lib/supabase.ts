import { requireEnv } from "./env";

/** طلب إلى Supabase REST (PostgREST) دون مكتبات إضافية */
export async function supabaseRest(
  path: string,
  init: RequestInit & { role: "anon" | "service" },
): Promise<Response> {
  const url = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const key =
    init.role === "service"
      ? requireEnv("SUPABASE_SERVICE_ROLE_KEY")
      : process.env.SUPABASE_ANON_KEY || requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const { role: _role, headers, ...rest } = init;
  return fetch(`${url}/rest/v1/${path}`, {
    ...rest,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

export interface VideoRow {
  video_id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  published_at: string | null;
  updated_at: string;
}

export interface VideoSearchResult {
  id: string;
  title: string;
  thumbnail: string | null;
}

/** البحث في فيديوهات الجمعية (أفضل 3 نتائج كحد أقصى) */
export async function searchVideos(q: string, max = 3): Promise<VideoSearchResult[]> {
  const res = await supabaseRest("rpc/search_youtube_videos", {
    role: "anon",
    method: "POST",
    body: JSON.stringify({ q, max_results: Math.min(Math.max(max, 1), 3) }),
  });
  if (!res.ok) throw new Error(`فشل البحث في Supabase (${res.status}): ${await res.text()}`);
  const rows = (await res.json()) as Array<{ video_id: string; title: string; thumbnail_url: string | null }>;
  return rows.map((r) => ({ id: r.video_id, title: r.title, thumbnail: r.thumbnail_url }));
}
