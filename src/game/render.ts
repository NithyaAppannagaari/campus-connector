import {
  Building, COLS, Pt, ROWS, TILE, Vibe, World, doorTile,
} from "./world";

const VIBE_COLOR: Record<Vibe, string> = {
  study: "#4a7fd6",
  gym: "#e04a4a",
  food: "#e0913f",
  chaos: "#c94ad6",
};

function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
}

// ---- tiles -------------------------------------------------------------

function drawGrass(ctx: CanvasRenderingContext2D, px: number, py: number, tx: number, ty: number) {
  ctx.fillStyle = "#7ec850";
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = "#72b849";
  for (let i = 0; i < 4; i++) {
    const h = hash(tx * 4 + i, ty);
    ctx.fillRect(px + (h % 14), py + ((h >> 4) % 14), 2, 1);
  }
}

function drawPath(ctx: CanvasRenderingContext2D, px: number, py: number, tx: number, ty: number) {
  ctx.fillStyle = "#e3cf9e";
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = "#d4bd85";
  for (let i = 0; i < 3; i++) {
    const h = hash(tx * 3 + i + 99, ty);
    ctx.fillRect(px + (h % 13), py + ((h >> 3) % 13), 2, 2);
  }
}

function drawWater(ctx: CanvasRenderingContext2D, px: number, py: number, time: number, tx: number, ty: number) {
  ctx.fillStyle = "#3f74c9";
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = "#6fa0e8";
  const phase = Math.floor(time / 450 + tx + ty) % 3;
  ctx.fillRect(px + 2, py + 3 + phase, 5, 1);
  ctx.fillRect(px + 9, py + 9 + ((phase + 1) % 3), 5, 1);
}

function drawRim(ctx: CanvasRenderingContext2D, px: number, py: number) {
  ctx.fillStyle = "#aeb6c4";
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = "#8d93a3";
  ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
  ctx.fillStyle = "#c6cdd8";
  ctx.fillRect(px + 2, py + 2, 4, 2);
}

function drawTree(ctx: CanvasRenderingContext2D, px: number, py: number, tx: number, ty: number) {
  drawGrass(ctx, px, py, tx, ty);
  ctx.fillStyle = "#6b4423";
  ctx.fillRect(px + 6, py + 10, 4, 5);
  ctx.fillStyle = "#2e7d3a";
  ctx.fillRect(px + 2, py + 2, 12, 9);
  ctx.fillStyle = "#3c9c4a";
  ctx.fillRect(px + 3, py + 1, 10, 4);
  ctx.fillRect(px + 2, py + 4, 5, 4);
  ctx.fillStyle = "#256330";
  ctx.fillRect(px + 10, py + 7, 4, 4);
}

function drawFlower(ctx: CanvasRenderingContext2D, px: number, py: number, tx: number, ty: number) {
  drawGrass(ctx, px, py, tx, ty);
  const h = hash(tx, ty * 7);
  ctx.fillStyle = h % 2 ? "#e85d75" : "#f2d94e";
  ctx.fillRect(px + 3, py + 4, 3, 3);
  ctx.fillRect(px + 10, py + 9, 3, 3);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(px + 4, py + 5, 1, 1);
  ctx.fillRect(px + 11, py + 10, 1, 1);
}

// ---- buildings ---------------------------------------------------------

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

  // wall
  ctx.fillStyle = b.wall;
  ctx.fillRect(px, py + roofH, pw, wallH);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(px, py + roofH, pw, 2);
  // stone texture for the gym (dungeon vibes)
  if (b.id === "gym") {
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < b.w * 2; col++) {
        const off = row % 2 ? 4 : 0;
        ctx.fillRect(px + col * 8 + off, py + roofH + row * 8 + 7, 7, 1);
      }
    }
  }

  // roof with shading stripes
  ctx.fillStyle = b.roof;
  ctx.fillRect(px, py, pw, roofH);
  ctx.fillStyle = b.roofDark;
  for (let i = 0; i < roofH; i += 6) ctx.fillRect(px, py + i, pw, 2);
  ctx.fillRect(px, py + roofH - 3, pw, 3);
  // roof ridge highlight
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(px, py, pw, 2);

  // windows — lit count follows occupancy
  const occ = world.displayOccupancy(b);
  const winCount = b.w - 2;
  const wy = py + roofH + 5;
  for (let i = 0; i < winCount; i++) {
    const wx = px + TILE * (i + 1) + 3;
    const lit = i < occ;
    ctx.fillStyle = "#2b2f3d";
    ctx.fillRect(wx - 1, wy - 1, 10, 10);
    ctx.fillStyle = lit ? "#ffd94e" : "#4a5468";
    ctx.fillRect(wx, wy, 8, 8);
    ctx.fillStyle = lit ? "#fff3b8" : "#5c687e";
    ctx.fillRect(wx, wy, 3, 3);
  }

  // door
  const d = doorTile(b);
  const dx = d.x * TILE;
  const dy = (b.y + b.h) * TILE - 14;
  ctx.fillStyle = "#2b2f3d";
  ctx.fillRect(dx + 2, dy - 2, 12, 16);
  ctx.fillStyle = b.id === "gym" ? "#3d2c16" : "#8a5a2b";
  ctx.fillRect(dx + 3, dy - 1, 10, 15);
  ctx.fillStyle = "#ffd94e";
  ctx.fillRect(dx + 11, dy + 6, 1, 2);

  // torches for the gym
  if (b.id === "gym") {
    const flicker = Math.floor(time / 200) % 2;
    for (const tx of [dx - 6, dx + 18]) {
      ctx.fillStyle = "#6b4423";
      ctx.fillRect(tx, dy + 2, 2, 8);
      ctx.fillStyle = flicker ? "#ff9b3d" : "#ffd94e";
      ctx.fillRect(tx - 1, dy - 2, 4, 4);
    }
  }

  // name plate
  ctx.font = "7px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  const nx = px + pw / 2;
  const ny = py + roofH - 5;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  const tw = ctx.measureText(b.name).width;
  ctx.fillRect(nx - tw / 2 - 3, ny - 8, tw + 6, 11);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(b.name, nx, ny);

  if (selected) {
    ctx.strokeStyle = "#ffd94e";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px - 2, py - 2, pw + 4, ph + 4);
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

// ---- main draw ---------------------------------------------------------

export function draw(
  ctx: CanvasRenderingContext2D,
  world: World,
  time: number,
  selectedId: string | null,
) {
  ctx.imageSmoothingEnabled = false;

  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const px = tx * TILE;
      const py = ty * TILE;
      switch (world.tiles[ty][tx]) {
        case "grass": drawGrass(ctx, px, py, tx, ty); break;
        case "path": drawPath(ctx, px, py, tx, ty); break;
        case "water": drawWater(ctx, px, py, time, tx, ty); break;
        case "rim": drawRim(ctx, px, py); break;
        case "tree": drawTree(ctx, px, py, tx, ty); break;
        case "flower": drawFlower(ctx, px, py, tx, ty); break;
      }
    }
  }

  // fountain spray
  const fx = 14 * TILE;
  const fy = 10.5 * TILE;
  ctx.fillStyle = "#cfe3ff";
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
      pos: pl.pos, shirt: "#f2d94e", hair: "#17111e",
      ghost: pl.ghost, label: "You", moving: pl.state === "walking",
    });
  }
  walkers.sort((a, b) => a.pos.y - b.pos.y);
  for (const w of walkers) {
    const frame = w.moving ? Math.floor(time / 160) % 2 : 0;
    drawPerson(ctx, w.pos, w.shirt, w.hair, frame, w.ghost, w.label);
  }

  for (const b of world.buildings) drawBubble(ctx, b, world, time);
}
