import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { WhatsAppConversationList } from "@/components/whatsapp/WhatsAppConversationList";
import { WhatsAppConversationDetail } from "@/components/whatsapp/WhatsAppConversationDetail";
import { NewWhatsAppDialog } from "@/components/whatsapp/NewWhatsAppDialog";
import { MessageCircle } from "lucide-react";

export default function WhatsApp() {
  const [searchParams] = useSearchParams();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    searchParams.get("id")
  );
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <AppLayout>
      <div className="flex h-full w-full">
        {/* Conversation list */}
        <div className="w-[340px] border-r border-border flex flex-col bg-background">
          <WhatsAppConversationList
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
            onNewConversation={() => setShowNewDialog(true)}
          />
        </div>

        {/* Conversation detail */}
        <div className="flex-1 flex flex-col bg-background">
          {selectedConversationId ? (
            <WhatsAppConversationDetail conversationId={selectedConversationId} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-[15px] font-medium text-foreground">Sélectionnez une conversation</p>
                <p className="text-[13px] text-muted-foreground mt-1.5 max-w-[260px]">
                  Choisissez une conversation WhatsApp dans la liste ou démarrez-en une nouvelle
                </p>
              </div>
            </div>
          )}
        </div>

        <NewWhatsAppDialog open={showNewDialog} onOpenChange={setShowNewDialog} onCreated={(id) => {
          setSelectedConversationId(id);
          setShowNewDialog(false);
        }} />
      </div>
    </AppLayout>
  );
}
