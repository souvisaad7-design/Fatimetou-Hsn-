import { useMemo, useRef, useState } from "react";
import { assistantConfig as cfg } from "../config";
import { channelVideos } from "../data/channelVideos";
import { filterChannelVideos } from "../lib/videoMatch";

const PAGE = 12;
const embedVideo = (id: string, autoplay: boolean) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1${autoplay ? "&autoplay=1" : ""}`;
const thumb = (id: string) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;

/**
 * كل فيديوهات قناة الجمعية داخل فقاعة الرد:
 * - المشغّل يبدأ بقائمة كل فيديوهات القناة (videoseries)، ويتنقل المستخدم بينها من زر القائمة داخله.
 * - تحته معرض بكل الفيديوهات؛ الضغط على صورة يشغّل الفيديو في المشغّل نفسه، دون الخروج من البوت.
 * - لا روابط خارجية ولا target="_blank".
 */
export function PlaylistCard({ startId }: { startId?: string }) {
  const p = cfg.channelPlaylist;
  const [current, setCurrent] = useState<string | null>(startId ?? null); // null = قائمة القناة كاملة
  const [autoplay, setAutoplay] = useState(false); // التشغيل التلقائي فقط بعد ضغط المستخدم على صورة
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const frameRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => filterChannelVideos(query), [query]);
  const visible = query ? list : list.slice(0, shown);
  const currentVideo = current ? channelVideos.find((v) => v.id === current) : null;

  const play = (id: string) => {
    setCurrent(id);
    setAutoplay(true);
    frameRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="ast-video ast-playlist">
      <p className="ast-playlist__intro">{p.intro}</p>
      <div className="ast-video__frame" ref={frameRef}>
        <iframe
          key={current ?? "playlist"}
          src={current ? embedVideo(current, autoplay) : p.embedUrl}
          title={currentVideo ? currentVideo.title : p.title}
          loading="lazy"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      {currentVideo && <p className="ast-video__title">{currentVideo.title}</p>}

      <div className="ast-gallery">
        <div className="ast-gallery__head">
          <span className="ast-gallery__count">كل الفيديوهات ({channelVideos.length})</span>
          {current && (
            <button type="button" className="ast-gallery__all" onClick={() => setCurrent(null)}>
              تشغيل القائمة كاملة
            </button>
          )}
        </div>
        <label htmlFor="ast-gallery-search" className="visually-hidden">ابحث في فيديوهات الجمعية</label>
        <input
          id="ast-gallery-search"
          className="ast-gallery__search"
          type="search"
          placeholder="ابحث في الفيديوهات: سقاية، المحجة، رمضان..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {list.length === 0 ? (
          <p className="ast-gallery__empty">لا توجد فيديوهات بهذا العنوان.</p>
        ) : (
          <div className="ast-gallery__grid" role="list">
            {visible.map((v) => (
              <button
                key={v.id}
                type="button"
                role="listitem"
                className={`ast-video__thumb${v.id === current ? " is-playing" : ""}`}
                aria-label={`تشغيل: ${v.title}`}
                aria-current={v.id === current ? "true" : undefined}
                onClick={() => play(v.id)}
              >
                <span className="ast-video__thumb-img">
                  <img src={thumb(v.id)} alt="" loading="lazy" width={320} height={180} />
                  {v.duration && <span className="ast-video__duration">{v.duration}</span>}
                  <span className="ast-video__play" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg>
                  </span>
                </span>
                <span className="ast-video__thumb-title">{v.title}</span>
              </button>
            ))}
          </div>
        )}
        {!query && shown < list.length && (
          <button type="button" className="ast-gallery__more" onClick={() => setShown(list.length)}>
            عرض كل الفيديوهات ({list.length})
          </button>
        )}
      </div>
    </div>
  );
}
