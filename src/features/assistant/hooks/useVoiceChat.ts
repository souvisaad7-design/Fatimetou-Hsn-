import { useCallback, useEffect, useRef, useState } from "react";
import { assistantConfig as cfg } from "../config";
import { detectLang } from "../lib/detectLang";
import { primeSpeech, speak, stopSpeaking } from "../lib/speech";
import { listen, voiceErrorMessage, voiceInputSupported, type ListenSession } from "../lib/voiceInput";
import type { ChatMessage } from "../types";
import { at } from "../i18n";
import { getLang } from "../../membership/i18n";

/**
 * المحادثة الصوتية: يضغط الزائر على الميكروفون ويتكلم ← يُرسل سؤاله ← يُقرأ الرد بالصوت ← يستمع المساعد من جديد.
 * تنتهي المحادثة إذا سكت الزائر، أو ضغط «إنهاء».
 *
 *   off       متوقفة
 *   listening يستمع للزائر
 *   thinking  ينتظر الرد
 *   speaking  يقرأ الرد بالصوت
 */
export type VoiceState = "off" | "listening" | "thinking" | "speaking";

let active = false;
/** هل المحادثة الصوتية تعمل الآن؟ (حتى لا تُقرأ الردود مرتين مع «قراءة الردود بالصوت») */
export const isVoiceChatActive = () => active;

interface Options {
  busy: boolean;
  messages: ChatMessage[];
  conversationId?: string;
  onSend: (text: string) => void;
}

export function useVoiceChat({ busy, messages, conversationId, onSend }: Options) {
  const [state, setState] = useState<VoiceState>("off");
  const [interim, setInterim] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const stateRef = useRef<VoiceState>("off");
  const session = useRef<ListenSession | null>(null);
  const lang = useRef<"ar" | "fr">(getLang());
  const waitFrom = useRef<string | undefined>(undefined); // آخر رسالة قبل إرسال السؤال
  const sawBusy = useRef(false);
  const lastId = useRef<string | undefined>(undefined);
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;
  lastId.current = messages[messages.length - 1]?.id;

  const go = (s: VoiceState) => {
    stateRef.current = s;
    active = s !== "off";
    setState(s);
  };

  const end = useCallback(() => {
    session.current?.cancel();
    session.current = null;
    stopSpeaking();
    setInterim("");
    go("off");
  }, []);

  /** auto: إعادة الاستماع تلقائياً بعد الرد (لا بضغطة من الزائر) */
  const startListening = useCallback((auto = false) => {
    session.current?.cancel();
    stopSpeaking();
    setInterim("");
    setNotice(null);
    go("listening");
    session.current = listen(lang.current === "fr" ? cfg.voice.frenchLang : cfg.voice.arabicLang, {
      onInterim: setInterim,
      onFinal: (text) => {
        session.current = null;
        lang.current = detectLang(text) === "fr" ? "fr" : "ar";
        waitFrom.current = lastId.current;
        sawBusy.current = false;
        go("thinking");
        onSendRef.current(text);
        // إذا لم يبدأ الرد (مثلاً لا توجد محادثة)، لا نبقى في الانتظار
        window.setTimeout(() => { if (stateRef.current === "thinking" && !sawBusy.current) end(); }, 2000);
      },
      onSilence: () => {
        session.current = null;
        setInterim("");
        go("off");
        if (auto) setNotice(at("voiceEnded"));
      },
      onError: (code) => {
        session.current = null;
        setInterim("");
        go("off");
        // بعض الهواتف (iPhone) لا تفتح الميكروفون تلقائياً دون ضغطة
        setNotice(auto && code === "not-allowed" ? at("voiceTapAgain") : voiceErrorMessage(code));
      },
    });
  }, [end]);

  /** زر الميكروفون */
  const toggle = useCallback(() => {
    if (!voiceInputSupported) return setNotice(voiceErrorMessage("unsupported"));
    switch (stateRef.current) {
      case "off":
        primeSpeech(); // يسمح بقراءة الرد لاحقاً على iPhone
        return startListening();
      case "listening":
        return session.current?.finish(); // انتهيت من الكلام: أرسل الآن
      case "speaking":
        return startListening(); // قاطع القراءة وتكلم
      case "thinking":
        return end();
    }
  }, [startListening, end]);

  // وصول الرد ← قراءته بالصوت ← الاستماع من جديد
  useEffect(() => {
    if (stateRef.current !== "thinking") return;
    if (busy) { sawBusy.current = true; return; }
    if (!sawBusy.current) return;
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant" || last.id === waitFrom.current || last.error) return end();
    go("speaking");
    speak(last.content, () => {
      if (stateRef.current === "speaking") startListening(true);
    });
  }, [busy, messages, end, startListening]);

  // تغيير المحادثة أو مغادرة الصفحة يوقف الصوت
  useEffect(() => end, [conversationId, end]);

  // إخفاء التنبيه بعد قليل
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  return { state, interim, notice, toggle, end, supported: voiceInputSupported };
}

export type VoiceChat = ReturnType<typeof useVoiceChat>;
