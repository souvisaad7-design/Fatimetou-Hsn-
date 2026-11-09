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

function pickVoice(lang: "ar" | "fr"): SpeechSynthesisVoice | undefined {
  const voices = synth?.getVoices() ?? [];
  const mine = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  // نفضّل الأصوات الطبيعية (Google / Online / Natural) ثم أي صوت باللغة
  return mine.find((v) => /google|natural|online/i.test(v.name)) ?? mine[0];
}

export function stopSpeaking() {
  if (!synth) return;
  synth.cancel();
  speakingText = null;
  emit();
}

export function speak(text: string) {
  if (!synth) return;
  synth.cancel();
  const spoken = toSpoken(text);
  if (!spoken) return;
  const latin = (spoken.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length;
  const arabic = (spoken.match(/[؀-ۿ]/g) ?? []).length;
  const lang = latin > arabic ? "fr" : "ar";
  const u = new SpeechSynthesisUtterance(spoken);
  u.lang = lang === "fr" ? "fr-FR" : "ar-SA";
  const voice = pickVoice(lang);
  if (voice) { u.voice = voice; u.lang = voice.lang; }
  u.rate = lang === "ar" ? 0.95 : 1;
  const done = () => { if (speakingText === text) { speakingText = null; emit(); } };
  u.onend = done;
  u.onerror = done;
  speakingText = text;
  emit();
  synth.speak(u);
}

// بعض المتصفحات تحمّل قائمة الأصوات متأخرة
synth?.addEventListener?.("voiceschanged", () => {});

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
