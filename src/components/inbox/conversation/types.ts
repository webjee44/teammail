import type { FileToUpload } from "../Attachments";

export const decodeHtml = (s = "") => {
  const t = document.createElement("textarea");
  t.innerHTML = s;
  return t.value.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
};

export type MessageAttachment = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
};

export type Message = {
  id: string;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  cc?: string | null;
  body_html: string | null;
  body_text: string | null;
  sent_at: string;
  is_outbound: boolean;
  attachments?: MessageAttachment[];
};

export type Comment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
};

export type ConversationDetailData = {
  id: string;
  seq_number?: number;
  subject: string;
  from_email: string | null;
  from_name: string | null;
  status: "open" | "closed";
  assigned_to: string | null;
  assignee_name?: string;
  tags?: { id: string; name: string; color: string }[];
  messages: Message[];
  comments: Comment[];
  priority?: string | null;
  is_noise?: boolean;
  ai_summary?: string | null;
  category?: string | null;
  entities?: any;
};

export type ConversationDetailProps = {
  conversation: ConversationDetailData | null;
  currentUserId?: string;
  onStatusChange?: (id: string, status: "open" | "closed") => void;
  onReply?: (id: string, body: string, attachments?: FileToUpload[]) => void;
  onComment?: (id: string, body: string) => void;
  onEditComment?: (commentId: string, newBody: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onArchive?: (id: string) => void;
};

export type Suggestion = {
  label: string;
  body: string;
  action?: "compose_to";
  action_email?: string;
};

export const priorityConfig: Record<string, { icon: any; className: string; label: string }> = {
  high: { icon: null, className: "text-destructive", label: "Haute" },
  medium: { icon: null, className: "text-amber-500", label: "Moyenne" },
  low: { icon: null, className: "text-muted-foreground", label: "Basse" },
};

export const categoryLabels: Record<string, string> = {
  support: "Support",
  billing: "Facturation",
  commercial: "Commercial",
  notification: "Notification",
  other: "Autre",
};
