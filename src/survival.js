import { BIOME } from './world/biomes.js';

// Survival stats and the day clock. Values are 0-100 except temperature,
// which is a small "feels like" number: negative is cold, positive is warm.

export const MINUTES_PER_SECOND = 1; // game minutes that pass per real second
const START_HOUR = 8;

const WATER_DRAIN = 100 / (40 * 60); // per real second: empty after ~40 min
const FOOD_DRAIN = 100 / (55 * 60); // ~55 min
const RUN_DRAIN_MULT = 2;
const HARM_PER_SECOND = 0.35; // health lost per bad condition
const HEAL_PER_SECOND = 0.08;
const THOUGHT_EVERY = 45; // seconds between repeated complaints
const THOUGHT_SHOWN = 4;
const CLOTHING_HEAT_FACTOR = 0.35; // T-shirt + jeans (heat 7) is about +2.5

export class Survival {
  constructor() {
    this.reset();
  }

  reset() {
    this.health = 100;
    this.water = 70;
    this.food = 65;
    this.temperature = 0;
    this.minutes = START_HOUR * 60; // time of day plus days elapsed, in game minutes
    this.aliveSeconds = 0;
    this.stats = { score: 0, infectedKilled: 0, banditsKilled: 0, karma: 0 };
    this.thoughts = [];
    this.thoughtTimer = 0;
    this.thoughtShown = 0;
  }

  get hour() {
    return Math.floor(this.minutes / 60) % 24;
  }

  get minute() {
    return Math.floor(this.minutes) % 60;
  }

  get daysSurvived() {
    return Math.floor((this.minutes - START_HOUR * 60) / (24 * 60));
  }

  /** 0 at noon, 1 in the middle of the night, smooth dusk and dawn. */
  get darkness() {
    const h = (this.minutes / 60) % 24;
    const sun = Math.cos(((h - 13) / 24) * Math.PI * 2); // 1 at 13:00, -1 at 01:00
    return Math.min(1, Math.max(0, (0.25 - sun) / 0.75));
  }

  /** Temperature from time of day, biome, effort and worn clothing. */
  environmentTemp(biome, running, clothingHeat = 0) {
    let t = 1 - Math.round(this.darkness * 4);
    if (biome === BIOME.SWAMP || biome === BIOME.SHORE || biome === BIOME.ROCKY) t -= 1;
    if (biome === BIOME.WATER || biome === BIOME.DEEP_WATER) t -= 2;
    if (biome === BIOME.FIELD) t += 1;
    if (running) t += 1;
    return t + clothingHeat * CLOTHING_HEAT_FACTOR;
  }

  update(dt, { running, moving, biome, clothingHeat = 0 }) {
    this.minutes += dt * MINUTES_PER_SECOND;
    this.aliveSeconds += dt;
    this.stats.score = Math.floor(this.aliveSeconds / 60) * 2;

    const effort = running && moving ? RUN_DRAIN_MULT : 1;
    this.water = Math.max(0, this.water - WATER_DRAIN * effort * dt);
    this.food = Math.max(0, this.food - FOOD_DRAIN * effort * dt);
    // Temperature eases toward the environment instead of jumping.
    const target = this.environmentTemp(biome, running && moving, clothingHeat);
    this.temperature += (target - this.temperature) * Math.min(1, dt * 0.2);

    let harm = 0;
    if (this.water <= 0) harm++;
    if (this.food <= 0) harm++;
    if (this.temperature <= -3.5) harm++;
    if (harm) this.health = Math.max(0, this.health - harm * HARM_PER_SECOND * dt);
    else if (this.water > 50 && this.food > 50) this.health = Math.min(100, this.health + HEAL_PER_SECOND * dt);

    this.updateThoughts(dt);
  }

  updateThoughts(dt) {
    const wants = [];
    if (this.food < 30) wants.push('I want to eat something.');
    if (this.water < 30) wants.push('I want to drink something.');
    if (this.temperature <= -2.5) wants.push("I'm cold.");
    if (this.health < 30) wants.push("I don't feel well.");

    this.thoughtShown = Math.max(0, this.thoughtShown - dt);
    this.thoughtTimer -= dt;
    if (wants.length && this.thoughtTimer <= 0) {
      this.thoughts = wants;
      this.thoughtShown = THOUGHT_SHOWN;
      this.thoughtTimer = THOUGHT_EVERY;
    }
    if (!wants.length) this.thoughtTimer = Math.min(this.thoughtTimer, 3);
  }

  /** Show a one-off thought above the player. */
  say(text, seconds = 3) {
    this.thoughts = [text];
    this.thoughtShown = seconds;
  }

  /** Thoughts to show above the player right now (empty when none). */
  get visibleThoughts() {
    return this.thoughtShown > 0 ? this.thoughts : [];
  }

  get clockText() {
    return `${String(this.hour).padStart(2, '0')}:${String(this.minute).padStart(2, '0')}`;
  }
}
