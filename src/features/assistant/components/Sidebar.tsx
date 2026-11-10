import { Icon } from "../../../shared/Icon";
import { assistantConfig as cfg } from "../config";
import type { Conversation } from "../types";
import { getChosenVoice, setAutoSpeak, setChosenVoice, speechSupported, useAutoSpeak, useVoicesVersion, voicesFor } from "../lib/speech";
import { assistantName, at } from "../i18n";

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
      <aside className={`ast-sidebar${open ? " is-open" : ""}`} id="ast-sidebar" aria-label={at("chats")}>
        <div className="ast-sidebar__head">
          <button type="button" className="ast-brand" onClick={onNew} aria-label={at("newChat")}>
            <img src={cfg.org.logo} alt="" width={36} height={36} />
            <span>
              <b>{at("shortName")}</b>
              <small>{assistantName()}</small>
            </span>
          </button>
          <button className="ast-icon-btn ast-only-mobile" type="button" aria-label={at("closeMenu")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <button className="ast-new" type="button" onClick={onNew}>
          <Icon name="plus" /> {at("newChat")}
        </button>

        <div className="ast-sidebar__label">{at("history")}</div>
        {history.length ? (
          <ul className="ast-history">
            {history.map((c) => (
              <li key={c.id} className={c.id === currentId ? "is-active" : undefined}>
                <button type="button" className="ast-history__open" title={c.title} onClick={() => onSelect(c.id)}>
                  {c.title === "محادثة جديدة" || c.title === "Nouvelle conversation" ? at("newChat") : c.title}
                </button>
                <button type="button" className="ast-history__del" aria-label={`${at("deleteChat")}: ${c.title}`} onClick={() => onDelete(c.id)}>
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ast-history__empty">{at("noChats")}</p>
        )}

        <div className="ast-sidebar__foot">
          {cfg.membership.url && (
            <a className="ast-side-link" href={cfg.membership.url}>
              <Icon name="userPlus" /> {at("join")}
            </a>
          )}
          {speechSupported && (
            <button className="ast-side-link" type="button" onClick={() => setAutoSpeak(!autoSpeak)} aria-pressed={autoSpeak}>
              <Icon name="volume" /> {at("autoSpeak")}: {autoSpeak ? at("on") : at("off")}
            </button>
          )}
          {speechSupported && <VoicePicker />}
          <button className="ast-side-link" type="button" onClick={onToggleTheme}>
            <Icon name={theme === "dark" ? "sun" : "moon"} /> {theme === "dark" ? at("light") : at("dark")}
          </button>
          {cfg.provider === "mock" && <span className="ast-badge">{at("demo")}</span>}
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
    <label className="ast-voice-pick">
      <span><Icon name="volume" size={16} /> {at("voicePick")}</span>
      <select value={current} onChange={(e) => setChosenVoice(e.target.value)}>
        {voices.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>{v.name.replace(/\s*\(.*\)\s*/, " ").replace(/Microsoft|Google|Online/gi, "").trim() || v.name}</option>
        ))}
      </select>
    </label>
  );
}
