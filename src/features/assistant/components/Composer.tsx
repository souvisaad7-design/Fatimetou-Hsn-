import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "../../../shared/Icon";
import type { VoiceChat, VoiceState } from "../hooks/useVoiceChat";

interface Props {
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  focusKey?: string; // يعيد التركيز عند تغيّر المحادثة
  voice: VoiceChat;
}

const voiceLabels: Record<Exclude<VoiceState, "off">, { status: string; button: string }> = {
  listening: { status: "أستمع إليك... تكلم الآن", button: "انتهيت من الكلام" },
  thinking: { status: "لحظة، أحضّر الرد...", button: "إنهاء المحادثة الصوتية" },
  speaking: { status: "أجيبك بالصوت... اضغط الميكروفون لتقاطعني", button: "قاطع وتكلم" },
};

export function Composer({ busy, onSend, onStop, focusKey, voice }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // تكبير الحقل تلقائياً مع النص
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    if (voice.state === "off" && window.matchMedia?.("(hover: hover)").matches) ref.current?.focus();
  }, [focusKey, busy, voice.state]);

  const live = voice.state !== "off";

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return onStop();
    if (!value.trim()) return;
    onSend(value);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!busy) submit();
    }
  };

  return (
    <footer className="ast-composer-wrap">
      {(live || voice.notice) && (
        <div className={`ast-voice${live ? ` is-${voice.state}` : " is-notice"}`} role="status" aria-live="polite">
          {live ? (
            <>
              <span className="ast-voice__wave" aria-hidden="true"><i /><i /><i /><i /></span>
              <span className="ast-voice__text">
                <strong>{voiceLabels[voice.state as Exclude<VoiceState, "off">].status}</strong>
                {voice.interim && <span dir="auto">{voice.interim}</span>}
              </span>
              <button type="button" className="ast-voice__end" onClick={voice.end}>
                <Icon name="close" size={16} /> إنهاء
              </button>
            </>
          ) : (
            <span className="ast-voice__text"><span>{voice.notice}</span></span>
          )}
        </div>
      )}
      <form className="ast-composer" onSubmit={submit} autoComplete="off">
        <label htmlFor="ast-input" className="visually-hidden">اكتب سؤالك</label>
        <textarea
          id="ast-input"
          ref={ref}
          rows={1}
          maxLength={2000}
          enterKeyHint="send"
          placeholder={live ? "أو اكتب سؤالك هنا..." : "اكتب سؤالك أو اضغط الميكروفون وتكلم..."}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          className={`ast-mic${live ? ` is-${voice.state}` : ""}`}
          type="button"
          onClick={voice.toggle}
          disabled={busy && !live}
          aria-pressed={live}
          aria-label={live ? voiceLabels[voice.state as Exclude<VoiceState, "off">].button : "تكلم مع المساعد بالصوت"}
          title={live ? voiceLabels[voice.state as Exclude<VoiceState, "off">].button : "تكلم مع المساعد بالصوت"}
        >
          <Icon name={voice.state === "thinking" ? "stop" : "mic"} />
        </button>
        <button className="ast-send" type="submit" aria-label={busy ? "إيقاف الرد" : "إرسال"} disabled={!busy && !value.trim()}>
          <Icon name={busy ? "stop" : "send"} />
        </button>
      </form>
      <p className="ast-disclaimer">إجابات المساعد مبنية على الملف التعريفي للجمعية. للتأكد من أي معلومة يُرجى الرجوع إلى إدارة الجمعية.</p>
    </footer>
  );
}
