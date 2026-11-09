import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../../shared/Icon";
import { useTheme } from "../../shared/useTheme";
import { Composer } from "./components/Composer";
import { BotMessage, PendingMessage, UserMessage } from "./components/Message";
import { Sidebar } from "./components/Sidebar";
import { Welcome } from "./components/Welcome";
import { assistantConfig as cfg } from "./config";
import { useAssistant } from "./hooks/useAssistant";
import { useVoiceChat } from "./hooks/useVoiceChat";
import "./assistant.css";

const welcomeMessage = { content: cfg.assistant.welcome.join("\n") };

export default function AssistantPage() {
  const chat = useAssistant();
  const { theme, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const messages = chat.conversation?.messages ?? [];
  const empty = messages.length === 0 && !chat.pending;
  const voice = useVoiceChat({ busy: chat.busy, messages, conversationId: chat.conversation?.id, onSend: chat.ask });

  useEffect(() => {
    document.title = `${cfg.assistant.name} | ${cfg.org.name}`;
  }, []);

  // فتح المساعد بسؤال جاهز: assistant/?q=كيف أنتسب
  const handledPreset = useRef(false);
  useEffect(() => {
    if (handledPreset.current) return;
    handledPreset.current = true;
    const preset = new URLSearchParams(window.location.search).get("q");
    if (!preset) return;
    window.history.replaceState(null, "", window.location.pathname);
    chat.startWith(preset.slice(0, 500));
  }, [chat]);

  // التمرير لآخر رسالة عند وصول محتوى جديد (إذا كان المستخدم قريباً من الأسفل)
  const stick = useRef(true);
  const onScroll = () => {
    const t = threadRef.current!;
    stick.current = t.scrollHeight - t.scrollTop - t.clientHeight < 140;
  };
  useLayoutEffect(() => {
    const t = threadRef.current;
    if (t && stick.current) t.scrollTop = t.scrollHeight;
  }, [messages.length, chat.pending?.text]);
  useLayoutEffect(() => {
    stick.current = true;
  }, [chat.conversation?.id, messages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (sidebarOpen) setSidebarOpen(false);
      else if (voice.state !== "off") voice.end();
      else chat.stop();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen, chat, voice]);

  const closeAnd = <T extends unknown[]>(fn: (...a: T) => void) => (...a: T) => { fn(...a); setSidebarOpen(false); };

  return (
    <div className="ast">
      <Sidebar
        open={sidebarOpen}
        history={chat.history}
        currentId={chat.conversation?.id}
        theme={theme}
        onToggleTheme={toggle}
        onNew={closeAnd(chat.newConversation)}
        onSelect={closeAnd(chat.select)}
        onDelete={chat.remove}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="ast-chat">
        <header className="ast-topbar">
          <button
            className="ast-icon-btn ast-only-mobile"
            type="button"
            aria-label="فتح قائمة المحادثات"
            aria-controls="ast-sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="ast-topbar__title">
            <img src={cfg.org.logo} alt="شعار جمعية عون وسند الخيرية" width={32} height={32} />
            <div>
              <h1>{cfg.org.name}</h1>
              <span className="ast-status"><i aria-hidden="true" />المساعد الذكي متاح</span>
            </div>
          </div>
          <button className="ast-icon-btn" type="button" aria-label="محادثة جديدة" title="محادثة جديدة" onClick={chat.newConversation}>
            <Icon name="edit" />
          </button>
        </header>

        <section className="ast-thread" ref={threadRef} onScroll={onScroll} aria-live="polite" aria-label="الرسائل">
          {empty ? (
            <Welcome onAsk={chat.ask} onVoice={voice.toggle} />
          ) : (
            <div className="ast-messages">
              <BotMessage message={welcomeMessage} isWelcome />
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <UserMessage key={m.id} content={m.content} />
                ) : (
                  <BotMessage
                    key={m.id}
                    message={m}
                    isLast={i === messages.length - 1 && !chat.busy}
                    onAsk={chat.ask}
                    onRegenerate={chat.regenerate}
                  />
                ),
              )}
              {chat.pending && <PendingMessage text={chat.pending.text} />}
            </div>
          )}
        </section>

        <Composer busy={chat.busy} onSend={chat.ask} onStop={chat.stop} focusKey={chat.conversation?.id} voice={voice} />
      </main>
    </div>
  );
}
