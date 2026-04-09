import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { WhatsAppConversationList } from "@/components/whatsapp/WhatsAppConversationList";
import { WhatsAppConversationDetail } from "@/components/whatsapp/WhatsAppConversationDetail";
import { NewWhatsAppDialog } from "@/components/whatsapp/NewWhatsAppDialog";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function WhatsApp() {
  const [searchParams] = useSearchParams();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    searchParams.get("id")
  );
  const [showNewDialog, setShowNewDialog] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette conversation et tous ses messages ?")) return;
    // Delete messages first, then conversation
    await supabase.from("whatsapp_messages").delete().eq("conversation_id", id);
    const { error } = await supabase.from("whatsapp_conversations").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Conversation supprimée");
      if (selectedConversationId === id) setSelectedConversationId(null);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full w-full">
        <div className="w-[340px] border-r border-border flex flex-col bg-background">
          <WhatsAppConversationList
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
            onNewConversation={() => setShowNewDialog(true)}
          />
        </div>

        <div className="flex-1 flex flex-col bg-background">
          {selectedConversationId ? (
            <WhatsAppConversationDetail
              conversationId={selectedConversationId}
              onDelete={handleDelete}
            />
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