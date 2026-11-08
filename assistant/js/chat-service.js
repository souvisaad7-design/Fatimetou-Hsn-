/**
 * طبقة خدمة المحادثة — الواجهة لا تعرف مصدر الردود، بل تتعامل مع هذا العقد فقط:
 *
 *   Awn.chatService.send({ messages, signal, onToken }) → Promise<Reply>
 *
 *   messages : [{ role: "user" | "assistant", content: string }]  (المحادثة كاملة)
 *   signal   : AbortSignal لإيقاف التوليد
 *   onToken  : (fullTextSoFar) => void  يُستدعى كلما وصل جزء جديد من الرد
 *   Reply    : { content: string, followups?: string[], actions?: [{ type, url?, label? }] }
 *
 * للربط بالـ Backend لاحقاً: اضبط config.provider = "http" و config.api.endpoint.
 * الخادم يستقبل POST { messages } ويعيد إما:
 *   - JSON: { content, followups?, actions? }
 *   - أو تدفقاً نصياً / SSE بأسطر "data: {\"delta\":\"...\"}" ثم اختيارياً "data: {\"followups\":[...]}"
 */
(function (Awn) {
  const cfg = Awn.config;

  const sleep = (ms, signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(abortError());
      const t = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => { clearTimeout(t); reject(abortError()); }, { once: true });
    });
  const abortError = () => new DOMException("Aborted", "AbortError");
  const rand = ([a, b]) => a + Math.random() * (b - a);

  /** توحيد النص العربي لتسهيل المطابقة: إزالة التشكيل والتطويل وتوحيد الألف والياء والتاء المربوطة */
  function normalize(text) {
    return String(text)
      .replace(/[ً-ٰٟـ]/g, "")
      .replace(/[إأآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/[؟?!.,،؛:"'()]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function matchIntent(question, kb) {
    const q = normalize(question);
    const words = q.split(" ").filter(Boolean).length;
    let best = null, bestScore = 0;
    for (const intent of kb.intents) {
      if (intent.maxWords && words > intent.maxWords) continue;
      const hits = intent.keywords.filter((k) => q.includes(normalize(k))).length;
      if (!hits) continue;
      const score = hits * 10 + (intent.priority || 0);
      if (score > bestScore) { best = intent; bestScore = score; }
    }
    return best || kb.fallback;
  }

  /** إضافة رابط الانتساب للأزرار فقط إذا كان مُعرّفاً في الإعدادات */
  function resolveActions(actions = []) {
    return actions
      .map((a) => (a.type === "membership" ? (cfg.membership.url ? { ...a, url: cfg.membership.url, label: a.label || cfg.membership.label } : null) : a))
      .filter(Boolean);
  }

  const mockProvider = {
    async send({ messages, signal, onToken }) {
      const last = [...messages].reverse().find((m) => m.role === "user");
      const intent = matchIntent(last?.content || "", Awn.mockKnowledge);
      await sleep(rand(cfg.mock.thinkingMs), signal);

      // محاكاة الكتابة التدريجية كلمة بكلمة
      const parts = intent.answer.split(/(\s+)/);
      let text = "";
      for (const part of parts) {
        text += part;
        onToken?.(text);
        if (part.trim()) await sleep(cfg.mock.tokenMs + Math.random() * cfg.mock.tokenMs, signal);
      }
      return { content: intent.answer, followups: intent.followups || [], actions: resolveActions(intent.actions) };
    },
  };

  const httpProvider = {
    async send({ messages, signal, onToken }) {
      if (!cfg.api.endpoint) throw new Error("لم يتم ضبط عنوان الخادم (config.api.endpoint).");
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), cfg.api.timeoutMs);
      signal?.addEventListener("abort", () => timeout.abort(), { once: true });
      try {
        const res = await fetch(cfg.api.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...cfg.api.headers },
          body: JSON.stringify({ messages, stream: cfg.api.stream }),
          signal: timeout.signal,
        });
        if (!res.ok) throw new Error("تعذّر الحصول على رد من الخادم (" + res.status + ").");

        const type = res.headers.get("content-type") || "";
        if (type.includes("application/json")) {
          const data = await res.json();
          onToken?.(data.content || "");
          return { content: data.content || "", followups: data.followups || [], actions: resolveActions(data.actions) };
        }

        // تدفق: SSE أو نص خام
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const isSSE = type.includes("text/event-stream");
        let text = "", buffer = "", extra = {};
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!isSSE) { text += chunk; onToken?.(text); continue; }
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const obj = JSON.parse(payload);
              if (obj.delta) { text += obj.delta; onToken?.(text); }
              if (obj.followups || obj.actions) extra = { ...extra, ...obj };
            } catch { text += payload; onToken?.(text); }
          }
        }
        return { content: text, followups: extra.followups || [], actions: resolveActions(extra.actions) };
      } finally {
        clearTimeout(timer);
      }
    },
  };

  const providers = { mock: mockProvider, http: httpProvider };

  Awn.chatService = {
    send(options) {
      const provider = providers[cfg.provider];
      if (!provider) return Promise.reject(new Error("مزوّد غير معروف: " + cfg.provider));
      return provider.send(options);
    },
    // مكشوفة للاختبار والتطوير
    _normalize: normalize,
    _matchIntent: matchIntent,
  };
})(window.Awn);
