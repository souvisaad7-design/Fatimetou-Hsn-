/**
 * منطق الواجهة: عرض المحادثة، الإرسال، مؤشر الانتظار، المحادثات السابقة، والوضع الداكن.
 * لا يحتوي على أي منطق للردود؛ كل الردود تأتي من Awn.chatService.
 */
(function (Awn) {
  const cfg = Awn.config;
  const md = Awn.markdown;
  const store = Awn.store;
  const $ = (id) => document.getElementById(id);

  const el = {
    app: $("app"), sidebar: $("sidebar"), scrim: $("scrim"),
    history: $("history"), historyEmpty: $("historyEmpty"),
    thread: $("thread"), welcome: $("welcome"), welcomeText: $("welcomeText"),
    suggestions: $("suggestions"), messages: $("messages"),
    form: $("composer"), input: $("input"), send: $("send"),
    toast: $("toast"), themeToggle: $("themeToggle"), themeLabel: $("themeLabel"),
    membershipLink: $("membershipLink"), modeBadge: $("modeBadge"),
  };

  const ICONS = {
    info: '<path d="M12 16v-4M12 8h.01"/><circle cx="12" cy="12" r="9"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    hands: '<path d="M7 11V7a2 2 0 1 1 4 0v4M11 10V5a2 2 0 1 1 4 0v6M15 9a2 2 0 1 1 4 0v4a7 7 0 0 1-7 7h-1a6 6 0 0 1-5.2-3l-2-3.5a1.8 1.8 0 0 1 3-2L7 13"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    retry: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    link: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  };
  const SUGGESTION_ICONS = ["info", "target", "hands", "star", "heart", "phone"];
  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  let busy = false;
  let controller = null;

  /* ---------- إعداد أولي ---------- */
  function initBranding() {
    document.querySelectorAll("[data-org-logo]").forEach((img) => (img.src = cfg.org.logo));
    document.querySelectorAll("[data-org-name]").forEach((n) => (n.textContent = cfg.org.name));
    document.querySelectorAll("[data-org-short]").forEach((n) => (n.textContent = cfg.org.shortName));
    el.welcomeText.innerHTML = cfg.assistant.welcome.split("\n").map((l) => `<p>${md.escape(l)}</p>`).join("");
    el.modeBadge.hidden = cfg.provider !== "mock";

    if (cfg.membership.url) {
      el.membershipLink.href = cfg.membership.url;
      el.membershipLink.hidden = false;
    }

    el.suggestions.innerHTML = "";
    cfg.assistant.suggestions.forEach((q, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "suggestion";
      b.setAttribute("role", "listitem");
      b.innerHTML = `<span class="suggestion__icon">${svg(SUGGESTION_ICONS[i % SUGGESTION_ICONS.length])}</span><span></span>`;
      b.lastChild.textContent = q;
      b.addEventListener("click", () => ask(q));
      el.suggestions.appendChild(b);
    });
  }

  /* ---------- الوضع الداكن ---------- */
  const THEME_KEY = cfg.storageKey + ":theme";
  function currentTheme() {
    const set = document.documentElement.dataset.theme;
    if (set) return set;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function applyTheme(theme) {
    if (theme) document.documentElement.dataset.theme = theme;
    el.themeLabel.textContent = currentTheme() === "dark" ? "الوضع الفاتح" : "الوضع الداكن";
  }
  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch {}
    applyTheme(saved);
    el.themeToggle.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch {}
    });
  }

  /* ---------- الشريط الجانبي ---------- */
  function toggleSidebar(open) {
    el.app.classList.toggle("sidebar-open", open);
    el.scrim.hidden = !open;
    $("openSidebar").setAttribute("aria-expanded", String(open));
  }

  function renderHistory() {
    const list = store.sorted().filter((c) => c.messages.length);
    const currentId = store.current()?.id;
    el.history.innerHTML = "";
    el.historyEmpty.hidden = list.length > 0;
    list.forEach((c) => {
      const li = document.createElement("li");
      if (c.id === currentId) li.className = "active";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "history__open";
      open.textContent = c.title;
      open.title = c.title;
      open.addEventListener("click", () => { if (busy) stop(); store.select(c.id); renderConversation(); renderHistory(); toggleSidebar(false); });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "history__del";
      del.setAttribute("aria-label", "حذف المحادثة: " + c.title);
      del.innerHTML = svg("trash");
      del.addEventListener("click", () => {
        if (busy && c.id === currentId) stop();
        store.remove(c.id);
        if (!store.current()) startNewChat(false);
        renderConversation(); renderHistory();
        toast("تم حذف المحادثة");
      });
      li.append(open, del);
      el.history.appendChild(li);
    });
  }

  /* ---------- عرض الرسائل ---------- */
  function welcomeMessage() {
    return { role: "assistant", content: cfg.assistant.welcome, local: true };
  }

  function renderConversation() {
    const conv = store.current();
    el.messages.innerHTML = "";
    const empty = !conv || conv.messages.length === 0;
    el.welcome.hidden = !empty;
    if (empty) { el.thread.scrollTop = 0; return; }

    appendMessage(welcomeMessage());
    conv.messages.forEach((m, i) => {
      const isLast = i === conv.messages.length - 1;
      appendMessage(m, { isLast });
    });
    scrollToBottom(false);
  }

  function appendMessage(m, { isLast = false } = {}) {
    const wrap = document.createElement("article");
    if (m.role === "user") {
      wrap.className = "msg msg--user";
      wrap.innerHTML = '<div class="msg__body"></div>';
      wrap.firstChild.textContent = m.content;
    } else {
      wrap.className = "msg msg--bot" + (m.error ? " msg--error" : "");
      wrap.innerHTML =
        `<img class="msg__avatar" src="${cfg.org.logo}" alt="" width="34" height="34">` +
        `<div class="msg__main"><div class="msg__name">${md.escape(cfg.assistant.name)}</div><div class="msg__body"></div></div>`;
      const body = wrap.querySelector(".msg__body");
      body.innerHTML = md.render(m.content);
      decorateBot(wrap, m, isLast);
    }
    el.messages.appendChild(wrap);
    return wrap;
  }

  /** أزرار الإجراءات، الأدوات (نسخ/إعادة)، والأسئلة المقترحة بعد الرد */
  function decorateBot(wrap, m, isLast) {
    const main = wrap.querySelector(".msg__main");
    main.querySelectorAll(".msg__actions,.msg__tools,.followups").forEach((n) => n.remove());

    if (m.actions?.length) {
      const box = document.createElement("div");
      box.className = "msg__actions";
      m.actions.forEach((a) => {
        if (!a.url) return;
        const link = document.createElement("a");
        link.className = "action-btn";
        link.href = a.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.innerHTML = svg("link") + "<span></span>";
        link.lastChild.textContent = a.label || "فتح الرابط";
        box.appendChild(link);
      });
      if (box.children.length) main.appendChild(box);
    }

    if (m.local) return; // رسالة الترحيب لا تحتاج أدوات

    const tools = document.createElement("div");
    tools.className = "msg__tools";
    const copy = toolButton("copy", "نسخ", async () => {
      const ok = await copyText(m.content);
      toast(ok ? "تم نسخ الرد" : "تعذّر النسخ، حدّد النص وانسخه يدوياً");
    });
    tools.appendChild(copy);
    if (isLast) tools.appendChild(toolButton("retry", m.error ? "إعادة المحاولة" : "إعادة التوليد", regenerate));
    main.appendChild(tools);

    if (isLast && m.followups?.length) {
      const box = document.createElement("div");
      box.className = "followups";
      m.followups.forEach((q) => {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "chip";
        c.textContent = q;
        c.addEventListener("click", () => ask(q));
        box.appendChild(c);
      });
      main.appendChild(box);
    }
  }

  function toolButton(icon, label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tool";
    b.innerHTML = svg(icon) + `<span>${label}</span>`;
    b.addEventListener("click", onClick);
    return b;
  }

  function typingIndicator() {
    const wrap = document.createElement("article");
    wrap.className = "msg msg--bot";
    wrap.innerHTML =
      `<img class="msg__avatar" src="${cfg.org.logo}" alt="" width="34" height="34">` +
      `<div class="msg__main"><div class="msg__name">${md.escape(cfg.assistant.name)}</div>` +
      `<div class="msg__body"><div class="typing" aria-label="المساعد يكتب"><span></span><span></span><span></span><em>يكتب الآن...</em></div></div></div>`;
    el.messages.appendChild(wrap);
    return wrap;
  }

  function nearBottom() {
    const t = el.thread;
    return t.scrollHeight - t.scrollTop - t.clientHeight < 140;
  }
  function scrollToBottom(smooth = true) {
    el.thread.scrollTo({ top: el.thread.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  /* ---------- الإرسال والردود ---------- */
  function ask(text) {
    const q = String(text || "").trim();
    if (!q || busy) return;
    let conv = store.current() || store.create();
    const firstMessage = conv.messages.length === 0;
    store.addMessage(conv, { role: "user", content: q });
    el.input.value = "";
    autoGrow();

    if (firstMessage) renderConversation();
    else {
      // إزالة الاقتراحات والأدوات من الرد السابق
      el.messages.querySelectorAll(".followups").forEach((n) => n.remove());
      el.messages.querySelectorAll(".msg__tools .tool:nth-child(2)").forEach((n) => n.remove());
      appendMessage(conv.messages[conv.messages.length - 1]);
    }
    renderHistory();
    scrollToBottom();
    respond(conv);
  }

  async function respond(conv) {
    setBusy(true);
    controller = new AbortController();
    const node = typingIndicator();
    scrollToBottom();
    const body = node.querySelector(".msg__body");
    let partial = "";

    const history = conv.messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));

    try {
      const reply = await Awn.chatService.send({
        messages: history,
        signal: controller.signal,
        onToken: (text) => {
          partial = text;
          const stick = nearBottom();
          body.classList.add("streaming");
          body.innerHTML = md.render(text);
          if (stick) scrollToBottom(false);
        },
      });
      body.classList.remove("streaming");
      const msg = store.addMessage(conv, { role: "assistant", content: reply.content, followups: reply.followups, actions: reply.actions });
      body.innerHTML = md.render(msg.content);
      decorateBot(node, msg, true);
    } catch (err) {
      body.classList.remove("streaming");
      if (err.name === "AbortError") {
        if (partial.trim()) {
          const msg = store.addMessage(conv, { role: "assistant", content: partial + "\n\n_تم إيقاف الرد._" });
          body.innerHTML = md.render(msg.content);
          decorateBot(node, msg, true);
        } else {
          node.remove();
        }
      } else {
        const msg = store.addMessage(conv, { role: "assistant", content: "عذراً، حدث خطأ أثناء الحصول على الرد. " + (err.message || ""), error: true });
        node.classList.add("msg--error");
        body.innerHTML = md.render(msg.content);
        decorateBot(node, msg, true);
      }
    } finally {
      controller = null;
      setBusy(false);
      if (nearBottom()) scrollToBottom();
      if (matchMedia("(hover: hover)").matches) el.input.focus();
    }
  }

  function regenerate() {
    if (busy) return;
    const conv = store.current();
    if (!conv) return;
    const last = conv.messages[conv.messages.length - 1];
    if (last?.role === "assistant") { conv.messages.pop(); store.touch(conv); }
    renderConversation();
    respond(conv);
  }

  function stop() { controller?.abort(); }

  function setBusy(v) {
    busy = v;
    el.send.classList.toggle("is-stop", v);
    el.send.setAttribute("aria-label", v ? "إيقاف الرد" : "إرسال");
    updateSendState();
  }
  function updateSendState() {
    el.send.disabled = !busy && !el.input.value.trim();
  }

  function startNewChat(focus = true) {
    if (busy) stop();
    store.prune();
    const cur = store.current();
    if (!cur || cur.messages.length) store.create();
    renderConversation();
    renderHistory();
    toggleSidebar(false);
    if (focus) el.input.focus();
  }

  /* ---------- مساعدات ---------- */
  function autoGrow() {
    el.input.style.height = "auto";
    el.input.style.height = Math.min(el.input.scrollHeight, 200) + "px";
    updateSendState();
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      try {
        const ta = Object.assign(document.createElement("textarea"), { value: text });
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand("copy"); ta.remove(); return ok;
      } catch { return false; }
    }
  }

  let toastTimer;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.toast.hidden = true), 2200);
  }

  /* ---------- الأحداث ---------- */
  function bindEvents() {
    el.form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (busy) stop();
      else ask(el.input.value);
    });
    el.input.addEventListener("input", autoGrow);
    el.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!busy) ask(el.input.value);
      }
    });
    $("newChatSide").addEventListener("click", () => startNewChat());
    $("newChatTop").addEventListener("click", () => startNewChat());
    $("openSidebar").addEventListener("click", () => toggleSidebar(true));
    $("closeSidebar").addEventListener("click", () => toggleSidebar(false));
    el.scrim.addEventListener("click", () => toggleSidebar(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { if (el.app.classList.contains("sidebar-open")) toggleSidebar(false); else if (busy) stop(); }
    });
  }

  /* ---------- التشغيل ---------- */
  store.load();
  initBranding();
  initTheme();
  bindEvents();
  if (!store.current()) store.create();
  store.prune();
  renderConversation();
  renderHistory();
  autoGrow();

  // فتح المساعد بسؤال جاهز من صفحة أخرى (مثلاً من موقع الانتساب): assistant/?q=كيف أنتسب
  const preset = new URLSearchParams(location.search).get("q");
  if (preset) { startNewChat(false); ask(preset.slice(0, 500)); }

  // واجهة برمجية صغيرة لاستخدامها لاحقاً من موقع الانتساب أو للاختبار (مثال: Awn.app.ask("..."))
  Awn.app = { ask, newChat: startNewChat, stop };
})(window.Awn);
