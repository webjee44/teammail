---
name: Draft lifecycle & state machine
description: Drafts use localStorage + DB sync with status machine (draft → send_pending → sent/send_failed)
type: feature
---
## Architecture

1. **localStorage** (`useLocalDraft.ts`): immediate snapshot on every keystroke, key = `draft:<id|new>`
2. **DB sync** (`useDraft.ts`): debounce 500ms, serialized save chain, `flushDraft()` for immediate save
3. **State machine** on `drafts.status` column: `draft` → `send_pending` → `sent` | `send_failed`
4. **Send flow** (`FloatingCompose.tsx`): flush → set send_pending → UndoSendDialog → gmail-send → set sent/send_failed
5. **Cancel**: reverts status to `draft`, toast confirms draft preserved
6. **deleteDraft()** now marks `status = 'sent'` instead of DELETE
7. **inbox_list** DB function filters `has_draft` on `status = 'draft'` only
8. **beforeunload** handler ensures localStorage flush on tab close
