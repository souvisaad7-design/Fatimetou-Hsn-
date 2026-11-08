import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "../../../shared/Icon";

interface Props {
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  focusKey?: string; // يعيد التركيز عند تغيّر المحادثة
}

export function Composer({ busy, onSend, onStop, focusKey }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // تكبير الحقل تلقائياً مع النص
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    if (window.matchMedia?.("(hover: hover)").matches) ref.current?.focus();
  }, [focusKey, busy]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return onStop();
    if (!value.trim()) return;
    onSend(value);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!busy) submit();
    }
  };

  return (
    <footer className="ast-composer-wrap">
      <form className="ast-composer" onSubmit={submit} autoComplete="off">
        <label htmlFor="ast-input" className="visually-hidden">اكتب سؤالك</label>
        <textarea
          id="ast-input"
          ref={ref}
          rows={1}
          maxLength={2000}
          enterKeyHint="send"
          placeholder="اكتب سؤالك عن الجمعية..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="ast-send" type="submit" aria-label={busy ? "إيقاف الرد" : "إرسال"} disabled={!busy && !value.trim()}>
          <Icon name={busy ? "stop" : "send"} />
        </button>
      </form>
      <p className="ast-disclaimer">إجابات المساعد مبنية على الملف التعريفي للجمعية. للتأكد من أي معلومة يُرجى الرجوع إلى إدارة الجمعية.</p>
    </footer>
  );
}
