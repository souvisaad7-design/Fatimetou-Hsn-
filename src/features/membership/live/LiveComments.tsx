/** تعليقات وأسئلة المنتسبين أثناء البث (تتحدّث كل 3 ثوانٍ). اللجنة تستطيع إخفاء أي تعليق. */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../../../shared/Icon";
import { supabase, errorMessage } from "../services/supabase";
import { t } from "../i18n";
import type { LiveComment } from "./liveApi";

export function LiveComments({ sessionId, admin = false, enabled = true, live = true }: { sessionId: string; admin?: boolean; enabled?: boolean; live?: boolean }) {
  const [items, setItems] = useState<LiveComment[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const stick = useRef(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("live_comments").select("id, session_id, author_name, is_committee, body, hidden, created_at")
      .eq("session_id", sessionId).order("created_at", { ascending: true }).limit(300);
    if (data) setItems(data as LiveComment[]);
  }, [sessionId]);

  useEffect(() => {
    void load();
    if (!live) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 3000);
    return () => clearInterval(timer);
  }, [load, live]);

  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc("post_live_comment", { p_session: sessionId, p_body: body });
      if (error) throw error;
      setText("");
      stick.current = true;
      await load();
    } catch (er) {
      setErr(errorMessage(er));
    } finally {
      setBusy(false);
    }
  };

  const hide = async (c: LiveComment) => {
    const { error } = await supabase.rpc("hide_live_comment", { p_id: c.id, p_hidden: !c.hidden });
    if (error) setErr(errorMessage(error)); else void load();
  };

  const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="lv-chat" aria-label={t("live.comments")}>
      <h2 className="lv-chat__title"><Icon name="chat" size={18} /> {t("live.comments")} <span className="lv-small num">({items.filter((c) => !c.hidden).length})</span></h2>
      <ol className="lv-chat__list" ref={listRef} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
        {items.length === 0 && <li className="lv-chat__empty">{t("live.noComments")}</li>}
        {items.map((c) => (
          <li key={c.id} className={`lv-msg${c.is_committee ? " is-committee" : ""}${c.hidden ? " is-hidden" : ""}`}>
            <div className="lv-msg__head">
              <b>{c.author_name}</b>
              {c.is_committee && <span className="lv-tag">{t("live.committee")}</span>}
              <span className="lv-small num">{time(c.created_at)}</span>
              {admin && <button type="button" className="lv-msg__hide" onClick={() => void hide(c)}>{c.hidden ? t("live.show") : t("live.hide")}</button>}
            </div>
            <p>{c.body}</p>
          </li>
        ))}
      </ol>
      {live && (enabled || admin ? (
        <form className="lv-chat__form" onSubmit={send}>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={t("live.commentPh")} aria-label={t("live.commentPh")} />
          <button type="submit" disabled={busy || !text.trim()} aria-label={t("live.send")}><Icon name="send" size={18} /></button>
        </form>
      ) : <p className="lv-chat__off">{t("live.commentsOff")}</p>)}
      {err && <p className="lv-small lv-error" role="alert">{err}</p>}
    </section>
  );
}
