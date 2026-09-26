// Deterministic randomness. Everything in the world is derived from
// (seed, coordinates) so the same seed always rebuilds the same world.

/** Small fast PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(a) {
  a >>>= 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash any number of integers into one 32-bit unsigned int. */
export function hashInts(...nums) {
  let h = 0x811c9dc5;
  for (let n of nums) {
    n = n | 0;
    h = Math.imul(h ^ (n & 0xff), 0x01000193);
    h = Math.imul(h ^ ((n >>> 8) & 0xff), 0x01000193);
    h = Math.imul(h ^ ((n >>> 16) & 0xff), 0x01000193);
    h = Math.imul(h ^ (n >>> 24), 0x01000193);
  }
  // final avalanche
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Hash of integers mapped to a float in [0, 1). */
export function hashFloat(...nums) {
  return hashInts(...nums) / 4294967296;
}

/**
 * Turn user seed text into a 32-bit number, Minecraft style:
 * whole numbers are used directly, any other text is hashed.
 */
export function seedFromText(text) {
  const t = String(text).trim();
  if (/^-?\d+$/.test(t)) return Number(BigInt.asIntN(32, BigInt(t))) >>> 0;
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Pick a key from { key: weight } using a random float r in [0, 1). */
export function weightedPick(weights, r) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let x = r * total;
  for (const k in weights) {
    x -= weights[k];
    if (x < 0) return k;
  }
  return Object.keys(weights)[0];
}
