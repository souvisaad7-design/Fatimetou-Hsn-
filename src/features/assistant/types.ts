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
  /** عرض مشغّل قائمة كل فيديوهات قناة الجمعية داخل الرد */
  playlist?: boolean;
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
  playlist?: boolean;
}

export interface ChatProvider {
  send(request: ChatRequest): Promise<ChatReply>;
}

/** نص الرد بلغات المساعد الثلاث: الحسانية (افتراضياً) والفصحى والفرنسية */
export interface LangText {
  has: string;
  ar: string;
  fr: string;
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
  answer: LangText;
  /** أسئلة مقترحة بعد الرد (مفاتيح من قائمة الأسئلة الجاهزة) */
  followups?: string[];
  actions?: ReplyAction[];
  /** يعرض مشغّل قائمة فيديوهات القناة مع الرد */
  playlist?: boolean;
  /** لا يُبحث عن فيديو مع هذا الرد */
  noVideo?: boolean;
}

export interface KnowledgeBase {
  intents: Intent[];
  /** الأسئلة الجاهزة بالألسن الثلاثة، تُستعمل كمقترحات بعد الردود */
  questions: Record<string, LangText>;
  /** كلمات تدل على أن السؤال عن الجمعية */
  topicWords: string[];
  /** «ما عندي خبر عن ذاك...» */
  unknown: Omit<Intent, "id" | "keywords">;
  /** سؤال خارج موضوع الجمعية */
  offTopic: Omit<Intent, "id" | "keywords">;
}
