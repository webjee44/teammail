# Project Memory

## Core
Front.com clone — collaborative Gmail inbox app called "TeamMail". French UI, Inter font.
Primary #6366f1 (indigo). Light/dark mode. Team-scoped RLS on all tables.
Google OAuth via Lovable Cloud managed auth. 2-5 person teams.
Mock data in place — backend wiring (Gmail API sync) not yet implemented.

## Memories
- [DB Schema](mem://features/db-schema) — Tables: teams, profiles, user_roles, tags, conversations, messages, comments, rules, team_invitations
- [Pages](mem://features/pages) — Login, Inbox (3-col), Compose, Rules, Analytics, Settings
- [Draft lifecycle](mem://features/draft-lifecycle) — localStorage + DB sync, status machine (draft/send_pending/sent/send_failed)
- [Email templates](mem://features/email-templates) — Reusable templates with dynamic variables
- [Contacts](mem://features/contacts) — Contacts table with team RLS, ContactPanel
- [Conversation state](mem://features/conversation-state) — Conversation state management rules
- [Campaign paused](mem://constraints/campaign-paused) — Campaign feature paused
- [Noise whitelist](mem://constraints/noise-whitelist) — Noise detection whitelist rules
- [Gmail limits](mem://reference/gmail-limits) — Gmail API rate limits reference
