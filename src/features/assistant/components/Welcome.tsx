import { Icon } from "../../../shared/Icon";
import { assistantConfig as cfg } from "../config";

export function Welcome({ onAsk }: { onAsk: (q: string) => void }) {
  return (
    <div className="ast-welcome">
      <img className="ast-welcome__logo" src={cfg.org.logoFull} alt={cfg.org.name} width={640} height={380} />
      <h2>كيف يمكنني مساعدتك؟</h2>
      <div className="ast-welcome__msg">
        {cfg.assistant.welcome.map((line) => <p key={line}>{line}</p>)}
      </div>
      <div className="ast-suggestions">
        {cfg.assistant.suggestions.map((s) => (
          <button key={s.text} type="button" className="ast-suggestion" onClick={() => onAsk(s.text)}>
            <span className="ast-suggestion__icon"><Icon name={s.icon} size={18} /></span>
            <span>{s.text}</span>
          </button>
        ))}
      </div>
      <button type="button" className="ast-videos-btn" onClick={() => onAsk(cfg.channelPlaylist.buttonLabel)}>
        <Icon name="play" /> {cfg.channelPlaylist.buttonLabel}
      </button>
    </div>
  );
}
