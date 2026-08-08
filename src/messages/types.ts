export type EventSource = "partiful" | "luma" | "doorlist" | "handshake";

export type EventCategory =
  | "hobby"      // social hobbies: board games, photography walks
  | "gym"        // working out
  | "party"      // watch parties, frats, house parties
  | "sports"     // basketball, pickleball
  | "club"       // student club GMs and socials
  | "popup"      // spontaneous, time-boxed
  | "recruiting" // handshake info sessions, coffee chats
  | "brand";     // Monster / Celsius style activations

export const CATEGORY_META: Record<EventCategory, { label: string; icon: string }> = {
  hobby: { label: "Social Hobby", icon: "\u{1F3B2}" },
  gym: { label: "Workout", icon: "\u{1F4AA}" },
  party: { label: "Party", icon: "\u{1F389}" },
  sports: { label: "Sports", icon: "\u{1F3D3}" },
  club: { label: "Student Club", icon: "\u{1F3DB}\u{FE0F}" },
  popup: { label: "Pop-Up", icon: "\u{26A1}" },
  recruiting: { label: "Recruiting", icon: "\u{1F4BC}" },
  brand: { label: "Brand Drop", icon: "\u{1F964}" },
};

export const SOURCE_META: Record<EventSource, { label: string; color: string }> = {
  partiful: { label: "Partiful", color: "#ff66a3" },
  luma: { label: "Luma", color: "#b18cff" },
  doorlist: { label: "Doorlist", color: "#59d0ff" },
  handshake: { label: "Handshake", color: "#6fcf97" },
};

/** A past event pulled from a connected source. */
export interface EventRecord {
  source: EventSource;
  category: EventCategory;
  title: string;
  attendedWith: string[]; // friend ids
  outcome: "joined" | "skipped" | "left-early";
  daysAgo: number;
  hour: number; // 0-23 start hour
}

/** An upcoming event the recommender scores. */
export interface CandidateEvent {
  id: string;
  source: EventSource;
  category: EventCategory;
  title: string;
  when: string; // human label, e.g. "Tonight 8 PM"
  hour: number;
  friendsGoing: string[]; // friend ids
  spotsNeeded?: number; // sports quorum
  demoAt: number; // ms after load this candidate "arrives" in the demo
  expiresInSec?: number; // pop-ups / brand drops vanish
}

export type Decision = "push" | "digest" | "silent";

export interface Recommendation {
  event: CandidateEvent;
  score: number;
  decision: Decision;
  autoInvite: string[]; // friend ids the agent invites automatically
  reason: string; // shown to the user, keeps the engine explainable
}

export type NotifKind =
  | "presence"
  | "invite"
  | "quorum"
  | "popup"
  | "system";

export interface NotifAction {
  id: string;
  label: string;
}

export interface AppNotification {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  source?: EventSource;
  category?: EventCategory;
  expiresAt?: number; // epoch ms, countdown + auto-vanish
  ttlMs?: number; // original lifetime, drives the countdown bar
  actions?: NotifAction[];
}

export interface ThreadMessage {
  id: number;
  from: "agent" | "you" | string; // friend name otherwise
  text: string;
  at: number; // epoch ms
  /** delivery state for your/agent outgoing messages */
  status?: "sent" | "delivered" | "read";
}

/** Compact receipt chip on a thread: "Partiful RSVP", "GCal", ... */
export interface Receipt {
  id: number;
  label: string;
}

export interface LiveGuest {
  id: string;
  name: string;
  avatar: string | null;
  status: string; // GOING | MAYBE | INVITED | DECLINED | ...
}

/** A connected real Partiful event, polled for live RSVPs. */
export interface LiveEvent {
  url: string;
  eventId: string;
  title: string;
  when: string | null;
  going: number;
  maybe: number;
  invited: number;
  guests: LiveGuest[];
  updatedAt: number;
  loading: boolean;
  error?: string;
}

export interface Thread {
  id: string;
  title: string;
  source?: EventSource;
  category: EventCategory;
  messages: ThreadMessage[];
  receipts: Receipt[];
  typing: string | null; // friend name currently "typing"
  live?: LiveEvent; // connected real Partiful event
  invitees?: string[]; // real mutuals selected in the creator
}

export type CreatorCategory = "party" | "hangout" | "sports" | "popup";

export const CREATOR_META: Record<CreatorCategory, { label: string; icon: string }> = {
  party: { label: "Party", icon: "\u{1F389}" },
  hangout: { label: "Hangout", icon: "\u{1F9CB}" },
  sports: { label: "Sports", icon: "\u{1F3C0}" },
  popup: { label: "Pop-Up", icon: "\u{26A1}" },
};
