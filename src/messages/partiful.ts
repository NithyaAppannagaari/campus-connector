export interface Mutual {
  id: string;
  name: string;
  avatar: string | null;
  sharedEvents: number;
  attended: number;
  hosted: number;
}

export interface MutualsResult {
  connected: boolean;
  mutuals: Mutual[];
  error?: string;
}

// Fallback roster shown when the Partiful proxy isn't running or has no token.
// Lets the invite picker work standalone for demos.
const MOCK_MUTUALS: Mutual[] = [
  { id: "m1", name: "Maya Chen", avatar: null, sharedEvents: 14, attended: 41, hosted: 6 },
  { id: "m2", name: "Sam Okafor", avatar: null, sharedEvents: 12, attended: 38, hosted: 3 },
  { id: "m3", name: "Jordan Lee", avatar: null, sharedEvents: 11, attended: 33, hosted: 9 },
  { id: "m4", name: "Priya Nair", avatar: null, sharedEvents: 9, attended: 27, hosted: 2 },
  { id: "m5", name: "Dev Patel", avatar: null, sharedEvents: 9, attended: 25, hosted: 1 },
  { id: "m6", name: "Alex Rivera", avatar: null, sharedEvents: 7, attended: 22, hosted: 4 },
  { id: "m7", name: "Nina Torres", avatar: null, sharedEvents: 7, attended: 19, hosted: 0 },
  { id: "m8", name: "Chris Wong", avatar: null, sharedEvents: 6, attended: 18, hosted: 2 },
  { id: "m9", name: "Bella Ross", avatar: null, sharedEvents: 6, attended: 15, hosted: 5 },
  { id: "m10", name: "Omar Haddad", avatar: null, sharedEvents: 5, attended: 14, hosted: 1 },
  { id: "m11", name: "Zoe Kim", avatar: null, sharedEvents: 5, attended: 13, hosted: 0 },
  { id: "m12", name: "Tyler Brooks", avatar: null, sharedEvents: 4, attended: 12, hosted: 3 },
  { id: "m13", name: "Lena Vogel", avatar: null, sharedEvents: 4, attended: 11, hosted: 1 },
  { id: "m14", name: "Marcus Bell", avatar: null, sharedEvents: 3, attended: 9, hosted: 0 },
  { id: "m15", name: "Ivy Zhang", avatar: null, sharedEvents: 3, attended: 8, hosted: 2 },
];

export interface EventGuest {
  id: string;
  name: string;
  avatar: string | null;
  status: string;
}

export interface PartifulEvent {
  eventId: string;
  url: string;
  title: string;
  when: string | null;
  going: number;
  maybe: number;
  invited: number;
  guests: EventGuest[];
}

/** Fetch a real Partiful event's live details + guest list by URL or id. */
export async function fetchEvent(urlOrId: string): Promise<PartifulEvent | null> {
  try {
    const res = await fetch(`/api/event?url=${encodeURIComponent(urlOrId)}`, {
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    return json.ok ? (json.event as PartifulEvent) : null;
  } catch {
    return null;
  }
}

/** Best-effort real create; returns the event on success, or null to fall back. */
export async function createRealEvent(
  title: string,
  when: string,
  location: string,
  userIdsToInvite: string[],
): Promise<PartifulEvent | null> {
  try {
    const res = await fetch("/api/create-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, when, location, userIdsToInvite }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    return json.ok ? (json.event as PartifulEvent) : null;
  } catch {
    return null;
  }
}

export async function fetchMutuals(limit = 15): Promise<MutualsResult> {
  try {
    const res = await fetch(`/api/mutuals?limit=${limit}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const json = await res.json();
    if (json.connected && Array.isArray(json.mutuals) && json.mutuals.length > 0) {
      return { connected: true, mutuals: json.mutuals };
    }
    return { connected: false, mutuals: MOCK_MUTUALS.slice(0, limit), error: json.error };
  } catch (e) {
    return {
      connected: false,
      mutuals: MOCK_MUTUALS.slice(0, limit),
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
