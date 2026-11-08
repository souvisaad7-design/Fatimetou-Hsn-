/**
 * مزامنة فيديوهات قناة الجمعية على يوتيوب مع جدول youtube_videos في Supabase.
 * يعمل يومياً عبر Vercel Cron (vercel.json)، ويمكن تشغيله يدوياً من لوحة Vercel.
 * محمي بـ CRON_SECRET: يرسل Vercel تلقائياً الترويسة Authorization: Bearer <CRON_SECRET>.
 */
import { json, requireEnv } from "../_lib/env";
import { supabaseRest } from "../_lib/supabase";
import { getAllVideos, getUploadsPlaylistId } from "../_lib/youtube";

export const config = { maxDuration: 60 };

const HANDLE = process.env.YOUTUBE_CHANNEL_HANDLE || "@associationaidesoutien";

export async function GET(request: Request): Promise<Response> {
  if (request.headers.get("authorization") !== `Bearer ${requireEnv("CRON_SECRET")}`) {
    return json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const syncedAt = new Date().toISOString();
    const playlistId = await getUploadsPlaylistId(HANDLE);
    const videos = await getAllVideos(playlistId);

    // upsert على دفعات
    for (let i = 0; i < videos.length; i += 500) {
      const batch = videos.slice(i, i + 500).map((v) => ({ ...v, updated_at: syncedAt }));
      const res = await supabaseRest("youtube_videos?on_conflict=video_id", {
        role: "service",
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(batch),
      });
      if (!res.ok) throw new Error(`فشل الحفظ في Supabase (${res.status}): ${await res.text()}`);
    }

    // حذف الفيديوهات التي لم تعد في القناة (حُذفت أو صارت خاصة)
    let removed = 0;
    if (videos.length > 0) {
      const res = await supabaseRest(`youtube_videos?updated_at=lt.${encodeURIComponent(syncedAt)}`, {
        role: "service",
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      });
      if (res.ok) removed = ((await res.json()) as unknown[]).length;
    }

    return json({ ok: true, channel: HANDLE, synced: videos.length, removed, syncedAt });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
