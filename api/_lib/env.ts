/** متغيرات البيئة على الخادم فقط — لا تُرسل أبداً إلى المتصفح */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`متغير البيئة ${name} غير مضبوط في إعدادات Vercel.`);
  return value;
}

export const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(init.headers ?? {}) },
  });
