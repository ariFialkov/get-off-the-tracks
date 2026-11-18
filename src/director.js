// Camera director. Every shot is a small "rig": offsets [lateral, up, forward] in a yaw-only
// frame that either rides with the train (`back` metres behind the nose) or is planted at a
// fixed spot on the line (`fix`), with a target that tracks the train (or `tfix`/`tobj`).
// Cues are scheduled by train position, so cinematics stay in sync with the generated map.
import * as THREE from 'three';
import { makeFrame, lerp, clamp, RAIL_H } from './track.js';

export const RIGS = {
  chase: { o: [0, 14, -31], t: [0, 2, 22], fov: 72 },
  // roaming shots used between events in attract mode / as flavour
  flavour: [
    { o: [-15, 2.2, 8], t: [0, 2, -10], fov: 48, o2: [-13, 3, 2] },
    { o: [13, 1.4, 22], t: [0, 2.4, 0], fov: 40, o2: [9, 1.2, 14] },
    { o: [0, 46, -4], t: [0, 0, 6], fov: 46, back: 30 },
    { o: [22, 9, -50], t: [0, 2, -10], fov: 34, o2: [14, 6, -30] },
    { o: [-5.2, 1.0, -34], t: [0, 2, 10], fov: 62, back: 0 },
    { o: [0, 5.4, 16], t: [0, 2, -40], fov: 58, o2: [0, 9, 26] },
    { o: [30, 16, 30], t: [0, 2, -30], fov: 36, o2: [22, 10, 10] },
    { o: [-38, 3, 60], t: [0, 2, -20], fov: 26, fixAhead: 130 },
  ],
};

const _f = makeFrame(), _g = makeFrame();
const arr = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

class Pose { constructor() { this.p = new THREE.Vector3(); this.t = new THREE.Vector3(); this.fov = 60; this.roll = 0; } copy(o) { this.p.copy(o.p); this.t.copy(o.t); this.fov = o.fov; this.roll = o.roll; return this; } }

export class Director {
  constructor(camera) {
    this.camera = camera; this.world = null;
    this.cur = new Pose(); this.prev = new Pose(); this.out = new Pose();
    this.shot = null; this.shotStart = 0; this.blend = 0; this.blendT = 1;
    this.timed = []; this.trauma = 0; this.rumble = 0; this.time = 0; this.cinematic = false;
    this.attract = false; this.flavT = 0; this.flav = null; this.flavI = 0;
  }
  reset(world) { this.world = world; this.shot = null; this.timed.length = 0; this.trauma = 0; this.rumble = 0; this.blendT = 1; this.flav = null; this.first = true; }
  shake(a) { this.trauma = Math.min(1, this.trauma + a); }
  // time-based shots (used for the finale): [{rig, dur, blend}]
  play(list) { this.timed = list.map((s) => ({ ...s, t: 0 })); }

  eval(rig, u, pose) {
    const w = this.world, tr = w.track, hz = w.train.z;
    const e = rig.ease === 'lin' ? u : u * u * (3 - 2 * u);
    const o = rig.o2 ? arr(rig.o, rig.o2, e) : rig.o, t = rig.t2 ? arr(rig.t, rig.t2, e) : rig.t;
    const fixed = rig.fix != null;
    // offsets ride along the track itself, so shots hug curves and slopes
    tr.frame((fixed ? rig.fix : hz - (rig.back || 0)) + o[2], _f, !fixed, !rig.noWeave);
    pose.p.copy(_f.pos).addScaledVector(_f.lat, o[0]); pose.p.y += o[1] - RAIL_H;
    if (rig.tobj) pose.t.copy(rig.tobj());
    else {
      const tf = rig.tfix != null;
      tr.frame((tf ? rig.tfix : hz - (rig.tback || 0)) + t[2], _g, !tf, !rig.noWeave);
      pose.t.copy(_g.pos).addScaledVector(_g.lat, t[0]); pose.t.y += t[1] - RAIL_H;
    }
    pose.fov = rig.fov2 ? lerp(rig.fov, rig.fov2, e) : rig.fov;
    pose.roll = rig.roll2 != null ? lerp(rig.roll || 0, rig.roll2, e) : rig.roll || 0;
    if (!rig.free && tr.cover(pose.p.z) < 0.5) pose.p.y = Math.max(pose.p.y, w.terrain.h(pose.p.x, pose.p.z) + 1.3);
  }

  update(dt) {
    const w = this.world; if (!w) return;
    this.time += dt;
    const hz = w.train.z;
    // pick the shot
    let rig = null, u = 0, blend = 0.9, key = null;
    if (this.timed.length) {
      const s = this.timed[0]; s.t += dt;
      if (s.t >= s.dur && this.timed.length > 1) { this.timed.shift(); this.timed[0].t = 0; }
      const c = this.timed[0]; rig = c.rig; u = clamp(c.t / c.dur); blend = c.blend || 0; key = c;
    } else {
      for (const c of w.plan.cues) if (hz >= c.z0 && hz < c.z1) { rig = c.rig; u = (hz - c.z0) / (c.z1 - c.z0); blend = c.blend; key = c; }
      if (!rig && this.attract) {
        this.flavT -= dt;
        if (!this.flav || this.flavT <= 0) {
          const f = RIGS.flavour[this.flavI++ % RIGS.flavour.length];
          this.flav = { ...f, dur: 3.4, t0: this.time }; if (f.fixAhead) this.flav.fix = hz + f.fixAhead;
          this.flavT = this.flav.fix ? 2.6 : 3.4;
        }
        rig = this.flav; u = clamp((this.time - this.flav.t0) / this.flav.dur); blend = 0; key = this.flav;
      }
    }
    this.cinematic = !!rig && !this.attract;
    if (!rig) { rig = w.chaseRig || RIGS.chase; key = rig; }
    if (key !== this.shot) {
      if (this.first) blend = 0;
      this.first = false; this.shot = key;
      this.prev.copy(this.out); this.blend = blend; this.blendT = blend > 0 ? 0 : 1;
    }
    this.eval(rig, u, this.cur);
    if (this.blendT < 1) {
      this.blendT = Math.min(1, this.blendT + dt / this.blend);
      const k = this.blendT * this.blendT * (3 - 2 * this.blendT);
      // the outgoing pose keeps riding with the train so blends stay smooth at speed
      this.out.p.lerpVectors(this.prevLive(dt), this.cur.p, k); this.out.t.lerpVectors(this.prev.t, this.cur.t, k);
      this.out.fov = lerp(this.prev.fov, this.cur.fov, k); this.out.roll = lerp(this.prev.roll, this.cur.roll, k);
    } else this.out.copy(this.cur);

    const cam = this.camera, o = this.out;
    cam.position.copy(o.p);
    // shake
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    const s = Math.min(1, this.trauma * this.trauma + this.rumble + (rig.rumble || 0)), T = this.time * 38;
    if (s > 0.001) {
      cam.position.x += Math.sin(T * 1.3) * Math.cos(T * 0.7) * s * 0.9; cam.position.y += Math.sin(T * 1.7 + 1) * s * 0.8; cam.position.z += Math.cos(T * 1.1 + 2) * s * 0.5;
    }
    cam.up.set(0, 1, 0); cam.lookAt(o.t);
    cam.rotateZ(o.roll + Math.sin(T * 0.9) * s * 0.03);
    // widen the lens in portrait so the train still reads
    const asp = cam.aspect;
    let fov = o.fov + (w.fovKick || 0);
    if (asp < 1) fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * lerp(1, 1 / asp, 0.55)));
    cam.fov = Math.min(fov, 118); cam.updateProjectionMatrix();
  }
  prevLive(dt) {
    // advance the frozen previous pose along with the train's motion
    const w = this.world, v = w.train.speed * w.timeScale * dt;
    w.track.frame(w.train.z, _g);
    this.prev.p.addScaledVector(_g.fwd, v); this.prev.t.addScaledVector(_g.fwd, v);
    return this.prev.p;
  }
}
