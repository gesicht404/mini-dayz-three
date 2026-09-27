import { hashFloat, mulberry32 } from '../world/rng.js';
import { HERO } from './hero-data.js';

// Placeholder pixel art, drawn in code, styled after Mini DayZ: muted
// grey-green palette, canopies built from many small shaded leaf clumps,
// dark soft outlines. Every sprite is packed into one atlas canvas.
// To use real art later, replace a draw function with an image of the same
// name; the rest of the game only uses sprite names.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const ramp = (hexes) => hexes.map(rgb);

/** A tiny pixel buffer: set colours per pixel, add an outline, export a canvas. */
class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }

  set(x, y, color) {
    x |= 0;
    y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = color;
  }

  has(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.px[y * this.w + x] !== null;
  }

  rect(color, x, y, w, h) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, color);
  }

  /** Paint a 1 px border around everything drawn so far. */
  outline(color) {
    const add = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.has(x, y)) continue;
        if (this.has(x - 1, y) || this.has(x + 1, y) || this.has(x, y - 1) || this.has(x, y + 1)) add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], color);
  }

  toCanvas() {
    const c = makeCanvas(this.w, this.h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    this.px.forEach((p, i) => {
      if (!p) return;
      img.data[i * 4] = p[0];
      img.data[i * 4 + 1] = p[1];
      img.data[i * 4 + 2] = p[2];
      img.data[i * 4 + 3] = 255;
    });
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

/**
 * Paint leaf clumps. Each clump is shaded on its own (light from the top-left,
 * dark rim at the bottom-right), and lower clumps overlap higher ones, which
 * gives the lumpy "cauliflower" canopy look.
 */
function paintClumps(pix, clumps, rng, globalShade) {
  clumps.sort((a, b) => a.y - b.y);
  for (const c of clumps) {
    const pal = c.pal;
    c.base ??= 0.52;
    for (let y = Math.floor(c.y - c.r); y <= Math.ceil(c.y + c.r); y++) {
      for (let x = Math.floor(c.x - c.r); x <= Math.ceil(c.x + c.r); x++) {
        const nx = (x + 0.5 - c.x) / c.r;
        const ny = (y + 0.5 - c.y) / c.r;
        const d = Math.hypot(nx, ny);
        if (d > 1) continue;
        let s = c.base - nx * 0.22 - ny * 0.4 + globalShade(x, y) + (rng() - 0.5) * 0.28;
        if (d > 0.72 && nx + ny > 0.25) s -= 0.4;
        const i = Math.max(0, Math.min(pal.length - 1, Math.floor(s * pal.length)));
        pix.set(x, y, pal[i]);
      }
    }
  }
}

// ---------- Palettes (sampled to match the Mini DayZ look) ----------

const LEAF = ramp(['#262e22', '#36402d', '#48533c', '#5b664c', '#707b5e', '#879071']);
const LEAF_DARK = ramp(['#20281d', '#2f3829', '#3f4a36', '#515c46', '#667157']);
const AUTUMN = ramp(['#36251a', '#4f3522', '#68462c', '#825a38', '#9a7047', '#ae875c']);
const PINE = ramp(['#1f2922', '#29362c', '#354538', '#435545', '#546653']);
const GRASS = ramp(['#3d4428', '#535c33', '#69743f', '#808b4c', '#979f5d', '#abb170']);
const STONE = ramp(['#5c5a53', '#7a7870', '#99968d', '#b6b3a9', '#d0cdc3', '#e2dfd6']);
const BARK = { dark: rgb('#2f2620'), mid: rgb('#4f4235'), light: rgb('#6d5d4b') };
const OUTLINE = rgb('#1f2419');

// ---------- Trees ----------

function trunk(pix, cx, top, bottom) {
  for (let y = top; y < bottom; y++) {
    const wide = y > bottom - 3 ? 1 : 0;
    pix.set(cx - 2 - wide, y, BARK.dark);
    pix.set(cx - 1, y, BARK.light);
    pix.set(cx, y, BARK.mid);
    pix.set(cx + 1 + wide, y, BARK.dark);
    if (wide) {
      pix.set(cx - 2, y, BARK.mid);
      pix.set(cx + 1, y, BARK.mid);
    }
  }
}

function leafyTree(seed, palettes, w = 42, h = 56) {
  const rng = mulberry32(seed);
  const pix = new Pix(w, h);
  const cx = Math.floor(w / 2);
  const rx = w / 2 - 3;
  const ry = rx * 0.88;
  const cy = ry + 3;
  trunk(pix, cx, Math.floor(cy), h - 1);

  const pickPal = () => palettes[Math.floor(rng() * palettes.length)];
  const clumps = [];
  // Inner clumps fill the canopy...
  for (let i = 0; i < 36; i++) {
    const a = rng() * Math.PI * 2;
    const rr = Math.sqrt(rng()) * 0.7;
    clumps.push({ x: cx + Math.cos(a) * rx * rr, y: cy + Math.sin(a) * ry * rr, r: 3 + rng() * 2.5, pal: pickPal(), base: 0.46 });
  }
  // ...rim clumps make the silhouette lumpy.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rng() * 0.3;
    const rr = 0.78 + rng() * 0.12;
    clumps.push({ x: cx + Math.cos(a) * rx * rr, y: cy + Math.sin(a) * ry * rr, r: 3 + rng() * 1.8, pal: pickPal(), base: 0.46 });
  }
  paintClumps(pix, clumps, rng, (x, y) => -((y - cy) / ry) * 0.12 - ((x - cx) / rx) * 0.08);
  pix.outline(OUTLINE);
  return pix.toCanvas();
}

function pineTree(seed, w = 30, h = 60) {
  const rng = mulberry32(seed);
  const pix = new Pix(w, h);
  const cx = Math.floor(w / 2);
  const foliageBottom = h - 8;
  trunk(pix, cx, foliageBottom - 6, h - 1);

  const tiers = 5;
  const tierH = (foliageBottom - 1) / (tiers + 0.6);
  // Bottom tier first, so upper tiers overlap lower ones.
  for (let t = tiers - 1; t >= 0; t--) {
    const top = 1 + t * tierH;
    const bottom = Math.min(foliageBottom, top + tierH * 1.7);
    const half = (w / 2 - 1) * (0.3 + (0.7 * (t + 1)) / tiers);
    const jag = Array.from({ length: w }, (_, x) => Math.abs(Math.sin(x * 1.25 + seed + t)) * 3 + rng());
    for (let y = Math.floor(top); y <= bottom; y++) {
      const p = (y - top) / (bottom - top);
      const hw = half * Math.pow(p, 0.75) + (rng() - 0.5) * 1.2;
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        if (y > bottom - jag[x]) continue;
        const nx = (x + 0.5 - cx) / Math.max(1, hw);
        let s = 0.25 + p * 0.55 - nx * 0.22 + (rng() - 0.5) * 0.3;
        if (Math.abs(nx) > 0.85) s -= 0.2;
        pix.set(x, y, PINE[Math.max(0, Math.min(PINE.length - 1, Math.floor(s * PINE.length)))]);
      }
    }
  }
  pix.outline(OUTLINE);
  return pix.toCanvas();
}

function deadTree(seed, w = 28, h = 44) {
  const rng = mulberry32(seed);
  const pix = new Pix(w, h);
  const cols = [rgb('#3b342d'), rgb('#5c544a'), rgb('#7a7166')];
  const branch = (x, y, a, len, width, depth) => {
    const steps = Math.ceil(len);
    for (let i = 0; i <= steps; i++) {
      const px = x + Math.cos(a) * i;
      const py = y + Math.sin(a) * i;
      for (let k = 0; k < width; k++) pix.set(px + k, py, cols[Math.min(2, k + (depth > 1 ? 1 : 0))]);
    }
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    if (depth < 3) {
      branch(x2, y2, a - 0.45 - rng() * 0.35, len * 0.62, Math.max(1, width - 1), depth + 1);
      branch(x2, y2, a + 0.4 + rng() * 0.35, len * 0.58, Math.max(1, width - 1), depth + 1);
    }
  };
  branch(w / 2 - 1, h - 1, -Math.PI / 2, 18, 3, 0);
  pix.outline(OUTLINE);
  return pix.toCanvas();
}

// ---------- Small stuff ----------

function bushLike(seed, w, h, n, rMin, rMax, berries) {
  const rng = mulberry32(seed);
  const pix = new Pix(w, h);
  const clumps = [];
  for (let i = 0; i < n; i++) {
    clumps.push({
      x: w / 2 + (rng() - 0.5) * (w - rMax * 2),
      y: h / 2 + 1 + (rng() - 0.5) * (h - rMax * 2),
      r: rMin + rng() * (rMax - rMin),
      pal: GRASS,
    });
  }
  paintClumps(pix, clumps, rng, (x, y) => -((y - h / 2) / h) * 0.2);
  if (berries) {
    for (let i = 0; i < 7; i++) {
      const x = 3 + Math.floor(rng() * (w - 6));
      const y = 3 + Math.floor(rng() * (h - 6));
      if (!pix.has(x, y)) continue;
      pix.set(x, y, rgb('#4a2440'));
      pix.set(x + 1, y, rgb('#6e3a5e'));
      pix.set(x, y - 1, rgb('#9a6088'));
    }
  }
  pix.outline(OUTLINE);
  return pix.toCanvas();
}

function rock(seed, w, h) {
  const rng = mulberry32(seed);
  const pix = new Pix(w, h);
  const bumps = Array.from({ length: 8 }, () => 0.82 + rng() * 0.18);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2 - 1);
      const ny = (y + 0.5 - h * 0.55) / (h * 0.45 - 1);
      const a = Math.atan2(ny, nx);
      const k = bumps[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 8];
      if (nx * nx + ny * ny > k * k) continue;
      // Flat-ish top face is bright, the front/bottom face is darker.
      let s = 0.7 - nx * 0.25 - ny * 0.45 + (rng() - 0.5) * 0.2;
      if (ny > 0.35) s -= 0.3;
      pix.set(x, y, STONE[Math.max(0, Math.min(STONE.length - 1, Math.floor(s * STONE.length)))]);
    }
  }
  pix.outline(rgb('#34332e'));
  return pix.toCanvas();
}

function stump() {
  const pix = new Pix(12, 10);
  pix.rect(BARK.dark, 1, 3, 10, 7);
  pix.rect(BARK.mid, 2, 4, 8, 5);
  pix.rect(BARK.light, 2, 4, 2, 5);
  pix.rect(rgb('#a08a6a'), 2, 2, 8, 2);
  pix.rect(rgb('#7e6a50'), 4, 2, 4, 2);
  pix.outline(OUTLINE);
  return pix.toCanvas();
}

function log() {
  const pix = new Pix(28, 10);
  pix.rect(BARK.mid, 1, 2, 23, 6);
  pix.rect(BARK.light, 1, 2, 23, 2);
  pix.rect(BARK.dark, 1, 7, 23, 1);
  pix.rect(rgb('#a08a6a'), 24, 2, 3, 6);
  pix.rect(rgb('#7e6a50'), 25, 4, 1, 2);
  pix.outline(OUTLINE);
  return pix.toCanvas();
}

function mushroom() {
  const pix = new Pix(10, 8);
  pix.rect(rgb('#d8ccb0'), 2, 4, 2, 4);
  pix.rect(rgb('#7a3a2a'), 0, 2, 6, 3);
  pix.rect(rgb('#a4563c'), 1, 2, 4, 2);
  pix.set(2, 2, rgb('#d8c4a8'));
  pix.rect(rgb('#d8ccb0'), 7, 5, 1, 3);
  pix.rect(rgb('#7a3a2a'), 6, 4, 3, 2);
  pix.outline(OUTLINE);
  return pix.toCanvas();
}

// ---------- Points of interest ----------

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function tower() {
  const w = 30;
  const h = 58;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const dark = '#241d17';
  const wood = '#4f463b';
  const light = '#6e6456';
  // legs
  rect(ctx, dark, 4, 26, 3, 32);
  rect(ctx, dark, 23, 26, 3, 32);
  rect(ctx, wood, 5, 26, 1, 31);
  rect(ctx, wood, 24, 26, 1, 31);
  // braces
  for (let i = 0; i < 3; i++) {
    const y = 32 + i * 9;
    rect(ctx, dark, 6, y, 18, 2);
    rect(ctx, wood, 6, y, 18, 1);
  }
  // ladder
  for (let y = 30; y < 56; y += 3) rect(ctx, light, 13, y, 4, 1);
  rect(ctx, dark, 12, 28, 1, 30);
  rect(ctx, dark, 17, 28, 1, 30);
  // cabin
  rect(ctx, dark, 2, 10, 26, 18);
  rect(ctx, wood, 3, 11, 24, 16);
  for (let x = 4; x < 27; x += 3) rect(ctx, light, x, 11, 1, 16);
  rect(ctx, '#15100c', 6, 14, 18, 5);
  // roof
  rect(ctx, dark, 0, 5, 30, 6);
  rect(ctx, '#4a4a42', 1, 6, 28, 4);
  rect(ctx, '#66665a', 1, 6, 28, 1);
  rect(ctx, dark, 4, 2, 22, 4);
  rect(ctx, '#55554c', 5, 3, 20, 2);
  return c;
}

function crate() {
  const c = makeCanvas(16, 14);
  const ctx = c.getContext('2d');
  rect(ctx, '#1d2016', 0, 0, 16, 14);
  rect(ctx, '#4d5534', 1, 1, 14, 12);
  rect(ctx, '#626c42', 1, 1, 14, 4);
  rect(ctx, '#1d2016', 1, 5, 14, 1);
  rect(ctx, '#8a8a70', 7, 7, 2, 3);
  rect(ctx, '#3a4028', 3, 8, 2, 4);
  rect(ctx, '#3a4028', 11, 8, 2, 4);
  return c;
}

function shadow(w, h, alpha = 105) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2);
      const ny = (y + 0.5 - h / 2) / (h / 2);
      const d = nx * nx + ny * ny;
      // Two-step falloff: dark core, lighter edge (still hard pixel edges).
      if (d <= 1) img.data[(y * w + x) * 4 + 3] = d < 0.55 ? alpha : alpha * 0.6;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- Player ----------
// The hero is the CraftPix swordsman (level 2), rebuilt pixel by pixel from
// hero-data.js, which tools/extract_hero.py generates from the sprite sheets.
// No image files are loaded at runtime. Characters start without weapons, so
// the sword is removed from every frame (the data keeps it for later).

/** Empty rows under the hero's feet in each frame. */
export const PLAYER_FEET_OFFSET = HERO.feet;

/** Frame count and speed of each animation, e.g. { walk: { fps: 10, count: 6 } }. */
export const HERO_ANIMS = Object.fromEntries(
  Object.entries(HERO.anims).map(([name, a]) => [name, { fps: a.fps, count: a.frames.down.length }]),
);

const HERO_RGB = Object.fromEntries(Object.entries(HERO.palette).map(([ch, hex]) => [ch, rgb(hex)]));

const HAIR_CHARS = '!#&%()';
const EYE_CHARS = '/0';
const HEAD_CHARS = `${HAIR_CHARS},+*B3-/012`; // hair, skin and eyes
const SWORD_CHARS = 'EFJKL';

/**
 * Decode a frame into a grid of palette characters with the sword removed.
 * Where the blade crossed in front of the body, the hole is filled from the
 * neighbouring pixels so no gaps are left.
 */
function unarmedGrid(data) {
  const grip = findGrip(data);
  const { w, h } = HERO;
  const grid = [];
  for (let y = 0; y < h; y++) grid.push(data.slice(y * w, y * w + w).split(''));
  const holes = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (SWORD_CHARS.includes(grid[y][x])) {
        grid[y][x] = '.';
        holes.push([x, y]);
      }
    }
  }
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? grid[y][x] : '.');
  const isHole = new Set(holes.map(([x, y]) => y * w + x));
  for (let pass = 0; pass < 3; pass++) {
    for (const [x, y] of holes) {
      if (grid[y][x] !== '.') continue;
      const l = at(x - 1, y);
      const r = at(x + 1, y);
      const u = at(x, y - 1);
      const d = at(x, y + 1);
      if (l !== '.' && r !== '.') grid[y][x] = l;
      else if (u !== '.' && d !== '.') grid[y][x] = u;
    }
  }
  // Wider gaps (a blade lying across a leg) are filled when the body shows on
  // both sides of the run: each half copies the pixel on its side.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] !== '.' || !isHole.has(y * w + x) || at(x - 1, y) === '.') continue;
      let end = x;
      while (end < w && grid[y][end] === '.' && isHole.has(y * w + end)) end++;
      if (at(end, y) === '.') continue;
      const mid = (x + end) / 2;
      for (let i = x; i < end; i++) grid[y][i] = i < mid ? grid[y][x - 1] : grid[y][end];
    }
  }
  if (grip) drawFist(grid, grip, eyeRowOf(data));
  return grid;
}

const SKIN_CHARS = '*+,3B';
const FIST_OUTLINE = '-';
// Fallback fist when the other hand is hidden behind the body: 2x2, lit on top.
const DEFAULT_FIST = [[0, 0, '*'], [1, 0, '+'], [0, 1, '+'], [1, 1, ',']];

/** Row of the eyes (lowest one), or 0 when the face is not visible. */
function eyeRowOf(data) {
  let row = 0;
  for (let i = 0; i < data.length; i++) if (EYE_CHARS.includes(data[i])) row = Math.floor(i / HERO.w);
  return row;
}

/**
 * Where the hand held the sword: between the top of the hilt and the end of the
 * arm (the nearest skin below the face), or the hilt alone if no arm is close.
 */
function findGrip(data) {
  const { w, h } = HERO;
  let hilt = null;
  for (let i = 0; i < w * h && !hilt; i++) if (SWORD_CHARS.includes(data[i])) hilt = [i % w, Math.floor(i / w)];
  if (!hilt) return null;
  let arm = null;
  let best = 4;
  for (let y = eyeRowOf(data) + 3; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!'*+,3'.includes(data[y * w + x])) continue;
      const d = Math.max(Math.abs(x - hilt[0]), Math.abs(y - hilt[1]));
      if (d < best) {
        best = d;
        arm = [x, y];
      }
    }
  }
  return arm ? [Math.round((hilt[0] + arm[0]) / 2), Math.round((hilt[1] + arm[1]) / 2)] : hilt;
}

/**
 * The free hand in this frame, as [dx, dy, char] cells relative to its bottom
 * left: the lowest three rows of the biggest patch of skin below the face that
 * is not the sword arm. Null when that hand is hidden behind the body.
 */
function freeHand(grid, [gx, gy], eyeRow) {
  const { w, h } = HERO;
  const seen = new Set();
  let hand = null;
  for (let y = eyeRow + 3; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen.has(y * w + x) || !SKIN_CHARS.includes(grid[y][x])) continue;
      const cells = [];
      const stack = [[x, y]];
      seen.add(y * w + x);
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= w || ny <= eyeRow + 2 || ny >= h || seen.has(ny * w + nx)) continue;
          if (!SKIN_CHARS.includes(grid[ny][nx])) continue;
          seen.add(ny * w + nx);
          stack.push([nx, ny]);
        }
      }
      const nearGrip = cells.some(([cx, cy]) => Math.max(Math.abs(cx - gx), Math.abs(cy - gy)) <= 2);
      if (!nearGrip && cells.length >= 3 && (!hand || cells.length > hand.length)) hand = cells;
    }
  }
  if (!hand) return null;
  const bottom = Math.max(...hand.map(([, y]) => y));
  const lower = hand.filter(([, y]) => y > bottom - 3);
  const left = Math.min(...lower.map(([x]) => x));
  return lower.map(([x, y]) => [x - left, y - bottom, grid[y][x]]);
}

/** Draw a copy of the free hand (or a plain fist) at the grip, in front of the body, with a dark rim. */
function drawFist(grid, grip, eyeRow) {
  const { w, h } = HERO;
  const [gx, gy] = grip;
  const shape = freeHand(grid, grip, eyeRow) ?? DEFAULT_FIST.map(([dx, dy, ch]) => [dx, dy - 1, ch]);
  const width = Math.max(...shape.map(([dx]) => dx)) + 1;
  const ox = gx - Math.ceil(width / 2); // centred on the grip
  const oy = gy + 1; // bottom row of the hand
  const cells = shape.map(([dx, dy, ch]) => [ox + dx, oy + dy, ch]);
  const inFist = (x, y) => cells.some(([cx, cy]) => cx === x && cy === y);
  for (const [x, y] of cells) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || inFist(nx, ny)) continue;
      if (grid[ny][nx] === '.') grid[ny][nx] = FIST_OUTLINE;
    }
  }
  for (const [x, y, ch] of cells) if (x >= 0 && y >= 0 && x < w && y < h) grid[y][x] = ch;
}

function heroFrame(data) {
  const grid = unarmedGrid(data);
  const pix = new Pix(HERO.w, HERO.h);
  grid.forEach((row, y) => row.forEach((ch, x) => ch !== '.' && pix.set(x, y, HERO_RGB[ch])));
  return pix.toCanvas();
}

// ---------- Soldier (derived from the swordsman) ----------
// Same frames and poses, in a woodland digital-camo uniform with a tactical
// vest, black boots and a helmet over the hair. Colour groups are the
// swordsman's palette characters.

const luminance = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Characters of a group sorted dark to light, with each one's rank in [0, 1]. */
function rankGroup(chars) {
  const sorted = [...chars].sort((a, b) => luminance(HERO_RGB[a]) - luminance(HERO_RGB[b]));
  return sorted.map((ch, i) => [ch, sorted.length === 1 ? 1 : i / (sorted.length - 1)]);
}

/** Map each palette character in a group onto a target ramp, keeping dark-to-light order. */
function remapGroups(groups) {
  const map = {};
  for (const { chars, ramp } of groups) {
    for (const [ch, r] of rankGroup(chars)) map[ch] = rgb(ramp[Math.round(r * (ramp.length - 1))]);
  }
  return map;
}

const CAMO_CHARS = '4567:=9A@GTWPHIR'; // jacket + trousers
const CAMO_RANK = Object.fromEntries([...rankGroup('4567:=9A@'), ...rankGroup('GTWPHIR')]);

const SOLDIER_RGB = {
  ...HERO_RGB,
  ...remapGroups([
    { chars: '8;<>?O', ramp: ['#3b3628', '#4d4634', '#615842', '#756b50'] }, // tactical vest
    { chars: 'CD', ramp: ['#1c1c18', '#2c2b24'] }, // belt
    { chars: 'MNQSVUXY', ramp: ['#141414', '#1e1d1c', '#2a2826', '#363330'] }, // boots
    { chars: HAIR_CHARS, ramp: ['#141210', '#1f1b18', '#2b2621', '#37302a'] }, // short dark hair
  ]),
};

// Woodland digital camo: each 2x2 block picks one of these colours, then the
// pixel's original light/shade picks the shade within it.
const CAMO = [
  { weight: 0.45, ramp: ['#2c3322', '#3b4430', '#4b563b', '#5c6848', '#6e7b55'] }, // olive
  { weight: 0.25, ramp: ['#1f2619', '#283222', '#323e2a', '#3d4a33', '#48573c'] }, // dark green
  { weight: 0.18, ramp: ['#2e261c', '#3c3225', '#4c402f', '#5c4e3a', '#6c5c45'] }, // brown
  { weight: 0.12, ramp: ['#4d4a36', '#5f5b43', '#716d51', '#847f5f', '#96906d'] }, // tan
].map((c) => ({ ...c, ramp: c.ramp.map(rgb) }));

function camoColor(ch, x, y) {
  let r = hashFloat(Math.floor(x / 2), Math.floor(y / 2), 4242);
  let pick = CAMO[0];
  for (const c of CAMO) {
    r -= c.weight;
    if (r < 0) {
      pick = c;
      break;
    }
  }
  return pick.ramp[Math.round(CAMO_RANK[ch] * (pick.ramp.length - 1))];
}

const HELMET = ['#2a3120', '#3a4429', '#4b5634', '#5d6a40', '#71804f'].map(rgb);
const HELMET_OUTLINE = rgb('#171a12');

function soldierFrame(data) {
  const { w, h } = HERO;
  const grid = unarmedGrid(data);

  // Find the hair and the eyes in this frame.
  let hairTop = h;
  let eyeRow = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (HAIR_CHARS.includes(grid[y][x])) hairTop = Math.min(hairTop, y);
      if (eyeRow === null && EYE_CHARS.includes(grid[y][x])) eyeRow = y;
    }
  }

  // Helmet dome from just under the hair spikes down to the brim.
  const HELMET_ROWS = 6; // dome height including the brim row
  const brim = eyeRow !== null ? eyeRow - 2 : hairTop + 8;
  const top = Math.max(hairTop, brim - HELMET_ROWS + 1);

  // Body: camo uniform; hair spikes above the helmet are dropped.
  const pix = new Pix(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      if (ch === '.' || (y < top && HAIR_CHARS.includes(ch))) continue;
      pix.set(x, y, CAMO_CHARS.includes(ch) ? camoColor(ch, x, y) : SOLDIER_RGB[ch]);
    }
  }
  if (hairTop === h) return pix.toCanvas();

  // Centre and width come from the skull at forehead level (the brim row and
  // two rows below), not the whole hairstyle: the spikes stick out to one side.
  let x0 = w;
  let x1 = -1;
  for (let y = brim; y <= Math.min(h - 1, brim + 2); y++) {
    for (let x = 0; x < w; x++) {
      if (HEAD_CHARS.includes(grid[y][x])) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    }
  }
  const cx = (x0 + x1 + 1) / 2;
  const rx = (x1 - x0 + 1) / 2 - 1; // a bit narrower than the skull so it hugs the head

  // Helmet on top: an upper half-ellipse plus a wider brim row.
  const helmet = new Set();
  for (let y = top; y <= brim; y++) {
    const t = (brim - y) / (brim - top + 1); // 1 near the top, 0 at the brim
    const hw = y === brim ? rx + 0.5 : rx * Math.sqrt(1 - t * t);
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      const nx = (x + 0.5 - cx) / rx;
      if (Math.abs(nx) > hw / rx + 0.01) continue;
      let s = 0.55 - nx * 0.3 + t * 0.35;
      if (y === brim) s = 0.15;
      pix.set(x, y, HELMET[Math.max(0, Math.min(HELMET.length - 1, Math.floor(s * HELMET.length)))]);
      helmet.add(y * w + x);
    }
  }
  // Remove leftover hair next to the helmet, then outline the helmet.
  for (let y = top; y <= brim; y++) {
    for (let x = 0; x < w; x++) {
      if (!helmet.has(y * w + x) && HAIR_CHARS.includes(grid[y][x])) pix.px[y * w + x] = null;
    }
  }
  for (const k of helmet) {
    const x = k % w;
    const y = Math.floor(k / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) {
      if (!pix.has(x + dx, y + dy)) pix.set(x + dx, y + dy, HELMET_OUTLINE);
    }
  }
  return pix.toCanvas();
}

/** Playable characters: id -> display name. Frames are <id>_<anim>_<dir>_<i>. */
export const CHARACTERS = { swordsman: 'Swordsman', soldier: 'Soldier' };

// ---------- Ground decals (painted straight into chunk ground) ----------

function smallStone(seed) {
  return rock(seed + 100, 6 + (seed % 3), 5);
}

function twig(seed) {
  const rng = mulberry32(seed);
  const pix = new Pix(11, 7);
  const col = [rgb('#4a4238'), rgb('#6a6052')];
  let x = 0;
  let y = 3 + Math.floor(rng() * 2);
  while (x < 10) {
    pix.set(x, y, col[x % 3 === 0 ? 1 : 0]);
    if (rng() < 0.3) y += rng() < 0.5 ? -1 : 1;
    if (rng() < 0.18) pix.set(x + 1, y - 1, col[1]);
    y = Math.max(1, Math.min(5, y));
    x++;
  }
  return pix.toCanvas();
}

function redPlant(seed) {
  const rng = mulberry32(seed);
  const pix = new Pix(6, 5);
  const cols = [rgb('#6e2e22'), rgb('#94412c'), rgb('#b4623e')];
  for (let i = 0; i < 6; i++) pix.set(Math.floor(rng() * 6), Math.floor(rng() * 5), cols[Math.floor(rng() * 3)]);
  return pix.toCanvas();
}

function flower(color) {
  const pix = new Pix(3, 3);
  const c = rgb(color);
  pix.set(1, 0, c);
  pix.set(0, 1, c);
  pix.set(2, 1, c);
  pix.set(1, 2, c);
  pix.set(1, 1, rgb('#d8c870'));
  return pix.toCanvas();
}

// ---------- Atlas ----------

export function buildSprites() {
  const sprites = {
    oak0: leafyTree(11, [LEAF]),
    oak1: leafyTree(23, [LEAF], 38, 52),
    oak2: leafyTree(37, [LEAF, LEAF_DARK], 46, 60),
    autumn0: leafyTree(51, [AUTUMN, AUTUMN, LEAF]),
    autumn1: leafyTree(67, [AUTUMN, LEAF_DARK], 40, 54),
    pine0: pineTree(3),
    pine1: pineTree(8, 26, 52),
    pine2: pineTree(13, 32, 66),
    dead0: deadTree(5),
    dead1: deadTree(9, 24, 38),
    bush0: bushLike(1, 18, 14, 5, 3, 4.5, false),
    bush1: bushLike(2, 16, 12, 4, 3, 4, false),
    berry0: bushLike(3, 18, 14, 5, 3, 4.5, true),
    berry1: bushLike(4, 16, 12, 4, 3, 4, true),
    rock0: rock(1, 14, 10),
    rock1: rock(2, 12, 9),
    boulder0: rock(3, 26, 18),
    stump0: stump(),
    log0: log(),
    mushroom0: mushroom(),
    tower0: tower(),
    crate0: crate(),
    shadowS: shadow(16, 6),
    shadowM: shadow(24, 8),
    shadowL: shadow(38, 12),
  };

  // Character frames are named <character>_<anim>_<dir>_<i>, e.g. soldier_walk_left_3.
  for (const [anim, a] of Object.entries(HERO.anims)) {
    for (const [dir, frames] of Object.entries(a.frames)) {
      frames.forEach((data, i) => {
        sprites[`swordsman_${anim}_${dir}_${i}`] = heroFrame(data);
        sprites[`soldier_${anim}_${dir}_${i}`] = soldierFrame(data);
      });
    }
  }

  const decals = {
    // Little yellow-green grass mounds, the most common ground clutter.
    mounds: [11, 12, 13, 14, 15].map((s, i) => bushLike(s, 9 + (i % 3) * 2, 7 + (i % 2), 3, 2, 3, false)),
    stones: [1, 2, 3, 4].map(smallStone),
    twigs: [1, 2, 3].map(twig),
    reds: [1, 2, 3].map(redPlant),
    flowers: [flower('#d0c8b8'), flower('#b8a0c0'), flower('#d0b860')],
  };

  return { atlas: packAtlas(sprites), decals };
}

/** Simple shelf packer: puts every sprite into one canvas, returns UV rects. */
function packAtlas(sprites) {
  const size = 1024;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const entries = Object.entries(sprites).sort((a, b) => b[1].height - a[1].height);
  const rects = {};
  let x = 1;
  let y = 1;
  let rowH = 0;
  for (const [name, c] of entries) {
    if (x + c.width + 1 > size) {
      x = 1;
      y += rowH + 2;
      rowH = 0;
    }
    ctx.drawImage(c, x, y);
    rects[name] = {
      w: c.width,
      h: c.height,
      u0: x / size,
      u1: (x + c.width) / size,
      // Three.js flips canvas textures vertically, so v is measured from the bottom.
      v0: 1 - (y + c.height) / size,
      v1: 1 - y / size,
    };
    x += c.width + 2;
    rowH = Math.max(rowH, c.height);
  }
  return { canvas, rects };
}
