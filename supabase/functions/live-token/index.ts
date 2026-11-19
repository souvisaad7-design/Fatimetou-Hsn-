/**
 * إذن الدخول إلى البث المباشر الخاص باللجنة الانتسابية (LiveKit).
 * - عضو اللجنة: يحصل على إذن بث (كاميرا/مايكروفون/شاشة).
 * - المنتسب المعتمد: يحصل على إذن مشاهدة فقط، وفقط أثناء بث جارٍ.
 * - غير ذلك: مرفوض.
 * مفاتيح LiveKit مشفّرة في Supabase Vault (تُدخلها اللجنة من لوحة الإدارة)، ولا تصل إلى المتصفح أبداً.
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = env("SUPABASE_ANON_KEY");

const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** رمز LiveKit (JWT موقّع بـ HS256 بمفتاح المشروع السري) */
async function livekitToken(apiKey: string, secret: string, claims: Record<string, unknown>) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${head}.${body}`)));
  return `${head}.${body}.${b64url(sig)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "طريقة غير مسموحة" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "إعدادات الخادم ناقصة" }, 500);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "سجّل الدخول أولاً" }, 401);
  const userDb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: userData } = await userDb.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "سجّل الدخول أولاً" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const [{ data: isAdmin }, { data: member }] = await Promise.all([
    userDb.rpc("is_admin"),
    db.from("members").select("id, full_name, status").eq("user_id", user.id).maybeSingle(),
  ]);
  const admin = isAdmin === true;
  const approved = member?.status === "approved";
  if (!admin && !approved) return json({ error: "البث خاص بالمنتسبين المعتمدين" }, 403);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* بلا جسم */ }
  const action = String(body.action ?? "token");

  try {
    const { data: live } = await db.from("live_sessions").select("id, room, title").eq("status", "live").maybeSingle();

    /* اللجنة تسجّل أعلى عدد للمشاهدين */
    if (action === "viewers") {
      if (!admin || !live) return json({ ok: false });
      await db.rpc("live_record_viewers", { p_id: live.id, p_count: Math.max(0, Math.min(100000, Number(body.count) || 0)) });
      return json({ ok: true });
    }

    if (action !== "token") return json({ error: "طلب غير معروف" }, 400);
    if (!live) return json({ error: "لا يوجد بث جارٍ الآن" }, 404);
    if (body.session_id && body.session_id !== live.id) return json({ error: "انتهى هذا البث" }, 409);

    const { data: cfg } = await db.rpc("live_provider_config");
    const url = String(cfg?.url ?? ""), apiKey = String(cfg?.key ?? ""), secret = String(cfg?.secret ?? "");
    if (!url || !apiKey || !secret || apiKey === "null" || secret === "null") {
      return json({ error: admin ? "لم يُربط حساب LiveKit بعد: أدخل المفاتيح في صفحة البث المباشر" : "البث غير متاح الآن" }, 503);
    }

    const now = Math.floor(Date.now() / 1000);
    const publisher = admin && body.role === "publisher";
    const name = member?.full_name ?? "اللجنة الانتسابية";
    const token = await livekitToken(apiKey, secret, {
      iss: apiKey,
      sub: `${publisher ? "host" : "viewer"}-${user.id}`,
      name,
      nbf: now - 10,
      exp: now + 6 * 3600,
      metadata: JSON.stringify({ role: publisher ? "host" : admin ? "committee" : "member" }),
      video: {
        room: live.room,
        roomJoin: true,
        canSubscribe: true,
        canPublish: publisher,
        canPublishData: false,
        canUpdateOwnMetadata: false,
        ...(publisher ? { canPublishSources: ["camera", "microphone", "screen_share", "screen_share_audio"] } : {}),
      },
    });
    return json({ url, token, session_id: live.id, role: publisher ? "host" : "viewer" });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || "خطأ في الخادم" }, 500);
  }
});
