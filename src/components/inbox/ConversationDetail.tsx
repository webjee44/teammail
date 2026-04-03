import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { ConversationHeader } from "./conversation/ConversationHeader";
import { MessageList } from "./conversation/MessageList";
import { ReplyArea } from "./conversation/ReplyArea";
import type { ConversationDetailProps } from "./conversation/types";
export type { ConversationDetailData } from "./conversation/types";

export function ConversationDetail({ conversation, currentUserId, onStatusChange, onReply, onComment, onEditComment, onDeleteComment, onDelete }: ConversationDetailProps) {
  const [activeTab, setActiveTab] = useState("reply");

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
      />
      <MessageList
        messages={conversation.messages}
        comments={conversation.comments}
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
      />
    </div>
  );
}
