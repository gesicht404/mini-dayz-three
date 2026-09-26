import { ITEMS, SLOTS, RESOURCE_ITEMS, LOOT_TABLE } from './items.js';
import { OBJECTS } from './world/objects.js';
import { hashInts, mulberry32, weightedPick } from './world/rng.js';

// The player's equipment and the "vicinity" (piles of items near the player).
//
// A location (loc) says where an item is:
//   { type: 'equip', slot }            worn in an equipment slot
//   { type: 'cell', slot, index }      in a pocket of the clothing worn in `slot`
//   { type: 'pile', key, index }       in a pile on the ground / in a world object
//   { type: 'ground' }                 drop target: "put it on the ground here"

let nextId = 1;

export function makeItem(type, count = 1, extra = {}) {
  const def = ITEMS[type];
  const item = { id: nextId++, type, count, condition: 100, ...extra };
  if (def.kind === 'canteen' && item.fill === undefined) item.fill = 0;
  if (def.storage) item.contents = new Array(def.storage).fill(null);
  return item;
}

const POCKET_ORDER = ['shirt', 'pants', 'vest', 'backpack'];
const VICINITY_RADIUS = 36; // px
const DROP_MERGE_RADIUS = 12;

export class Inventory {
  constructor() {
    this.version = 0; // bumps on every change, so the UI knows to redraw
    this.playerPos = { x: 0, y: 0 };
    this.reset(0);
  }

  /** New game: starting clothes like the original (T-shirt + jeans), empty world piles. */
  reset(seed) {
    this.seed = seed;
    this.equipment = Object.fromEntries(Object.keys(SLOTS).map((k) => [k, null]));
    this.piles = new Map();
    const shirt = makeItem('tshirt');
    shirt.contents[0] = makeItem('berries', 2);
    const jeans = makeItem('jeans');
    jeans.contents[0] = makeItem('canteen', 1, { fill: 60 });
    this.equipment.shirt = shirt;
    this.equipment.pants = jeans;
    this.changed();
  }

  changed() {
    this.version++;
  }

  /** Total heat from worn clothing. */
  get heat() {
    let h = 0;
    for (const item of Object.values(this.equipment)) if (item) h += ITEMS[item.type].heat || 0;
    return h;
  }

  // ---------- Locations ----------

  get(loc) {
    if (loc.type === 'equip') return this.equipment[loc.slot];
    if (loc.type === 'cell') return this.equipment[loc.slot]?.contents?.[loc.index] ?? null;
    if (loc.type === 'pile') return this.piles.get(loc.key)?.items[loc.index] ?? null;
    return null;
  }

  take(loc) {
    const item = this.get(loc);
    if (!item) return null;
    if (loc.type === 'equip') this.equipment[loc.slot] = null;
    else if (loc.type === 'cell') this.equipment[loc.slot].contents[loc.index] = null;
    else if (loc.type === 'pile') {
      const pile = this.piles.get(loc.key);
      pile.items.splice(loc.index, 1);
      if (pile.dropped && !pile.items.length) this.piles.delete(loc.key);
    }
    return item;
  }

  /** Can `item` go into `loc` (ignoring whether it's occupied)? */
  accepts(loc, item, from) {
    const def = ITEMS[item.type];
    if (loc.type === 'equip') return def.kind === 'clothing' && def.slot === loc.slot && !SLOTS[loc.slot].locked;
    if (loc.type === 'cell') {
      const container = this.equipment[loc.slot];
      if (!container?.contents || loc.index >= container.contents.length) return false;
      if (from?.type === 'equip' && from.slot === loc.slot) return false; // not inside itself
      // Spare clothing can be carried, but only when its own pockets are empty.
      return !item.contents || item.contents.every((c) => !c);
    }
    return loc.type === 'ground';
  }

  /** Move an item. Stacks merge, cells swap, clothing takes its pockets along. */
  move(from, to) {
    const item = this.get(from);
    if (!item || sameLoc(from, to)) return false;
    if (to.type === 'pile') to = { type: 'ground' };
    if (!this.accepts(to, item, from)) return false;

    if (to.type === 'ground') {
      if (from.type === 'pile') return false;
      this.dropOnGround(this.take(from));
      this.changed();
      return true;
    }

    const target = this.get(to);
    if (target) {
      const def = ITEMS[item.type];
      if (target.type === item.type && (def.stack || 1) > 1) {
        const room = def.stack - target.count;
        if (room <= 0) return false;
        const n = Math.min(room, item.count);
        target.count += n;
        item.count -= n;
        if (item.count <= 0) this.take(from);
        this.changed();
        return true;
      }
      // Swap two occupied cells.
      if (from.type === 'cell' && to.type === 'cell' && this.accepts(from, target, to)) {
        this.equipment[from.slot].contents[from.index] = target;
        this.equipment[to.slot].contents[to.index] = item;
        this.changed();
        return true;
      }
      return false;
    }

    this.take(from);
    if (to.type === 'equip') this.equipment[to.slot] = item;
    else this.equipment[to.slot].contents[to.index] = item;
    this.changed();
    return true;
  }

  /** Put an item in the first pocket it fits (stacking first). Returns true if it fit. */
  addToPockets(item) {
    const def = ITEMS[item.type];
    const cells = [];
    for (const slot of POCKET_ORDER) {
      const c = this.equipment[slot]?.contents;
      if (c) c.forEach((_, index) => cells.push({ type: 'cell', slot, index }));
    }
    if ((def.stack || 1) > 1) {
      for (const loc of cells) {
        const t = this.get(loc);
        if (t && t.type === item.type && t.count < def.stack) {
          const n = Math.min(def.stack - t.count, item.count);
          t.count += n;
          item.count -= n;
          if (item.count <= 0) return true;
        }
      }
    }
    for (const loc of cells) {
      if (!this.get(loc) && this.accepts(loc, item)) {
        this.equipment[loc.slot].contents[loc.index] = item;
        return true;
      }
    }
    return false;
  }

  /** Double-click on something in the vicinity: wear it if the slot is free, else pocket it. */
  quickTake(loc) {
    const item = this.get(loc);
    if (!item) return 'There is nothing there.';
    const def = ITEMS[item.type];
    if (def.kind === 'clothing' && !this.equipment[def.slot] && !SLOTS[def.slot].locked) {
      this.move(loc, { type: 'equip', slot: def.slot });
      return null;
    }
    const taken = this.take(loc);
    if (this.addToPockets(taken)) {
      this.changed();
      return null;
    }
    // Didn't fit (or only partly): put the rest back.
    if (taken.count > 0) this.putBack(loc, taken);
    this.changed();
    return 'I have no room for that.';
  }

  putBack(loc, item) {
    const pile = this.piles.get(loc.key);
    if (pile) pile.items.splice(loc.index, 0, item);
    else this.dropOnGround(item);
  }

  dropOnGround(item) {
    const { x, y } = this.playerPos;
    let pile = null;
    for (const p of this.piles.values()) {
      if (p.dropped && Math.hypot(p.x - x, p.y - y) < DROP_MERGE_RADIUS) pile = p;
    }
    if (!pile) {
      pile = { key: `drop:${item.id}`, x, y, label: 'Ground', dropped: true, items: [] };
      this.piles.set(pile.key, pile);
    }
    pile.items.push(item);
  }

  // ---------- Using items ----------

  /** Eat, drink, fill a canteen, or wear. Returns a thought to show, or null. */
  use(loc, survival, nearWater) {
    const item = this.get(loc);
    if (!item) return null;
    const def = ITEMS[item.type];
    if (def.kind === 'food') {
      survival.food = Math.min(100, survival.food + (def.food || 0));
      survival.water = Math.min(100, survival.water + (def.water || 0));
      item.count--;
      if (item.count <= 0) this.take(loc);
      this.changed();
      return def.water > def.food ? 'Refreshing.' : 'That was good.';
    }
    if (def.kind === 'canteen') {
      if (nearWater) {
        item.fill = 100;
        this.changed();
        return 'I filled my canteen.';
      }
      if (item.fill <= 0) return 'My canteen is empty.';
      const sip = Math.min(item.fill, 25);
      item.fill -= sip;
      survival.water = Math.min(100, survival.water + sip * 0.9);
      this.changed();
      return 'Ahh, water.';
    }
    if (def.kind === 'clothing' && loc.type !== 'equip') {
      if (this.equipment[def.slot]) return `I'm already wearing ${ITEMS[this.equipment[def.slot].type].name.toLowerCase()}.`;
      return this.move(loc, { type: 'equip', slot: def.slot }) ? null : "I can't wear that now.";
    }
    return "I can't use that.";
  }

  // ---------- Vicinity ----------

  /**
   * Piles near the player: resources from nearby world objects (berries,
   * sticks, stones...), loot in crates and towers, and dropped items.
   * World piles are created the first time they're seen, so taking from
   * them sticks.
   */
  vicinity(chunks) {
    const { x, y } = this.playerPos;
    const out = [];
    for (const c of chunks.chunks.values()) {
      for (const o of c.data.objects) {
        const d = Math.hypot(o.x - x, o.y - y);
        if (d > VICINITY_RADIUS) continue;
        const pile = this.pileFor(o);
        if (pile?.items.length) out.push({ pile, d });
      }
    }
    for (const p of this.piles.values()) {
      if (!p.dropped) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= VICINITY_RADIUS && p.items.length) out.push({ pile: p, d });
    }
    out.sort((a, b) => a.d - b.d);
    return out.map((o) => o.pile);
  }

  pileFor(o) {
    const key = `${o.type}:${o.x},${o.y}`;
    let pile = this.piles.get(key);
    if (pile) return pile;
    const def = OBJECTS[o.type];
    let items;
    if (o.resource === 'loot') {
      const rng = mulberry32(hashInts(this.seed, o.x, o.y, 55));
      items = [];
      for (let i = 0; i < o.amount + 1; i++) {
        const type = weightedPick(LOOT_TABLE, rng());
        const extra = {};
        if (ITEMS[type].kind === 'canteen') extra.fill = Math.floor(rng() * 5) * 25;
        if (ITEMS[type].kind === 'clothing') extra.condition = 40 + Math.floor(rng() * 7) * 10;
        items.push(makeItem(type, 1, extra));
      }
    } else if (RESOURCE_ITEMS[o.resource]) {
      // Standing trees need an axe (later); other resources can be picked by hand.
      if (['oak', 'autumn', 'pine'].includes(o.type)) return null;
      items = [makeItem(RESOURCE_ITEMS[o.resource], o.amount)];
    } else return null;
    pile = { key, x: o.x, y: o.y, label: def.name, items };
    this.piles.set(key, pile);
    return pile;
  }
}

function sameLoc(a, b) {
  return a.type === b.type && a.slot === b.slot && a.index === b.index && a.key === b.key;
}
