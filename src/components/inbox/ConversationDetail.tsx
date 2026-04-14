import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { ConversationHeader } from "./conversation/ConversationHeader";
import { MessageList } from "./conversation/MessageList";
import { ReplyArea } from "./conversation/ReplyArea";
import { useComposeWindow } from "@/hooks/useComposeWindow";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ConversationDetailProps } from "./conversation/types";
import { decodeHtml } from "./conversation/types";
export type { ConversationDetailData } from "./conversation/types";

function buildForwardBody(conversation: NonNullable<ConversationDetailProps["conversation"]>) {
  const lastMsg = [...conversation.messages].reverse().find((m) => !m.is_outbound) || conversation.messages[conversation.messages.length - 1];
  if (!lastMsg) return "";
  const date = lastMsg.sent_at ? format(new Date(lastMsg.sent_at), "d MMMM yyyy à HH:mm", { locale: fr }) : "";
  return `<br><br>---------- Message transféré ----------<br>De : ${lastMsg.from_name || lastMsg.from_email || ""} &lt;${lastMsg.from_email || ""}&gt;<br>Date : ${date}<br>Objet : ${decodeHtml(conversation.subject)}<br>À : ${lastMsg.to_email || ""}<br><br>${lastMsg.body_html || lastMsg.body_text || ""}`;
}

export function ConversationDetail({ conversation, currentUserId, onStatusChange, onReply, onComment, onEditComment, onDeleteComment, onDelete }: ConversationDetailProps) {
  const [activeTab, setActiveTab] = useState("reply");
  const { openCompose } = useComposeWindow();

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <MessageSquare className="h-12 w-12 mx-auto opacity-30" />
          <p className="text-sm">Sélectionnez une conversation</p>
        </div>
      </div>
    );
  }

  const handleForward = async () => {
    const subject = conversation.subject.replace(/^(Fwd?|Tr)\s*:\s*/i, "");
    const fwdSubject = `Fwd: ${subject}`;
    const fwdBody = buildForwardBody(conversation);

    const lastMsg = [...conversation.messages].reverse().find((m) => !m.is_outbound) || conversation.messages[conversation.messages.length - 1];
    const attachments: { name: string; file: File; base64: string }[] = [];

    if (lastMsg?.attachments && lastMsg.attachments.length > 0) {
      for (const att of lastMsg.attachments) {
        try {
          const { data } = await supabase.storage.from("attachments").download(att.storage_path);
          if (data) {
            const reader = new FileReader();
            const b64 = await new Promise<string>((resolve) => {
              reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
              reader.readAsDataURL(data);
            });
            attachments.push({ name: att.filename, file: new File([data], att.filename, { type: att.mime_type }), base64: b64 });
          }
        } catch { /* skip failed attachment */ }
      }
    }

    openCompose({ subject: fwdSubject, body: fwdBody, attachments: attachments.length > 0 ? attachments : undefined });
  };

  return (
    <div className="flex flex-col h-full">
      <ConversationHeader
        conversation={conversation}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        onReplyClick={() => {
          setActiveTab("reply");
          document.querySelector("[data-reply-area]")?.scrollIntoView({ behavior: "smooth" });
        }}
        onForward={handleForward}
      />
      <MessageList
        messages={conversation.messages}
        comments={conversation.comments}
        conversationSubject={conversation.subject}
        currentUserId={currentUserId}
        onEditComment={onEditComment}
        onDeleteComment={onDeleteComment}
      />
      <ReplyArea
        conversation={conversation}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        onReply={onReply}
        onComment={onComment}
        onForward={handleForward}
      />
    </div>
  );
}
