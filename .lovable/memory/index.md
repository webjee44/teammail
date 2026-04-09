# Project Memory

## Core
Front.com clone — collaborative Gmail inbox app called "TeamMail". French UI, Inter font.
Primary #6366f1 (indigo). Light/dark mode. Team-scoped RLS on all tables.
Google OAuth via Lovable Cloud managed auth. 2-5 person teams.
Campaign feature PAUSED — do not touch until user says otherwise.

## Memories
- [DB Schema](mem://features/db-schema) — Tables: teams, profiles, user_roles, tags, conversations, messages, comments, rules, team_invitations
- [Pages](mem://features/pages) — Login, Inbox (3-col), Compose, Rules, Analytics, Settings
- [Campaign paused](mem://constraints/campaign-paused) — Do not modify campaign code/UI/functions
- [Gmail limits](mem://reference/gmail-limits) — Gmail API daily quotas: 2k msgs/day, 10k recipients/day, current delay 1s is safe
