import { TILE, CHUNK_TILES } from './generator.js';

// Colour of unexplored land on the minimap.
export const FOG_COLOR = 0x0b0d0c;

const BYTES = (CHUNK_TILES * CHUNK_TILES) / 8;
const SAVE_EVERY_MS = 5000;
const key = (cx, cy) => `${cx},${cy}`;

/**
 * Remembers which tiles the player has seen: one bit per tile, grouped by
 * chunk so an endless world stays cheap. Saved per seed in localStorage.
 */
export class FogMemory {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.seed = null;
    this.chunks = new Map();
    this.dirty = false;
    this.lastSave = 0;
    this.lastView = null;
  }

  /** Switch to a seed's fog, saving the current one first. */
  load(seedText) {
    if (this.seed !== null) this.save();
    this.seed = String(seedText);
    this.chunks.clear();
    this.lastView = null;
    this.dirty = false;
    try {
      const saved = JSON.parse(this.storage.getItem(`fog:${this.seed}`) || '{}');
      for (const [k, b64] of Object.entries(saved)) {
        const bits = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
        if (bits.length === BYTES) this.chunks.set(k, bits);
      }
    } catch {
      // storage unavailable or corrupt: start with everything unseen
      this.chunks.clear();
    }
  }

  save() {
    if (!this.dirty || this.seed === null) return;
    const out = {};
    for (const [k, bits] of this.chunks) out[k] = btoa(String.fromCharCode(...bits));
    try {
      this.storage.setItem(`fog:${this.seed}`, JSON.stringify(out));
      this.dirty = false;
    } catch {
      // storage unavailable or full: keep it in memory only
    }
    this.lastSave = Date.now();
  }

  /** Save now and then, not every frame. */
  maybeSave() {
    if (this.dirty && Date.now() - this.lastSave > SAVE_EVERY_MS) this.save();
  }

  /** The bitset for a chunk, or null if nothing in it has been seen. */
  chunkBits(cx, cy) {
    return this.chunks.get(key(cx, cy)) ?? null;
  }

  isTileExplored(tx, ty) {
    const cx = Math.floor(tx / CHUNK_TILES);
    const cy = Math.floor(ty / CHUNK_TILES);
    const bits = this.chunks.get(key(cx, cy));
    if (!bits) return false;
    const i = (ty - cy * CHUNK_TILES) * CHUNK_TILES + (tx - cx * CHUNK_TILES);
    return (bits[i >> 3] & (1 << (i & 7))) !== 0;
  }

  isExplored(x, y) {
    return this.isTileExplored(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  /**
   * Mark every tile in the view as explored: a rectangle reaching halfW / halfH
   * world pixels either side of (x, y), so zooming out reveals more.
   */
  reveal(x, y, halfW, halfH) {
    const tx0 = Math.floor((x - halfW) / TILE);
    const tx1 = Math.floor((x + halfW) / TILE);
    const ty0 = Math.floor((y - halfH) / TILE);
    const ty1 = Math.floor((y + halfH) / TILE);
    const viewKey = `${tx0},${tx1},${ty0},${ty1}`;
    if (this.lastView === viewKey) return;
    this.lastView = viewKey;

    for (let ty = ty0; ty <= ty1; ty++) {
      const cy = Math.floor(ty / CHUNK_TILES);
      const row = (ty - cy * CHUNK_TILES) * CHUNK_TILES;
      let cx = null;
      let bits = null;
      for (let tx = tx0; tx <= tx1; tx++) {
        const tcx = Math.floor(tx / CHUNK_TILES);
        if (tcx !== cx) {
          cx = tcx;
          const k = key(cx, cy);
          bits = this.chunks.get(k);
          if (!bits) this.chunks.set(k, (bits = new Uint8Array(BYTES)));
        }
        const i = row + (tx - cx * CHUNK_TILES);
        const m = 1 << (i & 7);
        if (!(bits[i >> 3] & m)) {
          bits[i >> 3] |= m;
          this.dirty = true;
        }
      }
    }
  }
}
