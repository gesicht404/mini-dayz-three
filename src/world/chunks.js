import * as THREE from 'three';
import { CHUNK_PX } from './generator.js';
import { OBJECTS } from './objects.js';
import { paintGround } from '../gfx/ground.js';

const key = (cx, cy) => `${cx},${cy}`;

/**
 * Keeps the chunks around the camera loaded. Each chunk becomes three meshes:
 * ground (a canvas texture), shadows, and objects (one merged geometry).
 *
 * Depth: objects use z = -y, so things lower on screen draw in front.
 * Vertex positions are local to the chunk, which keeps precision fine even
 * far from the origin.
 */
export class ChunkManager {
  constructor(scene, gen, sprites) {
    this.scene = scene;
    this.gen = gen;
    this.rects = sprites.atlas.rects;
    this.decals = sprites.decals;
    this.chunks = new Map();
    this.queue = [];

    const atlasTex = new THREE.CanvasTexture(sprites.atlas.canvas);
    atlasTex.magFilter = THREE.NearestFilter;
    atlasTex.minFilter = THREE.NearestFilter;
    atlasTex.generateMipmaps = false;
    atlasTex.colorSpace = THREE.SRGBColorSpace;
    this.atlasTex = atlasTex;

    this.objectMat = new THREE.MeshBasicMaterial({ map: atlasTex, alphaTest: 0.5 });
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: atlasTex, transparent: true, depthTest: false, depthWrite: false,
    });
  }

  setGenerator(gen) {
    for (const k of [...this.chunks.keys()]) this.unload(k);
    this.queue.length = 0;
    this.gen = gen;
  }

  /** Chunk coordinates containing a world position. */
  static chunkOf(x, y) {
    return [Math.floor(x / CHUNK_PX), Math.floor(y / CHUNK_PX)];
  }

  /**
   * Make sure chunks covering the view (plus a margin) exist.
   * Builds nearest chunks first, within a time budget per frame.
   */
  update(camX, camY, viewW, viewH, budgetMs = 6, forceAll = false) {
    const margin = CHUNK_PX;
    const minCx = Math.floor((camX - viewW / 2 - margin) / CHUNK_PX);
    const maxCx = Math.floor((camX + viewW / 2 + margin) / CHUNK_PX);
    const minCy = Math.floor((camY - viewH / 2 - margin) / CHUNK_PX);
    const maxCy = Math.floor((camY + viewH / 2 + margin) / CHUNK_PX);

    const wanted = [];
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        if (!this.chunks.has(key(cx, cy))) {
          const dx = (cx + 0.5) * CHUNK_PX - camX;
          const dy = (cy + 0.5) * CHUNK_PX - camY;
          wanted.push({ cx, cy, d: dx * dx + dy * dy });
        }
      }
    }
    wanted.sort((a, b) => a.d - b.d);

    const start = performance.now();
    for (const w of wanted) {
      this.load(w.cx, w.cy);
      if (!forceAll && performance.now() - start > budgetMs) break;
    }

    // Unload chunks well outside the view.
    for (const [k, c] of this.chunks) {
      if (c.cx < minCx - 2 || c.cx > maxCx + 2 || c.cy < minCy - 2 || c.cy > maxCy + 2) this.unload(k);
    }
  }

  load(cx, cy) {
    const data = this.gen.generateChunk(cx, cy);
    const ox = cx * CHUNK_PX;
    const oy = cy * CHUNK_PX;
    const group = new THREE.Group();

    // Ground
    const groundTex = new THREE.CanvasTexture(paintGround(data, this.gen, this.decals));
    groundTex.magFilter = THREE.NearestFilter;
    groundTex.minFilter = THREE.NearestFilter;
    groundTex.generateMipmaps = false;
    groundTex.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CHUNK_PX, CHUNK_PX),
      new THREE.MeshBasicMaterial({ map: groundTex, depthTest: false, depthWrite: false }),
    );
    // Ground is drawn first and never depth-tested, so z only needs to be
    // inside the camera's range: put it just below this chunk's objects.
    ground.position.set(ox + CHUNK_PX / 2, oy + CHUNK_PX / 2, -(oy + CHUNK_PX) - 600);
    ground.renderOrder = -2;
    group.add(ground);

    // Objects + shadows as merged quads
    const obj = new QuadBuilder();
    const shd = new QuadBuilder();
    const solids = [];
    for (const o of data.objects) {
      const def = OBJECTS[o.type];
      const r = this.rects[o.sprite];
      const lx = o.x - ox;
      const ly = o.y - oy;
      const z = -ly;
      if (def.shadow) {
        const s = this.rects[def.shadow];
        shd.add(lx + 1 - Math.floor(s.w / 2), ly - Math.floor(s.h / 2) - 1, s, z);
      }
      obj.add(lx - Math.floor(r.w / 2), ly - 1, r, z);
      if (def.solid > 0) solids.push({ x: o.x, y: o.y, r: def.solid });
    }
    if (shd.count) {
      const m = new THREE.Mesh(shd.build(), this.shadowMat);
      m.position.set(ox, oy, -oy);
      m.renderOrder = -1;
      group.add(m);
    }
    if (obj.count) {
      const m = new THREE.Mesh(obj.build(), this.objectMat);
      m.position.set(ox, oy, -oy);
      group.add(m);
    }

    this.scene.add(group);
    this.chunks.set(key(cx, cy), { cx, cy, data, group, groundTex, solids });
  }

  unload(k) {
    const c = this.chunks.get(k);
    if (!c) return;
    this.scene.remove(c.group);
    c.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material !== this.objectMat && o.material !== this.shadowMat) o.material.dispose();
    });
    c.groundTex.dispose();
    this.chunks.delete(k);
  }

  get(cx, cy) {
    return this.chunks.get(key(cx, cy));
  }

  /** Solid obstacles (trees, rocks...) near a point, from loaded chunks. */
  *solidsNear(x, y) {
    const [cx, cy] = ChunkManager.chunkOf(x, y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.get(cx + dx, cy + dy);
        if (c) yield* c.solids;
      }
    }
  }

  /** Topmost object whose sprite covers the point (for hover tooltips). */
  objectAt(x, y) {
    const [cx, cy] = ChunkManager.chunkOf(x, y);
    let best = null;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.get(cx + dx, cy + dy);
        if (!c) continue;
        for (const o of c.data.objects) {
          const r = this.rects[o.sprite];
          const x0 = o.x - Math.floor(r.w / 2);
          const y0 = o.y - 1;
          if (x >= x0 && x < x0 + r.w && y >= y0 && y < y0 + r.h && (!best || o.y < best.y)) best = o;
        }
      }
    }
    return best;
  }
}

/** Collects textured quads into one BufferGeometry. */
class QuadBuilder {
  constructor() {
    this.pos = [];
    this.uv = [];
    this.idx = [];
    this.count = 0;
  }

  add(x, y, r, z) {
    const i = this.count * 4;
    this.pos.push(x, y, z, x + r.w, y, z, x + r.w, y + r.h, z, x, y + r.h, z);
    this.uv.push(r.u0, r.v0, r.u1, r.v0, r.u1, r.v1, r.u0, r.v1);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    this.count++;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
}
