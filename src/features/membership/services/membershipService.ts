/**
 * خدمة طلبات الانتساب.
 * حالياً: تجريبية بالكامل داخل المتصفح (لا يُرسل أي شيء إلى خادم).
 * لاحقاً: استبدل جسم الدالتين بطلبات fetch إلى الـ Backend مع الإبقاء على نفس الأنواع.
 */
export interface ApplicationData {
  fname: string;
  lname: string;
  nni: string;
  dob: string;
  sex: string;
  phone: string;
  email: string;
  job: string;
  wilaya: string;
  moughataa: string;
  commune: string;
  unit: string;
  address: string;
  source: string;
  sponsor: string;
  idcard: File | null;
  photo: File | null;
}

export interface ApplicationStatus {
  ref: string;
  name: string;
  wilaya: string;
  stage: number; // فهرس المرحلة الحالية في applicationStages
}

export const SAMPLE_REF = "INT-2026-04817";

const records = new Map<string, ApplicationStatus>([
  [SAMPLE_REF, { ref: SAMPLE_REF, name: "محمد عبد الله", wilaya: "نواكشوط الغربية", stage: 3 }],
]);

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function submitApplication(data: ApplicationData): Promise<{ ref: string }> {
  await delay(600);
  const ref = `INT-2026-${Math.floor(10000 + Math.random() * 89999)}`;
  records.set(ref, { ref, name: `${data.fname} ${data.lname}`, wilaya: data.wilaya, stage: 1 });
  return { ref };
}

export async function lookupApplication(ref: string): Promise<ApplicationStatus | null> {
  await delay(250);
  return records.get(ref.trim().toUpperCase()) ?? null;
}
