---
name: Conversation state model
description: conversations.state = inbox|archived|trash|spam (system location), independent from status (workflow). Archive = soft update, never delete. Reply uses conversation mailbox_id strictly. gmail-archive fails hard if Gmail API fails.
type: feature
---
## State vs Status
- `state` (conversation_state enum) = system location: `inbox`, `archived`, `trash`, `spam`
- `status` (conversation_status enum) = team workflow: `open`, `closed`, `snoozed`
- Both are independent: `archived + open` and `archived + closed` are valid
- `sent` and `draft` are NOT in conversation_state — handled separately

## Archive behavior
- `gmail-archive` function does `UPDATE state = 'archived'`, never `DELETE`
- **Critical**: If Gmail API fails to remove INBOX label, local state is NOT updated — drift is logged to `sync_journal` and 502 returned to client
- Inbox views filter on `state = 'inbox'`
- Archived view filters on `state = 'archived'`
- Search is global across all states except `trash` and `spam`

## Full scan reconciliation
- `gmail-sync` syncThread explicitly sets `state = 'inbox'` when a thread is seen in a full INBOX scan
- This corrects stale `archived` state for threads that reappeared in Gmail INBOX

## Reply mailbox routing (strict)
1. Use `conversation.mailbox_id` → lookup email in `team_mailboxes`
2. Fallback: current `mailboxId` from URL params
3. No automatic fallback to first available mailbox — block and show error

## Mutations centralized in useInboxMutations hook
- All mutations go through `applyConversationPatch()` or `removeFromActiveView()`
- No direct `setConversations` calls scattered in Index.tsx

## Realtime rules (view-aware)
- INSERT: only add if conversation matches current view (state, mailboxId, filter, userId)
- UPDATE: if conversation no longer matches view, remove; if it still matches, update in place; never auto-insert on UPDATE
- DELETE: remove from UI (reserved for real deletions only)
- Filters respected: mine (assigned_to === userId), unassigned (assigned_to === null), closed (status === 'closed')
