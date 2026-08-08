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
}

export type Tile = "grass" | "path" | "tree" | "water" | "flower" | "rim";

export interface Friend {
  id: string;
  name: string;
  shirt: string;
  hair: string;
  state: "inside" | "walking";
  buildingId: string;
  targetId: string | null;
  pos: Pt;
  route: Pt[];
  routeI: number;
  nextMoveAt: number;
  prefs: Record<string, number>; // buildingId -> weight
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
  | { type: "playerArrive"; buildingId: string };

const SPEED = 52; // px per second

export const BUILDINGS: Building[] = [
  {
    id: "gym", name: "Rec Gym", vibe: "gym", emoji: "\u{1F4AA}",
    x: 2, y: 2, w: 7, h: 5,
    roof: "#5b6273", roofDark: "#454b59", wall: "#8d93a3",
    bottom: false, base: 3, openSpots: null,
  },
  {
    id: "pods", name: "Study Pods", vibe: "study", emoji: "\u{1F4DA}",
    x: 13, y: 2, w: 6, h: 4,
    roof: "#4caf6d", roofDark: "#37804f", wall: "#e8ddc0",
    bottom: false, base: 1, openSpots: 3,
  },
  {
    id: "library", name: "Moffitt 3rd", vibe: "study", emoji: "\u{1F4DA}",
    x: 23, y: 2, w: 7, h: 6,
    roof: "#4a7fd6", roofDark: "#355d9e", wall: "#e8ddc0",
    bottom: false, base: 5, openSpots: 2,
  },
  {
    id: "dining", name: "Dining Hall", vibe: "food", emoji: "\u{1F355}",
    x: 2, y: 13, w: 7, h: 5,
    roof: "#d65a4a", roofDark: "#9e3f35", wall: "#f0e2c8",
    bottom: true, base: 4, openSpots: null,
  },
  {
    id: "union", name: "Student Union", vibe: "chaos", emoji: "\u{1F389}",
    x: 23, y: 13, w: 7, h: 5,
    roof: "#e0913f", roofDark: "#a86a2b", wall: "#efe3cb",
    bottom: true, base: 2, openSpots: null,
  },
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
  path(5, 18); path(26, 18);
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
  player: Player;
  events: WorldEvent[] = [];
  private driftAt = 0;
  private forced: { at: number; friendId: string; targetId: string }[] = [];

  constructor(now: number) {
    const mk = (
      id: string, name: string, shirt: string, hair: string,
      buildingId: string, firstMoveIn: number, prefs: Record<string, number>,
    ): Friend => ({
      id, name, shirt, hair,
      state: "inside", buildingId, targetId: null,
      pos: doorOut(buildingById(buildingId)),
      route: [], routeI: 0,
      nextMoveAt: now + firstMoveIn,
      prefs,
    });
    this.friends = [
      mk("maya", "Maya", "#e04a4a", "#2a1b12", "dining", 999999, { gym: 5, dining: 1, union: 1 }),
      mk("dev", "Dev", "#4a7fd6", "#111318", "library", 14000, { library: 4, pods: 2, dining: 1 }),
      mk("sam", "Sam", "#3fae62", "#5b3a1e", "dining", 20000, { dining: 2, union: 2, gym: 1 }),
      mk("priya", "Priya", "#9a5bd6", "#17111e", "pods", 26000, { pods: 3, library: 2, union: 1 }),
      mk("jordan", "Jordan", "#e0913f", "#3d2c16", "union", 32000, { union: 3, dining: 2, gym: 1 }),
    ];
    this.player = {
      pos: { x: 18 * TILE, y: 13.5 * TILE },
      state: "idle", buildingId: null,
      route: [], routeI: 0, ghost: false,
    };
    // demo beat: Maya heads to the gym a few seconds in
    this.forced.push({ at: now + 4500, friendId: "maya", targetId: "gym" });
  }

  friendsInside(buildingId: string): Friend[] {
    return this.friends.filter((f) => f.state === "inside" && f.buildingId === buildingId);
  }

  displayOccupancy(b: Building): number {
    let n = b.base + this.friendsInside(b.id).length;
    if (this.player.state === "inside" && this.player.buildingId === b.id) n += 1;
    return n;
  }

  sendPlayerTo(buildingId: string) {
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
    const entries = Object.entries(f.prefs).filter(([id]) => id !== f.buildingId);
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

    // ambient occupancy / open-spot drift
    if (now >= this.driftAt) {
      this.driftAt = now + 6000;
      for (const b of this.buildings) {
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
