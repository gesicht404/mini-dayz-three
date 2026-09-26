// Item types, equipment slots and their pixel-art icons.

/** Equipment slots, in the order the inventory shows them. */
export const SLOTS = {
  face: { name: 'Face', ghost: 'gasmask' },
  helmet: { name: 'Head', ghost: 'helmet' },
  pistol: { name: 'Sidearm', ghost: 'pistol', locked: true }, // no weapons yet
  shirt: { name: 'Shirt', ghost: 'tshirt' },
  vest: { name: 'Vest', ghost: 'vest' },
  rifle: { name: 'Rifle', ghost: 'rifle', locked: true },
  pants: { name: 'Trousers', ghost: 'jeans' },
  gloves: { name: 'Gloves', ghost: 'gloves' },
  backpack: { name: 'Backpack', ghost: 'backpack' },
};

/**
 * kind: clothing (worn in `slot`, may give `storage` pockets and `heat`),
 * food (restores `food`/`water`), canteen (holds water), material.
 * stack: how many fit in one cell.
 */
export const ITEMS = {
  tshirt: { name: 'T-shirt', kind: 'clothing', slot: 'shirt', heat: 2, storage: 2, icon: 'tshirt' },
  hoodie: { name: 'Hoodie', kind: 'clothing', slot: 'shirt', heat: 4, storage: 3, icon: 'hoodie' },
  jeans: { name: 'Jeans', kind: 'clothing', slot: 'pants', heat: 5, storage: 2, icon: 'jeans' },
  cargo: { name: 'Cargo pants', kind: 'clothing', slot: 'pants', heat: 4, storage: 4, icon: 'cargo' },
  vest: { name: 'Tactical vest', kind: 'clothing', slot: 'vest', heat: 1, storage: 4, icon: 'vest' },
  helmet: { name: 'Helmet', kind: 'clothing', slot: 'helmet', heat: 1, storage: 0, icon: 'helmet' },
  cap: { name: 'Cap', kind: 'clothing', slot: 'helmet', heat: 1, storage: 0, icon: 'cap' },
  gasmask: { name: 'Gas mask', kind: 'clothing', slot: 'face', heat: 1, storage: 0, icon: 'gasmask' },
  gloves: { name: 'Gloves', kind: 'clothing', slot: 'gloves', heat: 2, storage: 0, icon: 'gloves' },
  backpack: { name: 'Backpack', kind: 'clothing', slot: 'backpack', heat: 0, storage: 8, icon: 'backpack' },

  berries: { name: 'Berries', kind: 'food', food: 6, water: 2, stack: 10, icon: 'berries' },
  mushrooms: { name: 'Mushrooms', kind: 'food', food: 5, stack: 10, icon: 'mushrooms' },
  beans: { name: 'Canned beans', kind: 'food', food: 30, stack: 1, icon: 'beans' },
  soda: { name: 'Soda', kind: 'food', water: 25, food: 2, stack: 1, icon: 'soda' },
  canteen: { name: 'Canteen', kind: 'canteen', stack: 1, icon: 'canteen' },

  wood: { name: 'Wood', kind: 'material', stack: 10, icon: 'wood' },
  stone: { name: 'Stone', kind: 'material', stack: 10, icon: 'stone' },
  sticks: { name: 'Sticks', kind: 'material', stack: 10, icon: 'sticks' },
};

/** What a world resource name (from world/objects.js) turns into when picked up. */
export const RESOURCE_ITEMS = { berries: 'berries', food: 'mushrooms', sticks: 'sticks', stone: 'stone', wood: 'wood' };

/** Things that can be found in supply crates and hunting towers. */
export const LOOT_TABLE = {
  beans: 3, soda: 3, canteen: 2, berries: 1,
  hoodie: 1.5, cargo: 1.5, vest: 1, helmet: 1, cap: 1.5, gasmask: 0.6, gloves: 1.5, backpack: 1.2,
};

// ---------- Icons ----------
// Text grids: each character is a colour key, '.' is empty. K is the outline.

const K = '#1a140e';

export const ICONS = {
  tshirt: {
    pal: { K, G: '#5d7a3c', L: '#7a9a50', D: '#435a2a' },
    rows: [
      '..KKKK..KKKK..',
      '.KGGGGKKGGGGK.',
      'KGLGGGGGGGGGGK',
      'KGLGGGGGGGGGGK',
      'KKKGGGGGGGGKKK',
      '..KGGGGGGGGK..',
      '..KGGGGGGGGK..',
      '..KGGGGGGGGK..',
      '..KDDDDDDDDK..',
      '..KKKKKKKKKK..',
    ],
  },
  hoodie: {
    pal: { K, G: '#6a6a72', L: '#86868e', D: '#4c4c54', H: '#3a3a42' },
    rows: [
      '....KKKKKK....',
      '..KKGHHHHGKK..',
      '.KGGGKHHKGGGK.',
      'KGLGGGKKGGGGGK',
      'KGLGGGGGGGGGGK',
      'KKKGGGGGGGGKKK',
      '..KGGGGGGGGK..',
      '..KGDDDDDDGK..',
      '..KGDGGGGDGK..',
      '..KDDDDDDDDK..',
      '..KKKKKKKKKK..',
    ],
  },
  jeans: {
    pal: { K, B: '#2e3f63', J: '#3e5689', L: '#5670a6', D: '#2c3d62' },
    rows: [
      'KKKKKKKKKKK',
      'KBBBBBBBBBK',
      'KLJJJJJJJJK',
      'KLJJJJJJJJK',
      'KLJJJKJJJJK',
      'KLJJK.KJJJK',
      'KLJJK.KJJJK',
      'KLJJK.KJJJK',
      'KLJJK.KJJJK',
      'KDDDK.KDDDK',
      'KKKKK.KKKKK',
    ],
  },
  cargo: {
    pal: { K, B: '#4a4630', J: '#6d6747', L: '#877f5a', D: '#524d35', P: '#58533a' },
    rows: [
      'KKKKKKKKKKK',
      'KBBBBBBBBBK',
      'KLJJJJJJJJK',
      'KLJJJKJJJJK',
      'KPPJK.KJPPK',
      'KPPJK.KJPPK',
      'KLJJK.KJJJK',
      'KLJJK.KJJJK',
      'KDDDK.KDDDK',
      'KKKKK.KKKKK',
    ],
  },
  vest: {
    pal: { K, V: '#4d4634', P: '#3a3426', L: '#655c45' },
    rows: [
      '..KK....KK..',
      '.KVVK..KVVK.',
      '.KVLVKKVVVK.',
      'KVLVVVVVVVVK',
      'KVPPVVVVPPVK',
      'KVPPVVVVPPVK',
      'KVVVVVVVVVVK',
      'KVPPVVVVPPVK',
      'KVPPVVVVPPVK',
      'KKKKKKKKKKKK',
    ],
  },
  helmet: {
    pal: { K, H: '#4b5634', L: '#6a7a4a', D: '#333b23' },
    rows: [
      '...KKKKKK...',
      '..KHHLHHHK..',
      '.KHLHHHHHHK.',
      '.KHHHHHHHHK.',
      'KHHHHHHHHHHK',
      'KHHHHHHHHHHK',
      'KDDDDDDDDDDK',
      'KKKKKKKKKKKK',
    ],
  },
  cap: {
    pal: { K, C: '#7a3a2e', L: '#9a5040', D: '#5a2a22' },
    rows: [
      '..KKKKKK.....',
      '.KCCLCCCK....',
      'KCCLCCCCCK...',
      'KCCCCCCCCK...',
      'KDDDDDDDDDKKK',
      'KKKKKKKKKKDDK',
      '.........KKK.',
    ],
  },
  gasmask: {
    pal: { K, M: '#3e4238', E: '#7aa0a8', F: '#5a5e52' },
    rows: [
      '..KKKKKKKK..',
      '.KMMMMMMMMK.',
      'KMMEEMMEEMMK',
      'KMMEEMMEEMMK',
      'KMMMMMMMMMMK',
      '.KMMMKKMMMK.',
      '..KMKFFKMK..',
      '...KKFFKK...',
      '....KKKK....',
    ],
  },
  gloves: {
    pal: { K, G: '#5a4632', L: '#735a40', D: '#44352a' },
    rows: [
      '..KKKKKK..',
      '.KGGGGGGK.',
      'KGLKGGKGGK',
      'KGLGGGGGGK',
      'KGGGGGGGGK',
      'KGGGGGGGGK',
      '.KGGGGGGK.',
      '..KGGGGK..',
      '..KDDDDK..',
      '..KKKKKK..',
    ],
  },
  backpack: {
    pal: { K, P: '#5c6440', L: '#76805a', D: '#434a2e' },
    rows: [
      '....KKKK....',
      '...K....K...',
      '.KKKKKKKKKK.',
      'KPPLPPPPPPPK',
      'KPLPPPPPPPPK',
      'KDDDDDDDDDDK',
      'KPPPPKKPPPPK',
      'KPPPPPPPPPPK',
      'KPKKKKKKKKPK',
      'KPKPPPPPPKPK',
      'KPKPPPPPPKPK',
      'KDKKKKKKKKDK',
      '.KKKKKKKKKK.',
    ],
  },
  berries: {
    pal: { K, R: '#5a3a78', W: '#a88ac8', L: '#5d7a3a' },
    rows: [
      '....LLL...',
      '...LLL....',
      '..KKK.KKK.',
      '.KRWRKRWRK',
      '.KRRRKRRRK',
      '..KKKRKKK.',
      '...KRWRK..',
      '...KRRRK..',
      '....KKK...',
    ],
  },
  mushrooms: {
    pal: { K, R: '#a4563c', W: '#e6d8c0', S: '#d8ccb0' },
    rows: [
      '..KKKKK...',
      '.KRRWRRK..',
      'KRRRRRRRK.',
      'KKKKKKKKK.',
      '...KSK....',
      '...KSK....',
      '..KKSKK...',
    ],
  },
  beans: {
    pal: { K, S: '#a8aab0', C: '#7a7c82', L: '#c8a050', R: '#a04030' },
    rows: [
      '.KKKKKK.',
      'KSSSSSSK',
      'KKKKKKKK',
      'KCCCCCCK',
      'KLLLLLLK',
      'KLRRRRLK',
      'KLLLLLLK',
      'KCCCCCCK',
      'KKKKKKKK',
    ],
  },
  soda: {
    pal: { K, S: '#b0b2b8', R: '#b83a36', W: '#e8e0d8', D: '#8a2a26' },
    rows: [
      '.KKKKK.',
      'KSSSSSK',
      'KRRRRRK',
      'KRWRRRK',
      'KRWRRRK',
      'KRRRRRK',
      'KRRRRRK',
      'KDDDDDK',
      'KSSSSSK',
      '.KKKKK.',
    ],
  },
  canteen: {
    pal: { K, G: '#5a6a44', L: '#7a8a5a', D: '#3e4a2e', C: '#2a2a28' },
    rows: [
      '...KKK....',
      '...KCK....',
      '..KKKKK...',
      '.KGGGGGK..',
      'KGGLGGGGK.',
      'KGLGGGGGK.',
      'KGGGGGGGK.',
      'KGGGGGGGK.',
      'KDGGGGGDK.',
      '.KDDDDDK..',
      '..KKKKK...',
    ],
  },
  wood: {
    pal: { K, L: '#8a6a48', B: '#6b4f34', D: '#4f3a26', R: '#b09070', W: '#8a6a48' },
    rows: [
      '..KKKKKKKK..',
      '.KLLLLLLKRK.',
      '.KBBBBBBKWK.',
      '.KDDDDDDKRK.',
      '..KKKKKKKK..',
      'KKKKKKKK....',
      'KLLLLLLKRK..',
      'KBBBBBBKWK..',
      'KDDDDDDKRK..',
      '.KKKKKKKK...',
    ],
  },
  stone: {
    pal: { K, L: '#c2bfb5', W: '#e2dfd6', S: '#99968d', D: '#6f6d66' },
    rows: [
      '...KKKK...',
      '..KLLLLK..',
      '.KLWLLSSK.',
      'KLLLLSSSSK',
      'KSSSSSSDDK',
      'KSSSSSDDDK',
      '.KDDDDDDK.',
      '..KKKKKK..',
    ],
  },
  sticks: {
    pal: { K, B: '#7a5a3c' },
    rows: [
      'KK.......KK.',
      'KBK.....KBK.',
      '.KBK...KBK..',
      '..KBK.KBK...',
      '...KBKBK....',
      '....KBK.....',
      '...KBKBK....',
      '..KBK.KBK...',
      '.KBK...KBK..',
      'KBK.....KBK.',
      'KK.......KK.',
    ],
  },
  // Ghost-only silhouettes for weapon slots.
  pistol: {
    pal: { K, G: '#555' },
    rows: [
      'KKKKKKKKKKK',
      'KGGGGGGGGGK',
      'KGGGGGGGGGK',
      'KGGGKKKKKKK',
      'KGGGK......',
      'KGGGK......',
      'KKKKK......',
    ],
  },
  rifle: {
    pal: { K, G: '#555' },
    rows: [
      '..........K.............',
      'KKKKKKKKKKKKKKKKKKKKKKKK',
      'KGGGGGGGGGGGGGGGGGGGGGGK',
      'KGGGGGKGGGKGGGGKKKKKKKKK',
      'KGGGGK.KGGK.KGGK........',
      'KKKKK..KGK...KK.........',
      '.......KKK..............',
    ],
  },
};

const iconCache = new Map();

/**
 * An icon as a canvas (1 canvas pixel = 1 art pixel).
 * ghost: draw as a dark silhouette for empty slots. rotate: turn 90 degrees.
 */
export function iconCanvas(name, { ghost = false, rotate = false } = {}) {
  const key = `${name}|${ghost}|${rotate}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const { pal, rows } = ICONS[name];
  const w = rows[0].length;
  const h = rows.length;
  const c = document.createElement('canvas');
  c.width = rotate ? h : w;
  c.height = rotate ? w : h;
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = ghost ? (ch === 'K' ? '#2e261d' : '#4a4034') : pal[ch];
      if (rotate) ctx.fillRect(h - 1 - y, x, 1, 1);
      else ctx.fillRect(x, y, 1, 1);
    });
  });
  iconCache.set(key, c);
  return c;
}
