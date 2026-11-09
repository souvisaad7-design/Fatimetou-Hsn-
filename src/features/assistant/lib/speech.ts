/**
 * قراءة ردود المساعد بالصوت عبر محرّك الكلام المدمج في المتصفح/الهاتف (Web Speech API) — دون أي خادم.
 * الحسانية والفصحى تُقرآن بصوت عربي، والفرنسية بصوت فرنسي.
 * (لا يوجد في المتصفحات صوت حساني خاص؛ يمكن لاحقاً استبدال speak() بنموذج صوت حساني على خادم.)
 */
import { useSyncExternalStore } from "react";

const AUTO_KEY = "awn:assistant:autoSpeak";
const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

export const speechSupported = !!synth;

let speakingText: string | null = null;
let autoSpeak = (() => { try { return localStorage.getItem(AUTO_KEY) === "1"; } catch { return false; } })();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

/** نص مناسب للقراءة: بلا تنسيق ولا رموز، والأرقام الطويلة (الهاتف) رقماً رقماً */
function toSpoken(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#>`«»"]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\b(\d{6,})\b/g, (n) => n.split("").join(" "))
    .replace(/\s*\n+\s*-?\s*/g, "، ")
    .replace(/\s+/g, " ")
    .trim();
}

const VOICE_KEY = "awn:assistant:voice";
let chosenVoice = (() => { try { return localStorage.getItem(VOICE_KEY) || ""; } catch { return ""; } })();

/** أصوات هادئة وواضحة (غالباً نسائية أو «طبيعية») تُفضَّل، والأصوات الرجالية العميقة تُؤخَّر */
const SOFT = /natural|neural|online|enhanced|premium|google|laila|layla|mariam|maryam|amira|salma|zariyah|hoda|fatima|sana|noura|rana|amany|denise|amelie|audrey|julie|marie|celine|lea/i;
const HEAVY = /majed|maged|tarik|naayf|hamed|shakir|bassel|omar|hamdan|thomas|henri|paul|jacques/i;
const isFemale = (v: SpeechSynthesisVoice) => /female|femme|أنثى/i.test(v.name);

function score(v: SpeechSynthesisVoice): number {
  let n = 0;
  if (SOFT.test(v.name)) n += 4;
  if (isFemale(v)) n += 3;
  if (/natural|neural|enhanced|premium/i.test(v.name)) n += 3;
  if (HEAVY.test(v.name)) n -= 5;
  if (v.localService) n += 1; // أسرع وأوضح غالباً
  return n;
}

export const voicesFor = (lang: "ar" | "fr") =>
  (synth?.getVoices() ?? []).filter((v) => v.lang.toLowerCase().startsWith(lang)).sort((a, b) => score(b) - score(a));

function pickVoice(lang: "ar" | "fr"): SpeechSynthesisVoice | undefined {
  const list = voicesFor(lang);
  return (lang === "ar" && list.find((v) => v.voiceURI === chosenVoice)) || list[0];
}

export const getChosenVoice = () => chosenVoice;
export function setChosenVoice(uri: string) {
  chosenVoice = uri;
  try { localStorage.setItem(VOICE_KEY, uri); } catch { /* تجاهل */ }
  speak("السلام عليكم ومرحبا بيك! أنا مساعد عون وسند.");
}

export function stopSpeaking() {
  if (!synth) return;
  synth.cancel();
  speakingText = null;
  emit();
}

/** onDone: يُستدعى مرة واحدة عند انتهاء القراءة أو إيقافها (تستعمله المحادثة الصوتية لتستمع من جديد) */
export function speak(text: string, onDone?: () => void) {
  let finished = false;
  let watchdog = 0;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(watchdog);
    onDone?.();
  };
  if (!synth) return finish();
  synth.cancel();
  const spoken = toSpoken(text);
  if (!spoken) return finish();
  const latin = (spoken.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length;
  const arabic = (spoken.match(/[؀-ۿ]/g) ?? []).length;
  const lang = latin > arabic ? "fr" : "ar";
  const u = new SpeechSynthesisUtterance(spoken);
  u.lang = lang === "fr" ? "fr-FR" : "ar-SA";
  const voice = pickVoice(lang);
  if (voice) { u.voice = voice; u.lang = voice.lang; }
  // نبرة أخف قليلاً وسرعة طبيعية: صوت مريح وواضح
  u.pitch = 1.1;
  u.rate = 1;
  u.volume = 1;
  const done = () => {
    if (speakingText === text) { speakingText = null; emit(); }
    finish();
  };
  u.onend = done;
  u.onerror = done;
  speakingText = text;
  emit();
  synth.speak(u);
  // بعض المتصفحات لا تُبلغ أحياناً بانتهاء القراءة؛ مهلة احتياطية حسب طول النص
  if (onDone) watchdog = window.setTimeout(done, 6000 + spoken.length * 160);
}

/** على iPhone لا يُسمح بالقراءة إلا بعد ضغطة من الزائر: نطق صامت عند الضغط على الميكروفون يفتح الإذن */
let primed = false;
export function primeSpeech() {
  if (!synth || primed) return;
  primed = true;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    synth.speak(u);
  } catch { /* تجاهل */ }
}

// بعض المتصفحات تحمّل قائمة الأصوات متأخرة
let voicesVersion = 0;
synth?.addEventListener?.("voiceschanged", () => { voicesVersion++; emit(); });
export const useVoicesVersion = () => useSyncExternalStore(subscribe, () => voicesVersion, () => 0);

export function setAutoSpeak(on: boolean) {
  autoSpeak = on;
  try { localStorage.setItem(AUTO_KEY, on ? "1" : "0"); } catch { /* تجاهل */ }
  if (!on) stopSpeaking();
  emit();
}
export const getAutoSpeak = () => autoSpeak;

/** النص الذي يُقرأ الآن (أو null) */
export const useSpeakingText = () => useSyncExternalStore(subscribe, () => speakingText, () => null);
export const useAutoSpeak = () => useSyncExternalStore(subscribe, () => autoSpeak, () => false);
