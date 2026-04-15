/**
 * Shared inbox metrics — used by both InboxSidebar and Index page
 * to guarantee identical counting logic.
 *
 * "Actionable" = the real backlog: open, not noise, needs a reply (last msg inbound).
 */

export type InboxConversation = {
  id: string;
  status: string;
  is_noise: boolean;
  is_read: boolean;
  needs_reply?: boolean; // true when last message is inbound
  assigned_to: string | null;
};

/** Open, not noise, and last message is inbound (needs reply). */
export function isActionable(c: InboxConversation): boolean {
  return c.status === "open" && !c.is_noise && c.needs_reply !== false;
}

/** Open, not noise, but already replied (last message is outbound). */
export function isReplied(c: InboxConversation): boolean {
  return c.status === "open" && !c.is_noise && c.needs_reply === false;
}

/** Marked as noise. */
export function isNoise(c: InboxConversation): boolean {
  return c.is_noise;
}

/** Actionable and unread. */
export function isUnread(c: InboxConversation): boolean {
  return isActionable(c) && !c.is_read;
}

/** Actionable and already read (but still needs reply). */
export function isReadActionable(c: InboxConversation): boolean {
  return isActionable(c) && c.is_read;
}

export type InboxCounts = {
  all: number;
  actionable: number;
  unread: number;
  readActionable: number;
  replied: number;
  noise: number;
};

/** Compute all counts from a single pass. Counts are mutually exclusive and additive. */
export function computeInboxCounts(conversations: InboxConversation[]): InboxCounts {
  let actionable = 0;
  let unread = 0;
  let readActionable = 0;
  let replied = 0;
  let noise = 0;

  for (const c of conversations) {
    if (c.status !== "open") continue;
    if (c.is_noise) {
      noise++;
      continue;
    }
    if (c.needs_reply === false) {
      replied++;
      continue;
    }
    // actionable
    actionable++;
    if (!c.is_read) unread++;
    else readActionable++;
  }

  const all = actionable + replied + noise;

  return { all, actionable, unread, readActionable, replied, noise };
}
