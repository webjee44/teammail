---
name: Conversation state model
description: conversations.state = inbox|archived|trash|spam (system location), independent from status (workflow). Archive = soft update, never delete. Reply uses conversation mailbox_id strictly.
type: feature
---
## State vs Status
- `state` (conversation_state enum) = system location: `inbox`, `archived`, `trash`, `spam`
- `status` (conversation_status enum) = team workflow: `open`, `closed`, `snoozed`
- Both are independent: `archived + open` and `archived + closed` are valid
- `sent` and `draft` are NOT in conversation_state — handled separately

## Archive behavior
- `gmail-archive` function does `UPDATE state = 'archived'`, never `DELETE`
- Inbox views filter on `state = 'inbox'`
- Archived view filters on `state = 'archived'`
- Search is global across all states except `trash`

## Reply mailbox routing (strict)
1. Use `conversation.mailbox_id` → lookup email in `team_mailboxes`
2. Fallback: current `mailboxId` from URL params
3. No automatic fallback to first available mailbox — block and show error

## Mutations centralized in useInboxMutations hook
- All mutations go through `applyConversationPatch()` or `removeFromActiveView()`
- No direct `setConversations` calls scattered in Index.tsx

## Realtime rules
- INSERT: only add if `c.state === activeState`
- UPDATE: if `c.state !== activeState`, remove from view
- DELETE: remove from UI (reserved for real deletions only)
