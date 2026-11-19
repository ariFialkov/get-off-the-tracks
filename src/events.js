// The set-piece library. Each event is `make(P, z)`: it shapes the track/terrain, books
// camera cues, slow-mo and score bonuses on the planner `P`, and registers a lazy
// `build(W)` that spawns its props/actors when the train gets near.
import * as THREE from 'three';
import { C, MAT, box, cyl, cone, sph, blob, merge } from './kit.js';
import { Breakable } from './vfx.js';
import { smooth, smoother, lerp, clamp, RAIL_H } from './track.js';
import { Train } from './train.js';
import { DZ } from './terrain.js';
import * as M from './models.js';

const PI = Math.PI;
const R = (a, b) => a + Math.random() * (b - a);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- shared builders ----------
function bridge(W, z0, z1, o = {}) {
  const { truss = false, color = C.red, pierEvery = 3, breakable = false } = o;
  const T = W.track, n = Math.max(1, Math.round((z1 - z0) / 12)), L = (z1 - z0) / n;
  const G = M.bridgeGeos(truss, color), decks = [], piers = [], caps = [], segs = [];
  for (let i = 0; i < n; i++) {
    const zc = z0 + (i + 0.5) * L, hasPier = i % pierEvery === 1;
    const ph = hasPier ? T.Y(zc) - W.terrain.h(T.X0(zc), zc) + 3 : 0;
    if (breakable) {
      const d = new THREE.Mesh(G.deck, MAT.solid); d.castShadow = true; W.place(d, zc, 0, 0, true); d.scale.z = L / 12;
      const s = { z: zc, objs: [d] };
      if (hasPier && ph > 4) { const p = new THREE.Mesh(G.pier, MAT.solid); W.place(p, zc, 0, -2.4); p.scale.y = ph; const c = new THREE.Mesh(G.cap, MAT.solid); W.place(c, zc); s.objs.push(p, c); }
      segs.push(s);
    } else {
      decks.push(W.mat4(zc, 0, 0, { pitch: true, sz: L / 12 }));
      if (hasPier && ph > 4) { piers.push(W.mat4(zc, 0, -2.4, { sy: ph })); caps.push(W.mat4(zc)); }
    }
  }
  if (!breakable) { W.inst(G.deck, decks); if (piers.length) { W.inst(G.pier, piers); W.inst(G.cap, caps); } }
  return segs;
}

function tunnel(W, z0, z1, o = {}) {
  const T = W.track, ctr = (z) => ({ x: T.X0(z), y: T.Y(z) });
  const tube = new THREE.Mesh(M.sweep(ctr, z0 - 1, z1 + 1, 6, M.TUBE), MAT.tube); W.add(tube, true);
  const floor = new THREE.Mesh(M.sweep(ctr, z0 - 2, z1 + 2, 6, [[9.6, 0.03], [-9.6, 0.03]]), new THREE.MeshLambertMaterial({ color: C.ballast, side: THREE.DoubleSide })); W.add(floor, true);
  const ringGeo = M.portalRing(), ringMat = new THREE.MeshLambertMaterial({ color: C.concrete });
  const hoodMat = new THREE.MeshLambertMaterial({ color: C.concreteD, side: THREE.DoubleSide });
  for (const [edge, dir, on] of [[z0, 1, o.a !== false], [z1, -1, o.b !== false]]) {
    if (!on) continue;
    let zf = edge; // first terrain row where the hillside clears the tube
    for (let k = 0; k < 12; k++) { zf = (dir > 0 ? Math.ceil(edge / DZ) : Math.floor(edge / DZ)) * DZ + dir * k * DZ; if (T.cover(zf) >= 11) break; }
    const a = Math.min(edge - dir * 3, zf + dir), b = Math.max(edge - dir * 3, zf + dir);
    W.add(new THREE.Mesh(M.sweep(ctr, a, b, 3, M.HOOD), hoodMat), true);
    const ring = new THREE.Mesh(ringGeo, ringMat); W.place(ring, edge - dir * 3, 0, 0);
    const wallH = Math.max(14, Math.min(21, T.cover(zf) + 3));
    const wall = new THREE.Mesh(M.archWall(23, wallH, 7.2, 8.4, 1.6, C.concrete), MAT.solid); W.place(wall, zf + dir * 0.3, 0, 0); wall.userData.own = true;
  }
  // strip lights racing by
  const lights = [], ribs = [];
  for (let z = z0 + 14; z < z1 - 8; z += 14) { lights.push(W.mat4(z, -5.6, 4.6), W.mat4(z, 5.6, 4.6)); }
  if (lights.length) W.inst(box(0.2, 0.3, 5, 0xfff0c0), lights, MAT.glow, false);
}

function water(W, z0, z1, drop, depth = 7) {
  const T = W.track, zm = (z0 + z1) / 2;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1100, z1 - z0 + 40), MAT.water);
  m.rotation.x = -PI / 2; m.position.set(T.X0(zm), T.Y(zm) - drop + depth, zm); m.userData.own = true;
  W.add(m);
  return m.position.y;
}

function landing(W, z, big = 1) {
  W.on(z, () => {
    const p = W.train.head.clone(), v = W.fwd.clone().multiplyScalar(W.train.speed * 0.5);
    W.vfx.puff(p, 16 * big, { size: 4, spread: 4, vel: v, up: 6 }); W.vfx.sparks(p, 40 * big, { vel: v, speed: 30 });
    W.vfx.stars(p, 20 * big, [[3.2, 2.3, 0.5], [0.5, 2.6, 2.4], [3, 1, 0.8]], { vel: v, speed: 24 }); W.vfx.ring(p, 0xfff0a0, 22 * big, 0.5);
    W.dir.shake(0.7 * big); W.audio.thud(1);
    let n = 0; W.actor((dt) => { const c = W.train.cars[1 + n]; if (!c) return false; if (W.train.z - c.back > z) { W.vfx.puff(c.obj.position, 8, { size: 3.5, vel: v }); W.vfx.sparks(c.obj.position, 14, { vel: v }); W.dir.shake(0.25); n++; } });
  });
}

// ---------- intro: boarded-up tunnel, breakout, the first jump ----------
export function intro(P) {
  const T = P.track;
  T.zones.push({ type: 'cover', z0: -900, z1: 0, edge: 16, amt: 85 });
  T.zones.push({ type: 'flat', z0: -40, z1: 260, edge: 30, width: 26, clear: 12 });
  T.steps.push({ z0: 43, z1: 50, a: -12 });
  T.jumps.push({ z0: 40, z1: 152, h: 7.5 }); T.gaps.push([39, 153]);
  T.speeds.push({ z0: -400, z1: 60, m: 1.22, e: 20 });
  const camA = { fix: 76, o: [-7, 12.2, 0], o2: [-5.6, 12.6, -14], tfix: 0, t: [0, 3.8, 0], fov: 26, fov2: 36, ease: 'lin' };
  P.cue(-1e6, 22, camA, 0);
  P.cue(22, 122, { fix: 76, o: [-5.6, 12.6, -14], tback: 8, t: [0, 1.5, 0], fov: 36, fov2: 60 }, 0.25);
  P.slow(58, 78, 0.22);
  P.cue(122, 240, { o: [-15, 2.4, 10], o2: [-13, 3, 4], t: [0, 2, -12], fov: 50 }, 0);
  P.add(1, 1, 'BREAKOUT');
  P.add(152, 1.2, 'FIRST JUMP');
  P.item(-400, 200, (W) => {
    tunnel(W, -900, 0, { a: false });
    // messy nailed-on planks
    const b = new Breakable();
    const tones = [C.wood, C.woodD, 0xa87848, 0xd29b66];
    for (let i = 0; i < 13; i++) { const y = 0.9 + i * 0.62 + R(-0.12, 0.12); b.add(box(R(12, 15), R(0.42, 0.6), 0.22, tones[i % 4], 0.05), R(-0.8, 0.8), y, R(-0.15, 0.15), MAT.solid, { rz: R(-0.13, 0.13) }); }
    for (let i = 0; i < 5; i++) b.add(box(0.6, R(8, 10), 0.24, tones[(i + 1) % 4], 0.05), -5.2 + i * 2.6 + R(-0.5, 0.5), 4.4, 0.3, MAT.solid, { rz: R(-0.35, 0.35) });
    b.add(merge([box(5, 2.2, 0.2, C.yellow, 0.2), box(4.2, 0.5, 0.24, C.ink).translate(0, 0.35, 0), box(3, 0.4, 0.24, C.ink).translate(0, -0.45, 0)]), 0.4, 4.3, 0.55, MAT.solid, { rz: -0.1 });
    W.place(b.group, 3.2);
    W.smash(3, b, { power: 0.75, up: 22, spread: 20, colors: tones, n: 30, big: 1.2 });
    // bent rail stubs + rocks at the lip
    const stub = merge([box(0.22, 0.27, 5, C.steel).rotateX(-0.35).translate(-0.95, 1, 2.2), box(0.22, 0.27, 4, C.steel).rotateX(-0.2).rotateY(0.15).translate(0.95, 0.6, 1.8), blob(1.5, C.rock, 0.3, 2).translate(-9.5, -0.6, 2), blob(1.3, C.rockD, 0.3, 4).translate(9, -0.5, 2)]);
    const s = new THREE.Mesh(stub, MAT.solid); W.place(s, 39); s.userData.own = true;
    const stub2 = new THREE.Mesh(merge([box(0.22, 0.27, 4, C.steel).rotateX(0.25).translate(-0.95, 0.6, -1.6), box(0.22, 0.27, 5, C.steel).rotateX(0.35).translate(0.95, 0.9, -2)]), MAT.solid); W.place(stub2, 153); stub2.userData.own = true;
    for (const x of [-11, 11]) { const sg = new THREE.Mesh(M.warnSign(), MAT.solid); W.place(sg, 30, x); sg.userData.own = true; }
    // rumble builds as the light approaches
    W.actor(() => { const z = W.train.z; W.dir.rumble = z < 20 ? smooth(-240, 0, z) * 0.16 : 0; if (W.train.glow) W.train.glow.scale.setScalar(z < 4 ? 9 + smooth(-300, 0, z) * 16 : 5); return z < 200; });
    landing(W, 152, 1.3);
  });
}

// ---------- filler smashables ----------
const FILLER = ['barrier', 'billboard', 'crates', 'construction', 'bales', 'watertower', 'barrier', 'billboard', 'crates'];
export function smashable(P, z, type) {
  type = type || P.rng.pick(FILLER);
  const S = M.SMASH[type];
  P.add(z, S.w, S.label);
  P.item(z - 5, z + 5, (W) => {
    const b = new Breakable(); S.build(b); W.place(b.group, z);
    W.smash(z, b, { colors: S.colors, splash: S.splash, big: S.w > 1.6 ? 1 : 0.6 });
  });
}

// ---------- events ----------
export const EVENTS = {
  wall: { len: 240, minM: 0, w: 3, make(P, z) {
    const zc = z + 130;
    P.cue(zc - 44, zc + 34, { fix: zc + 17, o: [5.5, 1.5, 0], t: [0, 2.2, 0], tback: 2, fov: 52 }, 0);
    P.slow(zc - 3, zc + 13, 0.22);
    P.add(zc, M.SMASH.wall.w, 'BRICK WALL');
    P.item(z, zc + 20, (W) => { const b = new Breakable(); M.SMASH.wall.build(b); W.place(b.group, zc); W.smash(zc, b, { colors: M.SMASH.wall.colors, n: 40, big: 1.2, power: 0.55 }); });
  } },

  station: { len: 380, minM: 0, w: 2, make(P, z) {
    const T = P.track, zh = z + 250;
    T.zones.push({ type: 'flat', z0: z, z1: z + 380, edge: 50, width: 34, clear: 30 });
    P.title(z + 40, 'CENTRAL STATION');
    P.cue(z + 90, zh - 30, { o: [0, 2.3, 40], o2: [0, 3.2, 20], t: [0, 2.6, -8], fov: 50 }, 0);
    P.cue(zh - 30, zh + 60, { fix: zh + 36, o: [4.6, 1.8, 0], t: [0, 2.4, 0], tback: 2, fov: 55 }, 0);
    P.slow(zh - 3, zh + 16, 0.25);
    P.add(zh, 4, 'STATION SMASH');
    P.item(z, z + 380, (W) => {
      const plat = [], roof = [], post = [], bench = [], lamp = [];
      for (let q = z + 90; q < zh - 14; q += 12) for (const s of [-1, 1]) {
        plat.push(W.mat4(q, s * 6.4, 0)); roof.push(W.mat4(q, s * 7, 0));
        if (Math.round((q - z) / 12) % 2) { post.push(W.mat4(q, s * 8, 0)); bench.push(W.mat4(q + 4, s * 8.6, 0, { ry: s > 0 ? -PI / 2 : PI / 2 })); }
      }
      W.inst(merge([box(5.4, 1.1, 12.05, C.concrete).translate(0, 0.55, 0), box(0.5, 0.06, 12.05, C.yellow).translate(-2.2, 1.12, 0), box(0.5, 0.06, 12.05, C.yellow).translate(2.2, 1.12, 0)]), plat);
      W.inst(merge([box(6.4, 0.3, 12.05, C.white, 0.1).translate(0, 5.6, 0), box(6.5, 0.34, 12.07, C.teal).translate(0, 5.3, 0)]), roof);
      W.inst(merge([cyl(0.18, 0.18, 4.2, C.steel, 8).translate(0, 3.2, 0), box(1.8, 0.7, 0.14, C.navy, 0.1).translate(0, 4.4, 0)]), post);
      W.inst(merge([box(2.6, 0.16, 0.7, C.wood).translate(0, 1.6, 0), box(2.6, 0.7, 0.12, C.wood).translate(0, 2, -0.3)]), bench);
      const hall = M.stationHall(); W.place(hall.group, zh);
      W.smash(zh, hall, { colors: [C.glass, C.white, 0xcff3ff], n: 60, big: 1.6, power: 0.6, collapse: 7.8, glass: true });
    });
  } },

  building: { len: 300, minM: 0.8, w: 2, make(P, z) {
    const zc = z + 160;
    P.title(z + 20, 'DEMOLITION ZONE');
    P.track.zones.push({ type: 'flat', z0: z + 60, z1: z + 260, edge: 40, width: 26, clear: 22 });
    P.cue(zc - 90, zc - 6, { fix: zc - 30, o: [-17, 2, 0], t: [0, 9, 34], tfix: zc - 30, t2: [0, 4, 30], fov: 62 }, 0);
    P.cue(zc - 6, zc + 170, { o: [8, 4, 20], o2: [10, 7, 34], tfix: zc, t: [0, 16, 0], t2: [0, 4, 0], fov: 50 }, 0);
    P.slow(zc - 2, zc + 22, 0.3);
    P.add(zc, 5, 'DEMOLITION');
    P.item(z, z + 300, (W) => { const b = M.tower(); W.place(b.group, zc); W.smash(zc, b, { colors: [C.concrete, C.concreteD, C.white], n: 60, big: 2, power: 0.5, collapse: 4.2, life: 6 }); });
  } },

  intersection: { len: 400, minM: 0, w: 3, make(P, z) {
    const T = P.track, zc = z + 240, dir = P.rng.sign();
    T.zones.push({ type: 'flat', z0: z + 80, z1: z + 380, edge: 60, width: 120, clear: 9 });
    T.zones.push({ type: 'flat', z0: zc - 34, z1: zc + 16, edge: 2, width: 150, clear: 150 });
    P.title(z + 20, 'RUSH HOUR');
    P.cue(zc - 190, zc - 34, { fix: zc - 9, o: [-dir * 19, 1.5, 0], o2: [-dir * 15, 1.9, 0], t: [0, 2.5, 0], fov: 34, fov2: 44 }, 0);
    P.cue(zc - 34, zc + 80, { fix: zc, o: [0, 66, -16], o2: [0, 60, -8], tfix: zc, t: [0, 0, 2], fov: 52 }, 0);
    P.slow(zc - 6, zc + 14, 0.3);
    P.add(zc - 9, 1, 'CROSSING GATES'); P.add(zc, 3, 'TRUCK');
    P.item(z, z + 400, (W) => {
      W.place(new THREE.Mesh(merge([box(300, 0.16, 13, C.asphalt).translate(0, 0.14, 0), ...Array.from({ length: 24 }, (_, i) => box(4, 0.04, 0.3, C.white).translate(-144 + i * 12.5 + (Math.abs(-144 + i * 12.5) < 8 ? 500 : 0), 0.24, 0)),
        box(300, 0.05, 0.3, C.yellow).translate(0, 0.24, 6), box(300, 0.05, 0.3, C.yellow).translate(0, 0.24, -6), box(8, 0.1, 13, C.concreteD).translate(0, 0.3, 0)]), MAT.solid), zc).userData.own = true;
      const g = M.crossingGate(); W.place(g.group, zc - 9); W.smash(zc - 9, g, { colors: [C.red, C.white], n: 10, big: 0.5 });
      // the truck that doesn't make it
      const tb = new Breakable();
      tb.add(merge([box(2.6, 2.5, 2.8, C.blue, 0.4).translate(0, 2.1, 0), box(2.64, 0.9, 1.3, C.ink, 0.15).translate(0, 2.6, 0.8)]), 0, 0, 6, MAT.gloss, { heavy: true, r: 1.2 });
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) tb.add(box(2.5, 1.5, 2, (i + j) % 2 ? C.white : C.yellow, 0.15), 0, 1.9 + j * 1.5, 3.4 - i * 2.05, MAT.solid);
      tb.add(box(2.4, 0.5, 11.4, C.steelD), 0, 0.9, 1, MAT.solid, { heavy: true });
      const tg = tb.group; W.place(tg, zc); tg.rotateY(dir * PI / 2);
      const base = tg.position.clone(), lat = V(); W.track.frame(zc, { pos: V(), fwd: V(), lat }, false);
      W.smash(zc, tb, { colors: [C.white, C.yellow, C.blue], n: 36, big: 1.5, power: 0.55 });
      // traffic: near misses choreographed to the train's approach
      const cols = [C.coral, C.yellow, C.teal, C.white, C.purple, C.orange];
      const cars = [150, 96, 52, 17, -128, -170].map((gap, i) => { const m = new THREE.Mesh(M.carGeo(cols[i]), MAT.gloss); m.castShadow = true; const d = i % 2 ? -dir : dir; W.place(m, zc + (d > 0 ? -3.2 : 3.2)); m.rotateY(d * PI / 2); return { m, gap, d, p0: m.position.clone() }; });
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(M.carGeo(cols[(i + 2) % 6]), MAT.gloss); W.place(m, zc + s * 3.2, s * (18 + i * 7)); m.rotateY(-s * PI / 2); }
      W.actor(() => {
        const hz = W.train.z;
        if (!tb.smashed) tg.position.copy(base).addScaledVector(lat, dir * (hz - zc) * 0.1);
        for (const c of cars) c.m.position.copy(c.p0).addScaledVector(lat, c.d * (hz - (zc - c.gap)) * 0.55);
        return hz < zc + 300;
      });
    });
  } },

  tunnel: { len: 580, minM: 0, w: 3, make(P, z) {
    const a = z + 96, b = z + 480;
    P.track.zones.push({ type: 'cover', z0: a, z1: b, edge: 16, amt: 60 });
    P.title(z + 10, 'INTO THE DARK');
    P.cue(z + 20, a + 26, { fix: z + 50, o: [13, 4.5, 0], t: [0, 2, 0], tback: 10, fov: 44 }, 0);
    P.cue(a + 26, a + 200, { o: [0, 5.7, -22], t: [0, 2.6, 30], fov: 82, rumble: 0.03 }, 0);
    P.cue(a + 200, b - 30, { o: [1.6, 2.1, 27], o2: [-1.6, 2.4, 22], t: [0, 2.6, 0], fov: 56 }, 0);
    P.cue(b - 30, b + 80, { fix: b + 44, o: [-10, 2.6, 0], t: [0, 2.2, 0], tback: 6, fov: 40, fov2: 52 }, 0);
    P.add(b, 2, 'TUNNEL RUN');
    P.item(z, z + 580, (W) => { tunnel(W, a, b); W.on(b - 4, () => { W.flash(0.55); W.audio.whoosh(); }); W.on(a, () => W.audio.whoosh()); });
  } },

  downhill: { len: 640, minM: 0, w: 3, make(P, z) {
    const T = P.track;
    T.steps.push({ z0: z + 100, z1: z + 520, a: -135 });
    T.speeds.push({ z0: z + 100, z1: z + 600, m: 1.38, e: 120 });
    T.zones.push({ type: 'flat', z0: z + 40, z1: z + 600, edge: 60, width: 14 });
    P.title(z + 30, 'THE BIG DROP');
    P.cue(z + 70, z + 200, { fix: z + 150, o: [9, 2.5, 0], t: [0, 2, 0], tback: 4, fov: 54 }, 0);
    P.cue(z + 200, z + 500, { o: [0, 7.5, -19], t: [0, 0.5, 30], fov: 96, rumble: 0.07 }, 0.5);
    P.add(z + 500, 2.5, 'FREEFALL');
  } },

  hill: { len: 700, minM: 0, w: 3, make(P, z) {
    const T = P.track;
    T.steps.push({ z0: z + 80, z1: z + 400, a: 92 }); T.steps.push({ z0: z + 400, z1: z + 660, a: -42 });
    T.jumps.push({ z0: z + 396, z1: z + 522, h: 10.5 });
    T.zones.push({ type: 'flat', z0: z + 40, z1: z + 680, edge: 60, width: 14 });
    P.title(z + 30, 'LAUNCH HILL');
    P.cue(z + 90, z + 340, { o: [14, 1.2, 12], o2: [11, 1, 4], t: [0, 2, -10], fov: 54, roll: -0.12 }, 0);
    P.cue(z + 340, z + 560, { fix: z + 478, o: [-9, 3, 0], t: [0, 1.5, 0], tback: 10, fov: 50 }, 0);
    P.slow(z + 425, z + 455, 0.28);
    P.add(z + 522, 2.5, 'AIRTIME');
    P.item(z, z + 700, (W) => landing(W, z + 522));
  } },

  highbridge: { len: 660, minM: 0.6, w: 3, make(P, z) {
    const T = P.track, a = z + 90, b = z + 560, wet = P.rng.chance(0.55);
    T.zones.push({ type: 'drop', z0: a - 14, z1: b + 14, edge: 34, amt: 88, water: wet }); T.gaps.push([a, b]);
    P.title(z + 20, wet ? 'SKY BRIDGE' : 'FOREST CROSSING');
    P.cue(z + 70, z + 260, { fix: z + 330, o: [125, -40, 0], t: [0, 0, 0], tback: 45, fov: 30 }, 0);
    P.cue(z + 260, z + 410, { back: 40, o: [34, 42, 10], o2: [-30, 46, 44], t: [0, 0, 0], tback: 40, fov: 48 }, 0);
    P.cue(z + 410, z + 540, { o: [8.2, 2.6, 14], o2: [8.2, 3.2, 6], t: [0, 2, -24], fov: 62 }, 0);
    P.add(b, 2.5, 'HIGH LINE');
    P.item(z, z + 660, (W) => { bridge(W, a, b, { truss: true, color: wet ? C.red : C.teal }); if (wet) water(W, a - 60, b + 60, 88); });
  } },

  cliff: { len: 580, minM: 1.2, w: 2.5, make(P, z) {
    const T = P.track, s = P.rng.sign();
    T.curves.push({ z0: z + 80, z1: z + 490, a: s * 195 });
    T.zones.push({ type: 'rise', side: s, z0: z + 10, z1: z + 570, edge: 70, amt: 150, start: 8, width: 46 });
    T.zones.push({ type: 'sink', side: -s, z0: z + 10, z1: z + 570, edge: 70, amt: 140, start: 6.5, width: 20 });
    P.title(z + 30, 'CLIFFHANGER');
    P.cue(z + 70, z + 230, { fix: z + 270, o: [-s * 74, 14, 0], t: [0, 0, 0], tback: 30, fov: 34 }, 0);
    P.cue(z + 230, z + 410, { o: [-s * 11.5, 0.6, 5], o2: [-s * 10, 1.4, -2], t: [0, 2.4, -16], fov: 60, roll: s * 0.14, rumble: 0.03 }, 0);
    P.add(z + 450, 3, 'CLIFFHANGER');
    P.item(z, z + 580, (W) => {
      let acc = 0;
      W.actor((dt) => {
        const hz = W.train.z; if (hz < z + 130) return true; if (hz > z + 470) return false;
        acc += dt; if (acc > 0.05) { acc = 0; for (const c of W.train.cars) { const p = c.obj.position.clone(); p.y += 0.3; p.addScaledVector(W.lat, -s * 1); W.vfx.sparks(p, 3, { speed: 12, vel: W.fwd.clone().multiplyScalar(-10), life: 0.4 }); } }
        return true;
      });
    });
  } },

  race: { len: 680, minM: 1.2, w: 2.5, make(P, z) {
    const T = P.track, sw = z + 430, zx = z + 628;
    const off = (q) => 9 * smooth(z + 20, z + 90, q) + 62 * smoother((q - sw) / 210);
    T.lines.push({ z0: z + 20, z1: zx + 6, off });
    T.zones.push({ type: 'flat', z0: z, z1: z + 420, edge: 50, width: 44, clear: 42 });
    T.zones.push({ type: 'flat', z0: z + 380, z1: z + 700, edge: 40, width: 110, clear: 104 });
    T.speeds.push({ z0: z + 60, z1: z + 520, m: 1.15 });
    P.title(z + 30, 'RACE TO THE SWITCH');
    const rh = V();
    P.cue(z + 80, z + 250, { o: [32, 3.4, 12], o2: [28, 3, 2], t: [4.5, 2, -10], fov: 40 }, 0);
    P.cue(z + 250, sw - 34, { o: [4.5, 1.2, 30], o2: [4.5, 1.6, 20], t: [4.5, 2.6, 0], fov: 52 }, 0);
    P.cue(sw - 34, sw + 70, { fix: sw + 10, o: [10, 58, -14], t: [5, 0, -6], tback: 4, fov: 52 }, 0);
    P.cue(sw + 150, zx + 130, { fix: zx + 26, o: [off(zx) + 15, 3.2, 0], tobj: () => rh, fov: 44, fov2: 36 }, 0);
    P.mul(sw + 8, 1.5, 'WON THE RACE');
    P.item(z - 100, z + 800, (W) => {
      const rival = new Train(W.cur, W.track, { accent: C.purple, kinds: ['loco', 'car', 'car'], headlight: false });
      rival.off = off;
      const pile = new Breakable(); M.SMASH.crates.build(pile); W.place(pile.group, zx + 4, off(zx + 4));
      const buf = new THREE.Mesh(merge([box(6, 3.4, 2, C.concreteD, 0.3).translate(0, 1.7, 0), box(6.1, 0.6, 2.1, C.yellow).translate(0, 2.4, 0)]), MAT.solid); W.place(buf, zx + 9, off(zx + 9));
      W.place(new THREE.Mesh(merge([box(0.8, 1.2, 0.8, C.yellow, 0.1).translate(0, 0.6, 0), cyl(0.07, 0.07, 1.6, C.steel, 5).translate(0, 1.6, 0)]), MAT.solid), sw - 6, 4.5);
      const sig = new THREE.Mesh(sph(0.45, 0x60ff90, 8, 6), MAT.glow); W.place(sig, sw - 6, 4.5, 2.5);
      let crashed = false;
      W.actor((dt) => {
        const hz = W.train.z;
        let rz = hz + 36 - (hz - z - 60) * 0.118;
        if (hz > sw) rz = Math.min(rz, zx + 40);
        if (rz >= zx && !crashed) {
          crashed = true; rival.startDerail(zx, 1);
          pile.smash(W, V(0.3, 0, 1).normalize(), 60, { power: 0.7 }); W.vfx.explosion(rival.head.clone().add(V(0, 2, 0)), 1.6); W.vfx.debris(rival.head, 30, [C.wood, C.woodD, C.white], { vel: V(10, 6, 40) });
          W.dir.shake(0.35); W.audio.boom(0.7);
        }
        if (rival.derail) rival.derail.t += dt;
        rival.place(rz); rh.copy(rival.head); rh.y += 2;
        rival.group.visible = hz > z - 40;
        return hz < z + 820;
      });
    });
  } },

  truck: { len: 440, minM: 1, w: 2.5, make(P, z) {
    const T = P.track, zc = z + 260, dir = P.rng.sign(), tp = V();
    T.zones.push({ type: 'flat', z0: z + 60, z1: z + 440, edge: 60, width: 130, clear: 9 });
    T.zones.push({ type: 'flat', z0: zc - 14, z1: zc + 14, edge: 2, width: 150, clear: 150 });
    P.title(z + 20, 'STUNT CROSSING');
    P.cue(zc - 110, zc + 120, { back: 47, o: [0, 5.3, -1], tobj: () => tp, fov: 62, fov2: 54 }, 0.5);
    P.slow(zc + 31, zc + 60, 0.26);
    P.add(zc + 60, 3, 'TRUCK JUMP');
    P.item(z, z + 440, (W) => {
      const ramp = (s) => merge([box(26, 0.5, 9, C.wood).rotateZ(s * 0.3).translate(s * 26.5, 3.4, 0), box(1, 7.4, 8.6, C.steelD).translate(s * 14.8, 3.6, 0), box(1, 3.6, 8.6, C.steelD).translate(s * 26, 1.8, 0),
        box(26.4, 0.5, 0.4, C.yellow).rotateZ(s * 0.3).translate(s * 26.5, 3.9, 4.5), box(26.4, 0.5, 0.4, C.yellow).rotateZ(s * 0.3).translate(s * 26.5, 3.9, -4.5)]);
      W.place(new THREE.Mesh(merge([ramp(1), ramp(-1), box(110, 0.16, 9, C.asphalt).translate(94, 0.12, 0), box(110, 0.16, 9, C.asphalt).translate(-94, 0.12, 0)]), MAT.solid), zc).userData.own = true;
      const tr = new THREE.Mesh(M.truckGeo(C.orange), MAT.gloss); tr.castShadow = true; W.add(tr);
      const f = { pos: V(), fwd: V(), lat: V() }; W.track.frame(zc, f, false);
      const yAt = (l) => { const a = Math.abs(l); return a > 39 ? 0.2 : a > 14.5 ? 0.2 + (39 - a) * 0.3 : 7.6 + 7.5 * (1 - (a / 14.5) ** 2); };
      let landed = false;
      W.actor(() => {
        const hz = W.train.z, p = (hz - (zc + 46 - 125)) / 250, l = dir * lerp(-112, 112, clamp(p, -0.6, 1.6));
        const y = yAt(l), y2 = yAt(l + dir * 0.5);
        tr.position.copy(f.pos).addScaledVector(f.lat, l); tr.position.y += y - RAIL_H;
        tr.lookAt(tr.position.clone().addScaledVector(f.lat, dir).add(V(0, (y2 - y) * 2 * (Math.abs(l) < 14.5 ? 0.5 : 1), 0)));
        tp.copy(tr.position); tp.y += 1.5;
        if (!landed && dir * l > 15) { landed = true; W.vfx.puff(tr.position, 14, { size: 3 }); W.dir.shake(0.3); W.audio.thud(0.7); }
        return hz < z + 520;
      });
    });
  } },

  moto: { len: 560, minM: 1, w: 2.5, make(P, z) {
    const T = P.track, s = 1, bp = V();
    const off = (q) => 11 + 70 * smoother((q - (z + 520)) / 240);
    T.roads.push({ z0: z + 30, z1: z + 760, off, w: 7 });
    T.zones.push({ type: 'flat', z0: z, z1: z + 760, edge: 50, width: 60, clear: 20 });
    const A = z + 130, cb = 10 + 4 * 20.4;
    P.title(z + 20, 'THE STOWAWAY');
    P.cue(A, A + 112, { back: cb + 8.6, o: [-0.6, 2.9, 0], tobj: () => bp, fov: 78 }, 0);
    P.cue(A + 112, A + 215, { back: cb - 6, o: [27, 2.2, 0], o2: [24, 2, 10], tobj: () => bp, fov: 30, fov2: 38 }, 0);
    P.cue(A + 215, A + 350, { back: 70, o: [15, 1.5, -6], o2: [16, 2.5, 6], t: [8, 1.5, 60], tback: 70, fov: 60 }, 0);
    P.slow(A + 124, A + 146, 0.25);
    P.add(A + 150, 2.5, 'STOWAWAY');
    P.item(z, z + 560, (W) => {
      const b = M.bike(); W.add(b);
      const f = { pos: V(), fwd: V(), lat: V() };
      let out = false;
      W.actor((dt) => {
        const hz = W.train.z, u = hz - A, car = W.train.cars[4];
        let lz, lx, ly, yaw = 0, pitch = 0;
        if (u < 112) { lz = lerp(-8.6, -1.2, clamp(u / 112)); lx = -0.1; ly = 1.13; }
        else if (u < 170) { const k = (u - 112) / 58; lz = -1.2 + k * 14; lx = lerp(-0.1, 11, smooth(0, 1, k)); ly = lerp(1.13, 0.12, k) + 2.6 * 4 * k * (1 - k); yaw = Math.sin(k * PI) * 0.7; pitch = (0.5 - k) * 0.5; if (!out) { out = true; W.audio.whoosh(); } }
        else { lz = 12.8 + (u - 170) * 0.42; lx = 11; ly = 0.12; pitch = -Math.min(0.5, (u - 170) * 0.01); if (u < 174) { W.vfx.puff(b.position, 3, { size: 1.6 }); } }
        const bz = car.z + lz; W.track.frame(bz, f, false);
        b.position.copy(f.pos).addScaledVector(f.lat, lx < 5 ? lx : (off(bz) - 11) + lx); b.position.y += ly - RAIL_H + (lx < 5 ? W.track.TY(car.z) - W.track.Y(car.z) : 0);
        b.lookAt(b.position.clone().add(f.fwd).addScaledVector(f.lat, yaw).add(V(0, -pitch, 0)));
        bp.copy(b.position); bp.y += 1;
        b.visible = u > -5;
        return hz < z + 700;
      });
    });
  } },

  waterfall: { len: 560, minM: 0.6, w: 3, make(P, z) {
    const T = P.track, s = P.rng.sign(), zf = z + 290;
    T.zones.push({ type: 'rise', side: s, z0: z + 10, z1: z + 550, edge: 70, amt: 120, start: 9, width: 30 });
    T.zones.push({ type: 'sink', side: -s, z0: z + 10, z1: z + 550, edge: 70, amt: 74, start: 7, width: 22, water: false });
    P.title(z + 30, 'WATERFALL PASS');
    P.cue(z + 70, zf - 50, { fix: zf + 50, o: [-s * 48, 7, 0], t: [0, 4, 0], tback: 20, fov: 34, fov2: 40 }, 0);
    P.cue(zf + 40, zf + 190, { o: [-s * 8.5, 3.6, 36], o2: [-s * 9, 4.4, 30], tfix: zf, t: [0, 6, 0], t2: [0, 10, 0], fov: 48 }, 0);
    P.add(zf + 8, 2.5, 'SPLASHDOWN');
    P.item(z, z + 560, (W) => {
      const path = [[20, 50], [14, 49], [9, 44], [5, 33], [2.4, 18], [0.8, 6], [0, 1.2], [-3.5, 0.4], [-6.2, -0.4], [-8, -5], [-9.4, -18], [-10.2, -40], [-10.6, -74]].map(([m, y]) => [m * s, y]);
      const wf = M.waterfallMesh(path, 30); W.place(wf, zf); wf.userData.own = true;
      // pool below + a rainbow in the spray
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(380, 700), MAT.water); pool.rotation.x = -PI / 2; W.place(pool, zf, -s * 200, -70); pool.rotation.set(-PI / 2, 0, 0); pool.userData.own = true;
      const rb = new THREE.Group();
      [0xff5a5a, 0xffb347, 0xfff36b, 0x6fe28a, 0x58b8ff, 0x9a7bff].forEach((c, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(22 - i * 0.7, 0.36, 6, 40, PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.userData.own = true; rb.add(m); });
      W.place(rb, zf + 22, -s * 6, -6);
      let acc = 0, wet = false;
      W.actor((dt) => {
        const hz = W.train.z; wf.material.uniforms.t.value += dt;
        acc += dt;
        if (acc > 0.04 && hz > zf - 300) {
          acc = 0; const f = wf.position;
          W.vfx.puff(V(f.x - W.lat.x * s * 9, f.y - 4, f.z + R(-14, 14)), 2, { size: 5, color: [0.9, 0.97, 1], alpha: 0.35, up: 5, spread: 3, life: 1.8 });
          if (hz > zf - 14 && hz - W.train.len < zf + 14) { W.vfx.splash(V(W.track.X(zf) + R(-1.5, 1.5), f.y + 4, zf + R(-8, 8)), 0.45, W.fwd.clone().multiplyScalar(22)); }
        }
        if (!wet && W.camera.position.z > zf - 6 && hz > zf && hz < zf + 200 && Math.abs(W.camera.position.x - W.track.X(zf)) < 9) { wet = true; W.ui.wet(); W.audio.splash(); }
        return hz < z + 800;
      });
      W.on(zf - 10, () => { W.audio.splash(); W.dir.shake(0.25); });
    });
  } },

  canyon: { len: 680, minM: 3, w: 2, make(P, z) {
    const T = P.track, a = z + 150, b = z + 530, g0 = z + 272, g1 = z + 404, zm = (g0 + g1) / 2;
    T.zones.push({ type: 'drop', z0: a - 16, z1: b + 16, edge: 30, amt: 140, water: true });
    T.jumps.push({ z0: g0 - 4, z1: g1 + 6, h: 17 }); T.gaps.push([a, b]);
    T.speeds.push({ z0: z + 20, z1: b + 60, m: 1.22, e: 100 });
    P.title(z + 20, 'CANYON GAP');
    P.cue(z + 40, a + 30, { o: [8.5, 1.5, 34], o2: [6.5, 1.3, 22], t: [0, 2.4, 0], fov: 40 }, 0);
    P.cue(a + 30, g0 - 14, { fix: (a + g0) / 2 + 20, o: [-44, -24, 0], t: [0, 2, 0], tback: 20, fov: 48 }, 0);
    P.cue(g0 - 14, g0 + 38, { back: 30, o: [-5, 4.8, -16], o2: [-9, 7, -6], t: [0, 2, 40], tback: 0, fov: 70 }, 0);
    P.cue(g0 + 38, g1 + 90, { fix: zm, o: [190, 84, -110], o2: [180, 70, -60], t: [0, -8, 0], tback: 45, fov: 36, fov2: 31 }, 0);
    P.slow(g0 + 30, g0 + 86, 0.3);
    P.mul(g1 + 8, 3, 'CANYON GAP');
    P.item(z, z + 680, (W) => {
      bridge(W, a, g0, { truss: true, color: C.red }); bridge(W, g1, b, { truss: true, color: C.red });
      water(W, a - 80, b + 80, 140);
      // ragged ends dangling into the gap
      for (const [zz, d] of [[g0 + 3, 1], [g1 - 3, -1]]) { const m = new THREE.Mesh(merge([box(6.6, 0.8, 7, C.concrete).rotateX(d * 0.5).translate(0, -2, 0), box(0.24, 0.27, 9, C.steel).rotateX(d * 0.7).translate(-0.95, -2.4, d * 1), box(0.24, 0.27, 7, C.steel).rotateX(d * 0.4).translate(0.95, -1.2, d * 0.5), box(0.5, 0.5, 7, C.red).rotateX(d * 0.9).translate(3.6, 3, d * 2)]), MAT.solid); W.place(m, zz); m.userData.own = true; }
      W.on(g0 - 4, () => { W.audio.whoosh(); W.vfx.sparks(W.train.head, 30, { vel: W.fwd.clone().multiplyScalar(40) }); });
      landing(W, g1 + 6, 1.6);
    });
  } },

  storm: { len: 780, minM: 2.5, w: 2, make(P, z) {
    P.storms.push({ z0: z, z1: z + 780, e: 170 });
    P.title(z + 60, 'THUNDERHEAD');
    P.cue(z + 190, z + 330, { o: [-14, 1.8, 12], o2: [-12, 2.2, 6], t: [0, 4, -8], fov: 52 }, 0);
    P.cue(z + 460, z + 600, { o: [6, 2.5, 38], o2: [4, 2.2, 26], t: [0, 3.5, 0], fov: 44 }, 0);
    const strikes = [[215, 1, 15], [300, 1, 20], [385, -1, 14], [480, 1, 13], [545, -1, 16], [640, -1, 13], [690, 1, 15]];
    for (const [dz] of strikes) P.add(z + dz - 22, 0.7, 'NEAR MISS');
    P.add(z + 740, 2, 'RODE THE STORM');
    P.item(z, z + 780, (W) => { for (const [dz, s, lx] of strikes) strike(W, z + dz, s * lx, 22); });
  } },

  maze: { len: 660, minM: 6, w: 1.6, make(P, z) {
    const T = P.track, S = 6.5, a = z + 40, b = z + 580;
    const fan = (q) => smooth(a, a + 70, q) * (1 - smooth(b - 70, b, q));
    for (const k of [-2, -1, 0, 1, 2]) T.lines.push({ z0: a, z1: b, off: (q) => k * S * fan(q) });
    T.weaves.push({ z0: z + 130, z1: z + 180, a: S }, { z0: z + 280, z1: z + 340, a: -2 * S }, { z0: z + 440, z1: z + 490, a: S });
    const xo = [[2, 1, 205], [-1, -2, 250], [0, -1, 385], [1, 2, 420], [-2, -1, 150], [1, 0, 470]];
    for (const [l0, l1, dz] of xo) T.lines.push({ z0: z + dz, z1: z + dz + 50, bare: true, off: (q) => lerp(l0, l1, smoother((q - z - dz) / 50)) * S });
    T.zones.push({ type: 'flat', z0: z, z1: z + 640, edge: 50, width: 40, clear: 34 });
    T.speeds.push({ z0: z + 60, z1: z + 600, m: 1.12 });
    P.title(z + 20, 'SWITCH MAZE');
    P.cue(z + 96, z + 530, { back: 26, noWeave: true, o: [0, 74, -3], o2: [0, 64, -3], t: [0, 0, 9], tback: 26, fov: 50 }, 0.6);
    P.add(z + 182, 0.8, 'NEAR MISS'); P.add(z + 347, 0.8, 'NEAR MISS'); P.add(z + 468, 0.8, 'NEAR MISS');
    P.mul(z + 540, 2, 'SWITCH MAZE');
    P.item(z - 100, z + 660, (W) => {
      const mk = (accent, lane, kinds = ['loco', 'car']) => { const t = new Train(W.cur, W.track, { accent, kinds, headlight: false }); t.off = (q) => lane * S * fan(q); return t; };
      const parked = [[mk(C.teal, 0), z + 236], [mk(C.yellow, 1), z + 402], [mk(C.blue, 0), z + 398]];
      for (const [t, q] of parked) t.place(q);
      const onc = [[mk(C.purple, 2, ['loco', 'car', 'car']), z + 180, 1.1], [mk(C.teal, -2, ['loco', 'car', 'car']), z + 345, 1.15], [mk(C.orange, 2, ['loco', 'car']), z + 466, 1.2], [mk(C.blue, -2, ['loco', 'car']), z + 240, 1.3]];
      for (const [t] of onc) t.rev = true;
      // switch lamps that flip constantly
      const pts = []; for (const [l0, , dz] of xo) pts.push(W.mat4(z + dz, l0 * S + 2.2, 0.9)); for (const dz of [130, 280, 440]) pts.push(W.mat4(z + dz, 2.2, 0.9));
      const g1 = W.inst(sph(0.5, 0x60ff90, 8, 6), pts, MAT.glow, false), g2 = W.inst(sph(0.5, 0xff5050, 8, 6), pts, MAT.glow, false);
      W.inst(box(0.9, 0.8, 0.9, C.yellow, 0.15), pts.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.5, 0))));
      let tt = 0;
      W.actor((dt) => {
        const hz = W.train.z; tt += dt;
        g1.visible = Math.floor(tt * 5) % 2 === 0; g2.visible = !g1.visible;
        for (const [t, zp, k] of onc) { const q = zp + (zp - hz) * k; t.group.visible = q > a + 60 && q < b - 40; if (t.group.visible) t.place(q); }
        for (const [, zp] of onc) if (Math.abs(hz - zp) < 1.5) { W.dir.shake(0.2); }
        return hz < z + 760;
      });
      for (const [, zp] of onc) W.on(zp, () => W.audio.whoosh());
    });
  } },

  viaduct: { len: 740, minM: 6, w: 1.6, make(P, z) {
    const T = P.track, a = z + 100, b = z + 640;
    T.zones.push({ type: 'drop', z0: a - 14, z1: b + 14, edge: 30, amt: 112 }); T.gaps.push([a, b]);
    T.speeds.push({ z0: z + 60, z1: b + 40, m: 1.15 });
    P.title(z + 20, 'COLLAPSING VIADUCT');
    P.cue(a + 16, a + 170, { fix: a + 170, o: [-150, -8, 0], t: [0, -12, 0], tback: 60, fov: 36 }, 0);
    P.cue(a + 170, a + 330, { back: 152, o: [3.5, 8, 0], o2: [-3.5, 6.5, 6], t: [0, 3, 0], tback: 70, fov: 62, rumble: 0.06 }, 0);
    P.cue(a + 330, b - 20, { o: [-8.5, 5.4, 26], o2: [-7, 4.4, 18], t: [0, 0, -125], fov: 50, rumble: 0.04 }, 0);
    P.cue(b - 20, b + 110, { fix: b + 60, o: [26, 6, 0], t: [0, 2, 0], tback: 50, fov: 38 }, 0);
    P.mul(b + 10, 3, 'OUTRAN THE COLLAPSE');
    P.item(z, z + 800, (W) => {
      const segs = bridge(W, a, b, { breakable: true, pierEvery: 3 });
      let i = 0, acc = 0;
      W.actor((dt) => {
        const tail = W.train.z - W.train.len - 7;
        while (i < segs.length && segs[i].z < tail) {
          const s = segs[i++];
          const gy = s.objs[0].position.y - 118;
          s.objs.forEach((o, k) => { W.group.attach(o); W.vfx.body(o, V(R(-3, 3), R(-4, 2), R(-2, 6)), gy, { life: 5, spin: R(0.2, 0.9), delay: k * 0.06 }); });
          W.vfx.puff(s.objs[0].position, 5, { size: 6, spread: 4, up: 2, life: 2 }); W.vfx.debris(s.objs[0].position, 5, [C.concrete, C.concreteD, C.rock], { size: 1.6, groundY: gy, life: 4 });
        }
        acc += dt; if (i > 0 && i < segs.length && acc > 0.3) { acc = 0; W.audio.thud(0.5); }
        return W.train.z < b + 300;
      });
    });
  } },

  helicopter: { len: 660, minM: 2.5, w: 2, make(P, z) {
    const T = P.track, zb = z + 510, hp = V(), s = P.rng.sign();
    T.zones.push({ type: 'flat', z0: z + 380, z1: z + 640, edge: 60, width: 80, clear: 62 });
    P.title(z + 20, 'AIR PURSUIT');
    P.cue(z + 50, z + 180, { back: 30, o: [6, 21, -52], o2: [4, 17, -44], t: [0, 3, 0], tback: 20, fov: 56 }, 0);
    P.cue(z + 180, z + 310, { back: 64, o: [2.4, 5.2, 0], tobj: () => hp, fov: 52 }, 0);
    P.cue(z + 310, z + 420, { o: [-9, 2.2, 32], o2: [-7, 2, 24], t: [0, 6, -24], fov: 46 }, 0);
    P.cue(z + 420, z + 600, { fix: zb - 26, o: [-s * 40, 4.5, 0], tobj: () => hp, fov: 34, fov2: 44 }, 0);
    for (let i = 0; i < 4; i++) P.add(z + 170 + i * 70, 0.6, 'UNDER FIRE');
    P.add(zb + 20, 3, 'SHOOK THE CHOPPER');
    P.item(z - 60, z + 760, (W) => {
      const h = M.heli(); W.add(h);
      // overpass the chopper has to duck
      W.place(new THREE.Mesh(merge([box(150, 1.4, 12, C.concrete).translate(0, 11.4, 0), box(150, 1, 0.5, C.concreteD).translate(0, 12.6, 6), box(150, 1, 0.5, C.concreteD).translate(0, 12.6, -6), ...[-52, -31, -9.5, 9.5, 31, 52].map((x) => box(2.4, 10.8, 5, C.concreteD, 0.4).translate(x, 5.4, 0)),
        box(60, 0.4, 10, C.asphalt).translate(-100, 5.9, 0).rotateZ(0), box(150, 0.12, 0.3, C.yellow).translate(0, 12.16, 0)]), MAT.solid), zb).userData.own = true;
      const f = { pos: V(), fwd: V(), lat: V() };
      let acc = 0, t = 0;
      W.actor((dt) => {
        const hz = W.train.z, u = hz - z; t += dt;
        const inK = smooth(-40, 130, u), bank = smooth(430, 500, u), away = smooth(520, 700, u);
        const back = lerp(150, 28, inK) - away * 40, lx = lerp(40, Math.sin(t * 1.3) * 2.2, inK) * (1 - bank) + bank * -s * 20 + away * -s * 130;
        const y = lerp(46, 8.2 + Math.sin(t * 2.1) * 0.5, inK) - bank * 3 + away * 60;
        W.track.frame(hz - back, f);
        h.position.copy(f.pos).addScaledVector(f.lat, lx); h.position.y += y;
        h.lookAt(h.position.clone().add(f.fwd).add(V(0, -0.16 + away * 0.3, 0)).addScaledVector(f.lat, -s * (bank - away * 0.2) * 0.4));
        h.rotateZ(-s * (bank * (1 - away)) * 1.15 + Math.sin(t * 1.3) * 0.08);
        h.userData.rotor.rotation.y += dt * 38; h.userData.tail.rotation.x += dt * 50;
        hp.copy(h.position);
        acc += dt;
        if (u > 130 && u < 440 && acc > 0.07) {
          acc = 0;
          const car = W.train.cars[Math.floor(R(0, 3))], tgt = car.obj.position.clone().add(V(R(-4, 4), R(0, 4), R(-9, 9)));
          const o = h.position.clone().addScaledVector(f.fwd, 3); o.y -= 1;
          const d = tgt.clone().sub(o), v = d.clone().normalize().multiplyScalar(170).addScaledVector(f.fwd, W.train.speed);
          W.vfx.add.spawn(o.x, o.y, o.z, v.x, v.y, v.z, d.length() / 170, 0.5, 0.5, 4, 3, 1, 1, 0, 0, 0.03);
          const gz = Math.abs(tgt.x - car.obj.position.x) > 1.7;
          tgt.addScaledVector(f.fwd, W.train.speed * d.length() / 170);
          if (gz) { tgt.y = W.terrain.h(tgt.x, tgt.z) + 0.3; W.vfx.puff(tgt, 2, { size: 1.6, up: 6 }); } else { tgt.y = car.obj.position.y + 4.2; W.vfx.sparks(tgt, 5, { vel: W.fwd.clone().multiplyScalar(W.train.speed * 0.8), speed: 12, life: 0.3 }); }
          if (Math.random() < 0.3) W.audio.tick(0.4);
        }
        h.visible = u > -50;
        return hz < z + 780;
      });
      W.on(zb - 20, () => W.audio.whoosh());
    });
  } },

  whale: { len: 640, minM: 4, w: 1.4, make(P, z) {
    const T = P.track, a = z + 80, b = z + 560, zc = z + 330, dir = P.rng.sign(), wp = V();
    T.zones.push({ type: 'drop', z0: a - 20, z1: b + 20, edge: 40, amt: 17, water: true }); T.gaps.push([a, b]);
    P.title(z + 20, 'OPEN WATER');
    P.cue(a + 30, zc - 70, { o: [-dir * 30, -3.4, 30], o2: [-dir * 26, -3, 16], t: [0, 2, -30], fov: 44 }, 0);
    P.cue(zc - 70, zc + 170, { fix: zc + 92, o: [dir * 34, -4.2, 0], tobj: () => wp, fov: 50, fov2: 44 }, 0);
    P.slow(zc + 28, zc + 66, 0.24);
    P.mul(zc + 70, 2, 'WHALE!');
    P.item(z, z + 640, (W) => {
      bridge(W, a, b, { pierEvery: 2 });
      const wy = water(W, a - 80, b + 80, 17, 9);
      const wh = M.whale(); W.add(wh);
      const f = { pos: V(), fwd: V(), lat: V() }; W.track.frame(zc, f, false);
      const pos = (p) => f.pos.clone().addScaledVector(f.lat, dir * lerp(-62, 62, p)).add(V(0, -13 + 37 * Math.sin(PI * clamp(p, -0.1, 1.1)), 0)).addScaledVector(f.fwd, 30 * p);
      let st = 0;
      W.actor(() => {
        const hz = W.train.z, p = (hz - (zc + 48 - 130)) / 260;
        wh.visible = p > -0.05 && p < 1.08;
        const a0 = pos(p), a1 = pos(p + 0.02);
        wh.position.copy(a0); wh.lookAt(a1); wp.copy(a0);
        if (st === 0 && p > 0.02) { st = 1; W.vfx.splash(V(a0.x, wy, a0.z), 3.4); W.audio.splash(); W.dir.shake(0.3); }
        if (st === 1 && p > 0.94) { st = 2; W.vfx.splash(V(a0.x, wy, a0.z), 4); W.audio.splash(); W.dir.shake(0.45); }
        if (p > 0.1 && p < 0.9 && Math.random() < 0.5) W.vfx.soft.spawn(a0.x + R(-4, 4), a0.y - 3, a0.z + R(-8, 8), 0, -4, 0, 1, 1, 2.4, 0.85, 0.96, 1, 0.6, 20, 0);
        return hz < z + 760;
      });
    });
  } },
};

// lightning strike on a lone tree beside the line, timed as the train passes
export function strike(W, zs, lx, lead = 22, onTrack = false) {
  const T = W.track, x = T.X0(zs) + lx, p = V(x, 0, zs);
  let tree = null;
  if (!onTrack) { tree = M.strikeTree(W.terrain.biome); W.place(tree.group, zs, lx); p.y = tree.group.position.y = W.terrain.h(x, zs); }
  else p.y = T.Y(zs) + 0.5;
  W.on(zs - lead, () => {
    W.vfx.bolt(p); W.vfx.explosion(p.clone().add(V(0, 2, 0)), onTrack ? 2.2 : 1.1); W.flash(onTrack ? 0.9 : 0.5); W.dir.shake(onTrack ? 0.9 : 0.4); W.audio.thunder();
    if (tree) { tree.smash(W, V(R(-1, 1), 0, R(-1, 1)).normalize(), 30, { up: 26 }); W.vfx.debris(p, 10, [C.woodD, C.ink], { up: 20 }); }
  });
}
