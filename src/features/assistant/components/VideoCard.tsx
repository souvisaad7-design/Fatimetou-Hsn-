import { useEffect, useRef, useState } from "react";
import type { VideoResult } from "../types";

const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1`;
const thumbUrl = (v: VideoResult) => v.thumbnail || `https://i.ytimg.com/vi/${encodeURIComponent(v.id)}/hqdefault.jpg`;

/**
 * مشغّل فيديو داخل فقاعة الرد:
 * - الفيديو الأول مشغَّل، والباقي صور مصغّرة؛ الضغط على صورة يشغّلها مكان الأول.
 * - لا روابط خارجية ولا أزرار "شاهد على يوتيوب".
 * - تحميل كسول: لا يُنشأ الـ iframe إلا عند ظهور البطاقة على الشاشة.
 */
export function VideoCard({ videos }: { videos: VideoResult[] }) {
  const [activeId, setActiveId] = useState(videos[0]?.id);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (!("IntersectionObserver" in window)) return setVisible(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const active = videos.find((v) => v.id === activeId) ?? videos[0];
  if (!active) return null;
  const others = videos.filter((v) => v.id !== active.id);

  return (
    <div className="ast-video" ref={ref}>
      <div className="ast-video__frame">
        {visible ? (
          <iframe
            key={active.id}
            src={embedUrl(active.id)}
            title={active.title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <img src={thumbUrl(active)} alt="" loading="lazy" />
        )}
      </div>
      <p className="ast-video__title">{active.title}</p>

      {others.length > 0 && (
        <div className="ast-video__more" role="list" aria-label="فيديوهات أخرى">
          {others.map((v) => (
            <button
              key={v.id}
              type="button"
              role="listitem"
              className="ast-video__thumb"
              aria-label={`تشغيل: ${v.title}`}
              onClick={() => { setActiveId(v.id); setVisible(true); }}
            >
              <span className="ast-video__thumb-img">
                <img src={thumbUrl(v)} alt="" loading="lazy" />
                <span className="ast-video__play" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg>
                </span>
              </span>
              <span className="ast-video__thumb-title">{v.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
