import { useState, useCallback } from "react";
import type { Conversation } from "@/components/inbox/ConversationList";

export function useBulkActions(filteredConversations: Conversation[]) {
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());

  const handleBulkToggle = useCallback((id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkSelectAll = useCallback(() => {
    setBulkSelected(new Set(filteredConversations.map((c) => c.id)));
  }, [filteredConversations]);

  const handleBulkDeselectAll = useCallback(() => {
    setBulkSelected(new Set());
  }, []);

  return {
    bulkSelected,
    handleBulkToggle,
    handleBulkSelectAll,
    handleBulkDeselectAll,
  };
}
