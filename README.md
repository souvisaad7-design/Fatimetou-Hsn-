# موقع جمعية عون وسند الخيرية

تطبيق React (Vite + TypeScript) يضم:

| المسار | الصفحة |
|---|---|
| `#/` | بوابة لجنة الانتساب: استمارة من أربع مراحل، متابعة الطلب، الإعلانات، الأسئلة الشائعة |
| `#/assistant` | المساعد الذكي للجمعية (واجهة محادثة بردود تجريبية) |

## التشغيل محلياً

```bash
npm install
npm run dev      # خادم تطوير على http://localhost:5173
npm run build    # بناء نسخة الإنتاج في مجلد dist
npm run preview  # معاينة نسخة الإنتاج
```

## النشر

عند كل تحديث على الفرع `main` يبني GitHub Actions الموقع وينشره على GitHub Pages تلقائياً
(`.github/workflows/deploy.yml`). يجب ضبط **Settings → Pages → Source** على **GitHub Actions** مرة واحدة.

## بنية المشروع

```
src/
├── main.tsx                 نقطة التشغيل
├── app/                     المسارات وتوزيع الصفحات
├── styles/                  الألوان والخطوط (tokens.css) والأساسيات
├── shared/                  مكوّنات وأدوات مشتركة (أيقونات، تنبيهات، الوضع الداكن...)
└── features/
    ├── membership/          بوابة الانتساب
    │   ├── data.ts          المحتوى (الولايات، الإعلانات، الأسئلة...)
    │   ├── validation.ts    التحقق من حقول الاستمارة
    │   ├── services/        إرسال الطلب والاستعلام عنه (تجريبي الآن، جاهز للربط بالخادم)
    │   └── components/
    └── assistant/           المساعد الذكي
        ├── config.ts        كل إعدادات المساعد (الترحيب، الاقتراحات، رابط الانتساب، الـ API)
        ├── data/            الردود التجريبية
        ├── services/        مزوّد الردود: mock الآن، http لاحقاً
        ├── hooks/           منطق المحادثة وحفظها
        ├── lib/             المطابقة وعرض التنسيق
        └── components/
```

## ربط المساعد بالـ Backend لاحقاً

أنشئ ملف `.env` (أو اضبط المتغيرات في GitHub Actions):

```
VITE_ASSISTANT_PROVIDER=http
VITE_ASSISTANT_API=https://api.example.org/assistant/chat
VITE_MEMBERSHIP_URL=https://join.example.org
```

الخادم يستقبل `POST { "messages": [{ "role": "user", "content": "..." }] }` ويعيد:
- JSON: `{ "content": "...", "followups": ["..."], "actions": [{ "type": "membership" }] }`
- أو تدفق SSE بأسطر `data: {"delta":"..."}`

لا تضع مفاتيح API في الواجهة؛ مكانها الخادم فقط.

- ما دام `VITE_MEMBERSHIP_URL` غير مضبوط، لا يظهر أي زر انتساب في المساعد.
- يمكن فتح المساعد بسؤال جاهز: `#/assistant?q=ما شروط الانتساب`

## ربط استمارة الانتساب بالخادم لاحقاً

استبدل جسم الدالتين `submitApplication` و `lookupApplication` في
`src/features/membership/services/membershipService.ts` بطلبات `fetch`، مع الإبقاء على نفس الأنواع.

## قبل النشر الرسمي

- استبدل `public/awn-logo.svg` بشعار الجمعية الرسمي.
- عدّل الألوان في `src/styles/tokens.css` لتطابق الهوية.
- راجع المحتوى التجريبي في `src/features/assistant/data/mockKnowledge.ts` و `src/features/membership/data.ts`.
