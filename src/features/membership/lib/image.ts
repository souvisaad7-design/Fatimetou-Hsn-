/**
 * تصغير صورة الإيصال وضغطها قبل حفظها (حتى لا تثقل التخزين).
 * ترجع صورة JPEG بصيغة data URL بعرض أقصى 900 بكسل.
 */
export function compressImage(file: File, maxSize = 900, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("اختر صورة (JPG أو PNG)"));
    if (file.size > 15_000_000) return reject(new Error("الصورة كبيرة جداً"));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("تعذّرت قراءة الصورة"));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("تعذّرت قراءة الصورة. جرّب صورة أخرى أو لقطة شاشة.")); };
    img.src = url;
  });
}
