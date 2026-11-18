// The train: a sleek bullet-style loco, passenger cars and a hollow freight car at the tail.
import * as THREE from 'three';
import { C, MAT, box, cyl, sph, merge, glowTexture } from './kit.js';
import { RAIL_H, makeFrame, clamp } from './track.js';

export const CAR_LEN = 20.4;
const geoCache = new Map();

function bogies(zs) {
  const p = [];
  for (const z of zs) {
    p.push(box(2.3, 0.6, 3.8, C.dark, 0.2).translate(0, 0.6, z));
    for (const dz of [-1.15, 1.15]) for (const x of [-0.98, 0.98]) p.push(cyl(0.52, 0.52, 0.24, C.steelD, 12).rotateZ(Math.PI / 2).translate(x, 0.52, z + dz));
  }
  return p;
}

function carGeo(kind, accent) {
  const key = kind + accent;
  if (geoCache.has(key)) return geoCache.get(key);
  let solid, glow = null;
  if (kind === 'loco') {
    solid = merge([
      box(3.1, 3.1, 12.6, C.white, 0.95).translate(0, 2.4, -3.6),
      sph(1, C.white, 22, 14).scale(1.55, 1.55, 6.8).translate(0, 2.4, 2.4),
      sph(1, accent, 22, 12).scale(1.5, 0.85, 7.6).translate(0, 1.3, 2.2),
      sph(1, C.ink, 18, 10).scale(1.22, 0.95, 2.7).translate(0, 3.12, 4.7),
      box(3.14, 0.8, 12.4, C.steel, 0.3).translate(0, 1.05, -3.6),
      box(3.2, 0.3, 12.3, accent).translate(0, 1.72, -3.6),
      box(3.18, 0.7, 8.2, C.ink, 0.2).translate(0, 2.95, -5.2),
      box(1.7, 0.3, 4.2, C.concrete, 0.12).translate(0, 4.0, -5), box(0.9, 0.1, 6.5, accent).translate(0, 3.96, 0.2),
      box(0.3, 0.8, 0.12, C.steelD).translate(0, 4.4, -1.5), box(1.8, 0.1, 0.12, C.steelD).translate(0, 4.8, -1.5),
      ...bogies([-7.2, 3.2]),
    ]);
    glow = merge([sph(0.3, 0xfff6d0, 10, 8).translate(-0.82, 1.45, 9.25), sph(0.3, 0xfff6d0, 10, 8).translate(0.82, 1.45, 9.25), box(0.9, 0.09, 0.2, 0xffffff).translate(0, 2.05, 9.0)]);
  } else if (kind === 'car') {
    solid = merge([
      box(3.1, 3.1, 19.6, C.white, 0.95).translate(0, 2.4, 0),
      box(3.14, 0.8, 19.3, C.steel, 0.3).translate(0, 1.05, 0),
      box(3.2, 0.3, 19.2, accent).translate(0, 1.72, 0),
      box(3.18, 0.7, 15.2, C.ink, 0.2).translate(0, 2.95, 0),
      box(3.19, 2.1, 0.1, C.concrete).translate(0, 2.2, 8.4), box(3.19, 2.1, 0.1, C.concrete).translate(0, 2.2, -8.4),
      box(1.7, 0.3, 4.2, C.concrete, 0.12).translate(0, 4.0, -4.5), box(1.7, 0.3, 4.2, C.concrete, 0.12).translate(0, 4.0, 4.5), box(0.9, 0.1, 19, accent).translate(0, 3.96, 0),
      ...bogies([-6.6, 6.6]),
    ]);
  } else { // freight: hollow, door open on the +x side
    const w = accent, ribs = [];
    for (let z = -9; z <= 9; z += 1.5) { ribs.push(box(0.1, 2.9, 0.22, C.navy).translate(-1.58, 2.55, z)); if (Math.abs(z) > 2.6) ribs.push(box(0.1, 2.9, 0.22, C.navy).translate(1.58, 2.55, z)); }
    solid = merge([
      box(3.1, 0.3, 19.6, C.steelD).translate(0, 0.98, 0),
      box(3.2, 0.22, 19.7, C.white, 0.1).translate(0, 4.1, 0),
      box(0.14, 2.9, 19.6, w).translate(-1.48, 2.55, 0),
      box(0.14, 2.9, 7.2, w).translate(1.48, 2.55, -6.2), box(0.14, 2.9, 7.2, w).translate(1.48, 2.55, 6.2),
      box(0.12, 2.8, 5, C.yellow).translate(1.66, 2.55, 6),
      box(3.1, 2.9, 0.14, w).translate(0, 2.55, 9.7), box(3.1, 2.9, 0.14, w).translate(0, 2.55, -9.7),
      box(1.1, 1.1, 1.1, C.wood, 0.08).translate(-0.8, 1.7, 7.6), box(1.1, 1.1, 1.1, C.wood, 0.08).translate(-0.8, 1.7, 6.2), box(1, 1, 1, C.woodD, 0.08).translate(-0.8, 2.75, 7),
      box(1.2, 1.4, 1.2, C.teal, 0.08).translate(0.75, 1.85, 8.2),
      ...ribs, ...bogies([-6.6, 6.6]),
    ]);
  }
  const out = { solid, glow };
  geoCache.set(key, out);
  return out;
}

const _f = makeFrame(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Train {
  constructor(parent, track, { accent = C.coral, kinds = ['loco', 'car', 'car', 'car', 'freight'], headlight = true } = {}) {
    this.track = track; this.group = new THREE.Group(); parent.add(this.group);
    this.cars = kinds.map((k, i) => {
      const g = carGeo(k, accent), obj = new THREE.Group();
      const m = new THREE.Mesh(g.solid, k === 'freight' ? MAT.solid : MAT.gloss); m.castShadow = true; obj.add(m);
      if (g.glow) obj.add(new THREE.Mesh(g.glow, MAT.glow));
      this.group.add(obj);
      return { obj, kind: k, back: 10 + i * CAR_LEN, z: 0 };
    });
    this.len = kinds.length * CAR_LEN;
    this.z = 0; this.off = null; this.derail = null; this.speed = 0;
    this.head = new THREE.Vector3();
    if (headlight) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, toneMapped: false }));
      sp.material.color.setScalar(2.2);
      sp.position.set(0, 1.6, 9.9); sp.scale.setScalar(5);
      this.cars[0].obj.add(sp); this.glow = sp;
    }
  }
  // Place every car for head position z. `off` (optional) = lateral offset fn for trains on side lines.
  place(z) {
    this.z = z;
    const t = this.track, off = this.off;
    const X = off ? (q) => t.X0(q) + off(q) : (q) => t.X(q);
    const Y = off ? (q) => t.Y(q) : (q) => t.TY(q);
    const dzdx = X(z + 1) - X(z - 1), dydz = Y(z + 1) - Y(z - 1);
    const stretch = Math.hypot(dzdx / 2, dydz / 2, 1);
    for (const c of this.cars) {
      let zc = z - c.back / stretch;
      const d = this.derail;
      let k = 0;
      if (d) { zc = Math.min(zc, d.stop - c.back * d.squash); k = d.t > 0 && zc >= d.stop - c.back * d.squash - 0.01 ? 1 : 0; if (k && c.hit == null) { c.hit = d.t; d.onHit?.(c); } }
      c.z = zc;
      const h = 6.8 / stretch;
      _a.set(X(zc + h), Y(zc + h) + RAIL_H, zc + h); _b.set(X(zc - h), Y(zc - h) + RAIL_H, zc - h);
      c.obj.position.addVectors(_a, _b).multiplyScalar(0.5);
      c.obj.lookAt(_a);
      // lean into curves a touch
      const curv = X(zc + 6) - 2 * X(zc) + X(zc - 6);
      c.obj.rotateZ(clamp(curv * 0.12, -0.16, 0.16));
      if (d && c.hit != null) {
        const e = 1 - Math.exp(-(d.t - c.hit) * 5), i = this.cars.indexOf(c), s = (i % 2 ? -1 : 1) * d.side;
        c.obj.position.x += s * c.jx * e; c.obj.position.y += c.jy * e;
        c.obj.rotateY(s * c.jyaw * e); c.obj.rotateZ(s * c.jroll * e); c.obj.rotateX(c.jpitch * e);
      }
    }
    t.frame(z, _f); this.head.copy(_f.pos);
  }
  startDerail(stop, side, onHit) {
    this.derail = { stop, side, t: 0, squash: 0.62, onHit };
    this.cars.forEach((c, i) => {
      c.jx = i === 0 ? 1.5 : 2.5 + Math.random() * 3.5; c.jy = i === 0 ? 2.6 : 0.4 + Math.random() * 1.6;
      c.jyaw = i === 0 ? 0.18 : 0.6 + Math.random() * 0.35; c.jroll = i === 0 ? 0.25 : 0.2 + Math.random() * 0.5; c.jpitch = i === 0 ? -0.42 : (Math.random() - 0.5) * 0.3;
    });
  }
  dispose() { this.group.removeFromParent(); }
}
