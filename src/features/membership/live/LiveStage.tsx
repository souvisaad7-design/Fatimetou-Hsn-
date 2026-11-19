/**
 * شاشة البث (LiveKit). تُستعمل في لوحة الإدارة (البث) وفي بوابة المنتسبين (المشاهدة).
 * مكتبة LiveKit تُحمَّل فقط عند فتح البث، فلا تثقل باقي الموقع.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalTrackPublication, RemoteTrack, Room, Track as TrackT } from "livekit-client";
import { Icon } from "../../../shared/Icon";
import { t } from "../i18n";
import { getLiveToken, reportViewers } from "./liveApi";

type Phase = "idle" | "connecting" | "connected" | "error" | "ended";
interface VideoItem { key: string; track: TrackT; source: string }

/** يعرض مسار فيديو واحداً داخل عنصر <video> */
function VideoView({ track, className, mirror }: { track: TrackT; className?: string; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [track]);
  return <video ref={ref} className={className} autoPlay playsInline muted style={mirror ? { transform: "scaleX(-1)" } : undefined} />;
}

export function LiveStage({ role, sessionId, autoJoin = false, onLeft }: {
  role: "publisher" | "viewer";
  sessionId: string;
  autoJoin?: boolean;
  onLeft?: () => void;
}) {
  const roomRef = useRef<Room | null>(null);
  const audioBox = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [localVideo, setLocalVideo] = useState<{ camera?: TrackT; screen?: TrackT }>({});
  const [viewers, setViewers] = useState(0);
  const [hostPresent, setHostPresent] = useState(false);
  const [needsAudio, setNeedsAudio] = useState(false);
  const [media, setMedia] = useState({ camera: false, mic: false, screen: false });
  const [busy, setBusy] = useState(false);

  const join = useCallback(async () => {
    setPhase("connecting");
    setError(null);
    try {
      const [{ Room, RoomEvent, Track }, creds] = await Promise.all([import("livekit-client"), getLiveToken(role, sessionId)]);
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      const refresh = () => {
        const remote = [...room.remoteParticipants.values()];
        const isViewer = (identity: string) => identity.startsWith("viewer-");
        setViewers(remote.filter((p) => isViewer(p.identity)).length + (role === "viewer" ? 1 : 0));
        setHostPresent(remote.some((p) => p.identity.startsWith("host-")));
        const vids: VideoItem[] = [];
        for (const p of remote) {
          for (const pub of p.trackPublications.values()) {
            if (pub.track && pub.kind === Track.Kind.Video) vids.push({ key: `${p.identity}:${pub.trackSid}`, track: pub.track, source: pub.source });
          }
        }
        // الشاشة المشتركة أولاً، ثم الكاميرا
        vids.sort((a, b) => Number(b.source === Track.Source.ScreenShare) - Number(a.source === Track.Source.ScreenShare));
        setVideos(vids);
        if (role === "publisher") reportViewers(remote.filter((p) => isViewer(p.identity)).length);
      };
      const refreshLocal = () => {
        const lp = room.localParticipant;
        const cam = lp.getTrackPublication(Track.Source.Camera) as LocalTrackPublication | undefined;
        const scr = lp.getTrackPublication(Track.Source.ScreenShare) as LocalTrackPublication | undefined;
        setLocalVideo({ camera: cam?.track && !cam.isMuted ? cam.track : undefined, screen: scr?.track ? scr.track : undefined });
        setMedia({ camera: lp.isCameraEnabled, mic: lp.isMicrophoneEnabled, screen: lp.isScreenShareEnabled });
      };

      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Audio && audioBox.current) audioBox.current.appendChild(track.attach());
          refresh();
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => { track.detach().forEach((el) => el.remove()); refresh(); })
        .on(RoomEvent.TrackMuted, refresh)
        .on(RoomEvent.TrackUnmuted, refresh)
        .on(RoomEvent.ParticipantConnected, refresh)
        .on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.LocalTrackPublished, refreshLocal)
        .on(RoomEvent.LocalTrackUnpublished, refreshLocal)
        .on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudio(!room.canPlaybackAudio))
        .on(RoomEvent.Disconnected, () => {
          roomRef.current = null;
          setVideos([]);
          setLocalVideo({});
          setPhase((p) => (p === "connected" ? "ended" : p));
        });

      await room.connect(creds.url, creds.token);
      setPhase("connected");
      refresh();
      if (role === "publisher") {
        try { await room.localParticipant.setMicrophoneEnabled(true); } catch { /* بلا مايكروفون */ }
        try { await room.localParticipant.setCameraEnabled(true); } catch { /* بلا كاميرا */ }
        refreshLocal();
      } else {
        try { await room.startAudio(); } catch { /* يحتاج ضغطة */ }
        setNeedsAudio(!room.canPlaybackAudio);
      }
    } catch (err) {
      roomRef.current?.disconnect();
      roomRef.current = null;
      setError((err as Error).message || t("live.error"));
      setPhase("error");
    }
  }, [role, sessionId]);

  useEffect(() => {
    if (autoJoin) void join();
    return () => { roomRef.current?.disconnect(); roomRef.current = null; };
  }, [autoJoin, join]);

  const leave = async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setPhase("idle");
    onLeft?.();
  };

  const toggle = async (what: "camera" | "mic" | "screen") => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    setBusy(true);
    try {
      if (what === "camera") await lp.setCameraEnabled(!lp.isCameraEnabled);
      if (what === "mic") await lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled);
      if (what === "screen") await lp.setScreenShareEnabled(!lp.isScreenShareEnabled, { audio: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMedia({ camera: lp.isCameraEnabled, mic: lp.isMicrophoneEnabled, screen: lp.isScreenShareEnabled });
      setBusy(false);
    }
  };

  const fullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  const main = role === "publisher" ? (localVideo.screen ?? localVideo.camera) : videos[0]?.track;
  const pip = role === "publisher" ? (localVideo.screen && localVideo.camera ? localVideo.camera : undefined) : videos[1]?.track;
  const mainIsLocalCamera = role === "publisher" && !localVideo.screen && !!localVideo.camera;

  return (
    <div className="lv-stage-wrap">
      <div className="lv-stage" ref={stageRef}>
        {phase === "connected" && main && <VideoView key={main.sid} track={main} className="lv-video" mirror={mainIsLocalCamera} />}
        {phase === "connected" && pip && <VideoView key={pip.sid} track={pip} className="lv-pip" mirror={role === "publisher"} />}

        {phase === "connected" && !main && (
          <div className="lv-overlay">
            <span className="lv-pulse" aria-hidden="true" />
            <p>{role === "publisher" ? (media.mic ? t("live.audioOnly") : t("live.camOff")) : hostPresent ? t("live.audioOnly") : t("live.waitingHost")}</p>
          </div>
        )}
        {(phase === "idle" || phase === "ended") && (
          <div className="lv-overlay">
            {phase === "ended" ? <p>{t("live.ended")}</p> : (
              <button type="button" className="lv-join" onClick={() => void join()}>
                <Icon name="play" size={26} /> <span>{role === "publisher" ? t("live.goLive") : t("live.join")}</span>
              </button>
            )}
          </div>
        )}
        {phase === "connecting" && <div className="lv-overlay"><span className="app-spinner" aria-hidden="true" /><p>{t("live.connecting")}</p></div>}
        {phase === "error" && (
          <div className="lv-overlay">
            <p>{t("live.error")}</p>
            {error && <p className="lv-small">{error}</p>}
            <button type="button" className="lv-join lv-join--sm" onClick={() => void join()}>{t("common.retry")}</button>
          </div>
        )}

        {phase === "connected" && (
          <div className="lv-badges">
            <span className="lv-badge lv-badge--live">● LIVE</span>
            <span className="lv-badge"><Icon name="eye" size={14} /> <span className="num">{viewers}</span></span>
          </div>
        )}
        {phase === "connected" && needsAudio && role === "viewer" && (
          <button type="button" className="lv-unmute" onClick={() => void roomRef.current?.startAudio().then(() => setNeedsAudio(false))}>
            <Icon name="volume" size={18} /> {t("live.unmute")}
          </button>
        )}
        <div ref={audioBox} hidden />
      </div>

      {phase === "connected" && (
        <div className="lv-controls">
          {role === "publisher" && (
            <>
              <button type="button" className={`lv-ctl${media.mic ? " is-on" : ""}`} disabled={busy} onClick={() => void toggle("mic")}><Icon name="mic" size={18} /> {media.mic ? t("live.micOn") : t("live.micOff")}</button>
              <button type="button" className={`lv-ctl${media.camera ? " is-on" : ""}`} disabled={busy} onClick={() => void toggle("camera")}><Icon name="eye" size={18} /> {media.camera ? t("live.camOnBtn") : t("live.camOffBtn")}</button>
              <button type="button" className={`lv-ctl${media.screen ? " is-on" : ""}`} disabled={busy} onClick={() => void toggle("screen")}><Icon name="grid" size={18} /> {media.screen ? t("live.stopScreen") : t("live.shareScreen")}</button>
            </>
          )}
          <button type="button" className="lv-ctl" onClick={fullscreen}><Icon name="grid" size={18} /> {t("live.fullscreen")}</button>
          <button type="button" className="lv-ctl lv-ctl--leave" onClick={() => void leave()}><Icon name="close" size={18} /> {role === "publisher" ? t("live.disconnect") : t("live.leave")}</button>
        </div>
      )}
      {phase === "connected" && error && <p className="lv-small lv-error">{error}</p>}
    </div>
  );
}
