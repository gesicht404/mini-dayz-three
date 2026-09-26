import { BIOME, CELL, CELLS_PER_CHUNK, CHUNK_PX, isWaterBiome } from '../world/generator.js';
import { hashInts, mulberry32 } from '../world/rng.js';

// Five shades (dark -> light) plus a pale speck colour per biome. Every pixel
// picks a shade from fine grain + soft large-scale tone, which gives the
// grainy khaki ground of Mini DayZ.
export const GROUND_PALETTE = {
  [BIOME.DEEP_WATER]: { ramp: ['#2c4243', '#2f4646', '#324a49', '#354e4c', '#385250'], speck: '#4a6361' },
  [BIOME.WATER]: { ramp: ['#36504f', '#3a5553', '#3e5a57', '#425f5b', '#46645f'], speck: '#5f7c76' },
  [BIOME.SHORE]: { ramp: ['#5d5840', '#666047', '#6f694e', '#787255', '#827c5d'], speck: '#9e9880' },
  [BIOME.MEADOW]: { ramp: ['#615d3d', '#6d6946', '#78744e', '#838057', '#8f8b62'], speck: '#aaa58a' },
  [BIOME.FIELD]: { ramp: ['#6f6844', '#7c744c', '#877f54', '#938b5c', '#a09866'], speck: '#b8b194' },
  [BIOME.FOREST]: { ramp: ['#555639', '#5f6040', '#696a47', '#73744e', '#7e7e56'], speck: '#9a9a80' },
  [BIOME.PINE]: { ramp: ['#4e5236', '#575b3c', '#606443', '#6a6e4a', '#747852'], speck: '#8f927a' },
  [BIOME.SWAMP]: { ramp: ['#43472f', '#4b4f35', '#53583b', '#5c6142', '#666b49'], speck: '#7d826a' },
  [BIOME.ROCKY]: { ramp: ['#646150', '#6d6a58', '#767360', '#807d69', '#8a8773'], speck: '#b0ad9c' },
  [BIOME.ROAD]: { ramp: ['#6a5d45', '#74664b', '#7e6f52', '#887959', '#938361'], speck: '#a89a7c' },
};

const SHALLOW = [0x52, 0x6c, 0x66];
const FOAM = [0x78, 0x8c, 0x80];

const toRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const RGB = {};
for (const [b, p] of Object.entries(GROUND_PALETTE)) {
  RGB[b] = { ramp: p.ramp.map(toRgb), speck: toRgb(p.speck) };
}

function pixelHash(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Which decals each biome gets, as [kind, weight]. Attempts are per chunk.
const DECALS = {
  [BIOME.MEADOW]: { tries: 150, table: [['mounds', 5], ['stones', 1.5], ['twigs', 1.2], ['reds', 0.8], ['flowers', 0.5], [null, 3]] },
  [BIOME.FIELD]: { tries: 150, table: [['mounds', 6], ['stones', 1.2], ['twigs', 0.5], ['reds', 0.4], [null, 3]] },
  [BIOME.FOREST]: { tries: 140, table: [['mounds', 3], ['twigs', 3], ['stones', 0.8], ['reds', 1], [null, 3]] },
  [BIOME.PINE]: { tries: 130, table: [['twigs', 4], ['mounds', 1.5], ['stones', 1], [null, 3]] },
  [BIOME.SWAMP]: { tries: 120, table: [['mounds', 4], ['twigs', 2], ['reds', 1], [null, 3]] },
  [BIOME.ROCKY]: { tries: 120, table: [['stones', 5], ['mounds', 1], ['twigs', 0.5], [null, 3]] },
  [BIOME.ROAD]: { tries: 40, table: [['stones', 2], [null, 5]] },
  [BIOME.SHORE]: { tries: 60, table: [['stones', 2], ['mounds', 1], ['twigs', 1], [null, 3]] },
};

function pick(table, r) {
  let total = 0;
  for (const [, w] of table) total += w;
  let x = r * total;
  for (const [k, w] of table) {
    x -= w;
    if (x < 0) return k;
  }
  return null;
}

/** Paint one chunk's ground into a CHUNK_PX x CHUNK_PX canvas. */
export function paintGround(chunk, gen, decals) {
  const { cx, cy, cells, stride } = chunk;
  const n = CELLS_PER_CHUNK;
  const ox = cx * CHUNK_PX;
  const oy = cy * CHUNK_PX;
  const cellAt = (i, j) => cells[(j + 1) * stride + (i + 1)];

  // Soft large-scale tone per cell, in [-1, 1].
  const tone = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const wx = cx * n + i;
      const wy = cy * n + j;
      tone[j * n + i] = gen.detail.noise(wx / 14, wy / 14) * 0.7 + gen.detail.noise(wx / 4, wy / 4) * 0.3;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = CHUNK_PX;
  canvas.height = CHUNK_PX;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(CHUNK_PX, CHUNK_PX);
  const d = img.data;
  const seed2 = gen.seed ^ 0x5bd1e995;

  for (let py = 0; py < CHUNK_PX; py++) {
    // Canvas rows go top-down, world y goes up.
    const ly = CHUNK_PX - 1 - py;
    const j = Math.floor(ly / CELL);
    for (let px = 0; px < CHUNK_PX; px++) {
      const i = Math.floor(px / CELL);
      const b = cellAt(i, j);
      const pal = RGB[b];
      const wx = ox + px;
      const wy = oy + ly;
      const h = pixelHash(wx, wy, gen.seed);
      const h2 = pixelHash(wx, wy, seed2);
      const t = tone[j * n + i];
      let c;

      if (isWaterBiome(b)) {
        const nearLand =
          !isWaterBiome(cellAt(i - 1, j)) || !isWaterBiome(cellAt(i + 1, j)) ||
          !isWaterBiome(cellAt(i, j - 1)) || !isWaterBiome(cellAt(i, j + 1));
        if (nearLand) c = h < 0.25 ? FOAM : SHALLOW;
        else {
          const k = Math.floor((0.5 + t * 0.35 + (h - 0.5) * 0.25) * 5);
          c = pal.ramp[Math.max(0, Math.min(4, k))];
          if (h2 < 0.008) c = pal.speck;
        }
      } else {
        const k = Math.floor((0.5 + t * 0.25 + (h - 0.5) * 0.8) * 5);
        c = pal.ramp[Math.max(0, Math.min(4, k))];
        if (h2 < 0.03) c = pal.speck;
        else if (h2 > 0.985) c = pal.ramp[0];
      }

      const o = (py * CHUNK_PX + px) * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Clutter: grass mounds, stones, twigs, red plants, flowers.
  const rng = mulberry32(hashInts(gen.seed, cx, cy, 313));
  const tries = 150;
  for (let k = 0; k < tries; k++) {
    const px = 2 + Math.floor(rng() * (CHUNK_PX - 14));
    const py = 2 + Math.floor(rng() * (CHUNK_PX - 10));
    const r = rng();
    const r2 = rng();
    const b = cellAt(Math.floor(px / CELL), Math.floor((CHUNK_PX - 1 - py) / CELL));
    const cfg = DECALS[b];
    if (!cfg || k >= cfg.tries) continue;
    const kind = pick(cfg.table, r);
    if (!kind) continue;
    const list = decals[kind];
    const decal = list[Math.floor(r2 * list.length)];
    // Skip decals that would hang over water.
    const b2 = cellAt(Math.floor((px + decal.width) / CELL), Math.floor((CHUNK_PX - 1 - py - decal.height) / CELL));
    if (isWaterBiome(b2)) continue;
    ctx.drawImage(decal, px, py);
  }

  return canvas;
}

/** Flat colour per biome, for the minimap. */
export function biomeColor(b) {
  return GROUND_PALETTE[b].ramp[2];
}
