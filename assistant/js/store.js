/**
 * حفظ المحادثات محلياً في متصفح المستخدم (localStorage).
 * عند توفر Backend يمكن استبدال هذا الملف بنسخة تحفظ المحادثات في الخادم بنفس الدوال.
 */
(function (Awn) {
  const KEY = Awn.config.storageKey;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  let state = { conversations: [], currentId: null };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.conversations)) state = parsed;
      }
    } catch { /* التخزين غير متاح: نعمل في الذاكرة فقط */ }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* تجاهل */ }
  }

  const sorted = () => [...state.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const get = (id) => state.conversations.find((c) => c.id === id) || null;
  const current = () => get(state.currentId);

  function create() {
    const conv = { id: uid(), title: "محادثة جديدة", messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    state.conversations.push(conv);
    state.currentId = conv.id;
    save();
    return conv;
  }

  function select(id) { if (get(id)) { state.currentId = id; save(); } }

  function remove(id) {
    state.conversations = state.conversations.filter((c) => c.id !== id);
    if (state.currentId === id) state.currentId = null;
    save();
  }

  function addMessage(conv, msg) {
    const m = { id: uid(), createdAt: Date.now(), ...msg };
    conv.messages.push(m);
    if (msg.role === "user" && conv.title === "محادثة جديدة") conv.title = msg.content.slice(0, 48);
    conv.updatedAt = Date.now();
    save();
    return m;
  }

  function touch(conv) { conv.updatedAt = Date.now(); save(); }

  /** حذف المحادثات الفارغة (فتح محادثة جديدة دون كتابة شيء) */
  function prune() {
    state.conversations = state.conversations.filter((c) => c.messages.length || c.id === state.currentId);
    save();
  }

  Awn.store = { load, save, sorted, get, current, create, select, remove, addMessage, touch, prune };
})(window.Awn);
