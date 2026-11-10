import { at } from "../i18n";
/**
 * تحويل كلام الزائر إلى نص عبر محرّك التعرف على الكلام المدمج في المتصفح (Web Speech API) — دون خادم ولا مفتاح.
 * يعمل في Chrome وEdge وSafari (الحاسوب والهاتف). لا يدعمه Firefox.
 * يتطلب الموقع https وإذن الميكروفون من الزائر.
 */

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

const Ctor: RecognitionCtor | undefined =
  typeof window !== "undefined"
    ? ((window as unknown as Record<string, RecognitionCtor | undefined>).SpeechRecognition ??
       (window as unknown as Record<string, RecognitionCtor | undefined>).webkitSpeechRecognition)
    : undefined;

export const voiceInputSupported = !!Ctor;

export interface ListenHandlers {
  /** النص أثناء الكلام (يتغير حتى ينتهي الزائر) */
  onInterim: (text: string) => void;
  /** انتهى الزائر من الكلام، وهذا ما قاله */
  onFinal: (text: string) => void;
  /** انتهى الاستماع دون كلام */
  onSilence: () => void;
  /** خطأ (رمز الخطأ من المتصفح: not-allowed، audio-capture، network...) */
  onError: (code: string) => void;
}

export interface ListenSession {
  /** إنهاء الاستماع الآن وإرسال ما قيل */
  finish(): void;
  /** إلغاء الاستماع دون إرسال */
  cancel(): void;
}

export function listen(lang: string, h: ListenHandlers): ListenSession {
  if (!Ctor) {
    h.onError("unsupported");
    return { finish() {}, cancel() {} };
  }

  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false; // يتوقف تلقائياً عندما يسكت الزائر
  rec.maxAlternatives = 1;

  let text = "";
  let error: string | null = null;
  let closed = false;

  rec.onresult = (e) => {
    text = Array.from(e.results, (r) => r[0].transcript).join(" ").replace(/\s+/g, " ").trim();
    h.onInterim(text);
  };
  rec.onerror = (e) => {
    // «no-speech» = لم يتكلم، و«aborted» = ألغيناه نحن؛ ليسا خطأ يُعرض
    if (e.error !== "no-speech" && e.error !== "aborted") error = e.error;
  };
  rec.onend = () => {
    if (closed) return;
    closed = true;
    if (text) h.onFinal(text);
    else if (error) h.onError(error);
    else h.onSilence();
  };

  try {
    rec.start();
  } catch {
    closed = true;
    h.onError("start-failed");
  }

  return {
    finish: () => { try { rec.stop(); } catch { /* انتهى مسبقاً */ } },
    cancel: () => { closed = true; try { rec.abort(); } catch { /* انتهى مسبقاً */ } },
  };
}

/** رسالة مفهومة للزائر حسب رمز الخطأ */
export function voiceErrorMessage(code: string): string {
  switch (code) {
    case "unsupported":
      return at("vUnsupported");
    case "not-allowed":
    case "service-not-allowed":
      return at("vNotAllowed");
    case "audio-capture":
      return at("vNoMic");
    case "network":
      return at("vNetwork");
    case "language-not-supported":
      return at("vLang");
    default:
      return at("vOther");
  }
}
