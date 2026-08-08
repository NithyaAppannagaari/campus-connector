export const TILE = 16;
export const COLS = 48;
export const ROWS = 30;
export const W = COLS * TILE;
export const H = ROWS * TILE;

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
  base: number; // ambient non-friend occupancy
  openSpots: number | null; // open tables/racks, null = untracked
  isPublic: boolean; // private spaces never generate check-in notifications
  openMin: number; // opening time, minutes on the campus clock
  closeMin: number; // closing time, minutes on the campus clock
  dropIn: boolean; // shows up in the "open now" drop-in list
}

export type Tile = "grass" | "path" | "tree" | "water" | "flower" | "rim" | "bush";

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
  shirt: string;
  hair: string;
}

export type WorldEvent =
  | { type: "arrive"; friendId: string; buildingId: string }
  | { type: "depart"; friendId: string; buildingId: string }
  | { type: "playerArrive"; buildingId: string };

const SPEED = 52; // px per second

const HM = (h: number, m = 0) => h * 60 + m;

// The real Georgia Tech campus, Minecraft style. Positions follow the actual
// geography (north at the top): West Village and the CRC on west campus,
// Klaus and the CoC in central campus, Clough + Price Gilbert north of Tech
// Green, the Student Center and Kessler Campanile beside it, Tech Tower on
// the Hill, Brittain and Bobby Dodd down by North Ave, McCamish up NE.
export const BUILDINGS: Building[] = [
  // -- north of Ferst Dr ---------------------------------------------------
  {
    id: "westvillage", name: "West Village", vibe: "food", emoji: "\u{1F354}",
    x: 2, y: 4, w: 6, h: 5,
    roof: "#4b8fa8", roofDark: "#35687a", wall: "#e3d9c2",
    base: 3, openSpots: null,
    isPublic: true, openMin: HM(7), closeMin: HM(21), dropIn: true,
  },
  {
    id: "klaus", name: "Klaus", vibe: "study", emoji: "\u{1F4BB}",
    x: 15, y: 3, w: 7, h: 6,
    roof: "#3f5d78", roofDark: "#2c4256", wall: "#c9b8a0",
    base: 3, openSpots: 4,
    isPublic: true, openMin: HM(8), closeMin: HM(22), dropIn: true,
  },
  {
    id: "clough", name: "Clough (CULC)", vibe: "study", emoji: "\u{1F4DA}",
    x: 27, y: 4, w: 6, h: 5,
    roof: "#4caf6d", roofDark: "#37804f", wall: "#ccd6dc",
    base: 4, openSpots: 3,
    isPublic: true, openMin: HM(0), closeMin: HM(24), dropIn: true, // 24h, famously
  },
  {
    id: "library", name: "Price Gilbert", vibe: "study", emoji: "\u{1F4DA}",
    x: 34, y: 4, w: 6, h: 5,
    roof: "#2e4d7b", roofDark: "#1f3557", wall: "#e9e5d8",
    base: 5, openSpots: 2,
    isPublic: true, openMin: HM(8), closeMin: HM(24), dropIn: true,
  },
  {
    id: "mccamish", name: "McCamish", vibe: "gym", emoji: "\u{1F3C0}",
    x: 42, y: 3, w: 5, h: 6,
    roof: "#d8dde3", roofDark: "#aab3bf", wall: "#8d93a3",
    base: 2, openSpots: null,
    isPublic: true, openMin: HM(10), closeMin: HM(20), dropIn: false,
  },
  // -- between Ferst Dr and the mid walk ------------------------------------
  {
    id: "crc", name: "The CRC", vibe: "gym", emoji: "\u{1F4AA}",
    x: 2, y: 11, w: 7, h: 6,
    roof: "#5b6273", roofDark: "#454b59", wall: "#8d93a3",
    base: 3, openSpots: 4,
    isPublic: true, openMin: HM(6), closeMin: HM(23), dropIn: true,
  },
  {
    id: "studentcenter", name: "Student Center", vibe: "chaos", emoji: "\u{1F389}",
    x: 20, y: 12, w: 7, h: 5,
    roof: "#b3a369", roofDark: "#8a7c4d", wall: "#efe3cb",
    base: 2, openSpots: null,
    isPublic: true, openMin: HM(8), closeMin: HM(22), dropIn: true,
  },
  // -- south campus, along North Ave ----------------------------------------
  {
    id: "coc", name: "CoC", vibe: "study", emoji: "\u{1F4BB}",
    x: 8, y: 20, w: 6, h: 5,
    roof: "#6f7fb8", roofDark: "#4f5c8a", wall: "#d8cfc0",
    base: 2, openSpots: 5,
    isPublic: true, openMin: HM(8), closeMin: HM(20), dropIn: true,
  },
  {
    id: "ferst", name: "Ferst Center", vibe: "chaos", emoji: "\u{1F3AD}",
    x: 15, y: 20, w: 6, h: 5,
    roof: "#a84ad6", roofDark: "#7a35a0", wall: "#e8ddc0",
    base: 1, openSpots: null,
    isPublic: true, openMin: HM(12), closeMin: HM(22), dropIn: false,
  },
  {
    id: "dorms", name: "North Ave Apts", vibe: "chaos", emoji: "\u{1F6CF}\u{FE0F}",
    x: 22, y: 21, w: 5, h: 4,
    roof: "#8a5bd6", roofDark: "#63409e", wall: "#e2d4ef",
    base: 2, openSpots: null,
    isPublic: false, openMin: HM(0), closeMin: HM(24), dropIn: false,
  },
  {
    id: "brittain", name: "Brittain", vibe: "food", emoji: "\u{1F355}",
    x: 33, y: 20, w: 5, h: 5,
    roof: "#8f4b3d", roofDark: "#69352b", wall: "#c98a5e",
    base: 4, openSpots: null,
    isPublic: true, openMin: HM(7), closeMin: HM(20), dropIn: true,
  },
  {
    id: "stadium", name: "Bobby Dodd", vibe: "chaos", emoji: "\u{1F3C8}",
    x: 39, y: 19, w: 8, h: 6,
    roof: "#8d93a3", roofDark: "#5b6273", wall: "#8d93a3",
    base: 1, openSpots: null,
    isPublic: true, openMin: HM(9), closeMin: HM(17), dropIn: false,
  },
];

export function fmtClock(min: number): string {
  const m = ((Math.floor(min) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(m % 60).padStart(2, "0");
  return `${h12}:${mm} ${h24 < 12 ? "AM" : "PM"}`;
}

// Decorative landmarks (not enterable).
export const TECH_TOWER = { x: 29, y: 19, w: 3, h: 6 }; // on the Hill
export const TECH_GREEN = { x: 32, y: 11, w: 9, h: 6 };
export const POOL = { x: 28, y: 13 }; // Kessler Campanile pool (2x2)

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
  // east-west streets: Ferst Dr (north), the mid-campus walk, North Ave
  for (let x = 1; x <= 46; x++) {
    path(x, 9); path(x, 10);
    path(x, 17); path(x, 18);
    path(x, 25); path(x, 26);
  }
  // north-south connectors (Atlantic Dr / Cherry St / Techwood Dr feel)
  for (let y = 11; y <= 16; y++) { path(10, y); path(18, y); path(41, y); }
  for (let y = 19; y <= 24; y++) { path(3, y); path(14, y); path(27, y); path(38, y); }
  // Campanile plaza between the Student Center and Tech Green
  for (let y = 11; y <= 16; y++) for (let x = 27; x <= 31; x++) path(x, y);
  // diagonal-ish walk across Tech Green (kept as a straight cut)
  for (let x = 32; x <= 40; x++) path(x, 13);
  // Kessler Campanile reflecting pool
  t[POOL.y][POOL.x] = "water"; t[POOL.y][POOL.x + 1] = "water";
  t[POOL.y + 1][POOL.x] = "water"; t[POOL.y + 1][POOL.x + 1] = "water";
  t[POOL.y - 1][POOL.x] = "rim"; t[POOL.y - 1][POOL.x + 1] = "rim";
  t[POOL.y + 2][POOL.x] = "rim"; t[POOL.y + 2][POOL.x + 1] = "rim";
  // perimeter trees + scattered trees/flowers on grass
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (t[y][x] !== "grass") continue;
      const edge = x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1;
      const inBuilding = BUILDINGS.some(
        (b) => x >= b.x - 0 && x < b.x + b.w && y >= b.y - 1 && y < b.y + b.h,
      );
      if (inBuilding) continue;
      const inTower =
        x >= TECH_TOWER.x - 1 && x < TECH_TOWER.x + TECH_TOWER.w + 1 &&
        y >= TECH_TOWER.y - 1 && y < TECH_TOWER.y + TECH_TOWER.h + 1;
      if (inTower) continue;
      const inGreen =
        x >= TECH_GREEN.x && x < TECH_GREEN.x + TECH_GREEN.w &&
        y >= TECH_GREEN.y && y < TECH_GREEN.y + TECH_GREEN.h;
      const h = hash(x, y);
      if (edge || (!inGreen && h % 19 === 0)) t[y][x] = "tree";
      else if (!inGreen && h % 23 === 0) t[y][x] = "bush";
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

// walkability grid, built once (the map is static)
let WALK: boolean[][] | null = null;
function walkGrid(): boolean[][] {
  if (!WALK) WALK = buildTiles().map((row) => row.map((c) => c === "path"));
  return WALK;
}

interface TileXY { x: number; y: number }

function tileOf(p: Pt): TileXY {
  return {
    x: Math.max(0, Math.min(COLS - 1, Math.floor(p.x / TILE))),
    y: Math.max(0, Math.min(ROWS - 1, Math.floor(p.y / TILE))),
  };
}

/** BFS over street tiles. The start may be off-path (a doorway); expansion only enters path tiles. */
function bfsPath(from: TileXY, to: TileXY): TileXY[] {
  const walk = walkGrid();
  const key = (x: number, y: number) => y * COLS + x;
  const prev = new Map<number, number>();
  const goal = key(to.x, to.y);
  const queue: number[] = [key(from.x, from.y)];
  prev.set(queue[0], -1);
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi];
    if (k === goal) break;
    const x = k % COLS;
    const y = (k - x) / COLS;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (!walk[ny][nx]) continue;
      const nk = key(nx, ny);
      if (prev.has(nk)) continue;
      prev.set(nk, k);
      queue.push(nk);
    }
  }
  if (!prev.has(goal)) return [to]; // shouldn't happen: all doors face a street
  const out: TileXY[] = [];
  for (let k = goal; k !== -1; k = prev.get(k)!) {
    const x = k % COLS;
    out.push({ x, y: (k - x) / COLS });
  }
  return out.reverse();
}

/** Drop intermediate tiles that continue in the same direction, keeping corners. */
function corners(tiles: TileXY[]): TileXY[] {
  const out: TileXY[] = [];
  for (let i = 0; i < tiles.length; i++) {
    if (i === 0 || i === tiles.length - 1) {
      out.push(tiles[i]);
      continue;
    }
    const a = tiles[i - 1];
    const b = tiles[i];
    const c = tiles[i + 1];
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) out.push(b);
  }
  return out;
}

/** Route along campus streets from a start point (optionally leaving a building) to a target building's door. */
export function routeTo(start: Pt, from: Building | null, to: Building): Pt[] {
  const pts: Pt[] = [{ ...start }];
  let cur = start;
  if (from) {
    cur = doorOut(from);
    pts.push(cur);
  }
  const goal = doorOut(to);
  for (const t of corners(bfsPath(tileOf(cur), tileOf(goal)))) {
    pts.push({ x: (t.x + 0.5) * TILE, y: (t.y + 0.5) * TILE });
  }
  pts.push(goal);
  return dedupe(pts);
}

// ---- world -------------------------------------------------------------

export class World {
  tiles = buildTiles();
  buildings = BUILDINGS;
  friends: Friend[];
  player: Player;
  events: WorldEvent[] = [];
  /** campus clock in minutes; runs at 1 sim-minute per real second */
  clockMin = 16 * 60 + 20;
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
      mk("maya", "Maya", "#e04a4a", "#2a1b12", "brittain", 999999, { crc: 5, brittain: 1, studentcenter: 1 }),
      mk("dev", "Dev", "#4a7fd6", "#111318", "library", 14000, { library: 4, clough: 2, klaus: 2, coc: 1 }),
      mk("sam", "Sam", "#3fae62", "#5b3a1e", "brittain", 20000, { brittain: 2, westvillage: 2, studentcenter: 2, crc: 1, dorms: 3 }),
      mk("priya", "Priya", "#9a5bd6", "#17111e", "clough", 26000, { clough: 3, library: 2, coc: 2, klaus: 1 }),
      mk("jordan", "Jordan", "#e0913f", "#3d2c16", "studentcenter", 32000, { studentcenter: 3, stadium: 2, ferst: 1, brittain: 1 }),
    ];
    this.player = {
      pos: { x: 30.5 * TILE, y: 15.5 * TILE }, // Campanile plaza
      state: "idle", buildingId: null,
      route: [], routeI: 0, ghost: false,
      shirt: "#f2d94e", hair: "#17111e",
    };
    // demo beat: Maya heads to the CRC a few seconds in
    this.forced.push({ at: now + 4500, friendId: "maya", targetId: "crc" });
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
