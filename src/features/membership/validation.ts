import type { ApplicationData } from "./services/membershipService";

export type Errors = Partial<Record<keyof ApplicationData | "pledge", string>>;

/** الحقول التي تُتحقق منها في كل مرحلة من مراحل الاستمارة */
const stepFields: (keyof ApplicationData)[][] = [
  ["fname", "lname", "nni", "dob", "phone", "email"],
  ["wilaya", "moughataa", "commune"],
  ["idcard", "photo"],
  [],
];

const MAX_FILE = 5_000_000;

export function validateStep(step: number, d: ApplicationData, pledge: boolean): Errors {
  const e: Errors = {};
  const has = (k: keyof ApplicationData) => stepFields[step].includes(k);
  const clean = (v: string) => v.replace(/\s/g, "");

  if (has("fname") && !d.fname.trim()) e.fname = "اكتب اسمك الشخصي";
  if (has("lname") && !d.lname.trim()) e.lname = "اكتب اسم العائلة أو الأب";
  if (has("nni") && !/^\d{10}$/.test(clean(d.nni))) e.nni = "الرقم الوطني يتكون من ١٠ أرقام";
  if (has("dob")) {
    if (!d.dob) e.dob = "أدخل تاريخ ميلادك";
    else if ((Date.now() - new Date(d.dob).getTime()) / 31_557_600_000 < 18) e.dob = "يجب أن يكون عمرك ١٨ سنة على الأقل";
  }
  if (has("phone") && !/^[234]\d{7}$/.test(clean(d.phone))) e.phone = "أدخل ٨ أرقام تبدأ بـ ٢ أو ٣ أو ٤";
  if (has("email") && d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.email = "صيغة البريد غير صحيحة";
  if (has("wilaya") && !d.wilaya) e.wilaya = "اختر الولاية";
  if (has("moughataa") && !d.moughataa.trim()) e.moughataa = "اكتب اسم المقاطعة";
  if (has("commune") && !d.commune.trim()) e.commune = "اكتب اسم البلدية";
  for (const k of ["idcard", "photo"] as const) {
    if (!has(k)) continue;
    const f = d[k];
    if (!f) e[k] = k === "idcard" ? "أرفق صورة بطاقة التعريف" : "أرفق صورة شخصية";
    else if (f.size > MAX_FILE) e[k] = "حجم الملف يتجاوز ٥ ميغابايت";
  }
  if (step === 3 && !pledge) e.pledge = "يجب الموافقة على التعهد لإرسال الطلب";
  return e;
}
