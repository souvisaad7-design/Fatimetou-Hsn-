#!/usr/bin/env node
/**
 * يحدّث قائمة فيديوهات قناة جمعية عون وسند على يوتيوب دون أي API أو مفتاح:
 * يقرأ صفحة قائمة الرفع العامة للقناة ويستخرج معرّف كل فيديو وعنوانه ومدته.
 *
 *   node scripts/update-channel-videos.mjs
 *
 * الناتج: src/features/assistant/data/channelVideos.json (الأحدث أولاً).
 * إذا فشل الجلب أو تغيّرت بنية الصفحة، يتوقف دون أن يمسّ الملف الحالي.
 */
import { readFile, writeFile } from "node:fs/promises";

const PLAYLIST_ID = "UUtSeTuqXTgjteFqL8XVBz3w"; // قائمة الرفع لقناة @associationaidesoutien
const OUT = new URL("../src/features/assistant/data/channelVideos.json", import.meta.url);
const CHANNEL_SUFFIX = /\s*\|\s*جمعية عون و ?سند الخيرية\s*$/;

const res = await fetch(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}&hl=ar`, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    "Accept-Language": "ar,fr;q=0.8",
  },
});
if (!res.ok) throw new Error(`تعذّر جلب صفحة القائمة (${res.status})`);
const html = await res.text();
const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
if (!match) throw new Error("لم يتم العثور على بيانات الصفحة؛ ربما تغيّرت بنية يوتيوب.");
const data = JSON.parse(match[1]);

const texts = (node, acc = []) => {
  if (Array.isArray(node)) node.forEach((n) => texts(n, acc));
  else if (node && typeof node === "object")
    for (const [k, v] of Object.entries(node)) {
      if ((k === "text" || k === "content" || k === "simpleText") && typeof v === "string") acc.push(v);
      else texts(v, acc);
    }
  return acc;
};

const videos = [];
const seen = new Set();
const add = (id, title, duration) => {
  if (!id || seen.has(id) || !title) return;
  seen.add(id);
  videos.push({ id, title: title.replace(CHANNEL_SUFFIX, "").replace(/\s+/g, " ").trim(), duration: duration ?? null });
};
const walk = (node) => {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== "object") return;
  const lockup = node.lockupViewModel;
  if (lockup?.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
    const duration = texts(lockup.contentImage).find((t) => /^\d+:\d{2}(:\d{2})?$/.test(t));
    add(lockup.contentId, lockup.metadata?.lockupMetadataViewModel?.title?.content, duration);
  }
  const legacy = node.playlistVideoRenderer; // البنية القديمة لصفحات يوتيوب
  if (legacy) add(legacy.videoId, texts(legacy.title).join(""), legacy.lengthText?.simpleText);
  Object.values(node).forEach(walk);
};
walk(data);

if (videos.length === 0) throw new Error("لم يُستخرج أي فيديو؛ لن يُعدَّل الملف.");
const total = Number(texts(data).find((t, i, all) => /^\d+$/.test(t) && /فيديو|video/i.test(all[i + 1] ?? "")) ?? 0);
if (total > videos.length) console.warn(`تنبيه: القناة فيها ${total} فيديو، واستُخرج ${videos.length} فقط (الصفحة الأولى).`);

const next = JSON.stringify({ playlistId: PLAYLIST_ID, count: videos.length, videos }, null, 1) + "\n";
const prev = await readFile(OUT, "utf8").catch(() => "");
if (prev === next) console.log(`لا تغيير (${videos.length} فيديو).`);
else {
  await writeFile(OUT, next);
  console.log(`تم التحديث: ${videos.length} فيديو.`);
}
