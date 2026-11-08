# موقع جمعية عون وسند الخيرية

تطبيق React (Vite + TypeScript) يضم:

| المسار | الصفحة |
|---|---|
| `#/` | الصفحة الرئيسية للجمعية: التعريف، معهد المحجة البيضاء وكفالته، البرنامج السنوي، رقم التبرع |
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
├── shared/                  معلومات الجمعية (org.ts) ومكوّنات وأدوات مشتركة
└── features/
    ├── home/                الصفحة الرئيسية (المحتوى في data.ts)
    └── assistant/           المساعد الذكي
        ├── config.ts        كل إعدادات المساعد (الترحيب، الاقتراحات، رابط الانتساب، الـ API)
        ├── data/            الردود التجريبية
        ├── services/        مزوّد الردود: mock الآن، http لاحقاً
        ├── hooks/           منطق المحادثة وحفظها
        ├── lib/             المطابقة وعرض التنسيق
        └── components/
```

## القاعدة المعرفية للمساعد

الملف التعريفي الرسمي للجمعية وتعليمات المساعد في `docs/assistant-knowledge-base.md`.
الردود الحالية مبنية عليه، وعند ربط نموذج ذكاء اصطناعي يُستعمل الملف كاملاً كتعليمات للنظام (System Prompt) في الخادم.

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

- زر الانتساب في المساعد يفتح موقع الجمعية (https://aoun-sand.vercel.app/) ما لم يُضبط `VITE_MEMBERSHIP_URL`.
- يمكن فتح المساعد بسؤال جاهز: `#/assistant?q=ما شروط الانتساب`

## الهوية البصرية

- الشعار في `public/` (`awn-logo.png` للرمز و `awn-logo-full.png` للشعار الكامل)، والألوان في `src/styles/tokens.css`.
- الأرقام تُكتب بالأرقام اللاتينية (13578)، والمبالغ بالأوقية القديمة.
