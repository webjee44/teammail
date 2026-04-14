import { useState, useCallback } from "react";
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

/** Extract all unique email addresses from thread messages, parsing "Name <email>" format */
function collectThreadEmails(messages: NonNullable<ConversationDetailProps["conversation"]>["messages"]): Set<string> {
  const emails = new Set<string>();
  for (const m of messages) {
    for (const raw of [m.from_email, m.to_email]) {
      if (!raw) continue;
      // to_email can contain multiple comma-separated addresses
      for (const part of raw.split(",")) {
        const trimmed = part.trim();
        const match = trimmed.match(/<(.+?)>/);
        const email = match ? match[1].toLowerCase() : trimmed.toLowerCase();
        if (email && email.includes("@")) emails.add(email);
      }
    }
  }
  return emails;
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

  const handleReplyAll = async () => {
    // Get our mailbox emails to exclude them from CC
    const { data: mailboxes } = await supabase
      .from("team_mailboxes")
      .select("email")
      .eq("sync_enabled", true);
    const ourEmails = new Set((mailboxes || []).map((m: any) => m.email.toLowerCase()));

    // Collect all emails from the thread
    const allEmails = collectThreadEmails(conversation.messages);

    // Remove our own mailbox emails
    for (const e of ourEmails) allEmails.delete(e);

    // The primary recipient is the original sender
    const lastInbound = [...conversation.messages].reverse().find((m) => !m.is_outbound);
    const primaryTo = lastInbound?.from_email?.toLowerCase() || conversation.from_email?.toLowerCase() || "";

    // Everyone else goes to CC
    allEmails.delete(primaryTo);
    const ccList = Array.from(allEmails);

    const subject = conversation.subject.replace(/^Re:\s*/i, "");
    const replySubject = `Re: ${subject}`;

    // Get threading info
    const { data: convRow } = await supabase
      .from("conversations")
      .select("gmail_thread_id")
      .eq("id", conversation.id)
      .maybeSingle();

    const lastMsg = conversation.messages[conversation.messages.length - 1];

    openCompose({
      to: primaryTo,
      subject: replySubject,
      cc: ccList.length > 0 ? ccList : undefined,
      threadId: convRow?.gmail_thread_id || undefined,
      inReplyTo: (lastMsg as any)?.gmail_message_id || undefined,
    });
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
        onReplyAll={handleReplyAll}
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
        onReplyAll={handleReplyAll}
      />
    </div>
  );
}
