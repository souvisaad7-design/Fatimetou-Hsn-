import { assistantConfig as cfg } from "../config";

/**
 * مشغّل كل فيديوهات قناة الجمعية داخل فقاعة الرد (قائمة الرفع عبر videoseries).
 * يتنقل المستخدم بين الفيديوهات من زر القائمة داخل المشغّل. لا روابط خارجية.
 */
export function PlaylistCard() {
  const p = cfg.channelPlaylist;
  return (
    <div className="ast-video ast-playlist">
      <p className="ast-playlist__intro">{p.intro}</p>
      <div className="ast-video__frame">
        <iframe
          src={p.embedUrl}
          title={p.title}
          loading="lazy"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
