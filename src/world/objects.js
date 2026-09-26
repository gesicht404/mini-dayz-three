import { BIOME } from './biomes.js';

// Every world object: which sprites it can use, whether it blocks movement
// (solid = collision radius in px), and what resource it will give later.
export const OBJECTS = {
  oak:       { name: 'Oak tree',     sprites: ['oak0', 'oak1', 'oak2'],       shadow: 'shadowL', solid: 4,  resource: 'wood',    amount: [3, 6] },
  autumn:    { name: 'Autumn tree',  sprites: ['autumn0', 'autumn1'],         shadow: 'shadowL', solid: 4,  resource: 'wood',    amount: [3, 6] },
  pine:      { name: 'Pine tree',    sprites: ['pine0', 'pine1', 'pine2'],    shadow: 'shadowM', solid: 4,  resource: 'wood',    amount: [2, 5] },
  deadtree:  { name: 'Dead tree',    sprites: ['dead0', 'dead1'],             shadow: 'shadowM', solid: 3,  resource: 'wood',    amount: [1, 3] },
  bush:      { name: 'Bush',         sprites: ['bush0', 'bush1'],             shadow: 'shadowS', solid: 0,  resource: 'sticks',  amount: [1, 2] },
  berrybush: { name: 'Berry bush',   sprites: ['berry0', 'berry1'],           shadow: 'shadowS', solid: 0,  resource: 'berries', amount: [2, 5] },
  rock:      { name: 'Rock',         sprites: ['rock0', 'rock1'],             shadow: 'shadowS', solid: 5,  resource: 'stone',   amount: [1, 3] },
  boulder:   { name: 'Boulder',      sprites: ['boulder0'],                   shadow: 'shadowM', solid: 9,  resource: 'stone',   amount: [4, 8] },
  stump:     { name: 'Tree stump',   sprites: ['stump0'],                     shadow: 'shadowS', solid: 4,  resource: 'wood',    amount: [1, 1] },
  log:       { name: 'Fallen log',   sprites: ['log0'],                       shadow: 'shadowM', solid: 0,  resource: 'wood',    amount: [2, 4] },
  mushroom:  { name: 'Mushrooms',    sprites: ['mushroom0'],                  shadow: null,      solid: 0,  resource: 'food',    amount: [1, 2] },
  tower:     { name: 'Hunting tower', sprites: ['tower0'],                    shadow: 'shadowL', solid: 10, resource: 'loot',    amount: [2, 4], clearRadius: 40 },
  crate:     { name: 'Supply crate', sprites: ['crate0'],                     shadow: 'shadowS', solid: 6,  resource: 'loot',    amount: [1, 3], clearRadius: 24 },
};

// Chance of a natural object per tile, and which objects each biome favours.
export const BIOME_OBJECTS = {
  [BIOME.SHORE]:  { density: 0.04, weights: { bush: 2, rock: 1 } },
  [BIOME.MEADOW]: { density: 0.07, weights: { bush: 5, rock: 2, stump: 1, oak: 2, berrybush: 1, mushroom: 0.5 } },
  [BIOME.FIELD]:  { density: 0.03, weights: { bush: 3, rock: 2, deadtree: 0.4 } },
  [BIOME.FOREST]: { density: 0.45, weights: { oak: 6, autumn: 3, pine: 2, bush: 3, stump: 1, log: 0.7, mushroom: 1, berrybush: 1 } },
  [BIOME.PINE]:   { density: 0.5,  weights: { pine: 8, oak: 1, rock: 1, stump: 1, log: 0.5, mushroom: 1 } },
  [BIOME.SWAMP]:  { density: 0.18, weights: { deadtree: 3, bush: 3, log: 1, oak: 1, mushroom: 1 } },
  [BIOME.ROCKY]:  { density: 0.15, weights: { rock: 5, boulder: 2, pine: 1, bush: 1 } },
};

// Per-chunk chance of a point of interest.
export const POI_CHANCE = {
  tower: 0.04,
  crate: 0.07,
};
