import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConversationList, Conversation } from "@/components/inbox/ConversationList";
import { ConversationDetail } from "@/components/inbox/ConversationDetail";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";

// Mock data for UI preview while backend wires up
const mockConversations: Conversation[] = [
  {
    id: "1",
    subject: "Question sur les tarifs",
    snippet: "Bonjour, je voulais en savoir plus sur vos tarifs entreprise...",
    from_email: "jean@example.com",
    from_name: "Jean Dupont",
    status: "open",
    assigned_to: null,
    is_read: false,
    last_message_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    tags: [{ id: "1", name: "Ventes", color: "#6366f1" }],
  },
  {
    id: "2",
    subject: "Bug report: Login not working",
    snippet: "When I try to login with my Google account, I get an error...",
    from_email: "marie@startup.io",
    from_name: "Marie Martin",
    status: "open",
    assigned_to: "user1",
    assignee_name: "Alex",
    is_read: true,
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    tags: [
      { id: "2", name: "Bug", color: "#ef4444" },
      { id: "3", name: "Urgent", color: "#f59e0b" },
    ],
  },
  {
    id: "3",
    subject: "Partnership opportunity",
    snippet: "We'd love to discuss a potential partnership between our companies...",
    from_email: "thomas@bigcorp.com",
    from_name: "Thomas Bernard",
    status: "open",
    assigned_to: null,
    is_read: false,
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    tags: [],
  },
  {
    id: "4",
    subject: "Invoice #2024-0142",
    snippet: "Please find attached the invoice for last month's services...",
    from_email: "billing@vendor.com",
    from_name: "Vendor Billing",
    status: "snoozed",
    assigned_to: null,
    is_read: true,
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    tags: [],
  },
  {
    id: "5",
    subject: "Re: Feature request - Dark mode",
    snippet: "Thank you for your suggestion! We've added it to our roadmap...",
    from_email: "support@app.com",
    from_name: "Support Team",
    status: "closed",
    assigned_to: "user2",
    assignee_name: "Sarah",
    is_read: true,
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    tags: [{ id: "4", name: "Feature", color: "#6366f1" }],
  },
];

const mockMessages = [
  {
    id: "m1",
    from_email: "jean@example.com",
    from_name: "Jean Dupont",
    to_email: "team@yourcompany.com",
    body_html: null,
    body_text:
      "Bonjour,\n\nJe voulais en savoir plus sur vos plans tarifaires pour les entreprises. Nous sommes une équipe de 50 personnes et nous cherchons une solution de communication adaptée.\n\nPouvez-vous m'envoyer un devis personnalisé ?\n\nCordialement,\nJean Dupont",
    sent_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    is_outbound: false,
  },
  {
    id: "m2",
    from_email: "alex@yourcompany.com",
    from_name: "Alex (You)",
    to_email: "jean@example.com",
    body_html: null,
    body_text:
      "Bonjour Jean,\n\nMerci pour votre intérêt ! Je serais ravi de discuter de nos plans entreprise avec vous.\n\nPour une équipe de 50 personnes, je vous recommande notre plan Business à 15€/utilisateur/mois.\n\nSouhaitez-vous planifier un appel cette semaine ?\n\nBien cordialement,\nAlex",
    sent_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    is_outbound: true,
  },
];

const Index = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { user } = useAuth();

  const selectedConv = selectedId
    ? {
        ...mockConversations.find((c) => c.id === selectedId)!,
        messages: selectedId === "1" ? mockMessages : [],
        comments: [
          {
            id: "c1",
            user_id: "user1",
            body: "Ce prospect semble sérieux, je m'en occupe !",
            created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
            author_name: "Alex",
          },
        ],
      }
    : null;

  return (
    <AppLayout hideHeader>
      <div className="flex w-full h-screen">
        {/* Conversation list column */}
        <div className="w-[340px] border-r border-border flex flex-col shrink-0">
          <div className="h-12 flex items-center px-3 border-b border-border gap-2 shrink-0">
            <SidebarTrigger />
            <h2 className="text-sm font-semibold text-foreground">Inbox</h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {mockConversations.filter((c) => c.status === "open").length} open
            </span>
          </div>
          <ConversationList
            conversations={mockConversations.filter((c) => c.status === "open")}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Detail column */}
        <div className="flex-1 flex flex-col min-w-0">
          <ConversationDetail
            conversation={selectedConv}
            onStatusChange={(id, status) => toast.info(`Status → ${status}`)}
            onReply={(id, body) => toast.success("Réponse envoyée")}
            onComment={(id, body) => toast.success("Note ajoutée")}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
