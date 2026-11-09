import { Icon } from "../../../shared/Icon";
import { assistantConfig as cfg } from "../config";
import type { Conversation } from "../types";
import { getChosenVoice, setAutoSpeak, setChosenVoice, speechSupported, useAutoSpeak, useVoicesVersion, voicesFor } from "../lib/speech";

interface Props {
  open: boolean;
  history: Conversation[];
  currentId?: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function Sidebar({ open, history, currentId, theme, onToggleTheme, onNew, onSelect, onDelete, onClose }: Props) {
  const autoSpeak = useAutoSpeak();
  return (
    <>
      <aside className={`ast-sidebar${open ? " is-open" : ""}`} id="ast-sidebar" aria-label="المحادثات">
        <div className="ast-sidebar__head">
          <button type="button" className="ast-brand" onClick={onNew} aria-label="محادثة جديدة">
            <img src={cfg.org.logo} alt="" width={36} height={36} />
            <span>
              <b>{cfg.org.shortName}</b>
              <small>{cfg.assistant.name}</small>
            </span>
          </button>
          <button className="ast-icon-btn ast-only-mobile" type="button" aria-label="إغلاق القائمة" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <button className="ast-new" type="button" onClick={onNew}>
          <Icon name="plus" /> محادثة جديدة
        </button>

        <div className="ast-sidebar__label">المحادثات السابقة</div>
        {history.length ? (
          <ul className="ast-history">
            {history.map((c) => (
              <li key={c.id} className={c.id === currentId ? "is-active" : undefined}>
                <button type="button" className="ast-history__open" title={c.title} onClick={() => onSelect(c.id)}>
                  {c.title}
                </button>
                <button type="button" className="ast-history__del" aria-label={`حذف المحادثة: ${c.title}`} onClick={() => onDelete(c.id)}>
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ast-history__empty">لا توجد محادثات بعد. ابدأ بطرح سؤالك.</p>
        )}

        <div className="ast-sidebar__foot">
          {cfg.membership.url && (
            <a className="ast-side-link" href={cfg.membership.url}>
              <Icon name="userPlus" /> الانتساب إلى الجمعية
            </a>
          )}
          {speechSupported && (
            <button className="ast-side-link" type="button" onClick={() => setAutoSpeak(!autoSpeak)} aria-pressed={autoSpeak}>
              <Icon name="volume" /> قراءة الردود بالصوت: {autoSpeak ? "مفعّلة" : "متوقفة"}
            </button>
          )}
          {speechSupported && <VoicePicker />}
          <button className="ast-side-link" type="button" onClick={onToggleTheme}>
            <Icon name={theme === "dark" ? "sun" : "moon"} /> {theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
          </button>
          {cfg.provider === "mock" && <span className="ast-badge">نسخة تجريبية</span>}
        </div>
      </aside>
      {open && <div className="ast-scrim" onClick={onClose} />}
    </>
  );
}

/** اختيار صوت القراءة من الأصوات العربية الموجودة في الجهاز (تُجرَّب عند الاختيار) */
function VoicePicker() {
  useVoicesVersion();
  const voices = voicesFor("ar");
  if (voices.length < 2) return null;
  const current = voices.find((v) => v.voiceURI === getChosenVoice())?.voiceURI ?? voices[0].voiceURI;
  return (
    <label className="ast-voice">
      <span><Icon name="volume" size={16} /> صوت القراءة</span>
      <select value={current} onChange={(e) => setChosenVoice(e.target.value)}>
        {voices.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>{v.name.replace(/\s*\(.*\)\s*/, " ").replace(/Microsoft|Google|Online/gi, "").trim() || v.name}</option>
        ))}
      </select>
    </label>
  );
}
