# Project Memory

## Core
Front.com clone — collaborative Gmail inbox app called "TeamMail". French UI, Inter font.
Primary #6366f1 (indigo). Light/dark mode. Team-scoped RLS on all tables.
Google OAuth via Lovable Cloud managed auth. 2-5 person teams.
Gmail sync is incremental via history.list with historyId watermark.

## Memories
- [DB Schema](mem://features/db-schema) — Tables: teams, profiles, user_roles, tags, conversations, messages, comments, rules, team_invitations, outbox_commands, sync_journal
- [Pages](mem://features/pages) — Login, Inbox (3-col), Compose, Rules, Analytics, Settings
- [Conversation state model](mem://features/conversation-state) — state=inbox|archived|trash|spam, status=open|closed|snoozed. Archive=soft update. Strict reply mailbox routing.
- [Email templates](mem://features/email-templates) — Reusable templates with variables
- [Contacts](mem://features/contacts) — Contacts with team RLS, ContactPanel, auto-enrichment
