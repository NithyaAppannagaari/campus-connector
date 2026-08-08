// Notification + interest settings, persisted to localStorage.

export interface QuietHours {
  on: boolean;
  startMin: number; // campus-clock minutes
  endMin: number;
}

export interface Settings {
  notifsOn: boolean;
  quiet: QuietHours;
  mutedFriends: string[];
  mutedPlaces: string[];
  hobbies: string[]; // interests used for serendipity matching
}

export const ALL_HOBBIES = [
  "climbing",
  "board games",
  "basketball",
  "coffee",
  "photography",
  "pickleball",
];

const KEY = "connectmaxxer.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  notifsOn: true,
  quiet: { on: false, startMin: 22 * 60, endMin: 8 * 60 },
  mutedFriends: [],
  mutedPlaces: [],
  hobbies: ["climbing", "board games", "coffee"],
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable (private mode) — settings just won't persist
  }
}

export function inQuietHours(clockMin: number, q: QuietHours): boolean {
  if (!q.on) return false;
  const m = ((Math.floor(clockMin) % 1440) + 1440) % 1440;
  return q.startMin <= q.endMin
    ? m >= q.startMin && m < q.endMin
    : m >= q.startMin || m < q.endMin; // wraps past midnight
}

export type MuteReason = "master-off" | "quiet-hours" | "friend-muted" | "place-muted" | "private-space";

/** Decide whether a friend check-in should notify the user. */
export function checkNotify(
  s: Settings,
  clockMin: number,
  friendId: string,
  place: { id: string; isPublic: boolean },
): { ok: true } | { ok: false; reason: MuteReason } {
  if (!place.isPublic) return { ok: false, reason: "private-space" };
  if (!s.notifsOn) return { ok: false, reason: "master-off" };
  if (inQuietHours(clockMin, s.quiet)) return { ok: false, reason: "quiet-hours" };
  if (s.mutedFriends.includes(friendId)) return { ok: false, reason: "friend-muted" };
  if (s.mutedPlaces.includes(place.id)) return { ok: false, reason: "place-muted" };
  return { ok: true };
}
