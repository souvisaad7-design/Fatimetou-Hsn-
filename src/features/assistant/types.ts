export type Role = "user" | "assistant";

/** زر إضافي يظهر تحت الرد (مثل الانتقال إلى صفحة الانتساب) */
export interface ReplyAction {
  type: "membership" | "link";
  url?: string;
  label?: string;
}

/** فيديو من قناة الجمعية يُعرض ويُشغَّل داخل فقاعة الرد */
export interface VideoResult {
  id: string;
  title: string;
  thumbnail?: string | null;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  followups?: string[];
  actions?: ReplyAction[];
  videos?: VideoResult[];
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/** ما يُرسل إلى مزوّد الردود (Mock أو Backend) */
export interface ChatRequest {
  messages: Array<Pick<ChatMessage, "role" | "content">>;
  signal: AbortSignal;
  onToken?: (textSoFar: string) => void;
}

export interface ChatReply {
  content: string;
  followups?: string[];
  actions?: ReplyAction[];
  videos?: VideoResult[];
}

export interface ChatProvider {
  send(request: ChatRequest): Promise<ChatReply>;
}

export interface Intent {
  id: string;
  priority?: number;
  maxWords?: number;
  /** لا يُطابق إلا إذا احتوى السؤال على إحدى هذه الكلمات (مثل "مسؤول" لأسئلة الأشخاص) */
  requires?: string[];
  /** لا يُطابق إذا احتوى السؤال على إحدى هذه الكلمات */
  excludes?: string[];
  keywords: string[];
  answer: string;
  followups?: string[];
  actions?: ReplyAction[];
}

export interface KnowledgeBase {
  intents: Intent[];
  fallback: Omit<Intent, "id" | "keywords">;
}
