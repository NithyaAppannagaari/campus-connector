import {
  Building, COLS, Pt, ROWS, TILE, Tile, Vibe, W, World, doorTile,
} from "./world";

const VIBE_COLOR: Record<Vibe, string> = {
  study: "#4a7fd6",
  gym: "#e04a4a",
  food: "#e0913f",
  chaos: "#c94ad6",
};

// cozy village palette
const GRASS = "#7ec850";
const GRASS_LIGHT = "#8dd75f";
const GRASS_DARK = "#6db347";
const PATH_A = "#e9d49c";
const PATH_B = "#e0c88a";
const PATH_SPECK = "#cfb373";
const PATH_EDGE = "#c2a266";
const WATER = "#38b2cd";
const WATER_DEEP = "#2c94ac";
const WATER_LIGHT = "#8fe3ef";
const STONE = "#9b9280";
const STONE_DARK = "#776f5e";
const STONE_LIGHT = "#b8af9a";
const TRUNK = "#5f4126";
const TRUNK_DARK = "#472f18";
const LEAF_0 = "#2f6b27";
const LEAF_1 = "#3f9433";
const LEAF_2 = "#57b03f";
const LEAF_3 = "#7bcb58";
const WOOD_DARK = "#3a2716";
const WOOD = "#8a5a2b";
const CREAM = "#f7ecd1";

function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
}

// ---- ground tiles --------------------------------------------------------

function drawGrass(ctx: CanvasRenderingContext2D, px: number, py: number, tx: number, ty: number) {
  // blocky two-tone patches, like mowed lawn chunks
  const chunk = hash(tx >> 1, ty >> 1);
  ctx.fillStyle = chunk % 4 === 0 ? GRASS_LIGHT : GRASS;
  ctx.fillRect(px, py, TILE, TILE);
  // grass blade specks
  ctx.fillStyle = GRASS_DARK;
  for (let i = 0; i < 3; i++) {
    const h = hash(tx * 4 + i, ty * 2 + i);
    ctx.fillRect(px + (h % 14), py + ((h >> 4) % 13), 1, 2);
  }
  // occasional tiny white/yellow speck (clover)
  const h2 = hash(tx * 7, ty * 11);
  if (h2 % 9 === 0) {
    ctx.fillStyle = h2 % 2 ? "#f4f0d8" : "#e8d96a";
    ctx.fillRect(px + (h2 % 12) + 1, py + ((h2 >> 5) % 12) + 1, 1, 1);
  }
}

function isPathy(t: Tile | undefined): boolean {
  return t === "path" || t === "rim" || t === "water";
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  px: number, py: number, tx: number, ty: number,
  tiles: Tile[][],
) {
  // checkered sand slabs
  ctx.fillStyle = (tx + ty) % 2 ? PATH_A : PATH_B;
  ctx.fillRect(px, py, TILE, TILE);
  // pebbles
  ctx.fillStyle = PATH_SPECK;
  for (let i = 0; i < 2; i++) {
    const h = hash(tx * 3 + i + 99, ty * 5 + i);
    ctx.fillRect(px + (h % 12) + 1, py + ((h >> 3) % 12) + 1, 2, 1);
  }
  // darker rounded border where the path meets grass
  ctx.fillStyle = PATH_EDGE;
  if (!isPathy(tiles[ty - 1]?.[tx])) ctx.fillRect(px, py, TILE, 2);
  if (!isPathy(tiles[ty + 1]?.[tx])) ctx.fillRect(px, py + TILE - 2, TILE, 2);
  if (!isPathy(tiles[ty]?.[tx - 1])) ctx.fillRect(px, py, 2, TILE);
  if (!isPathy(tiles[ty]?.[tx + 1])) ctx.fillRect(px + TILE - 2, py, 2, TILE);
}

function drawWater(ctx: CanvasRenderingContext2D, px: number, py: number, time: number, tx: number, ty: number) {
  ctx.fillStyle = WATER;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = WATER_DEEP;
  ctx.fillRect(px, py + TILE - 4, TILE, 4);
  // drifting ripple dashes
  ctx.fillStyle = WATER_LIGHT;
  const phase = Math.floor(time / 420 + tx + ty) % 3;
  ctx.fillRect(px + 2, py + 3 + phase, 6, 1);
  ctx.fillRect(px + 9, py + 8 + ((phase + 1) % 3), 5, 1);
  // sparkle
  if ((Math.floor(time / 600) + tx * 3 + ty) % 5 === 0) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px + 4 + ((tx * 5) % 8), py + 5, 1, 1);
  }
}

function drawRim(ctx: CanvasRenderingContext2D, px: number, py: number) {
  // chunky stone blocks with mortar gaps
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = STONE;
  ctx.fillRect(px + 1, py + 1, 6, 6);
  ctx.fillRect(px + 9, py + 1, 6, 6);
  ctx.fillRect(px + 1, py + 9, 6, 6);
  ctx.fillRect(px + 9, py + 9, 6, 6);
  ctx.fillStyle = STONE_LIGHT;
  ctx.fillRect(px + 1, py + 1, 4, 2);
  ctx.fillRect(px + 9, py + 9, 4, 2);
}

// ---- decorations (drawn after the ground so they can overhang) ------------

function drawTree(ctx: CanvasRenderingContext2D, px: number, py: number, tx: number, ty: number) {
  const h = hash(tx * 3, ty * 5);
  const v = h % 3;
  const deep = h % 5 === 0; // some trees are darker for variety
  const c0 = deep ? "#255420" : LEAF_0;
  const c1 = deep ? "#31752a" : LEAF_1;
  const c2 = deep ? "#448d33" : LEAF_2;
  const c3 = deep ? "#5ea944" : LEAF_3;
  // ground shadow + trunk
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(px + 3, py + 13, 10, 2);
  ctx.fillStyle = TRUNK;
  ctx.fillRect(px + 6, py + 7, 4, 8);
  ctx.fillStyle = TRUNK_DARK;
  ctx.fillRect(px + 9, py + 7, 1, 8);
  // rounded layered canopy, overhangs the tile
  ctx.fillStyle = c0;
  ctx.fillRect(px - 2, py - 1 + v, 20, 9 - v);
  ctx.fillRect(px, py - 4, 16, 5 + v);
  ctx.fillRect(px + 2, py - 6, 12, 2);
  ctx.fillRect(px, py + 8, 16, 2);
  ctx.fillRect(px + 3, py + 10, 10, 1);
  // side lobes
  ctx.fillRect(px - 1, py - 3, 4, 4);
  ctx.fillRect(px + 13, py - 3, 4, 4);
  ctx.fillStyle = c1;
  ctx.fillRect(px - 1, py - 1, 18, 8);
  ctx.fillRect(px + 1, py - 4, 14, 4);
  ctx.fillRect(px + 3, py - 5, 10, 1);
  ctx.fillStyle = c2;
  ctx.fillRect(px + v, py - 3, 12, 7);
  ctx.fillRect(px + 2 + v, py - 4, 8, 2);
  // highlight clusters
  ctx.fillStyle = c3;
  ctx.fillRect(px + 2 + v, py - 4, 4, 2);
  ctx.fillRect(px + 8, py - 2, 5, 2);
  ctx.fillRect(px + 3, py + 1, 3, 2);
  ctx.fillRect(px + 10 - v, py + 3, 3, 1);
  // dark dapple under the lobes
  ctx.fillStyle = c0;
  ctx.fillRect(px + 4 + v, py + 5, 3, 2);
  ctx.fillRect(px + 10, py + 6, 4, 2);
}

function drawBush(ctx: CanvasRenderingContext2D, px: number, py: number, tx: number, ty: number) {
  const h = hash(tx * 9, ty * 13);
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.fillRect(px + 3, py + 12, 10, 2);
  ctx.fillStyle = LEAF_0;
  ctx.fillRect(px + 2, py + 5, 12, 8);
  ctx.fillRect(px + 4, py + 3, 8, 3);
  ctx.fillStyle = LEAF_1;
  ctx.fillRect(px + 3, py + 5, 10, 6);
  ctx.fillRect(px + 5, py + 4, 6, 2);
  ctx.fillStyle = LEAF_2;
  ctx.fillRect(px + 4, py + 5, 4, 2);
  ctx.fillRect(px + 9, py + 7, 3, 2);
  // some bushes carry berries or autumn tones
  if (h % 3 === 0) {
    ctx.fillStyle = h % 2 ? "#e05c4a" : "#e8a03e";
    ctx.fillRect(px + 5, py + 8, 2, 2);
    ctx.fillRect(px + 10, py + 5, 2, 2);
  }
}

function drawFlower(ctx: CanvasRenderingContext2D, px: number, py: number, tx: number, ty: number) {
  const h = hash(tx, ty * 7);
  const colors = ["#e8607a", "#f2d94e", "#ef8b3e", "#f4f0e2"];
  ctx.fillStyle = colors[h % colors.length];
  ctx.fillRect(px + 3, py + 4, 3, 3);
  ctx.fillRect(px + 10, py + 9, 3, 3);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(px + 4, py + 5, 1, 1);
  ctx.fillRect(px + 11, py + 10, 1, 1);
  ctx.fillStyle = GRASS_DARK;
  ctx.fillRect(px + 4, py + 7, 1, 2);
  ctx.fillRect(px + 11, py + 12, 1, 2);
}

// ---- buildings -------------------------------------------------------------

function drawShingleRoof(
  ctx: CanvasRenderingContext2D,
  px: number, py: number, pw: number, roofH: number,
  roof: string, roofDark: string,
) {
  const ox = 3; // eaves overhang past the walls
  const rx = px - ox;
  const rw = pw + ox * 2;
  // dark outline + base
  ctx.fillStyle = roofDark;
  ctx.fillRect(rx, py, rw, roofH);
  ctx.fillStyle = roof;
  ctx.fillRect(rx + 1, py + 2, rw - 2, roofH - 5);
  // shingle rows with alternating notches
  for (let ry = 6, row = 0; ry < roofH - 3; ry += 5, row++) {
    ctx.fillStyle = roofDark;
    ctx.fillRect(rx + 1, py + ry, rw - 2, 1);
    const off = row % 2 ? 4 : 0;
    for (let cx = 4 + off; cx < rw - 3; cx += 8) {
      ctx.fillRect(rx + cx, py + ry - 4, 1, 4);
    }
  }
  // ridge cap highlight + eave shadow
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(rx + 1, py + 1, rw - 2, 2);
  ctx.fillStyle = roofDark;
  ctx.fillRect(rx, py + roofH - 3, rw, 3);
}

function drawChimney(ctx: CanvasRenderingContext2D, cx: number, cy: number, time: number) {
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(cx - 1, cy - 1, 10, 10);
  ctx.fillStyle = STONE;
  ctx.fillRect(cx, cy, 8, 8);
  ctx.fillStyle = STONE_LIGHT;
  ctx.fillRect(cx, cy, 8, 2);
  ctx.fillStyle = "#2b2118";
  ctx.fillRect(cx + 2, cy + 3, 4, 3);
  // drifting smoke puffs
  for (let i = 0; i < 3; i++) {
    const t = (time / 2400 + i / 3) % 1;
    const s = 2 + t * 4;
    ctx.fillStyle = `rgba(235,235,230,${(0.5 * (1 - t)).toFixed(2)})`;
    ctx.fillRect(cx + 4 - s / 2 + Math.sin(t * 6 + i) * 3, cy - 4 - t * 16, s, s);
  }
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  b: Building,
  world: World,
  selected: boolean,
  time: number,
) {
  const px = b.x * TILE;
  const py = b.y * TILE;
  const pw = b.w * TILE;
  const ph = b.h * TILE;
  const wallH = TILE * 2;
  const roofH = ph - wallH;
  const wallY = py + roofH;

  // drop shadow on the grass
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(px - 2, py + ph - 2, pw + 6, 4);

  // wall
  ctx.fillStyle = b.wall;
  ctx.fillRect(px, wallY, pw, wallH);
  if (b.id === "gym") {
    // stone block texture
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < b.w * 2; col++) {
        const off = row % 2 ? 4 : 0;
        ctx.fillRect(px + col * 8 + off, wallY + row * 8 + 7, 7, 1);
      }
    }
  } else {
    // vertical plank seams
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    for (let sx = 8; sx < pw; sx += 8) ctx.fillRect(px + sx, wallY, 1, wallH);
    // horizontal timber beam
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.fillRect(px, wallY + 14, pw, 2);
  }
  // shadow under eaves, corner posts, foundation
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fillRect(px, wallY, pw, 3);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(px, wallY, 2, wallH);
  ctx.fillRect(px + pw - 2, wallY, 2, wallH);
  ctx.fillRect(px, py + ph - 2, pw, 2);

  // roof
  drawShingleRoof(ctx, px, py, pw, roofH, b.roof, b.roofDark);
  if (b.vibe === "food") drawChimney(ctx, px + pw - 16, py + 5, time);

  // windows — lit count follows occupancy
  const occ = world.displayOccupancy(b);
  const winCount = b.w - 2;
  const wy = wallY + 6;
  for (let i = 0; i < winCount; i++) {
    const wx = px + TILE * (i + 1) + 3;
    const lit = i < occ;
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(wx - 1, wy - 1, 10, 11);
    ctx.fillStyle = lit ? "#ffd94e" : "#57657c";
    ctx.fillRect(wx, wy, 8, 9);
    ctx.fillStyle = lit ? "#fff3b8" : "#6a7890";
    ctx.fillRect(wx, wy, 3, 4);
    // cross mullion + sill
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(wx + 3, wy, 1, 9);
    ctx.fillRect(wx, wy + 4, 8, 1);
    ctx.fillStyle = "#5a3d22";
    ctx.fillRect(wx - 2, wy + 9, 12, 2);
  }

  // door with wooden frame + stone step
  const d = doorTile(b);
  const dx = d.x * TILE;
  const dy = py + ph - 14;
  ctx.fillStyle = PATH_B;
  ctx.fillRect(dx + 1, py + ph - 2, 14, 3);
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(dx + 1, dy - 3, 14, 17);
  ctx.fillStyle = b.id === "gym" ? "#4a3520" : WOOD;
  ctx.fillRect(dx + 3, dy - 1, 10, 15);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(dx + 7, dy - 1, 1, 15);
  ctx.fillStyle = "#ffd94e";
  ctx.fillRect(dx + 11, dy + 6, 1, 2);

  // torches for the gym
  if (b.id === "gym") {
    const flicker = Math.floor(time / 200) % 2;
    for (const tx of [dx - 6, dx + 20]) {
      ctx.fillStyle = TRUNK;
      ctx.fillRect(tx, dy + 2, 2, 8);
      ctx.fillStyle = flicker ? "#ff9b3d" : "#ffd94e";
      ctx.fillRect(tx - 1, dy - 2, 4, 4);
    }
  }

  // hanging wooden sign
  ctx.font = "7px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  const nx = px + pw / 2;
  const ny = py + roofH - 5;
  const tw = ctx.measureText(b.name).width;
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(nx - tw / 2 - 4, ny - 9, tw + 8, 13);
  ctx.fillStyle = WOOD;
  ctx.fillRect(nx - tw / 2 - 3, ny - 8, tw + 6, 11);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(nx - tw / 2 - 3, ny - 8, tw + 6, 2);
  ctx.fillStyle = CREAM;
  ctx.fillText(b.name, nx, ny);

  if (selected) {
    ctx.strokeStyle = "#ffd94e";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px - 4, py - 2, pw + 8, ph + 4);
    ctx.setLineDash([]);
  }
}

function drawBubble(ctx: CanvasRenderingContext2D, b: Building, world: World, time: number) {
  const occ = world.displayOccupancy(b);
  const friends = world.friendsInside(b.id).length;
  const cx = (b.x + b.w / 2) * TILE;
  const cy = b.y * TILE - 14;
  const pulse = Math.sin(time / 400 + b.x) * 1.5;
  const r = 10 + Math.min(occ, 9) * 1.4 + pulse;
  const color = VIBE_COLOR[b.vibe];

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(b.emoji, cx, cy - 1);
  ctx.font = "7px 'Press Start 2P', monospace";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 2;
  ctx.strokeText(String(occ), cx, cy + 9);
  ctx.fillText(String(occ), cx, cy + 9);

  // friend count badge
  if (friends > 0) {
    ctx.fillStyle = "#ffd94e";
    ctx.beginPath();
    ctx.arc(cx + r - 1, cy - r + 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1d29";
    ctx.fillText(String(friends), cx + r - 1, cy - r + 6);
  }

  // dead zone marker
  if (occ <= 1) {
    ctx.font = "8px sans-serif";
    ctx.fillText("\u{1F4A4}", cx - r - 6, cy);
  }
}

// ---- sprites -----------------------------------------------------------

function drawPerson(
  ctx: CanvasRenderingContext2D,
  p: Pt,
  shirt: string,
  hair: string,
  frame: number,
  ghost: boolean,
  label?: string,
) {
  const x = Math.round(p.x) - 4;
  const y = Math.round(p.y) - 12;
  if (ghost) ctx.globalAlpha = 0.35;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x + 1, y + 12, 6, 2);
  // hair + head
  ctx.fillStyle = hair;
  ctx.fillRect(x + 1, y, 6, 2);
  ctx.fillRect(x, y + 1, 8, 2);
  ctx.fillStyle = "#f2c99a";
  ctx.fillRect(x + 1, y + 3, 6, 3);
  ctx.fillStyle = "#1a1d29";
  ctx.fillRect(x + 2, y + 4, 1, 1);
  ctx.fillRect(x + 5, y + 4, 1, 1);
  // body + arms
  ctx.fillStyle = shirt;
  ctx.fillRect(x + 1, y + 6, 6, 4);
  ctx.fillRect(x, y + 7, 1, 2);
  ctx.fillRect(x + 7, y + 7, 1, 2);
  // legs (2-frame walk)
  ctx.fillStyle = "#2b3a5e";
  if (frame === 0) {
    ctx.fillRect(x + 1, y + 10, 2, 2);
    ctx.fillRect(x + 5, y + 10, 2, 2);
  } else {
    ctx.fillRect(x + 2, y + 10, 2, 2);
    ctx.fillRect(x + 4, y + 10, 2, 2);
  }
  ctx.globalAlpha = 1;

  if (label) {
    ctx.font = "6px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 2;
    ctx.strokeText(label, x + 4, y - 3);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, x + 4, y - 3);
  }
}

// ---- clouds ----------------------------------------------------------------

const CLOUDS = [
  { y: 24, speed: 7, off: 0, s: 1.3 },
  { y: 148, speed: 5, off: 220, s: 1 },
  { y: 272, speed: 8.5, off: 420, s: 1.15 },
];

function drawClouds(ctx: CanvasRenderingContext2D, time: number) {
  for (const c of CLOUDS) {
    const x = ((time / 1000) * c.speed + c.off) % (W + 140) - 80;
    const s = c.s;
    // shadow cast on the ground
    ctx.fillStyle = "rgba(20,40,20,0.10)";
    ctx.fillRect(x + 10, c.y + 26, 52 * s, 12);
    ctx.fillRect(x + 20, c.y + 22, 28 * s, 6);
    // fluffy blocky cloud
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fillRect(x, c.y + 7, 54 * s, 12);
    ctx.fillRect(x + 7 * s, c.y + 2, 24 * s, 8);
    ctx.fillRect(x + 14 * s, c.y - 3, 16 * s, 6);
    ctx.fillRect(x + 32 * s, c.y + 3, 16 * s, 7);
    ctx.fillStyle = "rgba(206,221,232,0.96)";
    ctx.fillRect(x + 2, c.y + 15, 54 * s - 4, 4);
    ctx.fillRect(x + 8 * s, c.y + 8, 10, 3);
  }
}

// ---- main draw ---------------------------------------------------------

export function draw(
  ctx: CanvasRenderingContext2D,
  world: World,
  time: number,
  selectedId: string | null,
) {
  ctx.imageSmoothingEnabled = false;
  const tiles = world.tiles;

  // ground pass
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const px = tx * TILE;
      const py = ty * TILE;
      switch (tiles[ty][tx]) {
        case "path": drawPath(ctx, px, py, tx, ty, tiles); break;
        case "water": drawWater(ctx, px, py, time, tx, ty); break;
        case "rim": drawRim(ctx, px, py); break;
        default: drawGrass(ctx, px, py, tx, ty); break;
      }
    }
  }

  // decoration pass (row order so canopies overlap naturally)
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const px = tx * TILE;
      const py = ty * TILE;
      switch (tiles[ty][tx]) {
        case "tree": drawTree(ctx, px, py, tx, ty); break;
        case "bush": drawBush(ctx, px, py, tx, ty); break;
        case "flower": drawFlower(ctx, px, py, tx, ty); break;
      }
    }
  }

  // fountain spray
  const fx = 14 * TILE;
  const fy = 10.5 * TILE;
  ctx.fillStyle = "#d8f4fa";
  const sp = Math.floor(time / 250) % 3;
  ctx.fillRect(fx - 1, fy - 4 - sp * 2, 2, 3);
  ctx.fillRect(fx - 5, fy - 1 - ((sp + 1) % 3), 2, 2);
  ctx.fillRect(fx + 3, fy - 1 - ((sp + 2) % 3), 2, 2);

  for (const b of world.buildings) {
    drawBuilding(ctx, b, world, b.id === selectedId, time);
  }

  // walking sprites, sorted by y so lower ones draw on top
  const walkers: { pos: Pt; shirt: string; hair: string; ghost: boolean; label: string; moving: boolean }[] = [];
  for (const f of world.friends) {
    if (f.state === "walking") {
      walkers.push({ pos: f.pos, shirt: f.shirt, hair: f.hair, ghost: false, label: f.name, moving: true });
    }
  }
  const pl = world.player;
  if (pl.state !== "inside") {
    walkers.push({
      pos: pl.pos, shirt: pl.shirt, hair: pl.hair,
      ghost: pl.ghost, label: "You", moving: pl.state === "walking",
    });
  }
  walkers.sort((a, b) => a.pos.y - b.pos.y);
  for (const w of walkers) {
    const frame = w.moving ? Math.floor(time / 160) % 2 : 0;
    drawPerson(ctx, w.pos, w.shirt, w.hair, frame, w.ghost, w.label);
  }

  drawClouds(ctx, time);

  for (const b of world.buildings) drawBubble(ctx, b, world, time);
}
