export const TILE = 16;
export const COLS = 32;
export const ROWS = 22;
export const W = COLS * TILE;
export const H = ROWS * TILE;

// walk "rails" — center of the main quad path, bottom path, and vertical path
export const MAIN_Y = 12 * TILE;
export const BOT_Y = 19.5 * TILE;
export const VERT_X = 16 * TILE;

export type Vibe = "study" | "gym" | "food" | "chaos";
export interface Pt {
  x: number;
  y: number;
}

export interface Building {
  id: string;
  name: string;
  vibe: Vibe;
  emoji: string;
  x: number;
  y: number;
  w: number;
  h: number;
  roof: string;
  roofDark: string;
  wall: string;
  bottom: boolean; // sits on the bottom rail
  base: number; // ambient non-friend occupancy
  openSpots: number | null; // open tables/racks, null = untracked
  isPublic: boolean; // private spaces never generate check-in notifications
  openMin: number; // opening time, minutes on the campus clock
  closeMin: number; // closing time, minutes on the campus clock
  dropIn: boolean; // shows up in the "open now" drop-in list
}

export type Tile = "grass" | "path" | "tree" | "water" | "flower" | "rim";

export interface Friend {
  id: string;
  name: string;
  email: string;
  shirt: string;
  hair: string;
  hobbies: Hobby[];
  state: "inside" | "walking";
  buildingId: string;
  targetId: string | null;
  pos: Pt;
  route: Pt[];
  routeI: number;
  nextMoveAt: number;
  prefs: Record<string, number>; // buildingId -> weight
}

export type Hobby =
  | "climbing" | "film" | "salsa" | "robotics"
  | "gaming" | "music" | "food" | "fitness";

export const HOBBIES: Hobby[] = [
  "climbing", "film", "salsa", "robotics", "gaming", "music", "food", "fitness",
];

export interface Club {
  id: string;
  name: string;
  hobby: Hobby;
  emoji: string;
  email: string;
  members: number;
  color: string;
}

/** A club or brand activation that appears at a building for a limited window. */
export interface PopUp {
  id: string;
  hostId: string;
  hostName: string;
  kind: "club" | "brand";
  title: string;
  perk: string;
  buildingId: string;
  startsAt: number;
  endsAt: number;
  emoji: string;
  color: string;
  hobby: Hobby;
  rsvps: string[]; // friend ids
  live: boolean;
  done: boolean;
}

export interface Player {
  pos: Pt;
  state: "idle" | "walking" | "inside";
  buildingId: string | null;
  route: Pt[];
  routeI: number;
  ghost: boolean;
}

export type WorldEvent =
  | { type: "arrive"; friendId: string; buildingId: string }
  | { type: "depart"; friendId: string; buildingId: string }
  | { type: "playerArrive"; buildingId: string }
  | { type: "popupStart"; popUpId: string }
  | { type: "popupEnd"; popUpId: string }
  | { type: "nearby"; friendId: string; popUpId: string };

const SPEED = 52; // px per second

const HM = (h: number, m = 0) => h * 60 + m;

export const BUILDINGS: Building[] = [
  {
    id: "gym", name: "Rec Gym", vibe: "gym", emoji: "\u{1F4AA}",
    x: 2, y: 2, w: 7, h: 5,
    roof: "#5b6273", roofDark: "#454b59", wall: "#8d93a3",
    bottom: false, base: 3, openSpots: 4,
    isPublic: true, openMin: HM(6), closeMin: HM(23), dropIn: true,
  },
  {
    id: "pods", name: "Study Pods", vibe: "study", emoji: "\u{1F4DA}",
    x: 13, y: 2, w: 6, h: 4,
    roof: "#4caf6d", roofDark: "#37804f", wall: "#e8ddc0",
    bottom: false, base: 1, openSpots: 3,
    isPublic: true, openMin: HM(8), closeMin: HM(17), dropIn: true,
  },
  {
    id: "library", name: "Moffitt 3rd", vibe: "study", emoji: "\u{1F4DA}",
    x: 23, y: 2, w: 7, h: 6,
    roof: "#4a7fd6", roofDark: "#355d9e", wall: "#e8ddc0",
    bottom: false, base: 5, openSpots: 2,
    isPublic: true, openMin: HM(8), closeMin: HM(24), dropIn: true,
  },
  {
    id: "dining", name: "Dining Hall", vibe: "food", emoji: "\u{1F355}",
    x: 2, y: 13, w: 7, h: 5,
    roof: "#d65a4a", roofDark: "#9e3f35", wall: "#f0e2c8",
    bottom: true, base: 4, openSpots: null,
    isPublic: true, openMin: HM(7), closeMin: HM(20), dropIn: true,
  },
  {
    id: "dorms", name: "Dorms", vibe: "chaos", emoji: "\u{1F6CF}\u{FE0F}",
    x: 18, y: 15, w: 4, h: 3,
    roof: "#8a5bd6", roofDark: "#63409e", wall: "#e2d4ef",
    bottom: true, base: 2, openSpots: null,
    isPublic: false, openMin: HM(0), closeMin: HM(24), dropIn: false,
  },
  {
    id: "union", name: "Student Union", vibe: "chaos", emoji: "\u{1F389}",
    x: 23, y: 13, w: 7, h: 5,
    roof: "#e0913f", roofDark: "#a86a2b", wall: "#efe3cb",
    bottom: true, base: 2, openSpots: null,
    isPublic: true, openMin: HM(8), closeMin: HM(22), dropIn: true,
  },
];

export function fmtClock(min: number): string {
  const m = ((Math.floor(min) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(m % 60).padStart(2, "0");
  return `${h12}:${mm} ${h24 < 12 ? "AM" : "PM"}`;
}

export const HOBBY_EMOJI: Record<Hobby, string> = {
  climbing: "\u{1F9D7}",
  film: "\u{1F3AC}",
  salsa: "\u{1F483}",
  robotics: "\u{1F916}",
  gaming: "\u{1F3AE}",
  music: "\u{1F3B8}",
  food: "\u{1F32E}",
  fitness: "\u{1F3CB}\u{FE0F}",
};

export const SEED_CLUBS: Club[] = [
  { id: "climb", name: "Send It Climbing", hobby: "climbing", emoji: HOBBY_EMOJI.climbing, email: "climb@campus.edu", members: 84, color: "#ea580c" },
  { id: "cinema", name: "Midnight Cinema", hobby: "film", emoji: HOBBY_EMOJI.film, email: "cinema@campus.edu", members: 132, color: "#2563eb" },
  { id: "salsa", name: "Salsa Society", hobby: "salsa", emoji: HOBBY_EMOJI.salsa, email: "salsa@campus.edu", members: 57, color: "#db2777" },
  { id: "robo", name: "Robotics Lab", hobby: "robotics", emoji: HOBBY_EMOJI.robotics, email: "robo@campus.edu", members: 61, color: "#0d9488" },
];

export function buildingById(id: string): Building {
  return BUILDINGS.find((b) => b.id === id)!;
}

export function doorTile(b: Building): Pt {
  return { x: b.x + Math.floor(b.w / 2), y: b.y + b.h - 1 };
}

function doorOut(b: Building): Pt {
  const d = doorTile(b);
  return { x: (d.x + 0.5) * TILE, y: (b.y + b.h + 0.4) * TILE };
}

function anchorX(b: Building): number {
  return (doorTile(b).x + 0.5) * TILE;
}

// ---- tile map ----------------------------------------------------------

function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
}

export function buildTiles(): Tile[][] {
  const t: Tile[][] = [];
  for (let y = 0; y < ROWS; y++) {
    t.push(new Array<Tile>(COLS).fill("grass"));
  }
  const path = (x: number, y: number) => {
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) t[y][x] = "path";
  };
  // main quad path, bottom path, vertical path
  for (let x = 1; x <= 30; x++) { path(x, 11); path(x, 12); }
  for (let x = 3; x <= 28; x++) path(x, 19);
  for (let y = 1; y <= 19; y++) { path(15, y); path(16, y); }
  // plaza around the fountain
  for (let y = 9; y <= 14; y++) for (let x = 12; x <= 19; x++) path(x, y);
  // building spurs
  for (let y = 7; y <= 10; y++) path(5, y);
  for (let y = 8; y <= 10; y++) path(26, y);
  path(5, 18); path(26, 18); path(20, 18);
  // fountain
  t[10][13] = "water"; t[10][14] = "water";
  t[11][13] = "water"; t[11][14] = "water";
  t[9][13] = "rim"; t[9][14] = "rim";
  t[12][13] = "rim"; t[12][14] = "rim";
  // perimeter trees + scattered trees/flowers on grass
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (t[y][x] !== "grass") continue;
      const edge = x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1;
      const inBuilding = BUILDINGS.some(
        (b) => x >= b.x - 0 && x < b.x + b.w && y >= b.y - 1 && y < b.y + b.h,
      );
      if (inBuilding) continue;
      const h = hash(x, y);
      if (edge || h % 19 === 0) t[y][x] = "tree";
      else if (h % 13 === 0) t[y][x] = "flower";
    }
  }
  return t;
}

// ---- routing -----------------------------------------------------------

function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.5 || Math.abs(last.y - p.y) > 0.5) {
      out.push(p);
    }
  }
  return out;
}

/** Route along path rails from a start point (optionally leaving a building) to a target building's door. */
export function routeTo(start: Pt, from: Building | null, to: Building): Pt[] {
  const pts: Pt[] = [{ ...start }];
  let railY: number;
  if (from) {
    const out = doorOut(from);
    pts.push(out);
    railY = from.bottom ? BOT_Y : MAIN_Y;
    pts.push({ x: anchorX(from), y: railY });
  } else {
    railY = MAIN_Y;
    pts.push({ x: start.x, y: MAIN_Y });
  }
  const targetRail = to.bottom ? BOT_Y : MAIN_Y;
  if (railY !== targetRail) {
    pts.push({ x: VERT_X, y: railY });
    pts.push({ x: VERT_X, y: targetRail });
  }
  pts.push({ x: anchorX(to), y: targetRail });
  pts.push(doorOut(to));
  return dedupe(pts);
}

// ---- world -------------------------------------------------------------

export class World {
  tiles = buildTiles();
  buildings = BUILDINGS;
  friends: Friend[];
  clubs: Club[] = [...SEED_CLUBS];
  popUps: PopUp[] = [];
  player: Player;
  events: WorldEvent[] = [];
  /** campus clock in minutes; runs at 1 sim-minute per real second */
  clockMin = 16 * 60 + 20;
  private driftAt = 0;
  private forced: { at: number; friendId: string; targetId: string }[] = [];
  private seenNearby = new Set<string>();
  private popUpSeq = 0;
  private clubSeq = 0;

  constructor(now: number) {
    const mk = (
      id: string, name: string, email: string, shirt: string, hair: string,
      buildingId: string, firstMoveIn: number, hobbies: Hobby[],
      prefs: Record<string, number>,
    ): Friend => ({
      id, name, email, shirt, hair, hobbies,
      state: "inside", buildingId, targetId: null,
      pos: doorOut(buildingById(buildingId)),
      route: [], routeI: 0,
      nextMoveAt: now + firstMoveIn,
      prefs,
    });
    this.friends = [
      mk("maya", "Maya", "maya@campus.edu", "#e04a4a", "#2a1b12", "dining", 999999, ["fitness", "climbing"], { gym: 5, dining: 1, union: 1 }),
      mk("dev", "Dev", "dev@campus.edu", "#4a7fd6", "#111318", "library", 14000, ["robotics", "gaming"], { library: 4, pods: 2, dining: 1 }),
      mk("sam", "Sam", "sam@campus.edu", "#3fae62", "#5b3a1e", "dining", 20000, ["food", "music"], { dining: 2, union: 2, gym: 1, dorms: 3 }),
      mk("priya", "Priya", "priya@campus.edu", "#9a5bd6", "#17111e", "pods", 26000, ["film", "robotics"], { pods: 3, library: 2, union: 1 }),
      mk("jordan", "Jordan", "jordan@campus.edu", "#e0913f", "#3d2c16", "union", 32000, ["salsa", "music"], { union: 3, dining: 2, gym: 1 }),
    ];
    this.player = {
      pos: { x: 18 * TILE, y: 13.5 * TILE },
      state: "idle", buildingId: null,
      route: [], routeI: 0, ghost: false,
    };
    // demo beat: Maya heads to the gym a few seconds in
    this.forced.push({ at: now + 4500, friendId: "maya", targetId: "gym" });

    // brand activations + a club night, staggered so the map fills up on camera
    this.schedulePopUp({
      hostId: "monster", hostName: "Monster Energy", kind: "brand",
      title: "Monster recruiting table", perk: "Free cans + campus rep applications",
      buildingId: "union", emoji: "\u{1F49A}", color: "#65d02f", hobby: "gaming",
      startsAt: now + 9000, endsAt: now + 249000,
    });
    this.schedulePopUp({
      hostId: "celsius", hostName: "Celsius", kind: "brand",
      title: "Celsius sampling booth", perk: "Cold cans at the front desk",
      buildingId: "gym", emoji: "\u{1F964}", color: "#38bdf8", hobby: "fitness",
      startsAt: now + 20000, endsAt: now + 260000,
    });
    this.schedulePopUp({
      hostId: "cinema", hostName: "Midnight Cinema", kind: "club",
      title: "Rooftop screening sign-ups", perk: "Popcorn + free ticket for first 20",
      buildingId: "pods", emoji: HOBBY_EMOJI.film, color: "#2563eb", hobby: "film",
      startsAt: now + 34000, endsAt: now + 274000,
    });
  }

  // ---- clubs & pop-ups --------------------------------------------------

  addClub(input: { name: string; hobby: Hobby; email: string }): Club {
    const club: Club = {
      id: `club-${++this.clubSeq}`,
      name: input.name,
      hobby: input.hobby,
      emoji: HOBBY_EMOJI[input.hobby],
      email: input.email,
      members: 1,
      color: "#ea580c",
    };
    this.clubs.push(club);
    return club;
  }

  schedulePopUp(input: Omit<PopUp, "id" | "rsvps" | "live" | "done">): PopUp {
    const popUp: PopUp = { ...input, id: `pop-${++this.popUpSeq}`, rsvps: [], live: false, done: false };
    this.popUps.push(popUp);
    return popUp;
  }

  livePopUps(): PopUp[] {
    return this.popUps.filter((p) => p.live && !p.done);
  }

  popUpAt(buildingId: string): PopUp | undefined {
    return this.livePopUps().find((p) => p.buildingId === buildingId);
  }

  /** Friends inside the pop-up's building, or walking within a tile or two of its door. */
  friendsNear(popUp: PopUp): Friend[] {
    const b = buildingById(popUp.buildingId);
    const door = doorOut(b);
    return this.friends.filter((f) =>
      (f.state === "inside" && f.buildingId === popUp.buildingId) ||
      (f.state === "walking" && Math.hypot(f.pos.x - door.x, f.pos.y - door.y) < TILE * 3),
    );
  }

  friendsInside(buildingId: string): Friend[] {
    return this.friends.filter((f) => f.state === "inside" && f.buildingId === buildingId);
  }

  isOpen(b: Building): boolean {
    return this.clockMin >= b.openMin && this.clockMin < b.closeMin;
  }

  /** minutes until close; null if closed or 24h */
  minutesToClose(b: Building): number | null {
    if (!this.isOpen(b) || (b.openMin === 0 && b.closeMin === 24 * 60)) return null;
    return Math.round(b.closeMin - this.clockMin);
  }

  displayOccupancy(b: Building): number {
    let n = b.base + this.friendsInside(b.id).length;
    if (this.player.state === "inside" && this.player.buildingId === b.id) n += 1;
    return n;
  }

  sendPlayerTo(buildingId: string) {
    // already inside — nothing to walk
    if (this.player.state === "inside" && this.player.buildingId === buildingId) return;
    const to = buildingById(buildingId);
    const from =
      this.player.state === "inside" && this.player.buildingId
        ? buildingById(this.player.buildingId)
        : null;
    this.player.route = routeTo(this.player.pos, from, to);
    this.player.routeI = 0;
    this.player.state = "walking";
    this.player.buildingId = buildingId;
  }

  private pickTarget(f: Friend): string {
    let entries = Object.entries(f.prefs).filter(
      ([id]) => id !== f.buildingId && this.isOpen(buildingById(id)),
    );
    if (entries.length === 0) entries = Object.entries(f.prefs).filter(([id]) => id !== f.buildingId);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [id, w] of entries) {
      r -= w;
      if (r <= 0) return id;
    }
    return entries[0][0];
  }

  private startWalk(f: Friend, targetId: string) {
    const from = buildingById(f.buildingId);
    f.route = routeTo(f.pos, from, buildingById(targetId));
    f.routeI = 0;
    f.targetId = targetId;
    f.state = "walking";
    this.events.push({ type: "depart", friendId: f.id, buildingId: f.buildingId });
  }

  private advance(pos: Pt, route: Pt[], routeI: number, dist: number): { routeI: number; done: boolean } {
    let remaining = dist;
    let i = routeI;
    while (remaining > 0 && i < route.length) {
      const t = route[i];
      const dx = t.x - pos.x;
      const dy = t.y - pos.y;
      const d = Math.hypot(dx, dy);
      if (d <= remaining) {
        pos.x = t.x;
        pos.y = t.y;
        remaining -= d;
        i++;
      } else {
        pos.x += (dx / d) * remaining;
        pos.y += (dy / d) * remaining;
        remaining = 0;
      }
    }
    return { routeI: i, done: i >= route.length };
  }

  tick(dt: number, now: number) {
    this.clockMin += dt; // 1 sim-minute per real second
    // scripted moves
    for (const s of this.forced.filter((s) => now >= s.at)) {
      const f = this.friends.find((x) => x.id === s.friendId)!;
      if (f.state === "inside" && f.buildingId !== s.targetId) this.startWalk(f, s.targetId);
    }
    this.forced = this.forced.filter((s) => now < s.at);

    for (const f of this.friends) {
      if (f.state === "inside" && now >= f.nextMoveAt) {
        this.startWalk(f, this.pickTarget(f));
      } else if (f.state === "walking") {
        const r = this.advance(f.pos, f.route, f.routeI, SPEED * dt);
        f.routeI = r.routeI;
        if (r.done) {
          f.state = "inside";
          f.buildingId = f.targetId!;
          f.targetId = null;
          f.nextMoveAt = now + 18000 + Math.random() * 30000;
          this.events.push({ type: "arrive", friendId: f.id, buildingId: f.buildingId });
        }
      }
    }

    if (this.player.state === "walking") {
      const r = this.advance(this.player.pos, this.player.route, this.player.routeI, SPEED * dt);
      this.player.routeI = r.routeI;
      if (r.done) {
        this.player.state = "inside";
        this.events.push({ type: "playerArrive", buildingId: this.player.buildingId! });
      }
    }

    // pop-up lifecycle
    for (const p of this.popUps) {
      if (p.done) continue;
      if (!p.live && now >= p.startsAt) {
        p.live = true;
        this.events.push({ type: "popupStart", popUpId: p.id });
      } else if (p.live && now >= p.endsAt) {
        p.done = true;
        this.events.push({ type: "popupEnd", popUpId: p.id });
      }
    }

    // proximity: someone from the circle is standing where a pop-up is happening
    for (const p of this.livePopUps()) {
      for (const f of this.friendsNear(p)) {
        const key = `${p.id}:${f.id}`;
        if (this.seenNearby.has(key)) continue;
        this.seenNearby.add(key);
        this.events.push({ type: "nearby", friendId: f.id, popUpId: p.id });
      }
    }

    // ambient occupancy / open-spot drift; closed buildings empty out
    if (now >= this.driftAt) {
      this.driftAt = now + 6000;
      for (const b of this.buildings) {
        if (!this.isOpen(b)) {
          b.base = Math.max(0, b.base - 2);
          continue;
        }
        b.base = Math.max(0, Math.min(9, b.base + (Math.random() < 0.5 ? -1 : 1)));
        if (b.openSpots !== null) {
          b.openSpots = Math.max(0, Math.min(6, b.openSpots + (Math.random() < 0.5 ? -1 : 1)));
        }
      }
    }
  }

  drainEvents(): WorldEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
