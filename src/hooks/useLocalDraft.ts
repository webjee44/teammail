const PREFIX = "draft:";
const MAX_SIZE = 500_000; // ~500KB

export type LocalDraftData = {
  to_email?: string;
  from_email?: string;
  subject?: string;
  body?: string;
  savedAt?: number;
};

function key(draftKey: string) {
  return `${PREFIX}${draftKey}`;
}

export function saveLocal(draftKey: string, data: LocalDraftData) {
  try {
    const payload = JSON.stringify({ ...data, savedAt: Date.now() });
    if (payload.length > MAX_SIZE) return;
    localStorage.setItem(key(draftKey), payload);
  } catch {
    // quota exceeded — ignore
  }
}

export function loadLocal(draftKey: string): LocalDraftData | null {
  try {
    const raw = localStorage.getItem(key(draftKey));
    if (!raw) return null;
    return JSON.parse(raw) as LocalDraftData;
  } catch {
    return null;
  }
}

export function clearLocal(draftKey: string) {
  try {
    localStorage.removeItem(key(draftKey));
  } catch {
    // ignore
  }
}

export function listLocalDraftKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) {
        keys.push(k.slice(PREFIX.length));
      }
    }
  } catch {
    // ignore
  }
  return keys;
}
