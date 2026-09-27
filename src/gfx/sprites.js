import { mulberry32 } from '../world/rng.js';

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
// The survivor is drawn in Aseprite: assets/player.aseprite, one tag per
// animation and direction (idle_down, walk_left, ...). Aseprite's
// File > Export Sprite Sheet writes assets/player.png and assets/player.json
// (JSON array, with tags); the game loads those two files as they are.

/** Empty rows under the player's feet in each frame. */
export const PLAYER_FEET_OFFSET = 1;

/** Load the player sheet exported from Aseprite: { image, data }. */
export async function loadPlayerSheet() {
  const url = (file) => new URL(`../../assets/${file}`, import.meta.url);
  const image = new Image();
  image.src = url('player.png');
  const [data] = await Promise.all([fetch(url('player.json')).then((r) => r.json()), image.decode()]);
  return { image, data };
}

/**
 * Cut the sheet into one canvas per frame, named player_<tag>_<i>
 * (e.g. player_walk_left_3), and return each tag's frame durations in seconds.
 */
function playerFrames({ image, data }, sprites) {
  const anims = {};
  for (const tag of data.meta.frameTags) {
    anims[tag.name] = [];
    for (let i = tag.from; i <= tag.to; i++) {
      const { frame, duration } = data.frames[i];
      const c = makeCanvas(frame.w, frame.h);
      c.getContext('2d').drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
      sprites[`player_${tag.name}_${i - tag.from}`] = c;
      anims[tag.name].push(duration / 1000);
    }
  }
  return anims;
}

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

/** @param playerSheet  the Aseprite export from loadPlayerSheet() */
export function buildSprites(playerSheet) {
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

  const playerAnims = playerFrames(playerSheet, sprites);

  const decals = {
    // Little yellow-green grass mounds, the most common ground clutter.
    mounds: [11, 12, 13, 14, 15].map((s, i) => bushLike(s, 9 + (i % 3) * 2, 7 + (i % 2), 3, 2, 3, false)),
    stones: [1, 2, 3, 4].map(smallStone),
    twigs: [1, 2, 3].map(twig),
    reds: [1, 2, 3].map(redPlant),
    flowers: [flower('#d0c8b8'), flower('#b8a0c0'), flower('#d0b860')],
  };

  return { atlas: packAtlas(sprites), decals, playerAnims };
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
