import * as THREE from "three";
import {
  WorldGenerator,
  BIOME_NAMES,
  CHUNK_PX,
  TILE,
  isWaterBiome,
} from "./world/generator.js";
import { ChunkManager } from "./world/chunks.js";
import { OBJECTS } from "./world/objects.js";
import { seedFromText } from "./world/rng.js";
import { buildSprites, loadPlayerSheet } from "./gfx/sprites.js";
import { biomeColor } from "./gfx/ground.js";
import { FogMemory, FOG_COLOR } from "./world/fog.js";
import { Player } from "./player.js";
import { Survival } from "./survival.js";
import { Hud } from "./hud.js";
import { Inventory } from "./inventory.js";
import { InventoryUI } from "./inventoryUI.js";
import { isWaterBiome as isWater } from "./world/biomes.js";

// ---------- Renderer & pixel-perfect camera ----------
// The scene is rendered at low resolution, then scaled up by a whole
// number with CSS "pixelated", so every art pixel is a crisp square.

const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
renderer.setClearColor(0x1a1a14);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);

const ZOOM_IN_MAX = 4;
let zoom = 0; // whole-number steps added to the pixel scale; + is closer
try {
  zoom = Number(localStorage.getItem("zoom")) || 0;
} catch {
  // storage unavailable: start at the default zoom
}
let viewW = 0;
let viewH = 0;
let pixelScale = 1;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const devW = window.innerWidth * dpr;
  const devH = window.innerHeight * dpr;
  // Aim for ~540 world pixels of height (2x on a 1080p screen), like Mini DayZ.
  const baseScale = Math.round(devH / 320);
  pixelScale = Math.max(1, Math.min(baseScale + ZOOM_IN_MAX, baseScale + zoom));
  zoom = pixelScale - baseScale; // so a step past a limit is never a dead key press
  viewW = Math.ceil(devW / pixelScale);
  viewH = Math.ceil(devH / pixelScale);
  renderer.setSize(viewW, viewH, false);
  canvas.style.width = `${(viewW * pixelScale) / dpr}px`;
  canvas.style.height = `${(viewH * pixelScale) / dpr}px`;
  camera.left = -Math.floor(viewW / 2);
  camera.right = viewW - Math.floor(viewW / 2);
  camera.bottom = -Math.floor(viewH / 2);
  camera.top = viewH - Math.floor(viewH / 2);
  camera.updateProjectionMatrix();
  // HUD art pixels stay at a fixed size (2x on 1080p) regardless of game zoom.
  const hudScale = Math.max(2, Math.round(devH / 540));
  document.documentElement.style.setProperty("--u", `${hudScale / dpr}px`);
}
window.addEventListener("resize", resize);
resize();

function zoomBy(step) {
  const before = zoom;
  zoom += step;
  resize();
  if (zoom === before) return;
  try {
    localStorage.setItem("zoom", zoom);
  } catch {
    // not remembered, that's fine
  }
}

// Mouse wheel, and trackpad pinch (which arrives as ctrl + wheel). Deltas are
// summed so a trackpad's stream of tiny events still zooms one step at a time.
let wheelSum = 0;
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault(); // stop ctrl + wheel zooming the whole page
    const px =
      e.deltaMode === 1
        ? e.deltaY * 33
        : e.deltaMode === 2
          ? e.deltaY * 800
          : e.deltaY;
    wheelSum += e.ctrlKey ? px * 5 : px;
    if (Math.abs(wheelSum) >= 100) {
      zoomBy(wheelSum < 0 ? 1 : -1);
      wheelSum = 0;
    }
  },
  { passive: false },
);

// Two-finger pinch on touch screens: one step per 25% change in finger distance.
const touches = new Map();
let pinchDist = 0;
const fingerDist = () => {
  const [a, b] = touches.values();
  return Math.hypot(a.x - b.x, a.y - b.y);
};
canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch") return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) pinchDist = fingerDist();
});
canvas.addEventListener("pointermove", (e) => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size !== 2 || !pinchDist) return;
  const ratio = fingerDist() / pinchDist;
  if (ratio > 1.25 || ratio < 0.8) {
    zoomBy(ratio > 1 ? 1 : -1);
    pinchDist = fingerDist();
  }
});
for (const type of ["pointerup", "pointercancel"]) {
  canvas.addEventListener(type, (e) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinchDist = 0;
  });
}

// ---------- World ----------

const sprites = buildSprites(await loadPlayerSheet());
const params = new URLSearchParams(location.search);
let seedText = params.get("seed") || String(Math.floor(Math.random() * 1e9));
let gen = new WorldGenerator(seedFromText(seedText));
const chunks = new ChunkManager(scene, gen, sprites);
const player = new Player(
  scene,
  sprites.atlas.rects,
  sprites.playerAnims,
  chunks.objectMat,
  chunks.shadowMat,
);
const survival = new Survival();
const inventory = new Inventory();
// Fog of war: which tiles have been seen (saved per seed), for the minimap.
let storage = null;
try {
  storage = window.localStorage;
} catch {
  // storage unavailable: fog is remembered for this visit only
}
const fog = new FogMemory(storage ?? { getItem: () => null, setItem() {} });
window.addEventListener("pagehide", () => fog.save());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) fog.save();
});
let runToggle = false; // the boot button: run without holding Shift

/** Nearest free spot to a point, searching outwards in a spiral. */
function findSpawn(x, y) {
  const wasExploring = player.explore;
  player.explore = false;
  for (let r = 0; r < 4000; r += 8) {
    const steps = Math.max(1, Math.floor((r * Math.PI * 2) / 8));
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const px = Math.round(x + Math.cos(a) * r);
      const py = Math.round(y + Math.sin(a) * r);
      // Make sure the chunks there exist so tree collisions are known.
      chunks.update(px, py, 64, 64, 0, true);
      if (player.canStand(px, py, gen, chunks)) {
        player.explore = wasExploring;
        return [px, py];
      }
    }
  }
  player.explore = wasExploring;
  return [x, y];
}

function startWorld(text, x = 0, y = 0) {
  seedText = String(text).trim() || "0";
  gen = new WorldGenerator(seedFromText(seedText));
  chunks.setGenerator(gen);
  [player.x, player.y] = findSpawn(x, y);
  chunks.update(player.x, player.y, viewW, viewH, 0, true);
  survival.reset(); // a new world is a new game
  inventory.reset(gen.seed);
  fog.load(seedText);
  inventory.playerPos = { x: player.x, y: player.y };
  ui.seed.value = seedText;
  document.activeElement?.blur(); // give the keyboard back to the game
  const url = new URL(location.href);
  url.searchParams.set("seed", seedText);
  history.replaceState(null, "", url);
}

function teleport(tileX, tileY) {
  [player.x, player.y] = findSpawn(tileX * TILE, tileY * TILE);
  chunks.update(player.x, player.y, viewW, viewH, 0, true);
}

// ---------- Input ----------

const input = { up: false, down: false, left: false, right: false, run: false };
const KEYS = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "run",
  ShiftRight: "run",
};

window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.code === "F3") {
    e.preventDefault();
    toggleDebug();
  } else if (e.code === "KeyI" || e.code === "Tab") {
    e.preventDefault();
    invUI.toggle(chunks);
  } else if (e.code === "Escape" && invUI.open) {
    invUI.close();
  } else if (
    e.code === "KeyJ" ||
    (e.code === "Escape" && !ui.journal.classList.contains("hidden"))
  ) {
    toggleJournal();
  } else if (KEYS[e.code]) {
    input[KEYS[e.code]] = true;
    e.preventDefault();
  } else if (e.code === "KeyF") {
    player.explore = !player.explore;
  } else if (e.code === "Equal" || e.code === "NumpadAdd") {
    zoomBy(1);
  } else if (e.code === "Minus" || e.code === "NumpadSubtract") {
    zoomBy(-1);
  } else if (e.code === "KeyM") {
    ui.minimap.classList.toggle("hidden");
  }
});
window.addEventListener("keyup", (e) => {
  if (KEYS[e.code]) input[KEYS[e.code]] = false;
});
window.addEventListener("blur", () => {
  for (const k in input) input[k] = false;
});

// ---------- HUD ----------

const $ = (id) => document.getElementById(id);
const ui = {
  info: $("info"),
  seed: $("seed"),
  tx: $("tx"),
  ty: $("ty"),
  tooltip: $("tooltip"),
  minimap: $("minimap"),
  debug: $("debug"),
  journal: $("journal"),
  journalStats: $("journalStats"),
};

const hud = new Hud($("hud"), sprites.atlas, {
  settings: () => toggleDebug(),
  journal: () => toggleJournal(),
  interact: () => survival.say("There is nothing here to use."),
  backpack: () => invUI.toggle(chunks),
  toggleRun: () => (runToggle = !runToggle),
});

/** Is there water within a couple of steps of the player? (for filling a canteen) */
function nearWater() {
  for (const [dx, dy] of [
    [0, 0],
    [20, 0],
    [-20, 0],
    [0, 20],
    [0, -20],
    [14, 14],
    [-14, 14],
    [14, -14],
    [-14, -14],
  ]) {
    if (isWater(gen.biomeAt(player.x + dx, player.y + dy))) return true;
  }
  return false;
}

const invUI = new InventoryUI($("inventory"), inventory, {
  use: (loc) => {
    const msg = inventory.use(loc, survival, nearWater());
    if (msg) survival.say(msg);
  },
  quickTake: (loc) => {
    const msg = inventory.quickTake(loc);
    if (msg) survival.say(msg);
  },
});

function toggleDebug() {
  ui.debug.classList.toggle("hidden");
}

function toggleJournal() {
  ui.journal.classList.toggle("hidden");
  updateJournal();
}
ui.journal.addEventListener("click", toggleJournal);

function updateJournal() {
  if (ui.journal.classList.contains("hidden")) return;
  const rows = [
    ["Score", survival.stats.score],
    ["Minutes alive", Math.floor(survival.aliveSeconds / 60)],
    ["Infected killed", survival.stats.infectedKilled],
    ["Bandits killed", survival.stats.banditsKilled],
    ["Karma", survival.stats.karma],
    ["Days survived", survival.daysSurvived],
  ];
  ui.journalStats.innerHTML = rows
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("");
}

$("newWorld").addEventListener("click", () => startWorld(ui.seed.value));
$("randomWorld").addEventListener("click", () =>
  startWorld(String(Math.floor(Math.random() * 1e9))),
);
ui.seed.addEventListener(
  "keydown",
  (e) => e.key === "Enter" && startWorld(ui.seed.value),
);
$("go").addEventListener("click", () => {
  const x = parseInt(ui.tx.value, 10);
  const y = parseInt(ui.ty.value, 10);
  if (Number.isFinite(x) && Number.isFinite(y)) teleport(x, y);
  document.activeElement?.blur();
});
for (const el of document.querySelectorAll("#panel input, #panel button")) {
  el.addEventListener("keyup", (e) => e.key !== "Enter" && e.stopPropagation());
}

hud.drawPortrait();

let mouse = null;
canvas.addEventListener(
  "mousemove",
  (e) => (mouse = { x: e.clientX, y: e.clientY }),
);
canvas.addEventListener("mouseleave", () => (mouse = null));

function screenToWorld(sx, sy) {
  const rect = canvas.getBoundingClientRect();
  const u = (sx - rect.left) / rect.width;
  const v = (sy - rect.top) / rect.height;
  return [
    camera.position.x + camera.left + u * viewW,
    camera.position.y + camera.top - v * viewH,
  ];
}

function updateTooltip() {
  if (!mouse) {
    ui.tooltip.style.display = "none";
    return;
  }
  const [wx, wy] = screenToWorld(mouse.x, mouse.y);
  const o = chunks.objectAt(wx, wy);
  let text = null;
  if (o)
    text = `${OBJECTS[o.type].name}<br><small>${o.resource} ×${o.amount}</small>`;
  else if (!gen.isWalkable(wx, wy)) text = "Lake<br><small>water</small>";
  if (!text) {
    ui.tooltip.style.display = "none";
    return;
  }
  ui.tooltip.innerHTML = text;
  ui.tooltip.style.display = "block";
  ui.tooltip.style.left = `${mouse.x + 14}px`;
  ui.tooltip.style.top = `${mouse.y + 10}px`;
}

// Minimap: sample the generator directly, so it also shows unloaded land.
const mm = ui.minimap.getContext("2d");
const MM_SIZE = ui.minimap.width;
const MM_STEP = 24; // world px per minimap pixel
function drawMinimap() {
  if (
    ui.minimap.classList.contains("hidden") ||
    ui.debug.classList.contains("hidden")
  )
    return;
  const img = mm.createImageData(MM_SIZE, MM_SIZE);
  const cache = {};
  for (let j = 0; j < MM_SIZE; j++) {
    for (let i = 0; i < MM_SIZE; i++) {
      const x = player.x + (i - MM_SIZE / 2) * MM_STEP;
      const y = player.y - (j - MM_SIZE / 2) * MM_STEP;
      // Unexplored land stays dark, like a map you fill in as you go.
      let c = FOG_COLOR;
      if (fog.isExplored(x, y)) {
        const b = gen.biomeAt(x, y);
        c = cache[b] ??= parseInt(biomeColor(b).slice(1), 16);
      }
      const k = (j * MM_SIZE + i) * 4;
      img.data[k] = (c >> 16) & 255;
      img.data[k + 1] = (c >> 8) & 255;
      img.data[k + 2] = c & 255;
      img.data[k + 3] = 255;
    }
  }
  mm.putImageData(img, 0, 0);
  // Points of interest from loaded chunks
  for (const c of chunks.chunks.values()) {
    for (const o of c.data.objects) {
      if (o.resource !== "loot" || !fog.isExplored(o.x, o.y)) continue;
      const i = MM_SIZE / 2 + (o.x - player.x) / MM_STEP;
      const j = MM_SIZE / 2 - (o.y - player.y) / MM_STEP;
      mm.fillStyle = "#e0b040";
      mm.fillRect(Math.round(i) - 1, Math.round(j) - 1, 3, 3);
    }
  }
  mm.fillStyle = "#ff4030";
  mm.fillRect(MM_SIZE / 2 - 1, MM_SIZE / 2 - 1, 3, 3);
}

let fps = 0;
function updateInfo() {
  const tileX = Math.floor(player.x / TILE);
  const tileY = Math.floor(player.y / TILE);
  const [cx, cy] = ChunkManager.chunkOf(player.x, player.y);
  const b = gen.biomeAt(player.x, player.y);
  ui.info.innerHTML = [
    `Seed <b>${seedText}</b>`,
    `X <b>${tileX}</b>  Y <b>${tileY}</b>`,
    `Chunk <b>${cx}, ${cy}</b>`,
    `Biome <b>${isWaterBiome(b) ? "Lake" : BIOME_NAMES[b]}</b>`,
    `Chunks loaded <b>${chunks.chunks.size}</b>`,
    `FPS <b>${fps}</b>${player.explore ? '  <span class="warn">EXPLORE MODE</span>' : ""}`,
  ].join("<br>");
}

// ---------- Loop ----------

startWorld(
  seedText,
  Number(params.get("x") || 0) * TILE,
  Number(params.get("y") || 0) * TILE,
);

let last = performance.now();
let frames = 0;
let fpsTime = 0;
let hudTime = 0;
let mapTime = 1;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const running = input.run || runToggle;
  player.update(dt, { ...input, run: running }, gen, chunks);
  chunks.update(player.x, player.y, viewW, viewH);
  inventory.playerPos = { x: player.x, y: player.y };
  survival.update(dt, {
    running,
    moving: player.moving,
    biome: gen.biomeAt(player.x, player.y),
    clothingHeat: inventory.heat,
  });

  // Camera follows the player on whole pixels.
  const camX = Math.round(player.x);
  const camY = Math.round(player.y);
  camera.position.set(camX, camY, -camY + 1500);
  // Everything on screen counts as explored, for the minimap.
  fog.reveal(camX, camY, viewW / 2, viewH / 2);
  fog.maybeSave();
  renderer.render(scene, camera);

  frames++;
  fpsTime += dt;
  hudTime += dt;
  mapTime += dt;
  if (fpsTime >= 0.5) {
    fps = Math.round(frames / fpsTime);
    frames = 0;
    fpsTime = 0;
  }
  if (hudTime > 0.1) {
    hudTime = 0;
    // Just above the player's head: the sprite is ~28 art px tall, scaled like the world.
    const dpr = window.devicePixelRatio || 1;
    const headY = window.innerHeight / 2 - (30 * pixelScale) / dpr;
    hud.update(survival, { running, headY });
    invUI.refresh();
    updateJournal();
    if (!ui.debug.classList.contains("hidden")) updateInfo();
    updateTooltip();
  }
  if (mapTime > 0.4) {
    mapTime = 0;
    drawMinimap();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for debugging in the browser console.
window.game = {
  get gen() {
    return gen;
  },
  chunks,
  player,
  survival,
  inventory,
  fog,
  CHUNK_PX,
};
