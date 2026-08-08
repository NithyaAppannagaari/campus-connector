import { CandidateEvent, EventRecord } from "./types";

export const FRIEND_NAMES: Record<string, string> = {
  maya: "Maya",
  dev: "Dev",
  sam: "Sam",
  priya: "Priya",
  jordan: "Jordan",
};

/** Matches the sprite palette on the map. */
export const FRIEND_COLORS: Record<string, string> = {
  maya: "#e04a4a",
  dev: "#4a7fd6",
  sam: "#3fae62",
  priya: "#9a5bd6",
  jordan: "#e0913f",
};

export const NAME_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(FRIEND_NAMES).map(([id, name]) => [name, FRIEND_COLORS[id]]),
);

/**
 * Mock imported event history — stands in for OAuth imports from
 * Partiful / Luma / Doorlist / Handshake. Shaped so real importers can
 * replace this file without touching the recommender.
 */
export const HISTORY: EventRecord[] = [
  // parties — the recurring watch-party crew is maya/sam/jordan
  { source: "partiful", category: "party", title: "Severance S3 watch party", attendedWith: ["maya", "sam", "jordan"], outcome: "joined", daysAgo: 7, hour: 20 },
  { source: "partiful", category: "party", title: "March Madness finale", attendedWith: ["maya", "sam", "jordan", "dev"], outcome: "joined", daysAgo: 21, hour: 18 },
  { source: "partiful", category: "party", title: "Priya's birthday thing", attendedWith: ["priya", "maya", "sam"], outcome: "joined", daysAgo: 30, hour: 21 },
  { source: "doorlist", category: "party", title: "Sig Chi darty", attendedWith: ["jordan"], outcome: "left-early", daysAgo: 14, hour: 23 },
  { source: "doorlist", category: "party", title: "KDPhi mixer", attendedWith: [], outcome: "skipped", daysAgo: 10, hour: 23 },

  // gym — maya is the established gym buddy
  { source: "luma", category: "gym", title: "6 AM lift club", attendedWith: ["maya"], outcome: "joined", daysAgo: 2, hour: 18 },
  { source: "luma", category: "gym", title: "Leg day", attendedWith: ["maya"], outcome: "joined", daysAgo: 5, hour: 18 },
  { source: "luma", category: "gym", title: "Late night pump", attendedWith: ["jordan"], outcome: "skipped", daysAgo: 9, hour: 22 },

  // sports — dev + jordan are the racket/ball crew
  { source: "doorlist", category: "sports", title: "Pickleball run", attendedWith: ["dev", "jordan"], outcome: "joined", daysAgo: 4, hour: 17 },
  { source: "doorlist", category: "sports", title: "Pickup basketball @ RSF", attendedWith: ["jordan"], outcome: "joined", daysAgo: 11, hour: 19 },
  { source: "doorlist", category: "sports", title: "Pickleball run", attendedWith: ["dev"], outcome: "joined", daysAgo: 18, hour: 17 },

  // hobbies — joins some, never with pressure
  { source: "luma", category: "hobby", title: "Board game night", attendedWith: ["priya", "dev"], outcome: "joined", daysAgo: 6, hour: 19 },
  { source: "luma", category: "hobby", title: "Film photography walk", attendedWith: ["priya"], outcome: "joined", daysAgo: 20, hour: 15 },
  { source: "luma", category: "hobby", title: "Chess club casual", attendedWith: [], outcome: "skipped", daysAgo: 12, hour: 19 },

  // clubs — attends GMs of one club, skips cold outreach
  { source: "luma", category: "club", title: "ML @ Berkeley GM", attendedWith: ["dev"], outcome: "joined", daysAgo: 8, hour: 19 },
  { source: "luma", category: "club", title: "Consulting club infosession", attendedWith: [], outcome: "skipped", daysAgo: 15, hour: 19 },

  // pop-ups / brand drops — high hit rate when nearby
  { source: "luma", category: "popup", title: "Surprise boba cart @ Sproul", attendedWith: ["sam"], outcome: "joined", daysAgo: 3, hour: 13 },
  { source: "luma", category: "brand", title: "Celsius sampling tent", attendedWith: ["jordan", "sam"], outcome: "joined", daysAgo: 13, hour: 12 },

  // recruiting — personal lane, decent attendance
  { source: "handshake", category: "recruiting", title: "Jane Street tech talk", attendedWith: [], outcome: "joined", daysAgo: 16, hour: 18 },
  { source: "handshake", category: "recruiting", title: "Generic career fair", attendedWith: [], outcome: "left-early", daysAgo: 25, hour: 14 },
];

/** Upcoming events the recommender scores when the demo runs. */
export const CANDIDATES: CandidateEvent[] = [
  {
    id: "watchparty",
    source: "partiful",
    category: "party",
    title: "F1 watch party @ Union",
    when: "Tonight 8 PM",
    hour: 20,
    friendsGoing: ["maya", "sam", "jordan", "priya"],
    demoAt: 10000,
  },
  {
    id: "pickleball",
    source: "doorlist",
    category: "sports",
    title: "Pickleball @ RSF courts",
    when: "Today 5 PM",
    hour: 17,
    friendsGoing: ["dev", "jordan"],
    spotsNeeded: 1,
    demoAt: 24000,
  },
  {
    id: "celsius",
    source: "luma",
    category: "brand",
    title: "Celsius drop @ Sproul steps",
    when: "NOW, 20 min only",
    hour: 12,
    friendsGoing: ["sam"],
    demoAt: 50000,
    expiresInSec: 60,
  },
  {
    id: "boardgames",
    source: "luma",
    category: "hobby",
    title: "Board game night @ Study Pods",
    when: "Tomorrow 7 PM",
    hour: 19,
    friendsGoing: ["priya"],
    demoAt: 2000,
  },
  {
    id: "mlclub",
    source: "luma",
    category: "club",
    title: "ML @ Berkeley GM #6",
    when: "Wed 7 PM",
    hour: 19,
    friendsGoing: ["dev"],
    demoAt: 2000,
  },
  {
    id: "janestreet",
    source: "handshake",
    category: "recruiting",
    title: "Jane Street coffee chat",
    when: "Fri 4 PM",
    hour: 16,
    friendsGoing: [],
    demoAt: 2000,
  },
  {
    id: "frat",
    source: "doorlist",
    category: "party",
    title: "Sig Chi Thursday",
    when: "Thu 11 PM",
    hour: 23,
    friendsGoing: ["jordan"],
    demoAt: 2000,
  },
];
