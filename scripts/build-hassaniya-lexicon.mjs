#!/usr/bin/env node
/**
 * يبني قاموس «الحسانية بالحروف اللاتينية ← الحسانية بالحروف العربية» من مجموعة بيانات
 * hassan-IA/dah على Hugging Face (3002 جملة: الإنجليزية، والحسانية بالحرفين).
 *
 *   node scripts/build-hassaniya-lexicon.mjs
 *
 * كل جملة مكتوبة بالحرفين بالترتيب نفسه، فإذا تساوى عدد الكلمات تُقابَل كلمة بكلمة.
 * الناتج: src/features/assistant/data/hassaniyaLexicon.json
 * يستعمله المساعد ليفهم من يكتب الحسانية بالحروف اللاتينية (مثل: chenhou jam3iya 3oun w sanad).
 */
import { writeFile } from "node:fs/promises";

const SOURCE = "https://huggingface.co/datasets/hassan-IA/dah/resolve/main/d1.csv";
const OUT = new URL("../src/features/assistant/data/hassaniyaLexicon.json", import.meta.url);

/** قراءة CSV بسيطة تدعم الحقول بين علامتي تنصيص */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`تعذّر تحميل البيانات: ${res.status}`);
const [header, ...rows] = parseCsv(await res.text());
const iAr = header.indexOf("hassaniya-ar");
const iLat = header.indexOf("hassaniya-en");
if (iAr < 0 || iLat < 0) throw new Error("تغيّرت أعمدة البيانات");

const arabicWords = (s) => s.match(/[ء-يگڤٱ]+/g) ?? [];
const latinWords = (s) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

const counts = new Map(); // latin → Map(arabic → n)
let aligned = 0;
for (const r of rows) {
  const ar = arabicWords(r[iAr] ?? "");
  const lat = latinWords(r[iLat] ?? "");
  if (!ar.length || ar.length !== lat.length) continue;
  aligned++;
  lat.forEach((w, i) => {
    if (/^\d+$/.test(w)) return;
    const m = counts.get(w) ?? new Map();
    m.set(ar[i], (m.get(ar[i]) ?? 0) + 1);
    counts.set(w, m);
  });
}

// لكل كلمة لاتينية: أكثر مقابل عربي تكراراً
const latin = {};
for (const [w, m] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
  const [best] = [...m].sort((a, b) => b[1] - a[1])[0];
  latin[w] = best;
}

const out = {
  source: "https://huggingface.co/datasets/hassan-IA/dah",
  sentences: rows.length,
  aligned,
  latin,
};
await writeFile(OUT, JSON.stringify(out) + "\n");
console.log(`✓ ${Object.keys(latin).length} كلمة من ${aligned}/${rows.length} جملة متقابلة`);
