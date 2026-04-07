import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { WhatsAppConversationList } from "@/components/whatsapp/WhatsAppConversationList";
import { WhatsAppConversationDetail } from "@/components/whatsapp/WhatsAppConversationDetail";
import { NewWhatsAppDialog } from "@/components/whatsapp/NewWhatsAppDialog";
import { supabase } from "@/integrations/supabase/client";

export default function WhatsApp() {
  const [searchParams] = useSearchParams();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    searchParams.get("id")
  );
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Conversation list */}
        <div className="w-[380px] border-r border-border flex flex-col bg-background">
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
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-[15px] font-medium">Sélectionnez une conversation</p>
                <p className="text-[13px] mt-1">ou démarrez une nouvelle conversation WhatsApp</p>
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
