// Points + streaks for serendipity hangouts, persisted to localStorage.

export interface RewardsState {
  points: number;
  streak: number; // consecutive serendipity accepts; resets when one expires
  met: string[]; // persona ids you've already met (repeat meets earn less)
  lastGain: string | null;
}

const KEY = "connectmaxxer.rewards.v1";

export const DEFAULT_REWARDS: RewardsState = {
  points: 0,
  streak: 0,
  met: [],
  lastGain: null,
};

export function loadRewards(): RewardsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_REWARDS;
    return { ...DEFAULT_REWARDS, ...(JSON.parse(raw) as Partial<RewardsState>) };
  } catch {
    return DEFAULT_REWARDS;
  }
}

export function saveRewards(r: RewardsState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // storage unavailable — rewards just won't persist
  }
}

const BASE = 25;
const NEW_PERSON_BONUS = 15;
const STREAK_BONUS = 5;

/** Award points for accepting a serendipity hangout. */
export function awardAccept(
  r: RewardsState,
  peopleIds: string[],
): { next: RewardsState; gained: number; newPeople: number } {
  const newPeople = peopleIds.filter((id) => !r.met.includes(id)).length;
  const streak = r.streak + 1;
  const gained = BASE + newPeople * NEW_PERSON_BONUS + (streak - 1) * STREAK_BONUS;
  const next: RewardsState = {
    points: r.points + gained,
    streak,
    met: [...new Set([...r.met, ...peopleIds])],
    lastGain: `+${gained} (${newPeople} new ${newPeople === 1 ? "person" : "people"}${streak > 1 ? `, streak x${streak}` : ""})`,
  };
  return { next, gained, newPeople };
}

export function breakStreak(r: RewardsState): RewardsState {
  return { ...r, streak: 0 };
}
