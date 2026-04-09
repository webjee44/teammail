---
name: Gmail sending limits
description: Gmail API daily limits for Google Workspace accounts — reference for campaign feature
type: reference
---
## Gmail Sending Limits (Google Workspace, updated Apr 2026)

| Limit | Value |
|---|---|
| Messages/day | 2,000 (500 trial) |
| Total recipients/day | 10,000 |
| External recipients/day | 3,000 |
| Unique external recipients/day | 2,000 |
| Recipients per message (API) | 500 |
| Attachment size | 25 MB (50 MB Enterprise Plus) |

Current send-campaign delay: 1,000 ms between sends (~60/min). Safe.
Key risk: exceeding 2,000 messages/day per mailbox account. Add UI warning at 1,500 recipients.
Source: https://support.google.com/a/answer/166852
