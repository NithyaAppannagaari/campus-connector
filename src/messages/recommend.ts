import { FRIEND_NAMES, HISTORY } from "./history";
import {
  CandidateEvent, CATEGORY_META, CreatorCategory, Decision,
  EventCategory, EventRecord, EventSource, Recommendation,
} from "./types";

const OUTCOME_VALUE = { joined: 1, "left-early": 0.4, skipped: 0 } as const;

const SOURCE_TRUST: Record<EventSource, number> = {
  partiful: 0.9,
  luma: 0.85,
  handshake: 0.8,
  doorlist: 0.7,
};

/** Recency-weighted attend rate for a category. */
export function categoryAffinity(history: EventRecord[], category: EventCategory): number {
  const records = history.filter((r) => r.category === category);
  if (records.length === 0) return 0.3; // neutral prior
  let num = 0;
  let den = 0;
  for (const r of records) {
    const w = 1 / (1 + r.daysAgo / 14);
    num += OUTCOME_VALUE[r.outcome] * w;
    den += w;
  }
  return num / den;
}

/** never gym after 9, weeknight parties past 10:30 get penalized, etc. */
function timeFit(category: EventCategory, hour: number): number {
  if (category === "gym") return hour <= 21 ? 1 : 0.1;
  if (category === "party") return hour <= 22 ? 1 : 0.35;
  if (category === "recruiting") return hour >= 10 && hour <= 19 ? 1 : 0.5;
  return 0.9;
}

/** How many times each friend co-attended events of a category with you. */
export function coAttendCounts(history: EventRecord[], category: EventCategory): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of history) {
    if (r.category !== category || r.outcome === "skipped") continue;
    for (const id of r.attendedWith) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

function autoInviteList(history: EventRecord[], event: CandidateEvent): string[] {
  if (event.category === "party") {
    // the recurring crew: co-attended 2+ parties
    const counts = coAttendCounts(history, "party");
    return Object.keys(counts).filter((id) => counts[id] >= 2);
  }
  if (event.category === "sports") {
    // anyone who plays: co-attended 1+ sports events, ranked by count
    const counts = coAttendCounts(history, "sports");
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }
  return []; // gym pings buddies but never invites for you; personal lanes never do
}

function decide(category: EventCategory, score: number, fit: number): Decision {
  if (score < 0.25) return "silent";
  // pop-ups and brand drops are time-boxed: push or nothing
  if (category === "popup" || category === "brand") return "push";
  // personal / low-urgency lanes never push
  if (category === "hobby" || category === "club" || category === "recruiting") return "digest";
  let d: Decision = score >= 0.6 ? "push" : score >= 0.35 ? "digest" : "silent";
  // outside your time window: demote one tier (11 PM frat -> muted)
  if (fit < 0.5) d = d === "push" ? "digest" : "silent";
  return d;
}

export function recommend(
  history: EventRecord[],
  candidates: CandidateEvent[],
): Recommendation[] {
  return candidates.map((event) => {
    const aff = categoryAffinity(history, event.category);
    const overlap = Math.min(1, event.friendsGoing.length / 3);
    const fit = timeFit(event.category, event.hour);
    const trust = SOURCE_TRUST[event.source];
    const score = 0.4 * aff + 0.3 * overlap + 0.2 * fit + 0.1 * trust;

    const parts: string[] = [];
    if (event.friendsGoing.length > 0) parts.push(`${event.friendsGoing.length} of your people in`);
    parts.push(`${Math.round(aff * 100)}% ${CATEGORY_META[event.category].label.toLowerCase()} hit rate`);
    if (fit < 0.5) parts.push(`${event.hour > 12 ? event.hour - 12 : event.hour} ${event.hour >= 12 ? "PM" : "AM"} is outside your window`);

    return {
      event,
      score,
      decision: decide(event.category, score, fit),
      autoInvite: autoInviteList(history, event),
      reason: parts.join(" \u{00B7} "),
    };
  });
}

/** Crew the Partiful creator pre-fills, computed from co-attendance. */
export function crewFor(category: CreatorCategory): string[] {
  if (category === "party") {
    const counts = coAttendCounts(HISTORY, "party");
    return Object.keys(counts).filter((id) => counts[id] >= 2);
  }
  if (category === "sports") {
    const counts = coAttendCounts(HISTORY, "sports");
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }
  if (category === "popup") {
    const counts = {
      ...coAttendCounts(HISTORY, "popup"),
      ...coAttendCounts(HISTORY, "brand"),
    };
    return Object.keys(counts);
  }
  // hangout: top overall co-attenders
  const total: Record<string, number> = {};
  for (const r of HISTORY) {
    if (r.outcome === "skipped") continue;
    for (const id of r.attendedWith) total[id] = (total[id] ?? 0) + 1;
  }
  return Object.keys(total).sort((a, b) => total[b] - total[a]).slice(0, 3);
}

export function names(ids: string[]): string {
  return ids.map((id) => FRIEND_NAMES[id] ?? id).join(", ");
}
