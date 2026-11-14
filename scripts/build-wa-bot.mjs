/**
 * مساعد واتساب:
 *  1) منطق الرد → supabase/functions/whatsapp/bot.js (يُرفع مع دالة واتساب)
 *  2) المعلومات (knowledge + القاموس الحساني) → dist/wa-bot.json (تُنشر مع الموقع وتقرؤها دالة واتساب)
 * يعمل تلقائياً بعد بناء الموقع (npm run build).
 */
import { build } from "esbuild";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

await build({
  entryPoints: ["src/features/assistant/server/whatsappBot.ts"],
  bundle: true, format: "esm", platform: "neutral", target: "es2022", legalComments: "none",
  external: ["*.json"],
  banner: { js: "// ملف مولَّد تلقائياً من src/features/assistant/server/whatsappBot.ts — لا تعدّله يدوياً (npm run build:wa-bot)" },
  outfile: "supabase/functions/whatsapp/bot.js",
  logLevel: "warning",
});

const tmp = join(tmpdir(), `wa-bot-data-${process.pid}.mjs`);
await build({ entryPoints: ["src/features/assistant/server/botData.ts"], bundle: true, format: "esm", platform: "node", outfile: tmp, logLevel: "warning" });
const { botData } = await import(pathToFileURL(tmp).href);
if (existsSync("dist")) {
  writeFileSync("dist/wa-bot.json", JSON.stringify({ version: new Date().toISOString(), ...botData }));
  console.log("dist/wa-bot.json ✓");
} else {
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/wa-bot.json", JSON.stringify({ version: new Date().toISOString(), ...botData }));
}
