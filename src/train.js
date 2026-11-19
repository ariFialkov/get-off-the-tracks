// The train: a sleek bullet-style loco, passenger cars and a hollow freight car at the tail.
import * as THREE from 'three';
import { C, MAT, box, cyl, sph, merge, tint, glowTexture } from './kit.js';
import { RAIL_H, makeFrame, clamp } from './track.js';

export const CAR_LEN = 20.4;
const geoCache = new Map();

function bogies(zs) {
  const p = [];
  for (const z of zs) {
    p.push(box(2.3, 0.55, 3.9, C.dark, 0.2).translate(0, 0.62, z), box(2.5, 0.2, 2.2, C.steelD, 0.08).translate(0, 0.86, z));
    for (const dz of [-1.15, 1.15]) for (const x of [-0.98, 0.98]) p.push(cyl(0.52, 0.52, 0.22, C.steelD, 18).rotateZ(Math.PI / 2).translate(x, 0.52, z + dz), cyl(0.3, 0.3, 0.26, C.steel, 12).rotateZ(Math.PI / 2).translate(x, 0.52, z + dz), cyl(0.12, 0.12, 0.3, accentHub, 8).rotateZ(Math.PI / 2).translate(x, 0.52, z + dz));
  }
  return p;
}
let accentHub = C.yellow;
// shared body dressing: skirt, twin stripes, window band with pillars, doors, underfloor gear
function dress(L, zc, accent, doors, winLen) {
  const p = [
    box(3.14, 0.8, L - 0.3, C.steel, 0.3).translate(0, 1.05, zc),
    box(3.21, 0.26, L - 0.4, accent).translate(0, 1.74, zc), box(3.21, 0.07, L - 0.4, tint(accent, 0x000000, 0.3)).translate(0, 1.96, zc),
    box(3.19, 0.72, winLen, C.ink, 0.22).translate(0, 2.95, zc),
    box(3.16, 0.06, L - 1, C.concrete).translate(0, 3.5, zc),
  ];
  for (let z = zc - winLen / 2 + 1.5; z < zc + winLen / 2 - 0.5; z += 1.5) p.push(box(3.2, 0.74, 0.1, C.white).translate(0, 2.95, z));
  for (const dz of doors) p.push(box(3.2, 2.3, 1.15, C.concrete, 0.12).translate(0, 2.25, dz), box(3.22, 0.75, 0.6, C.ink, 0.1).translate(0, 2.95, dz), box(3.23, 0.3, 1.15, accent).translate(0, 1.74, dz));
  for (const dz of [zc - 1.8, zc + 1.6]) p.push(box(2.5, 0.55, 2.4, C.steelD, 0.12).translate(0, 0.72, dz));
  return p;
}

function carGeo(kind, accent) {
  const key = kind + accent;
  if (geoCache.has(key)) return geoCache.get(key);
  accentHub = accent;
  let solid, glow = null;
  const gangway = box(2.3, 2.7, 0.9, C.ink, 0.3).translate(0, 2.3, -10.05);
  if (kind === 'loco') {
    solid = merge([
      box(3.1, 3.1, 12.6, C.white, 0.95).translate(0, 2.4, -3.6),
      sph(1, C.white, 36, 22).scale(1.55, 1.55, 6.8).translate(0, 2.4, 2.4),
      sph(1, accent, 36, 18).scale(1.5, 0.85, 7.6).translate(0, 1.3, 2.2),
      sph(1, tint(accent, 0x000000, 0.3), 30, 12).scale(1.44, 0.5, 7.2).translate(0, 0.95, 2.1),
      sph(1, C.ink, 28, 16).scale(1.22, 0.95, 2.7).translate(0, 3.12, 4.7),
      sph(1, 0x3a5a7a, 20, 10).scale(0.8, 0.5, 1.5).translate(0, 3.5, 5.3),
      ...dress(12.4, -3.6, accent, [1.6, -8.6], 7.4),
      box(1.7, 0.3, 4.2, C.concrete, 0.12).translate(0, 4.0, -5), box(0.9, 0.1, 6.5, accent).translate(0, 3.96, 0.2),
      // pantograph
      box(1.2, 0.12, 1.6, C.steelD, 0.04).translate(0, 4.2, -1.6), box(0.1, 1.1, 0.1, C.steelD).rotateX(0.7).translate(0, 4.6, -1.3), box(0.1, 1.1, 0.1, C.steelD).rotateX(-0.7).translate(0, 5.3, -1.3), box(2, 0.08, 0.3, C.steel, 0.03).translate(0, 5.72, -1.62),
      sph(0.42, C.ink, 14, 10).scale(1, 1, 0.5).translate(-0.82, 1.45, 9.05), sph(0.42, C.ink, 14, 10).scale(1, 1, 0.5).translate(0.82, 1.45, 9.05),
      gangway, ...bogies([-7.2, 3.2]),
    ]);
    glow = merge([sph(0.3, 0xfff6d0, 12, 10).translate(-0.82, 1.45, 9.25), sph(0.3, 0xfff6d0, 12, 10).translate(0.82, 1.45, 9.25), box(0.9, 0.09, 0.2, 0xffffff).translate(0, 2.05, 9.0)]);
  } else if (kind === 'car') {
    solid = merge([
      box(3.1, 3.1, 19.6, C.white, 0.95).translate(0, 2.4, 0),
      ...dress(19.4, 0, accent, [8.3, -8.3], 14.2),
      box(1.7, 0.3, 4.2, C.concrete, 0.12).translate(0, 4.0, -4.5), box(1.7, 0.3, 4.2, C.concrete, 0.12).translate(0, 4.0, 4.5), box(0.9, 0.1, 19, accent).translate(0, 3.96, 0),
      ...[-4.5, 4.5].flatMap((z) => [-1.2, 0, 1.2].map((d) => box(1.4, 0.06, 0.12, C.steelD).translate(0, 4.17, z + d))),
      gangway, ...bogies([-6.6, 6.6]),
    ]);
  } else { // freight: hollow, door open on the +x side
    const w = accent, ribs = [];
    for (let z = -9; z <= 9; z += 1.5) { ribs.push(box(0.1, 2.9, 0.22, C.navy).translate(-1.58, 2.55, z)); if (Math.abs(z) > 2.6) ribs.push(box(0.1, 2.9, 0.22, C.navy).translate(1.58, 2.55, z)); }
    solid = merge([
      box(3.1, 0.3, 19.6, C.steelD).translate(0, 0.98, 0),
      box(3.2, 0.22, 19.7, C.white, 0.1).translate(0, 4.1, 0),
      box(0.14, 2.9, 19.6, w).translate(-1.48, 2.55, 0),
      box(0.14, 2.9, 7.2, w).translate(1.48, 2.55, -6.2), box(0.14, 2.9, 7.2, w).translate(1.48, 2.55, 6.2),
      box(0.12, 2.8, 5, C.yellow).translate(1.66, 2.55, 6), box(0.14, 0.3, 5, C.ink).translate(1.67, 2.55, 6), box(0.1, 0.12, 12, C.steelD).translate(1.62, 4.0, 2),
      box(3.1, 2.9, 0.14, w).translate(0, 2.55, 9.7), box(3.1, 2.9, 0.14, w).translate(0, 2.55, -9.7),
      box(3.24, 0.24, 19.7, C.navy).translate(0, 1.2, 0),
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
