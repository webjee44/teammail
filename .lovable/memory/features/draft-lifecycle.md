---
name: Draft lifecycle & state machine
description: Drafts use localStorage + DB sync with status machine (draft → send_pending → sent/send_failed). Both compose AND reply use outbox_commands pipeline.
type: feature
---
## Architecture

1. **localStorage** (`useLocalDraft.ts`): immediate snapshot on every keystroke, key = `draft:<id|new>`
2. **DB sync** (`useDraft.ts`): debounce 500ms, serialized save chain, `flushDraft()` for immediate save
3. **State machine** on `drafts.status` column: `draft` → `send_pending` → `sent` | `send_failed`
4. **Compose send flow** (`FloatingCompose.tsx`): flush → set send_pending → UndoSendDialog → outbox_commands insert (`send_new`) → set sent
5. **Reply send flow** (`useInboxMutations.ts`): UndoSendDialog → outbox_commands insert (`send_reply`) → process-outbox handles gmail-send + messages insert + conversation update
6. **Cancel**: reverts status to `draft`, toast confirms draft preserved
7. **deleteDraft()** now marks `status = 'sent'` instead of DELETE
8. **inbox_list** DB function filters `has_draft` on `status = 'draft'` only
9. **beforeunload** handler ensures localStorage flush on tab close
10. **visibilitychange** handler flushes to both localStorage AND DB when tab goes hidden
11. **ReplyArea** cleanup effect flushes draft on conversation change or unmount
12. **process-outbox** has idempotency check on `gmail_message_id` and logs partial failures to `sync_journal`
13. **pg_cron** runs process-outbox every minute automatically
