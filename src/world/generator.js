import { Simplex2 } from './noise.js';
import { hashInts, mulberry32, weightedPick } from './rng.js';
import { OBJECTS, BIOME_OBJECTS, POI_CHANCE } from './objects.js';
import { BIOME, isWaterBiome } from './biomes.js';

export { BIOME, BIOME_NAMES, isWaterBiome } from './biomes.js';

// World units are pixels. 1 tile = 16 px, 1 chunk = 16 x 16 tiles.
export const TILE = 16;
export const CHUNK_TILES = 16;
export const CHUNK_PX = TILE * CHUNK_TILES;
// Terrain is resolved on a 4 px grid ("cells") so borders look pixel-art.
export const CELL = 4;
export const CELLS_PER_CHUNK = CHUNK_PX / CELL;

export class WorldGenerator {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.elevation = new Simplex2(hashInts(seed, 1));
    this.moisture = new Simplex2(hashInts(seed, 2));
    this.forest = new Simplex2(hashInts(seed, 3));
    this.road = new Simplex2(hashInts(seed, 4));
    this.warp = new Simplex2(hashInts(seed, 5));
    this.detail = new Simplex2(hashInts(seed, 6));
  }

  /** Raw climate values at a world position (in pixels). */
  climate(x, y) {
    const tx = x / TILE;
    const ty = y / TILE;
    // Small wobble so biome borders look organic instead of smooth blobs.
    const jx = this.detail.noise(tx / 5, ty / 5) * 0.6;
    const jy = this.detail.noise(ty / 5 + 91, tx / 5 - 37) * 0.6;
    const sx = tx + jx;
    const sy = ty + jy;

    const e = this.elevation.fbm(sx / 140, sy / 140, 4);
    const m = this.moisture.fbm(sx / 180, sy / 180, 3);
    const f = this.forest.fbm(sx / 100, sy / 100, 3);

    // Roads follow the zero line of a domain-warped noise field.
    const wx = this.warp.noise(sx / 60, sy / 60) * 8;
    const wy = this.warp.noise(sy / 60 + 50, sx / 60 - 50) * 8;
    const r = Math.abs(this.road.noise((sx + wx) / 220, (sy + wy) / 220));

    return { e, m, f, r };
  }

  /** Biome id at a world position (in pixels). */
  biomeAt(x, y) {
    const { e, m, f, r } = this.climate(x, y);
    if (e < -0.4) return BIOME.DEEP_WATER;
    if (e < -0.28) return BIOME.WATER;
    if (e < -0.22) return BIOME.SHORE;
    if (r < 0.015) return BIOME.ROAD;
    if (e > 0.38) return BIOME.ROCKY;
    if (m > 0.25 && e < -0.02) return BIOME.SWAMP;
    if (f > 0.12 && e > 0.1) return BIOME.PINE;
    if (f > 0.08) return BIOME.FOREST;
    if (f < -0.2 && m < -0.05) return BIOME.FIELD;
    return BIOME.MEADOW;
  }

  /** Biome for a 4 px cell. Used by rendering and collision so they agree. */
  cellBiome(ci, cj) {
    return this.biomeAt(ci * CELL + CELL / 2, cj * CELL + CELL / 2);
  }

  isWalkable(x, y) {
    return !isWaterBiome(this.cellBiome(Math.floor(x / CELL), Math.floor(y / CELL)));
  }

  /**
   * Build the data for one chunk. Pure and deterministic:
   * the same (seed, cx, cy) always gives the same result.
   */
  generateChunk(cx, cy) {
    const n = CELLS_PER_CHUNK;
    const ox = cx * CHUNK_PX;
    const oy = cy * CHUNK_PX;

    // Cell biomes with a 1-cell border so painters can see neighbours.
    const stride = n + 2;
    const cells = new Uint8Array(stride * stride);
    for (let j = -1; j <= n; j++) {
      for (let i = -1; i <= n; i++) {
        cells[(j + 1) * stride + (i + 1)] = this.cellBiome(cx * n + i, cy * n + j);
      }
    }
    const cellAt = (i, j) => cells[(j + 1) * stride + (i + 1)];

    const objects = [];
    const cellsPerTile = TILE / CELL;

    // One chance per tile to spawn a natural object.
    for (let ty = 0; ty < CHUNK_TILES; ty++) {
      for (let tx = 0; tx < CHUNK_TILES; tx++) {
        const wtx = cx * CHUNK_TILES + tx;
        const wty = cy * CHUNK_TILES + ty;
        const rng = mulberry32(hashInts(this.seed, wtx, wty, 77));
        const px = tx * TILE + 2 + Math.floor(rng() * (TILE - 4));
        const py = ty * TILE + 2 + Math.floor(rng() * (TILE - 4));
        const biome = cellAt(Math.floor(px / CELL), Math.floor(py / CELL));
        const table = BIOME_OBJECTS[biome];
        if (!table) continue;

        let density = table.density;
        if (biome === BIOME.FOREST || biome === BIOME.PINE) {
          // Thicker in the middle of forests, clearings near the edges.
          const { f } = this.climate(ox + px, oy + py);
          density *= Math.min(1.3, 0.35 + (f - 0.08) * 6);
        }
        if (rng() >= density) continue;

        const type = weightedPick(table.weights, rng());
        objects.push(this.makeObject(type, ox + px, oy + py, rng));
      }
    }

    // Rare points of interest (loot spots), at most one per chunk.
    const prng = mulberry32(hashInts(this.seed, cx, cy, 991));
    const roll = prng();
    let acc = 0;
    for (const [type, chance] of Object.entries(POI_CHANCE)) {
      acc += chance;
      if (roll < acc) {
        const px = 48 + Math.floor(prng() * (CHUNK_PX - 96));
        const py = 48 + Math.floor(prng() * (CHUNK_PX - 96));
        const b = cellAt(Math.floor(px / CELL), Math.floor(py / CELL));
        if (!isWaterBiome(b) && b !== BIOME.ROAD) {
          // Clear natural objects around the POI.
          const clear = OBJECTS[type].clearRadius ?? 24;
          for (let k = objects.length - 1; k >= 0; k--) {
            const o = objects[k];
            if (Math.hypot(o.x - (ox + px), o.y - (oy + py)) < clear) objects.splice(k, 1);
          }
          objects.push(this.makeObject(type, ox + px, oy + py, prng));
        }
        break;
      }
    }

    return { cx, cy, cells, stride, objects };
  }

  makeObject(type, x, y, rng) {
    const def = OBJECTS[type];
    const variant = Math.floor(rng() * def.sprites.length);
    const [lo, hi] = def.amount;
    return {
      type,
      x,
      y,
      sprite: def.sprites[variant],
      resource: def.resource,
      amount: lo + Math.floor(rng() * (hi - lo + 1)),
    };
  }
}
