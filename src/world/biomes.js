export const BIOME = {
  DEEP_WATER: 0,
  WATER: 1,
  SHORE: 2,
  MEADOW: 3,
  FIELD: 4,
  FOREST: 5,
  PINE: 6,
  SWAMP: 7,
  ROCKY: 8,
  ROAD: 9,
};

export const BIOME_NAMES = [
  'Deep lake', 'Lake', 'Shore', 'Meadow', 'Dry field',
  'Forest', 'Pine forest', 'Swamp', 'Rocky hills', 'Dirt road',
];

export function isWaterBiome(b) {
  return b === BIOME.DEEP_WATER || b === BIOME.WATER;
}
