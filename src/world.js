// One generated round (or one attract-mode loop): owns the terrain, the train, lazily built
// event props, triggers/actors, time-scale, score read-out and the final derailment.
import * as THREE from 'three';
import { MAT, C } from './kit.js';
import { Terrain } from './terrain.js';
import { Train } from './train.js';
import { makeFrame, win, RAIL_H } from './track.js';

const _f = makeFrame();
const R = (a, b) => a + Math.random() * (b - a);
const PARTY3 = [[3.2, 2.3, 0.5], [3, 0.8, 0.7], [0.4, 2.6, 2.4], [0.7, 1.6, 3.2], [3, 1.4, 2.2], [2.6, 2.6, 2.6]];

export class World {
  constructor(game, plan) {
    Object.assign(this, { game, plan, track: plan.track, vfx: game.vfx, dir: game.dir, camera: game.camera, ui: game.ui, audio: game.audio });
    this.group = new THREE.Group(); game.scene.add(this.group);
    this.cur = this.group;
    this.terrain = new Terrain(this.track, plan.biome, plan.seed, this.group);
    this.train = new Train(this.group, this.track, { accent: plan.attract ? C.coral : [C.coral, C.teal, C.blue, C.orange][plan.seed % 4] });
    this.trigs = []; this.actors = []; this.timeScale = 1; this.state = 'run'; this.time = 0;
    this.fwd = new THREE.Vector3(0, 0, 1); this.lat = new THREE.Vector3(1, 0, 0);
    this.stepI = 0; this.titleI = 0; this.storm = 0; this.dark = 0; this.crashT = 0; this.score = 0;
    this.train.place(plan.startZ);
    this.dir.reset(this); this.dir.attract = plan.attract;
    this.buildItems();
    this.terrain.update(Math.min(this.train.z, 0), this.train.z);
  }
  // ---- builder helpers used by events ----
  add(obj, own = false) { if (own) obj.userData.own = true; this.cur.add(obj); return obj; }
  place(obj, z, off = 0, up = 0, pitch = false) {
    const t = this.track, x = t.X0(z) + off, y = t.Y(z) + up;
    obj.position.set(x, y, z);
    obj.lookAt(x + (t.X0(z + 1) - t.X0(z - 1)), y + (pitch ? t.Y(z + 1) - t.Y(z - 1) : 0), z + 2);
    this.cur.add(obj);
    return obj;
  }
  mat4(z, off = 0, up = 0, o = {}) {
    const d = this._d || (this._d = new THREE.Object3D()), t = this.track, x = t.X0(z) + off, y = t.Y(z) + up;
    d.position.set(x, y, z); d.scale.set(o.sx || 1, o.sy || 1, o.sz || 1);
    d.lookAt(x + (t.X0(z + 1) - t.X0(z - 1)), y + (o.pitch ? t.Y(z + 1) - t.Y(z - 1) : 0), z + 2);
    if (o.ry) d.rotateY(o.ry);
    d.updateMatrix(); return d.matrix.clone();
  }
  inst(geo, mats, mat = MAT.solid, shadow = true) {
    const im = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = shadow; im.userData.own = true; this.cur.add(im); return im;
  }
  on(z, fn) { this.trigs.push({ z, fn }); this.trigs.sort((a, b) => a.z - b.z); }
  actor(fn) { this.actors.push(fn); }
  flash(a) { this.ui.flash(a); }
  smash(z, brk, o = {}) {
    this.on(z - 3, () => {
      const sp = this.train.speed, big = o.big || 1;
      brk.smash(this, this.fwd, sp, o);
      const p = brk.group.position.clone(); p.y += 2;
      const vel = this.fwd.clone().multiplyScalar(sp * 0.45);
      this.vfx.debris(p, o.n ?? 22, o.colors || [0xffffff], { vel, groundY: p.y - 2, size: o.glass ? 0.5 : 0.85 });
      this.vfx.puff(p, Math.round(10 * big), { size: 4 * big, vel: this.fwd.clone().multiplyScalar(sp * 0.3) });
      this.vfx.sparks(p, 14, { vel });
      this.vfx.stars(p, Math.round(14 * big), PARTY3, { vel: vel.clone().multiplyScalar(0.9), speed: 26 });
      this.vfx.ring(p, 0xfff0a0, 14 * big, 0.4);
      if (o.splash) this.vfx.splash(p.clone().add(new THREE.Vector3(0, 4, 0)), 2.6, vel.clone().multiplyScalar(0.6));
      this.dir.shake(0.3 + 0.22 * big); this.audio.smash(big);
    });
  }

  buildItems() {
    const hz = this.train.z;
    for (const it of this.plan.items) {
      if (it.state === 0 && hz > it.z0 - 1150) {
        it.state = 1; it.g = this.cur = new THREE.Group(); this.group.add(it.g);
        it.build(this); this.cur = this.group;
      } else if (it.state === 1 && hz > it.z1 + 520) { it.state = 2; this.disposeGroup(it.g); }
    }
  }
  disposeGroup(g) {
    g.traverse((o) => { if (o.userData.own && o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
    g.removeFromParent();
  }
  dispose() {
    this.terrain.dispose(); this.disposeGroup(this.group); this.vfx.clear(); this.dir.rumble = 0;
  }

  update(dtReal) {
    const plan = this.plan, tr = this.train, T = this.track;
    this.time += dtReal;
    // --- time scale (cinematic slow-mo is tied to track position) ---
    let target = 1;
    for (const s of plan.slows) if (tr.z >= s.z0 && tr.z < s.z1) target = Math.min(target, s.s);
    if (this.state !== 'run') target = this.crashT < 0.8 ? 0.14 : 1;
    this.timeScale += (target - this.timeScale) * Math.min(1, dtReal * 16);
    const dt = dtReal * this.timeScale;

    // --- move ---
    if (this.state === 'run') {
      tr.speed = T.speed(tr.z);
      let nz = tr.z + tr.speed * dt;
      if (plan.finale && nz >= plan.finale.z - 1) { nz = plan.finale.z - 1; tr.place(nz); this.derail(); }
      else tr.place(nz);
    } else {
      this.crashT += dtReal; tr.derail.t += dt;
      tr.place(Math.min(tr.z + tr.speed * dt, plan.finale.z + tr.len * 0.45));
      if (Math.random() < dt * 14) { const c = tr.cars[Math.floor(Math.random() * tr.cars.length)]; this.vfx.puff(c.obj.position, 1, { size: 3.5, color: [0.25, 0.25, 0.27], up: 7, life: 2.6, alpha: 0.5 }); }
      if (this.crashT > 2.3 && this.state === 'crash') { this.state = 'done'; this.game.roundEnd(); }
    }
    const hz = tr.z;
    T.frame(hz, _f); this.fwd.copy(_f.fwd); this.lat.copy(_f.lat);

    this.buildItems();
    while (this.trigs.length && this.trigs[0].z <= hz) this.trigs.shift().fn();
    for (let i = 0; i < this.actors.length; i++) if (this.actors[i](dt) === false) this.actors.splice(i--, 1);

    // --- score & captions ---
    if (!plan.attract) {
      this.score = plan.scoreAt(hz);
      while (this.stepI < plan.steps.length && plan.steps[this.stepI].z <= hz) {
        const s = plan.steps[this.stepI++];
        this.ui.popup(s.label, s.type === 'add' ? '+' + this.ui.fmt(s.raw * plan.k) : '×' + s.m, s.type === 'mul');
        this.audio.coin(s.type === 'mul');
      }
      while (this.titleI < plan.titles.length && plan.titles[this.titleI].z <= hz) this.ui.title(plan.titles[this.titleI++].text);
      this.ui.score(this.score, this.score / plan.payout * plan.multiplier);
    }

    // --- environment ---
    let storm = 0; for (const s of plan.storms) if (hz > s.z0 && hz < s.z1) storm = Math.max(storm, win(hz, s.z0, s.z1, s.e));
    this.storm = storm;
    const cz = this.camera.position.z;
    const inTube = T.cover(cz) > 6 && this.camera.position.y < T.Y(cz) + 9 ? 1 : 0;
    this.dark += (inTube - this.dark) * Math.min(1, dtReal * 6);
    if (storm > 0.2) {
      const c = this.camera.position, n = Math.round(storm * 9);
      for (let i = 0; i < n; i++) this.vfx.soft.spawn(c.x + R(-45, 45) + this.fwd.x * 40, c.y + R(8, 30), c.z + R(-10, 90), -8, -75, 0, 0.5, 0.16, 0.16, 0.8, 0.9, 1, 0.5, 0, 0, 0.035);
    }
    this.audio.engine(tr.speed / 78 * this.timeScale, this.state === 'run', this.dark);
    this.ambient(dt);

    this.vfx.update(dt);
    this.dir.update(dtReal);
    const c = this.camera.position;
    this.terrain.update(Math.min(hz - tr.len, c.z), Math.max(hz, c.z));
  }

  // always-on motion dressing: wind streaks past the lens, sparks off the wheels, and a
  // glowing slipstream that heats up as the win multiplier climbs
  ambient(dt) {
    if (this.state !== 'run' || dt <= 0) return;
    const tr = this.train, c = this.camera.position, v = tr.speed, f = this.fwd, l = this.lat, vfx = this.vfx;
    if (tr.z < 150 && !this.plan.attract) return;
    const inTube = this.dark > 0.5;
    if (!inTube) for (let i = 0; i < 2; i++) {
      const s = Math.random() < 0.5 ? -1 : 1, d = R(40, 150), o = R(5, 26) * s;
      vfx.add.spawn(c.x + f.x * d + l.x * o, c.y + R(-6, 9), c.z + f.z * d + l.z * o, -f.x * v * 0.5, 0, -f.z * v * 0.5, 0.5, 0.1, 0.1, 1.4, 1.5, 1.6, 0.3, 0, 0, 0.09);
    }
    const heat = this.plan.attract ? 0.4 : Math.min(1, Math.log10(1 + (this.score / this.plan.payout) * this.plan.multiplier * 3) / 2);
    this._acc = (this._acc || 0) + dt;
    if (this._acc > 0.03) {
      this._acc = 0;
      const air = this.track.airborne(tr.z - 10);
      for (const car of tr.cars) {
        const p = car.obj.position, s = Math.random() < 0.5 ? -1 : 1;
        if (!air && Math.random() < 0.35) vfx.add.spawn(p.x + l.x * s * 1 + f.x * R(-7, 7), p.y + 0.15, p.z + l.z * s + f.z * R(-7, 7), f.x * v * 0.5 + l.x * s * R(2, 8), R(1, 6), f.z * v * 0.5 + l.z * s * R(2, 8), R(0.15, 0.4), 0.22, 0.08, 4, 2.4, 0.7, 1, 22, 0.5, 0.03);
        if (heat > 0.25 && Math.random() < heat) {
          const hot = heat > 0.75;
          vfx.add.spawn(p.x + l.x * s * 1.6 + f.x * R(-9, 9), p.y + R(0.8, 3.4), p.z + l.z * s * 1.6 + f.z * R(-9, 9), f.x * v * 0.82, R(-0.5, 1.5), f.z * v * 0.82, R(0.25, 0.5), 0.5, 0.15, hot ? 3.4 : 0.6, hot ? 2.2 : 2.4, hot ? 0.6 : 3.2, 0.55 * heat, 0, 0, 0.05);
        }
      }
      const tail = tr.cars[tr.cars.length - 1].obj.position;
      if (!air && !inTube) vfx.puff(tail, 1, { size: 2.2, spread: 1.2, up: 2, life: 0.9, alpha: 0.22, vel: f.clone().multiplyScalar(v * 0.35) });
    }
  }

  derail() {
    const plan = this.plan, tr = this.train, zE = plan.finale.z, v = this.fwd.clone().multiplyScalar(tr.speed * 0.25);
    this.state = 'crash'; this.crashT = 0; this.dir.rumble = 0;
    const side = Math.random() < 0.5 ? -1 : 1;
    tr.startDerail(zE - 1, side, (car) => {
      const p = car.obj.position.clone(); p.y += 2;
      this.vfx.sparks(p, 40, { vel: v, speed: 40 }); this.vfx.puff(p, 12, { size: 5, spread: 4, vel: v });
      this.vfx.debris(p, 14, [C.white, C.steel, C.dark, 0xff7663], { vel: v.clone().multiplyScalar(2), groundY: p.y - 2.4 });
      this.dir.shake(0.6); this.audio.smash(1.6);
      if (car.kind === 'loco') { this.vfx.explosion(p.add(this.fwd.clone().multiplyScalar(8)), 2.4, v); this.flash(0.7); this.audio.boom(1); this.dir.shake(1); }
    });
    this.ui.score(plan.payout, plan.multiplier);
    const o = side * 1;
    this.dir.play([
      { rig: { fix: zE - 5, o: [26, 3.2, 4], o2: [29, 5, 0], tfix: zE - 8, t: [0, 3, 0], t2: [0, 3, -8], fov: 52 }, dur: 1.5, blend: 0 },
      { rig: { fix: zE - 30, o: [-o * 30, 7, -34], o2: [o * 34, 13, -22], tfix: zE - 26, t: [0, 2.5, 0], fov: 46, ease: 'lin' }, dur: 16, blend: 0 },
    ]);
  }
}
