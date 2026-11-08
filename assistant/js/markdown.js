/**
 * محوّل Markdown مصغّر وآمن لعرض ردود المساعد.
 * يُهرَّب كل HTML أولاً، ثم يدعم: **عريض**، _مائل_، `كود`، [رابط](https://...)، قوائم "- " و "1. "، وفقرات.
 */
(function (Awn) {
  const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function inline(s) {
    return escape(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|\s)_(.+?)_(?=\s|$|[.،])/g, "$1<em>$2</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function render(text) {
    const lines = String(text || "").split("\n");
    const out = [];
    let list = null; // { tag, items }
    let para = [];
    const flushPara = () => { if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } };
    const flushList = () => { if (list) { out.push(`<${list.tag}>` + list.items.map((i) => `<li>${inline(i)}</li>`).join("") + `</${list.tag}>`); list = null; } };

    for (const raw of lines) {
      const line = raw.trimEnd();
      const ul = line.match(/^\s*[-•*]\s+(.*)$/);
      const ol = line.match(/^\s*(\d+|[٠-٩]+)[.)]\s+(.*)$/);
      if (ul || ol) {
        flushPara();
        const tag = ul ? "ul" : "ol";
        if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
        list.items.push(ul ? ul[1] : ol[2]);
      } else if (!line.trim()) {
        flushPara(); flushList();
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara(); flushList();
    return out.join("");
  }

  Awn.markdown = { render, escape };
})(window.Awn);
