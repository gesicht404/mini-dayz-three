import { hashFloat } from './world/rng.js';

// The in-game HUD, laid out like Mini DayZ: portrait (top-left), stat bars
// (top-centre), clock + menu buttons (top-right), interact button (right),
// backpack (bottom-left), walk/run toggle (bottom-right), thoughts above the
// player. Icons and parchment are pixel art drawn in code; the CSS variable
// --u is the size of one art pixel.

// ---------- Pixel-art helpers ----------

function artCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.className = 'art';
  c.style.width = `calc(var(--u) * ${w})`;
  c.style.height = `calc(var(--u) * ${h})`;
  return c;
}

/** Draw a text grid; each character is a key into `pal`, '.' is empty. */
function drawGrid(ctx, rows, pal, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(ox + x, oy + y, 1, 1);
    });
  });
}

/** Add a 1 px outline around everything already drawn. */
function outline(ctx, w, h, color) {
  const img = ctx.getImageData(0, 0, w, h);
  const a = (x, y) => x >= 0 && y >= 0 && x < w && y < h && img.data[(y * w + x) * 4 + 3] > 0;
  ctx.fillStyle = color;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** Worn parchment: speckled beige, rough dark border, light inner edge. */
function parchment(ctx, w, h, seed) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = hashFloat(x, y, seed);
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      const corner = (x < 1 || x > w - 2) && (y < 1 || y > h - 2);
      if (corner) continue;
      if (edge) {
        if (r < 0.12) continue; // small notches in the border
        ctx.fillStyle = r < 0.5 ? '#4a3c28' : '#5c4b32';
      } else if (x === 1 || y === 1) ctx.fillStyle = '#e2d7b6';
      else if (x === w - 2 || y === h - 2) ctx.fillStyle = '#a6976f';
      else ctx.fillStyle = r < 0.08 ? '#b3a47c' : r > 0.94 ? '#ddd1ad' : r > 0.5 ? '#cbbd96' : '#c6b890';
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// ---------- Icons ----------

const ICONS = {
  heart: {
    pal: { W: '#ffffff', R: '#c9cdd8', D: '#8b91a2' },
    rows: [
      '.RR.RR.',
      'RWRRRRR',
      'RWRRRRD',
      '.RRRRD.',
      '..RRD..',
      '...D...',
    ],
  },
  water: {
    pal: { B: '#9fbccb', W: '#eef5f8', D: '#6b8898' },
    rows: [
      '..B..',
      '..B..',
      '.BBB.',
      'BWBBB',
      'BWBBB',
      'BBBBD',
      '.BBD.',
    ],
  },
  food: {
    pal: { W: '#e8e8e8', D: '#a8a8a8' },
    rows: [
      'W.W..WW',
      'W.W..WD',
      'W.W..WD',
      'WWW..WD',
      '.W...WD',
      '.W....W',
      '.W....W',
      '.D....D',
    ],
  },
  temperature: {
    pal: { G: '#c9cdd8', W: '#ffffff', R: '#c8483a' },
    rows: [
      '.GGG.',
      'GWWWG',
      'G.W.G',
      'G.W.G',
      'G.R.G',
      'GRRRG',
      'GRRRG',
      '.GGG.',
    ],
  },
  clock: {
    pal: { K: '#2a2218', W: '#e9e0c6' },
    rows: [
      '..KKKKK..',
      '.KWWWWWK.',
      'KWWWKWWWK',
      'KWWWKWWWK',
      'KWWWKKKWK',
      'KWWWWWWWK',
      'KWWWWWWWK',
      '.KWWWWWK.',
      '..KKKKK..',
    ],
  },
};

function iconCanvas(name) {
  const { pal, rows } = ICONS[name];
  const c = artCanvas(rows[0].length + 2, rows.length + 2);
  const ctx = c.getContext('2d');
  drawGrid(ctx, rows, pal, 1, 1);
  outline(ctx, c.width, c.height, '#15110c');
  return c;
}

/** Big button icons, drawn with shapes onto a parchment square. */
const BUTTON_ART = {
  gear(ctx, s) {
    const c = s / 2;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const r = Math.hypot(dx, dy);
        const tooth = Math.cos(Math.atan2(dy, dx) * 8) > 0.2;
        if (r < 2.2 || r > (tooth ? 7 : 5.3)) continue;
        ctx.fillStyle = r > 5 ? '#1d1812' : '#2c241a';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  },
  journal(ctx) {
    const K = '#1d1812';
    ctx.fillStyle = K;
    ctx.fillRect(3, 2, 11, 14);
    ctx.fillStyle = '#e6dcc0';
    ctx.fillRect(4, 3, 9, 12);
    ctx.fillStyle = '#8c7f63';
    for (let y = 6; y < 14; y += 2) ctx.fillRect(5, y, 7, 1);
    ctx.fillStyle = K;
    for (let x = 4; x < 13; x += 2) ctx.fillRect(x, 1, 1, 3);
    // pencil
    ctx.fillStyle = '#c8a040';
    for (let i = 0; i < 6; i++) ctx.fillRect(9 + i * 0.5, 9 + i, 2, 1);
    ctx.fillStyle = K;
    ctx.fillRect(12, 15, 1, 1);
  },
  hand(ctx) {
    const S = '#dcae86';
    const D = '#a8755a';
    ctx.fillStyle = S;
    [[4, 3, 6], [6, 2, 7], [8, 2, 7], [10, 3, 6]].forEach(([x, y, h]) => ctx.fillRect(x, y, 2, h));
    ctx.fillRect(4, 8, 8, 5);
    ctx.fillRect(2, 8, 2, 2);
    ctx.fillRect(3, 10, 2, 2);
    ctx.fillStyle = D;
    ctx.fillRect(5, 12, 7, 1);
    ctx.fillRect(11, 8, 1, 5);
    // a leaf being picked up
    ctx.fillStyle = '#5d7a3a';
    ctx.fillRect(6, 13, 4, 2);
    ctx.fillRect(7, 15, 2, 1);
    outline(ctx, 18, 18, '#1d1812');
  },
  backpack(ctx) {
    const K = '#1d1812';
    ctx.fillStyle = '#8b8a80';
    ctx.fillRect(3, 4, 12, 13);
    ctx.fillStyle = '#a9a89c';
    ctx.fillRect(3, 4, 12, 5);
    ctx.fillStyle = '#6d6c64';
    ctx.fillRect(5, 11, 8, 5);
    ctx.fillStyle = '#595850';
    ctx.fillRect(5, 11, 8, 1);
    ctx.fillStyle = K;
    ctx.fillRect(7, 1, 4, 1);
    ctx.fillRect(7, 1, 1, 3);
    ctx.fillRect(10, 1, 1, 3);
    ctx.fillRect(8, 8, 2, 2);
    outline(ctx, 18, 18, K);
  },
  boot(ctx) {
    ctx.fillStyle = '#6b4a30';
    ctx.fillRect(4, 2, 6, 9);
    ctx.fillRect(4, 10, 10, 3);
    ctx.fillStyle = '#8a6444';
    ctx.fillRect(5, 2, 1, 9);
    ctx.fillStyle = '#2a1e14';
    ctx.fillRect(4, 13, 10, 2);
    ctx.fillStyle = '#4a3322';
    for (let y = 4; y < 10; y += 2) ctx.fillRect(7, y, 3, 1);
    outline(ctx, 18, 18, '#1d1812');
  },
};

function buttonCanvas(name, seed) {
  const size = 22;
  const c = artCanvas(size, size);
  const ctx = c.getContext('2d');
  parchment(ctx, size, size, seed);
  const icon = document.createElement('canvas');
  icon.width = 18;
  icon.height = 18;
  BUTTON_ART[name](icon.getContext('2d'), 18);
  ctx.drawImage(icon, 2, 2);
  return c;
}

// ---------- HUD ----------

const BARS = [
  { key: 'health', icon: 'heart', color: 'health' },
  { key: 'water', icon: 'water', color: 'water' },
  { key: 'food', icon: 'food', color: 'food' },
  { key: 'temperature', icon: 'temperature', color: 'temp' },
];

export class Hud {
  /**
   * @param root   element to build into
   * @param atlas  sprite atlas ({ canvas, rects }) for the portrait
   * @param actions callbacks: settings, journal, interact, backpack, toggleRun
   */
  constructor(root, atlas, actions) {
    this.atlas = atlas;
    this.root = root;
    root.innerHTML = '';

    // Portrait
    this.portrait = artCanvas(34, 34);
    const portraitBox = el('div', 'hud-portrait');
    this.score = el('div', 'hud-score', '0');
    portraitBox.append(this.portrait, this.score);

    // Bars
    const bars = el('div', 'hud-bars');
    this.bars = {};
    for (const b of BARS) {
      const wrap = el('div', 'hud-stat');
      const bar = el('div', 'hud-bar');
      const fill = el('div', `hud-fill ${b.color}`);
      bar.append(fill);
      if (b.key === 'temperature') {
        this.tempMark = el('div', 'hud-temp-mark');
        this.tempText = el('span', 'hud-temp-text', '0');
        this.tempMark.append(this.tempText);
        bar.append(this.tempMark);
      }
      wrap.append(iconCanvas(b.icon), bar);
      bars.append(wrap);
      this.bars[b.key] = fill;
    }

    // Clock + menu buttons (top-right)
    const right = el('div', 'hud-right');
    const clock = el('div', 'hud-clock');
    const clockBg = artCanvas(46, 15);
    parchment(clockBg.getContext('2d'), 46, 15, 71);
    this.clockText = el('span', 'hud-clock-text', '08:00');
    const clockIcon = iconCanvas('clock');
    clockIcon.classList.add('hud-clock-icon');
    clock.append(clockBg, clockIcon, this.clockText);
    right.append(
      clock,
      button('gear', 11, 'Settings (F3)', actions.settings),
      button('journal', 12, 'Journal', actions.journal),
    );

    const interact = button('hand', 13, 'Interact', actions.interact);
    interact.classList.add('hud-interact');
    const backpack = button('backpack', 14, 'Backpack', actions.backpack);
    backpack.classList.add('hud-backpack');
    this.runButton = button('boot', 15, 'Walk / run', actions.toggleRun);
    this.runButton.classList.add('hud-run');

    // Thoughts above the player, and the night tint
    this.thoughts = el('div', 'hud-thoughts');
    this.night = el('div', 'hud-night');

    root.append(this.night, portraitBox, bars, right, interact, backpack, this.runButton, this.thoughts);
  }

  /** Redraw the portrait from the character's front idle frame (head only, 2x). */
  setCharacter(id) {
    const r = this.atlas.rects[`${id}_idle_down_0`];
    const size = this.atlas.canvas.width;
    const ctx = this.portrait.getContext('2d');
    ctx.clearRect(0, 0, 34, 34);
    parchment(ctx, 34, 34, 7);
    ctx.fillStyle = '#6f6a55';
    ctx.fillRect(2, 2, 30, 30);
    ctx.imageSmoothingEnabled = false;
    // The head sits in the upper part of the frame; crop 15 x 15 and scale 2x.
    const sx = r.u0 * size + Math.floor((r.w - 15) / 2);
    const sy = (1 - r.v1) * size + 2;
    ctx.drawImage(this.atlas.canvas, sx, sy, 15, 15, 2, 2, 30, 30);
  }

  /**
   * @param s        Survival state
   * @param running  whether run mode is on (highlights the boot button)
   * @param headY    screen y (CSS px) just above the player's head, for thoughts
   */
  update(s, { running, headY }) {
    this.bars.health.style.width = `${s.health}%`;
    this.bars.water.style.width = `${s.water}%`;
    this.bars.food.style.width = `${s.food}%`;
    // Temperature bar: -5 (empty) .. +5 (full), marker shows the value.
    const t = Math.max(-5, Math.min(5, s.temperature));
    const pct = ((t + 5) / 10) * 100;
    this.bars.temperature.style.width = `${pct}%`;
    this.tempMark.style.left = `${pct}%`;
    this.tempText.textContent = String(Math.round(s.temperature));
    this.clockText.textContent = s.clockText;
    this.score.textContent = String(s.stats.score);
    this.night.style.opacity = (s.darkness * 0.6).toFixed(3);
    this.runButton.classList.toggle('active', running);

    const thoughts = s.visibleThoughts;
    this.thoughts.innerHTML = thoughts.map((t) => `<div>${t}</div>`).join('');
    this.thoughts.style.display = thoughts.length ? 'block' : 'none';
    this.thoughts.style.top = `${headY}px`;
  }
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(icon, seed, title, onClick) {
  const b = document.createElement('button');
  b.className = 'hud-button';
  b.title = title;
  b.append(buttonCanvas(icon, seed));
  b.addEventListener('click', () => {
    onClick?.();
    b.blur();
  });
  return b;
}
