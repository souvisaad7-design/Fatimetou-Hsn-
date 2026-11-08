/**
 * كل فيديوهات قناة الجمعية على يوتيوب (@associationaidesoutien)، الأحدث أولاً.
 * تُحدَّث تلقائياً كل أسبوع عبر GitHub Actions (scripts/update-channel-videos.mjs)، دون أي API.
 */
import raw from "./channelVideos.json";

export interface ChannelVideo {
  id: string;
  title: string;
  duration: string | null;
}

export const channelVideos: ChannelVideo[] = raw.videos;
