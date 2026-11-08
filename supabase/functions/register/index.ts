/**
 * تسجيل منتسب جديد في جمعية عون وسند:
 * ينشئ حساب دخول (رقم الهاتف + كلمة المرور) وطلب انتساب «قيد المراجعة» في جدول members.
 * لا يدخل صاحبه الموقع حتى يقبله المسؤول أو المشرف.
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

/** البريد الداخلي المرتبط برقم الهاتف (لا تُرسل إليه رسائل) */
const emailFor = (phone: string) => `${phone}@members.awnwasanad.app`;

const clean = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "طريقة غير مسموحة" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "بيانات غير صالحة" }, 400);
  }

  const fullName = clean(body.fullName);
  const phone = clean(body.phone, 20).replace(/\D/g, "");
  const pin = typeof body.pin === "string" ? body.pin : "";
  const gender = body.gender === "أنثى" ? "أنثى" : "ذكر";
  const occupation = clean(body.occupation, 60) || "أخرى";
  const nni = clean(body.nni, 20).replace(/\D/g, "") || null;
  const pledge = Number(body.pledge) > 0 ? Math.round(Number(body.pledge)) : null;
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.birthDate ?? "")) ? String(body.birthDate) : null;

  if (fullName.split(" ").length < 2) return json({ error: "اكتب الاسم الكامل (الاسم واسم الأب على الأقل)" }, 400);
  if (!/^[234]\d{7}$/.test(phone)) return json({ error: "رقم الهاتف 8 أرقام ويبدأ بـ 2 أو 3 أو 4" }, 400);
  if (pin.length < 6 || pin.length > 72) return json({ error: "كلمة المرور 6 أحرف أو أرقام على الأقل" }, 400);
  if (nni && !/^\d{10}$/.test(nni)) return json({ error: "الرقم الوطني 10 أرقام" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // رقم مسجّل بطلب غير مرفوض؟
  const { data: active } = await admin.from("members").select("id").eq("phone", phone).neq("status", "rejected").limit(1);
  if (active && active.length) return json({ error: "هذا الرقم مسجّل من قبل. ارجع إلى «تسجيل الدخول» وادخل برقمك وكلمة المرور." }, 409);

  // إنشاء حساب الدخول (أو إعادة استعماله لصاحب طلب مرفوض سابقاً)
  let userId: string | null = null;
  const created = await admin.auth.admin.createUser({ email: emailFor(phone), password: pin, email_confirm: true, user_metadata: { phone, full_name: fullName } });
  if (created.error) {
    const { data: old } = await admin.from("members").select("user_id").eq("phone", phone).not("user_id", "is", null).limit(1);
    userId = old?.[0]?.user_id ?? null;
    if (!userId) return json({ error: "تعذّر إنشاء الحساب، حاول مرة أخرى." }, 500);
    await admin.auth.admin.updateUserById(userId, { password: pin });
    await admin.from("members").update({ user_id: null }).eq("user_id", userId);
  } else {
    userId = created.data.user.id;
  }

  const { data: member, error } = await admin
    .from("members")
    .insert({
      user_id: userId,
      full_name: fullName,
      phone,
      nni,
      gender,
      birth_date: birthDate,
      occupation,
      institution: clean(body.institution) || null,
      address: clean(body.address) || null,
      pledge,
      status: "pending",
    })
    .select("code")
    .single();

  if (error) {
    console.error(error);
    return json({ error: "تعذّر حفظ الطلب، حاول مرة أخرى." }, 500);
  }
  return json({ ok: true, code: member.code, email: emailFor(phone) });
});
