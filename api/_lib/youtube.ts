import { requireEnv } from "./env";

const API = "https://www.googleapis.com/youtube/v3";

interface Thumb { url: string }
interface PlaylistItem {
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    resourceId: { videoId: string };
    thumbnails?: Partial<Record<"maxres" | "standard" | "high" | "medium" | "default", Thumb>>;
  };
  contentDetails?: { videoId: string; videoPublishedAt?: string };
  status?: { privacyStatus?: string };
}

export interface ChannelVideo {
  video_id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  published_at: string | null;
}

async function yt<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: requireEnv("YOUTUBE_API_KEY") });
  const res = await fetch(`${API}/${endpoint}?${qs}`);
  if (!res.ok) {
    // لا نُرجع الرابط لأنه يحتوي المفتاح
    throw new Error(`YouTube API ${endpoint} (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/** 1) قائمة الرفع للقناة عبر forHandle */
export async function getUploadsPlaylistId(handle: string): Promise<string> {
  const data = await yt<{ items?: Array<{ contentDetails: { relatedPlaylists: { uploads: string } } }> }>("channels", {
    part: "contentDetails",
    forHandle: handle,
  });
  const id = data.items?.[0]?.contentDetails.relatedPlaylists.uploads;
  if (!id) throw new Error(`لم يتم العثور على القناة ${handle}.`);
  return id;
}

/** 2) كل فيديوهات قائمة الرفع مع التنقل بين الصفحات */
export async function getAllVideos(playlistId: string): Promise<ChannelVideo[]> {
  const videos: ChannelVideo[] = [];
  let pageToken: string | undefined;
  do {
    const page = await yt<{ items: PlaylistItem[]; nextPageToken?: string }>("playlistItems", {
      part: "snippet,contentDetails,status",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of page.items) {
      const s = item.snippet;
      const privacy = item.status?.privacyStatus;
      // تجاهل الفيديوهات الخاصة أو المحذوفة
      if (privacy === "private" || privacy === "privacyStatusUnspecified") continue;
      if (s.title === "Private video" || s.title === "Deleted video") continue;
      const t = s.thumbnails ?? {};
      videos.push({
        video_id: item.contentDetails?.videoId ?? s.resourceId.videoId,
        title: s.title,
        description: s.description ?? "",
        thumbnail_url: (t.maxres ?? t.standard ?? t.high ?? t.medium ?? t.default)?.url ?? null,
        published_at: item.contentDetails?.videoPublishedAt ?? s.publishedAt ?? null,
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return videos;
}
