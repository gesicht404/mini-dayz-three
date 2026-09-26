import { ITEMS, SLOTS, iconCanvas } from './items.js';

// The inventory panel, laid out like Mini DayZ: "Vicinity" on the left,
// equipment slots on the right. Worn clothing shows as a parchment card with
// condition, heat and its pockets. Drag items to move them, double-click to
// use them, drag onto Vicinity to drop them.

const CELL_SCALE = 2; // art pixels -> HUD units for item icons
const GHOST_SCALE = 3; // bigger silhouettes in empty slots

export class InventoryUI {
  /**
   * @param root     element to build into
   * @param inv      Inventory
   * @param actions  { use(loc), quickTake(loc), close() } — use/quickTake return a thought or null
   */
  constructor(root, inv, actions) {
    this.root = root;
    this.inv = inv;
    this.actions = actions;
    this.chunks = null;
    this.drag = null;
    this.lastSig = '';

    root.innerHTML = `
      <div class="inv-panel">
        <div class="inv-vicinity" data-drop='{"type":"ground"}'>
          <div class="inv-title">Vicinity</div>
          <div class="inv-vlist"></div>
        </div>
        <div class="inv-equip"></div>
      </div>
      <div class="inv-hint">Drag to move · double-click to use · drag to Vicinity to drop · I / Esc to close</div>`;
    this.vlist = root.querySelector('.inv-vlist');
    this.equip = root.querySelector('.inv-equip');

    root.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    root.addEventListener('dblclick', (e) => {
      const el = e.target.closest('.inv-item');
      if (!el) return;
      const loc = JSON.parse(el.dataset.loc);
      if (loc.type === 'pile') this.actions.quickTake(loc);
      else this.actions.use(loc);
      this.render();
    });
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get open() {
    return !this.root.classList.contains('hidden');
  }

  toggle(chunks) {
    this.chunks = chunks;
    this.root.classList.toggle('hidden');
    if (this.open) this.render();
  }

  close() {
    this.root.classList.add('hidden');
  }

  /** Re-render when something changed (inventory, or what's nearby). */
  refresh() {
    if (!this.open || this.drag) return;
    const piles = this.inv.vicinity(this.chunks);
    const sig = `${this.inv.version}|${piles.map((p) => `${p.key}:${p.items.length}`).join(',')}`;
    if (sig !== this.lastSig) this.render(piles);
  }

  render(piles = this.inv.vicinity(this.chunks)) {
    this.lastSig = `${this.inv.version}|${piles.map((p) => `${p.key}:${p.items.length}`).join(',')}`;

    // Vicinity
    this.vlist.innerHTML = '';
    if (!piles.length) this.vlist.append(el('div', 'inv-empty', 'Nothing nearby'));
    for (const pile of piles) {
      const group = el('div', 'inv-pile');
      group.append(el('div', 'inv-pile-label', pile.label));
      const cells = el('div', 'inv-cells');
      pile.items.forEach((item, index) => {
        const cell = el('div', 'inv-cell');
        cell.append(itemEl(item, { type: 'pile', key: pile.key, index }));
        cells.append(cell);
      });
      group.append(cells);
      this.vlist.append(group);
    }

    // Equipment
    this.equip.innerHTML = '';
    for (const [slot, info] of Object.entries(SLOTS)) {
      const box = el('div', `inv-slot slot-${slot}`);
      box.dataset.drop = JSON.stringify({ type: 'equip', slot });
      const item = this.inv.equipment[slot];
      if (!item) {
        box.classList.add('empty');
        if (info.locked) box.classList.add('locked');
        box.title = info.locked ? `${info.name} (no weapons yet)` : info.name;
        box.append(artImg(iconCanvas(info.ghost, { ghost: true, rotate: slot === 'rifle' }), GHOST_SCALE));
      } else {
        box.classList.add('card');
        box.append(this.card(slot, item));
      }
      this.equip.append(box);
    }
  }

  card(slot, item) {
    const def = ITEMS[item.type];
    const wrap = el('div', 'inv-card');
    const head = el('div', 'inv-card-head');
    head.append(itemEl(item, { type: 'equip', slot }));
    const text = el('div', 'inv-card-text');
    text.append(el('div', '', `(${item.condition}%)`));
    if (def.heat) text.append(el('div', '', `Heat +${def.heat}`));
    head.append(text);
    wrap.append(head);
    if (item.contents) {
      const cells = el('div', 'inv-cells');
      item.contents.forEach((c, index) => {
        const loc = { type: 'cell', slot, index };
        const cell = el('div', 'inv-cell');
        cell.dataset.drop = JSON.stringify(loc);
        if (c) cell.append(itemEl(c, loc));
        cells.append(cell);
      });
      wrap.append(cells);
    }
    return wrap;
  }

  // ---------- Drag & drop ----------

  onPointerDown(e) {
    const el = e.target.closest('.inv-item');
    if (!el || e.button !== 0) return;
    this.drag = { el, loc: JSON.parse(el.dataset.loc), x: e.clientX, y: e.clientY, ghost: null };
  }

  onPointerMove(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.ghost && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) {
      d.ghost = d.el.cloneNode(true);
      d.ghost.classList.add('inv-ghost');
      document.body.append(d.ghost);
      d.el.classList.add('dragging');
    }
    if (d.ghost) {
      d.ghost.style.left = `${e.clientX}px`;
      d.ghost.style.top = `${e.clientY}px`;
      for (const t of this.root.querySelectorAll('.drop-hover')) t.classList.remove('drop-hover');
      this.dropTarget(e)?.classList.add('drop-hover');
    }
  }

  onPointerUp(e) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (!d.ghost) return; // a plain click
    d.ghost.remove();
    d.el.classList.remove('dragging');
    const target = this.dropTarget(e);
    if (target) this.inv.move(d.loc, JSON.parse(target.dataset.drop));
    this.render();
  }

  dropTarget(e) {
    return document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop]') ?? null;
  }
}

// ---------- Elements ----------

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Copy an icon canvas into a new element, scaled by whole HUD units. */
function artImg(src, scale) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  c.className = 'art';
  c.style.width = `calc(var(--u) * ${src.width * scale})`;
  c.style.height = `calc(var(--u) * ${src.height * scale})`;
  return c;
}

function itemEl(item, loc) {
  const def = ITEMS[item.type];
  const e = el('div', 'inv-item');
  e.dataset.loc = JSON.stringify(loc);
  e.append(artImg(iconCanvas(def.icon), CELL_SCALE));
  if (def.kind === 'canteen') e.append(el('span', 'inv-badge', `${item.fill}%`));
  else if (item.count > 1) e.append(el('span', 'inv-badge', String(item.count)));
  let tip = def.name;
  if (def.kind === 'clothing') tip += ` (${item.condition}%)${def.heat ? `, heat +${def.heat}` : ''}${def.storage ? `, ${def.storage} slots` : ''}`;
  if (def.kind === 'food') tip += ` — double-click to ${def.water > def.food ? 'drink' : 'eat'}`;
  if (def.kind === 'canteen') tip += ` (${item.fill}%) — double-click to drink, or near water to fill`;
  e.title = tip;
  return e;
}
