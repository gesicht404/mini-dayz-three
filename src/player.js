import * as THREE from 'three';
import { PLAYER_FEET_OFFSET, HERO_ANIMS } from './gfx/sprites.js';

const WALK_SPEED = 55; // px per second
const RUN_SPEED = 100;
const EXPLORE_SPEED = 600; // debug fly mode, ignores collisions
const RADIUS = 4;

export class Player {
  constructor(scene, rects, objectMat, shadowMat) {
    this.rects = rects;
    this.x = 0;
    this.y = 0;
    this.dir = 'down';
    this.anim = 'idle';
    this.character = 'swordsman';
    this.moving = false;
    this.animTime = 0;
    this.explore = false;

    const r = rects.swordsman_idle_down_0;
    this.w = r.w;
    this.h = r.h;
    const g = new THREE.BufferGeometry();
    // Anchor at the feet: the rows below them are padding.
    const x0 = -Math.floor(r.w / 2);
    const y0 = -PLAYER_FEET_OFFSET;
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      x0, y0, 0, x0 + r.w, y0, 0, x0 + r.w, y0 + r.h, 0, x0, y0 + r.h, 0,
    ], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(8).fill(0), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.mesh = new THREE.Mesh(g, objectMat);
    scene.add(this.mesh);

    const s = rects.shadowM;
    const sg = new THREE.PlaneGeometry(s.w, s.h);
    sg.setAttribute('uv', new THREE.Float32BufferAttribute([s.u0, s.v1, s.u1, s.v1, s.u0, s.v0, s.u1, s.v0], 2));
    this.shadow = new THREE.Mesh(sg, shadowMat);
    this.shadow.renderOrder = -1;
    scene.add(this.shadow);

    this.setFrame('swordsman_idle_down_0');
  }

  setFrame(name) {
    const r = this.rects[name];
    const uv = this.mesh.geometry.attributes.uv;
    uv.setXY(0, r.u0, r.v0);
    uv.setXY(1, r.u1, r.v0);
    uv.setXY(2, r.u1, r.v1);
    uv.setXY(3, r.u0, r.v1);
    uv.needsUpdate = true;
  }

  canStand(x, y, gen, chunks) {
    if (this.explore) return true;
    if (!gen.isWalkable(x - RADIUS, y) || !gen.isWalkable(x + RADIUS, y) ||
        !gen.isWalkable(x, y + 2) || !gen.isWalkable(x, y - 2)) return false;
    for (const s of chunks.solidsNear(x, y)) {
      const dx = x - s.x;
      const dy = y - s.y;
      const min = s.r + RADIUS;
      if (dx * dx + dy * dy < min * min) return false;
    }
    return true;
  }

  update(dt, input, gen, chunks) {
    let mx = 0;
    let my = 0;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (input.up) my += 1;
    if (input.down) my -= 1;
    this.moving = mx !== 0 || my !== 0;

    if (this.moving) {
      const len = Math.hypot(mx, my);
      const speed = this.explore ? EXPLORE_SPEED : input.run ? RUN_SPEED : WALK_SPEED;
      const step = (speed * dt) / len;
      // Move one axis at a time so the player slides along obstacles.
      const nx = this.x + mx * step;
      if (this.canStand(nx, this.y, gen, chunks)) this.x = nx;
      const ny = this.y + my * step;
      if (this.canStand(this.x, ny, gen, chunks)) this.y = ny;

      // Sideways wins on diagonals, like most top-down games.
      if (mx !== 0) this.dir = mx < 0 ? 'left' : 'right';
      else this.dir = my > 0 ? 'up' : 'down';
    }

    const anim = !this.moving ? 'idle' : input.run || this.explore ? 'run' : 'walk';
    if (anim !== this.anim) {
      this.anim = anim;
      this.animTime = 0;
    }
    this.animTime += dt;
    const { fps, count } = HERO_ANIMS[anim];
    this.setFrame(`${this.character}_${anim}_${this.dir}_${Math.floor(this.animTime * fps) % count}`);

    // Snap to whole pixels so the sprite stays crisp.
    const px = Math.round(this.x);
    const py = Math.round(this.y);
    this.mesh.position.set(px, py, -py + 0.5);
    this.shadow.position.set(px, py, -py);
  }
}
