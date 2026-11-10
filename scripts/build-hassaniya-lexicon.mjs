#!/usr/bin/env node
/**
 * يبني قاموس «الحسانية بالحروف اللاتينية ← الحسانية بالحروف العربية» من مجموعة بيانات
 * hassan-IA/dah على Hugging Face (3002 جملة: الإنجليزية، والحسانية بالحرفين).
 *
 *   node scripts/build-hassaniya-lexicon.mjs
 *
 * المصادر بالترتيب (كلها تقرأ كل الأجزاء، فإن أضاف صاحب البيانات أجزاء أو جملاً جديدة تدخل تلقائياً):
 *   1. ملفات Parquet: /api/datasets/<dataset>/parquet ← ملف لكل جزء (تحميل واحد، الأسرع)
 *   2. خادم البيانات: /splits ثم /rows صفحة صفحة
 *   3. ملف CSV الأصلي
 * كل جملة مكتوبة بالحرفين بالترتيب نفسه، فإذا تساوى عدد الكلمات تُقابَل كلمة بكلمة.
 * الناتج: src/features/assistant/data/hassaniyaLexicon.json
 * يستعمله المساعد ليفهم من يكتب الحسانية بالحروف اللاتينية (مثل: chenhou jam3iya 3oun w sanad).
 */
import { writeFile } from "node:fs/promises";
import { parquetReadObjects } from "hyparquet";

const DATASET = "hassan-IA/dah";
const API = "https://datasets-server.huggingface.co";
const CSV = `https://huggingface.co/datasets/${DATASET}/resolve/main/d1.csv`;
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** طلب JSON مع إعادة المحاولة (خادم البيانات يحدّ عدد الطلبات أحياناً) */
async function getJson(url, tries = 5) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (i >= tries - 1 || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${url}`);
    } catch (err) {
      if (i >= tries - 1) throw err;
    }
    await sleep(2000 * 2 ** i);
  }
}

/** كل الجمل من كل الأجزاء: [{ ar, lat }] */
async function fromDatasetServer() {
  const { splits } = await getJson(`${API}/splits?dataset=${encodeURIComponent(DATASET)}`);
  const all = [];
  for (const { config, split } of splits) {
    for (let offset = 0; ; offset += 100) {
      const q = `dataset=${encodeURIComponent(DATASET)}&config=${config}&split=${split}&offset=${offset}&length=100`;
      const page = await getJson(`${API}/rows?${q}`);
      for (const { row } of page.rows) all.push({ ar: row["hassaniya-ar"] ?? "", lat: row["hassaniya-en"] ?? "" });
      if (offset + 100 >= page.num_rows_total) break;
      await sleep(250);
    }
    console.log(`  ${config}/${split}: ${all.length} جملة حتى الآن`);
  }
  return { rows: all, splits: splits.map((x) => x.split) };
}

/** كل الجمل من ملفات Parquet لكل الأجزاء */
async function fromParquet() {
  const index = await getJson(`https://huggingface.co/api/datasets/${DATASET}/parquet`); // { config: { split: [urls] } }
  const all = [];
  const splits = [];
  for (const [config, bySplit] of Object.entries(index)) {
    for (const [split, urls] of Object.entries(bySplit)) {
      for (const url of urls) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${url}`);
        const rows = await parquetReadObjects({ file: await res.arrayBuffer(), columns: ["hassaniya-ar", "hassaniya-en"] });
        for (const row of rows) all.push({ ar: row["hassaniya-ar"] ?? "", lat: row["hassaniya-en"] ?? "" });
      }
      splits.push(split);
      console.log(`  ${config}/${split} (parquet): ${all.length} جملة حتى الآن`);
    }
  }
  if (!all.length) throw new Error("لا توجد جمل في ملفات Parquet");
  return { rows: all, splits };
}

async function fromCsv() {
  const res = await fetch(CSV);
  if (!res.ok) throw new Error(`تعذّر تحميل البيانات: ${res.status}`);
  const [header, ...lines] = parseCsv(await res.text());
  const iAr = header.indexOf("hassaniya-ar");
  const iLat = header.indexOf("hassaniya-en");
  if (iAr < 0 || iLat < 0) throw new Error("تغيّرت أعمدة البيانات");
  return { rows: lines.map((r) => ({ ar: r[iAr] ?? "", lat: r[iLat] ?? "" })), splits: ["train (csv)"] };
}

let data;
for (const [name, read] of [["Parquet", fromParquet], ["خادم البيانات", fromDatasetServer], ["CSV", fromCsv]]) {
  try {
    data = await read();
    break;
  } catch (err) {
    console.warn(`تعذّر المصدر ${name} (${err.message})، أجرّب التالي`);
  }
}
if (!data) throw new Error("تعذّرت كل مصادر البيانات");
const { rows, splits } = data;
const arabicWords = (s) => s.match(/[ء-يگڤٱ]+/g) ?? [];
const latinWords = (s) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

const counts = new Map(); // latin → Map(arabic → n)
let aligned = 0;
for (const r of rows) {
  const ar = arabicWords(r.ar);
  const lat = latinWords(r.lat);
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
  source: `https://huggingface.co/datasets/${DATASET}`,
  splits,
  sentences: rows.length,
  aligned,
  latin,
};
await writeFile(OUT, JSON.stringify(out) + "\n");
console.log(`✓ ${Object.keys(latin).length} كلمة من ${aligned}/${rows.length} جملة متقابلة`);
