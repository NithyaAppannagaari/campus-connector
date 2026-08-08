import type { Vibe } from "./game/world";

export interface AvatarColors {
  shirt: string;
  hair: string;
}

export interface UserProfile {
  name: string;
  avatar: AvatarColors;
  /** 0 (pass) .. 3 (love) per vibe */
  vibeWeights: Record<Vibe, number>;
  /** selected rhythm chip ids, see RHYTHM_CHIPS */
  rhythms: string[];
  privacy: {
    ghostByDefault: boolean;
    serendipityOptIn: boolean;
  };
  onboardedAt: number;
}

const STORAGE_KEY = "cm.profile.v1";

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as UserProfile;
    if (!p || typeof p.name !== "string" || !p.vibeWeights) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveProfile(p: UserProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function clearProfile() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---- catalogs ------------------------------------------------------------

export const SHIRT_PALETTE = [
  "#f2d94e", "#e04a4a", "#4a7fd6", "#3fae62", "#9a5bd6", "#e0913f",
];

export const HAIR_PALETTE = [
  "#17111e", "#2a1b12", "#5b3a1e", "#8a5a2b", "#d9a441", "#9aa1bd",
];

export interface RhythmChip {
  id: string;
  label: string;
  /** short fragment used in the preference-graph summary */
  summary: string;
  /** true when the chip describes a social preference (used for Luma copy) */
  social?: boolean;
}

export const RHYTHM_CHIPS: RhythmChip[] = [
  { id: "morning-deep-work", label: "Deep work mornings", summary: "deep work AM" },
  { id: "social-weeknights", label: "Social weeknights", summary: "social weeknights", social: true },
  { id: "late-night-grind", label: "Late-night grind", summary: "late-night grind" },
  { id: "weekend-hangs", label: "Weekend hangs", summary: "weekend hangs", social: true },
  { id: "lunch-crew", label: "Lunch with the crew", summary: "lunch w/ crew", social: true },
  { id: "no-gym-late", label: "Never gym after 9", summary: "never gym after 9" },
];

export const VIBE_META: Record<Vibe, { emoji: string; label: string }> = {
  study: { emoji: "\u{1F4DA}", label: "Study" },
  gym: { emoji: "\u{1F4AA}", label: "Gym" },
  food: { emoji: "\u{1F355}", label: "Food" },
  chaos: { emoji: "\u{1F389}", label: "Chaos" },
};

export const VIBE_ORDER: Vibe[] = ["study", "gym", "food", "chaos"];

// ---- derived reads ---------------------------------------------------------

export function topVibe(p: UserProfile): Vibe {
  let best: Vibe = "chaos";
  let bestW = -1;
  for (const v of VIBE_ORDER) {
    const w = p.vibeWeights[v] ?? 0;
    if (w > bestW) {
      best = v;
      bestW = w;
    }
  }
  return best;
}

const VIBE_READ: Record<Vibe, string> = {
  study: "\u{1F4DA} deep-work energy",
  gym: "\u{1F4AA} gym-rat energy",
  food: "\u{1F355} foodie energy",
  chaos: "\u{1F3B2} board-game energy",
};

export function vibeRead(p: UserProfile): string {
  return VIBE_READ[topVibe(p)];
}

/** Human-readable preference-graph line, e.g. "Study + chaos · deep work AM · never gym after 9." */
export function prefSummary(p: UserProfile): string {
  const liked = VIBE_ORDER
    .filter((v) => (p.vibeWeights[v] ?? 0) >= 2)
    .sort((a, b) => (p.vibeWeights[b] ?? 0) - (p.vibeWeights[a] ?? 0))
    .map((v) => VIBE_META[v].label.toLowerCase());
  const parts: string[] = [];
  if (liked.length > 0) {
    const cap = liked[0].charAt(0).toUpperCase() + liked[0].slice(1);
    parts.push([cap, ...liked.slice(1)].join(" + "));
  }
  for (const id of p.rhythms) {
    const chip = RHYTHM_CHIPS.find((c) => c.id === id);
    if (chip) parts.push(chip.summary);
  }
  if (parts.length === 0) return "Still learning your vibe \u2014 go join something.";
  return parts.join(" \u00B7 ") + ".";
}

/** First selected social rhythm chip, if any (used to justify Luma auto-RSVPs). */
export function socialRhythm(p: UserProfile): RhythmChip | null {
  for (const id of p.rhythms) {
    const chip = RHYTHM_CHIPS.find((c) => c.id === id);
    if (chip?.social) return chip;
  }
  return null;
}
