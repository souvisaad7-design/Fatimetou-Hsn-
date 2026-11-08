import type { ReactNode } from "react";
import { Icon } from "../../../shared/Icon";
import { copyText, useToast } from "../../../shared/toast";
import { assistantConfig as cfg } from "../config";
import { Markdown } from "../lib/Markdown";
import type { ChatMessage } from "../types";
import { VideoCard } from "./VideoCard";

export function UserMessage({ content }: { content: string }) {
  return (
    <article className="ast-msg ast-msg--user">
      <div className="ast-msg__body">{content}</div>
    </article>
  );
}

interface BotProps {
  message: Pick<ChatMessage, "content" | "followups" | "actions" | "error" | "videos">;
  isLast?: boolean;
  isWelcome?: boolean;
  onAsk?: (q: string) => void;
  onRegenerate?: () => void;
}

export function BotMessage({ message, isLast, isWelcome, onAsk, onRegenerate }: BotProps) {
  const toast = useToast();
  const links = (message.actions ?? []).filter((a) => a.url);

  return (
    <BotShell error={message.error}>
      <div className="ast-msg__body"><Markdown text={message.content} /></div>

      {!!message.videos?.length && <VideoCard videos={message.videos} />}

      {links.length > 0 && (
        <div className="ast-msg__actions">
          {links.map((a) => (
            <a key={a.url} className="ast-action" href={a.url} target="_blank" rel="noopener noreferrer">
              <Icon name="link" size={18} /> {a.label ?? "فتح الرابط"}
            </a>
          ))}
        </div>
      )}

      {!isWelcome && (
        <div className="ast-msg__tools">
          <button
            type="button"
            className="ast-tool"
            onClick={async () => toast((await copyText(message.content)) ? "تم نسخ الرد" : "تعذّر النسخ، حدّد النص وانسخه يدوياً")}
          >
            <Icon name="copy" size={16} /> نسخ
          </button>
          {isLast && onRegenerate && (
            <button type="button" className="ast-tool" onClick={onRegenerate}>
              <Icon name="retry" size={16} /> {message.error ? "إعادة المحاولة" : "إعادة التوليد"}
            </button>
          )}
        </div>
      )}

      {isLast && onAsk && !!message.followups?.length && (
        <div className="ast-followups">
          {message.followups.map((q) => (
            <button key={q} type="button" className="ast-chip" onClick={() => onAsk(q)}>{q}</button>
          ))}
        </div>
      )}
    </BotShell>
  );
}

/** رد قيد الكتابة: مؤشر انتظار ثم نص يظهر تدريجياً */
export function PendingMessage({ text }: { text: string }) {
  return (
    <BotShell pending>
      {text ? (
        <div className="ast-msg__body is-streaming"><Markdown text={text} /></div>
      ) : (
        <div className="ast-typing" role="status" aria-label="المساعد يكتب">
          <span /><span /><span /><em>يكتب الآن...</em>
        </div>
      )}
    </BotShell>
  );
}

function BotShell({ children, error, pending }: { children: ReactNode; error?: boolean; pending?: boolean }) {
  return (
    <article className={`ast-msg ast-msg--bot${error ? " is-error" : ""}${pending ? " is-pending" : ""}`}>
      <img className="ast-msg__avatar" src={cfg.org.logo} alt="" width={34} height={34} />
      <div className="ast-msg__main">
        <div className="ast-msg__name">{cfg.assistant.name}</div>
        {children}
      </div>
    </article>
  );
}
