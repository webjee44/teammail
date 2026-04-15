# Project Memory

## Core
Front.com clone — collaborative Gmail inbox app called "TeamMail". French UI, Inter font.
Primary #6366f1 (indigo). Light/dark mode. Team-scoped RLS on all tables.
Google OAuth via Lovable Cloud managed auth. 2-5 person teams.
Mock data in place — backend wiring (Gmail API sync) not yet implemented.

## Memories
- [DB Schema](mem://features/db-schema) — Tables: teams, profiles, user_roles, tags, conversations, messages, comments, rules, team_invitations
- [Conversation State](mem://features/conversation-state) — state=inbox|archived|trash|spam, soft-archive, strict reply routing, useInboxMutations hook
- [Pages](mem://features/pages) — Login, Inbox (3-col), Compose, Rules, Analytics, Settings
- [Email Templates](mem://features/email-templates) — Reusable templates with dynamic variables, CRUD in Settings
- [Contacts](mem://features/contacts) — Contacts table with team RLS, ContactPanel, auto-enrichment
- [Campaign paused](mem://constraints/campaign-paused) — Campaign sending paused due to Gmail limits
- [Gmail limits](mem://reference/gmail-limits) — Gmail API quotas and limits
- [Noise whitelist](mem://constraints/noise-whitelist) — Senders that must NEVER be classified as noise (grenke, etc.)
