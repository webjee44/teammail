---
name: Noise whitelist - important senders
description: Senders that must NEVER be classified as noise by AI analysis
type: constraint
---
These senders are important business contacts and must never be marked `is_noise = true`:

- **grenke France, Service fin de contrats** (`service.eol@grenke.fr`) — leasing contracts, buyback offers, terminations
- **grenke Nantes, Service** (`service.nantes@grenke.fr`) — same
- **Pixartprinting Support** (`support@pixartprinting.com`) — design service exchanges, order support
- Any email about contracts, invoices, terminations, buyback offers from partners/suppliers

Only newsletters, marketing emails, automated alerts (Google Alerts, Discord, Semrush), and platform notifications should be noise.
Exception: Pixartprinting satisfaction surveys ("Votre avis compte") CAN be noise, but actual support/order exchanges must NOT be.
