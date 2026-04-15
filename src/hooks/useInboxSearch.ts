import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Conversation } from "@/components/inbox/ConversationList";

export function useInboxSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) return;
    setSearchLoading(true);
    const { data: results } = await supabase.rpc("search_inbox", { p_query: query.trim(), p_limit: 50 });
    if (results && results.length > 0) {
      const convIds = [...new Set((results as any[]).map((r: any) => r.conversation_id))];
      const { data: convData } = await supabase
        .from("conversations")
        .select("*")
        .in("id", convIds)
        .order("last_message_at", { ascending: false });
      setSearchResults(
        (convData || []).map((c: any) => ({
          id: c.id, seq_number: c.seq_number, subject: c.subject, snippet: c.snippet,
          from_email: c.from_email, from_name: c.from_name,
          status: c.status as "open" | "closed", assigned_to: c.assigned_to,
          is_read: c.is_read, last_message_at: c.last_message_at,
          tags: [], priority: c.priority, is_noise: c.is_noise,
          ai_summary: c.ai_summary, category: c.category, entities: c.entities,
        }))
      );
    } else {
      setSearchResults([]);
    }
    setSearchLoading(false);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults(null);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    handleSearch,
    clearSearch,
  };
}
