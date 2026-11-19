// Hand-built props for the set-pieces: smashables, bridges, tunnels, vehicles, the whale…
import * as THREE from 'three';
import { C, MAT, box, cyl, cone, sph, blob, merge, sweep, archProfile, archWall } from './kit.js';
import { Breakable } from './vfx.js';
import { RAIL_H } from './track.js';

const PI = Math.PI;
const R = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const BRIGHT = [C.coral, C.teal, C.yellow, C.blue, C.purple, C.pink, C.orange];

// ---- smashables: each builds pieces into a Breakable (local x = lateral, z = along the track) ----
export const SMASH = {
  barrier: { w: 1, label: 'BARRIER', colors: [C.red, C.white, C.orange], build(b) {
    for (const i of [-1, 0, 1]) { b.add(box(2.8, 1.25, 0.7, i ? C.red : C.white, 0.2), i * 3.1, 0.65, 0, MAT.solid); b.add(box(2.82, 0.36, 0.72, i ? C.white : C.red), i * 3.1, 0.75, 0, MAT.solid); }
    for (const x of [-6, -2, 2, 6]) b.add(cone(0.5, 1.2, C.orange, 8), x, 0.6, -3.5, MAT.solid);
    for (const x of [-3.1, 3.1]) b.add(sph(0.28, 0xffc040, 8, 6), x, 1.5, 0, MAT.glow);
  } },
  billboard: { w: 1.5, label: 'BILLBOARD', colors: [C.white, C.coral, C.teal, C.yellow], build(b) {
    const a = pick(BRIGHT), c = pick(BRIGHT);
    for (const x of [-7.6, 7.6]) b.add(cyl(0.3, 0.36, 9.4, C.steelD, 8), x, 4.7, 0, MAT.solid, { heavy: true });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) b.add(box(3.5, 3.1, 0.35, (i + j) % 2 ? a : C.white, 0.12), -5.25 + i * 3.5, 2.6 + j * 3.1, 0, MAT.solid);
    b.add(box(14.6, 0.4, 0.5, c), 0, 7.9, 0, MAT.solid); b.add(box(14.6, 0.4, 0.5, c), 0, 0.9, 0, MAT.solid);
    b.add(sph(1.5, c, 12, 8).scale(1, 1, 0.2), -1.75, 4.15, 0.25, MAT.solid); b.add(box(4.4, 0.6, 0.2, c, 0.1), 3.3, 4.6, 0.25, MAT.solid); b.add(box(3, 0.6, 0.2, a, 0.1), 2.6, 3.5, 0.25, MAT.solid);
  } },
  crates: { w: 1, label: 'CRATES', colors: [C.wood, C.woodD, C.hay], build(b) {
    const rows = [[-3.6, -1.2, 1.2, 3.6], [-2.4, 0, 2.4], [-1.2, 1.2]];
    rows.forEach((r, j) => r.forEach((x) => b.add(merge([box(2.25, 2.25, 2.25, j % 2 ? C.woodD : C.wood, 0.14), box(2.3, 0.3, 2.3, C.woodD), box(0.3, 2.3, 2.3, C.woodD)]), x, 1.15 + j * 2.25, R(-0.2, 0.2), MAT.solid, { ry: R(-0.15, 0.15) })));
  } },
  construction: { w: 2, label: 'CONSTRUCTION SITE', colors: [C.orange, C.yellow, C.steel, C.wood], build(b) {
    for (const x of [-5.4, 5.4]) for (const z of [-2.2, 2.2]) b.add(cyl(0.13, 0.13, 7.4, C.steel, 6), x, 3.7, z, MAT.solid);
    for (const y of [3.6, 7.2]) { b.add(box(11.2, 0.22, 4.8, C.wood), 0, y, 0, MAT.solid); b.add(box(11.2, 0.12, 0.12, C.yellow), 0, y + 1, -2.3, MAT.solid); }
    for (const i of [-1, 0, 1]) b.add(merge([box(3.3, 1.7, 0.14, C.orange, 0.06), box(3.3, 0.3, 0.16, C.white).translate(0, 0.3, 0)]), i * 3.5, 0.95, -5, MAT.solid);
    b.add(merge([cyl(1.1, 0.8, 1.8, C.yellow, 10).rotateX(0.6).translate(0, 1.9, 0), box(1.6, 1, 1.4, C.steelD, 0.1).translate(0, 0.6, 0)]), -3.6, 0, 3.6, MAT.solid);
    for (const x of [-6.5, -2.2, 2.2, 6.5]) b.add(cone(0.5, 1.2, C.orange, 8), x, 0.6, -7.5, MAT.solid);
    b.add(box(1.4, 1.4, 1.4, C.wood, 0.1), 3.4, 4.4, 0.5, MAT.solid); b.add(box(1.2, 0.5, 3, C.steel), 2.6, 7.6, 0, MAT.solid);
  } },
  bales: { w: 1, label: 'HAY WAGON', colors: [C.hay, C.wood, 0xf8dc8c], build(b) {
    b.add(merge([box(8.4, 0.4, 3.6, C.wood).translate(0, 1.1, 0), ...[-3, 3].map((x) => cyl(0.7, 0.7, 0.4, C.dark, 10).rotateX(PI / 2).translate(x, 0.7, 1.9)), ...[-3, 3].map((x) => cyl(0.7, 0.7, 0.4, C.dark, 10).rotateX(PI / 2).translate(x, 0.7, -1.9))]), 0, 0, 0, MAT.solid, { heavy: true });
    [[-2.7, 0, 2.7], [-1.35, 1.35], [0]].forEach((r, j) => r.forEach((x) => b.add(cyl(1.3, 1.3, 3.2, C.hay, 12).rotateX(PI / 2), x, 2.6 + j * 2.3, 0, MAT.solid)));
  } },
  watertower: { w: 2, label: 'WATER TOWER', colors: [C.teal, C.white, C.steel], splash: true, build(b) {
    for (const x of [-3.2, 3.2]) for (const z of [-3.2, 3.2]) b.add(cyl(0.2, 0.26, 3.4, C.steelD, 6), x, 1.7, z, MAT.solid);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; b.add(box(3.4, 5.6, 0.6, i % 2 ? C.teal : 0x35d4c6, 0.2), Math.cos(a) * 3.9, 6.2, Math.sin(a) * 3.9, MAT.solid, { ry: PI / 2 - a }); }
    b.add(cone(5, 2.4, C.white, 14), 0, 10.2, 0, MAT.solid); b.add(cyl(4.4, 4.4, 0.4, C.steel, 14), 0, 3.5, 0, MAT.solid);
  } },
  wall: { w: 2.5, label: 'BRICK WALL', colors: [C.brick, C.brickD, 0xe88a70], build(b) {
    for (let j = 0; j < 6; j++) for (let i = 0; i < 9; i++) {
      const x = -8.8 + i * 2.2 + (j % 2 ? 1.1 : 0);
      b.add(box(2.14, 1.12, 1.1, (i + j * 2) % 3 ? C.brick : C.brickD, 0.1), x, 0.58 + j * 1.15, 0, MAT.solid);
    }
    b.add(box(20.5, 0.5, 1.4, C.concrete, 0.1), 0, 7.15, 0, MAT.solid);
    for (const x of [-4.4, 0, 4.4]) b.add(box(3.6, 0.9, 0.15, x ? C.yellow : C.ink), x, 3.4, -0.62, MAT.solid);
  } },
};

export function crossingGate() {
  const b = new Breakable();
  for (const s of [-1, 1]) {
    b.add(box(0.6, 1.6, 0.6, C.steelD, 0.1), s * 7.4, 0.8, 0, MAT.solid, { heavy: true });
    for (let i = 0; i < 4; i++) b.add(box(1.85, 0.26, 0.26, i % 2 ? C.white : C.red), s * (6.4 - i * 1.85), 1.5, 0, MAT.solid);
    b.add(sph(0.3, 0xff4040, 8, 6), s * 7.4, 2.1, 0, MAT.glow);
  }
  return b;
}

export function stationHall() {
  const b = new Breakable();
  for (const z of [0, 16]) {
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) b.add(box(3.3, 2.5, 0.2, (i + j) % 2 ? C.glass : 0xb5ebff, 0.08), -6.8 + i * 3.4, 1.5 + j * 2.6, z, MAT.solid);
    for (let i = 0; i <= 5; i++) b.add(box(0.2, 8, 0.3, C.white), -8.5 + i * 3.4, 4, z, MAT.solid);
  }
  for (const x of [-10, 10]) b.add(box(3, 8.4, 19, C.cream, 0.4), x, 4.2, 8, MAT.solid, { heavy: true, r: 2 });
  b.add(box(25, 1, 21, C.coral, 0.4), 0, 8.9, 8, MAT.solid, { heavy: true, r: 1 });
  b.add(box(27, 0.4, 23, C.white, 0.15), 0, 8.3, 8, MAT.solid, { heavy: true });
  b.add(merge([box(3.2, 5, 3.2, C.cream, 0.3), cone(2.8, 2.4, C.coral, 4).rotateY(PI / 4).translate(0, 3.7, 0), cyl(1, 1, 0.2, C.white, 14).rotateX(PI / 2).translate(0, 0.6, -1.65)]), 0, 11.9, 2, MAT.solid, { heavy: true, r: 2 });
  for (const x of [-5, 5]) b.add(merge([box(2.6, 0.2, 0.8, C.wood), box(2.6, 0.8, 0.15, C.wood).translate(0, 0.5, 0.35)]), x, 0.6, 8, MAT.solid);
  return b;
}

export function tower() {
  const b = new Breakable();
  const W = 15, D = 11, FH = 4.4, cols = [C.concrete, C.white, C.concreteD];
  for (let f = 0; f < 7; f++) {
    const y = f * FH, c = cols[f % 3];
    b.add(box(W, 0.5, D, C.concreteD), 0, y + FH, 0, MAT.solid, { heavy: true, r: 0.4 });
    for (const x of [-W / 2 + 0.4, W / 2 - 0.4]) b.add(merge([box(0.8, FH - 0.5, D, c), box(0.84, 1.6, D * 0.6, C.navy).translate(0, 0.3, 0)]), x, y + FH / 2 - 0.25, 0, MAT.solid, { heavy: true, r: 1 });
    if (f > 0) for (const z of [-D / 2 + 0.3, D / 2 - 0.3]) for (const i of [-1, 0, 1]) b.add(merge([box(4.6, FH - 0.5, 0.5, c, 0.1), box(3, 1.7, 0.56, C.navy, 0.1).translate(0, 0.3, 0)]), i * 4.7, y + FH / 2 - 0.25, z, MAT.solid, { r: 1 });
  }
  b.add(merge([box(6, 2, 4, C.steel, 0.2), cyl(0.12, 0.12, 6, C.steelD, 5).translate(2, 4, 0), box(11, 0.3, 0.3, C.yellow).translate(-2, 6.8, 0)]), 2, 7 * FH + 1.3, 0, MAT.solid, { heavy: true });
  for (const i of [-1, 0, 1]) b.add(merge([box(4.4, 2, 0.14, C.orange, 0.06), box(4.4, 0.34, 0.16, C.white).translate(0, 0.3, 0)]), i * 4.6, 1.1, -D / 2 - 1.5, MAT.solid);
  return b;
}

export function strikeTree(b0) {
  const b = new Breakable();
  b.add(cyl(0.5, 0.7, 5, C.woodD, 7), 0, 2.5, 0, MAT.solid, { heavy: true });
  b.add(sph(3.2, b0.leafA, 10, 8), 0, 7.4, 0, MAT.solid); b.add(sph(2.1, b0.leafB, 9, 7), 1.8, 5.8, 0.8, MAT.solid); b.add(sph(1.9, b0.leafB, 9, 7), -1.6, 6, -0.7, MAT.solid);
  return b;
}

// ---- finale obstacles (indestructible) ----
export function megaBuffer() {
  const g = [box(19, 12, 9, C.concreteD, 0.8).translate(0, 6, 5), box(20, 2.2, 10, C.steelD, 0.4).translate(0, 1.1, 5), box(20, 1.2, 10, C.steelD, 0.4).translate(0, 12.2, 5)];
  for (let i = -4; i <= 4; i++) g.push(box(1.4, 3.2, 0.3, i % 2 ? C.yellow : C.ink).rotateZ(0.5).translate(i * 2.05, 4.4, 0.35));
  g.push(box(19.2, 0.5, 0.5, C.yellow).translate(0, 6.4, 0.3), box(19.2, 0.5, 0.5, C.yellow).translate(0, 2.4, 0.3));
  for (const x of [-7, 7]) g.push(cyl(1.2, 1.2, 1.6, C.red, 14).rotateX(PI / 2).translate(x, 8.6, 0.2));
  const m = new THREE.Mesh(merge(g), MAT.solid); m.castShadow = true;
  const gl = new THREE.Mesh(merge([sph(0.8, 0xff3030, 10, 8).translate(-7, 8.6, -0.5), sph(0.8, 0xff3030, 10, 8).translate(7, 8.6, -0.5)]), MAT.glow);
  const grp = new THREE.Group(); grp.add(m, gl); return grp;
}
export function boulder(rockCol) {
  const g = [blob(9.4, rockCol, 0.22, 3, 3).scale(1.15, 0.95, 1).translate(0, 6.5, 9.5), blob(4.5, C.rockD, 0.25, 5).translate(-9, 2.5, 4), blob(3.6, C.rockD, 0.25, 7).translate(9.5, 2, 6), blob(2.4, rockCol, 0.25, 9).translate(5, 1.4, -1), blob(2, rockCol, 0.25, 11).translate(-5.5, 1.2, -0.5), blob(1.2, C.rockD, 0.25, 13).translate(2, 0.7, -2.5)];
  const m = new THREE.Mesh(merge(g), MAT.solid); m.castShadow = true; return m;
}
export function crater() {
  const g = [cyl(8, 9.5, 0.5, C.ink, 24).translate(0, 0.2, 6)];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; g.push(blob(R(1, 2.2), i % 2 ? C.rockD : C.dark, 0.28, i).translate(Math.cos(a) * 8.6, 0.6, 6 + Math.sin(a) * 8.6)); }
  for (const s of [-1, 1]) g.push(box(0.24, 0.3, 10, C.steel).rotateX(-0.5 * s).rotateZ(0.5 * s).translate(s * 2.2, 3, 2));
  const m = new THREE.Mesh(merge(g), MAT.solid); m.castShadow = true; return m;
}
export function warnSign(text = 0) {
  return merge([cyl(0.14, 0.14, 4, C.steelD, 6).translate(0, 2, 0), box(2.6, 2.6, 0.2, C.yellow, 0.3).rotateZ(PI / 4).translate(0, 4.6, 0), box(0.4, 1.3, 0.24, C.ink).translate(0, 4.8, 0), box(0.4, 0.4, 0.24, C.ink).translate(0, 3.8, 0)]);
}

// ---- bridges ----
export function bridgeGeos(truss, color) {
  const d = [box(7.4, 0.9, 12.14, C.concrete).translate(0, -0.5, 0), box(0.24, 0.27, 12.14, C.steel).translate(-0.95, RAIL_H - 0.14, 0), box(0.24, 0.27, 12.14, C.steel).translate(0.95, RAIL_H - 0.14, 0)];
  for (let z = -5; z <= 5; z += 2) d.push(box(3.3, 0.2, 0.6, C.woodD).translate(0, 0.1, z));
  for (const s of [-1, 1]) {
    if (truss) {
      d.push(box(0.5, 0.5, 12.14, color).translate(s * 3.6, 6.6, 0), box(0.5, 0.5, 12.14, color).translate(s * 3.6, 0.3, 0), box(0.4, 6.4, 0.4, color).translate(s * 3.6, 3.4, -6), box(0.34, 8.6, 0.34, color).rotateX(0.76 * 1).translate(s * 3.6, 3.4, -3), box(0.34, 8.6, 0.34, color).rotateX(-0.76).translate(s * 3.6, 3.4, 3));
    } else {
      d.push(box(0.3, 1.1, 12.14, C.concreteD, 0.1).translate(s * 3.5, 0.5, 0));
    }
  }
  if (truss) d.push(box(7.4, 0.4, 0.4, color).translate(0, 6.6, -6));
  const pier = merge([box(4.6, 1, 3.4, C.concreteD).translate(0, -0.5, 0)]);
  const cap = merge([box(6.6, 1.6, 4, C.concrete, 0.3).translate(0, -1.7, 0)]);
  return { deck: merge(d), pier, cap };
}

// ---- tunnel shell ----
export const TUBE = archProfile(6.4, 7.6, 14);
export const HOOD = archProfile(7.3, 8.5, 14);
export function portalRing() {
  const s = new THREE.Shape();
  const pts = archProfile(7.7, 8.9, 16), inner = archProfile(6.2, 7.4, 16).reverse();
  s.moveTo(pts[0][0], 0); pts.forEach(([x, y]) => s.lineTo(x, y)); inner.forEach(([x, y]) => s.lineTo(x, y)); s.lineTo(pts[0][0], 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: false });
  g.translate(0, 0, -0.7);
  return g;
}
export { sweep, archWall };

// ---- vehicles ----
export function carGeo(col) {
  return merge([box(2, 0.9, 4.4, col, 0.3).translate(0, 0.85, 0), box(1.8, 0.8, 2.3, C.white, 0.3).translate(0, 1.6, -0.2), box(1.84, 0.5, 1.9, C.ink, 0.15).translate(0, 1.62, -0.2),
    ...[[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]].map(([x, z]) => cyl(0.42, 0.42, 0.3, C.ink, 10).rotateZ(PI / 2).translate(x, 0.42, z))]);
}
export function truckGeo(col) {
  return merge([box(2.5, 2.4, 2.6, col, 0.4).translate(0, 2.1, 4.4), box(2.54, 0.9, 1.2, C.ink, 0.15).translate(0, 2.6, 5.2), box(2.6, 3, 7.6, C.white, 0.25).translate(0, 2.5, -1), box(2.64, 0.5, 7.6, col).translate(0, 2.4, -1),
    box(2.3, 0.5, 10.6, C.steelD).translate(0, 0.95, 0.4), ...[[-1.2, 4.2], [1.2, 4.2], [-1.2, -2], [1.2, -2], [-1.2, -3.6], [1.2, -3.6]].map(([x, z]) => cyl(0.7, 0.7, 0.5, C.ink, 12).rotateZ(PI / 2).translate(x, 0.7, z))]);
}
export function heli() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(merge([
    sph(1, C.ink, 14, 10).scale(1.5, 1.5, 3.2).translate(0, 0, 0), sph(1, C.glass, 12, 8).scale(1.25, 1.1, 1.6).translate(0, 0.25, 1.9),
    box(0.5, 0.6, 6, C.ink, 0.2).translate(0, 0.5, -5), box(0.14, 2, 1.1, C.red, 0.05).translate(0, 1.4, -7.6), box(2.2, 0.12, 0.8, C.red).translate(0, 0.6, -7.4),
    box(3.4, 0.22, 0.5, C.red).translate(0, -0.2, 0.2), cyl(0.2, 0.2, 0.9, C.steelD, 6).translate(0, 1.7, 0),
    ...[-1.3, 1.3].map((x) => merge([cyl(0.09, 0.09, 4.6, C.steel, 5).rotateX(PI / 2).translate(x, -1.9, 0.2), cyl(0.07, 0.07, 1, C.steel, 5).translate(x * 0.9, -1.45, 1.2), cyl(0.07, 0.07, 1, C.steel, 5).translate(x * 0.9, -1.45, -0.9)])),
    cyl(0.14, 0.14, 1.8, C.steelD, 6).rotateX(PI / 2).translate(1.75, -0.3, 1.2), cyl(0.14, 0.14, 1.8, C.steelD, 6).rotateX(PI / 2).translate(-1.75, -0.3, 1.2),
  ]), MAT.gloss);
  body.castShadow = true;
  const rotor = new THREE.Mesh(merge([box(13, 0.08, 0.5, C.steelD), box(0.5, 0.08, 13, C.steelD)]), MAT.solid); rotor.position.y = 2.2;
  const tail = new THREE.Mesh(merge([box(0.06, 2.4, 0.3, C.steelD), box(0.06, 0.3, 2.4, C.steelD)]), MAT.solid); tail.position.set(0.3, 1.4, -7.6);
  g.add(body, rotor, tail); g.userData = { rotor, tail };
  return g;
}
export function bike() {
  const m = new THREE.Mesh(merge([
    cyl(0.42, 0.42, 0.2, C.ink, 12).rotateZ(PI / 2).translate(0, 0.42, 0.85), cyl(0.42, 0.42, 0.2, C.ink, 12).rotateZ(PI / 2).translate(0, 0.42, -0.85),
    box(0.3, 0.45, 1.5, C.red, 0.15).translate(0, 0.8, 0), box(0.5, 0.1, 0.1, C.steel).translate(0, 1.2, 0.7), cyl(0.05, 0.05, 0.8, C.steel, 5).rotateX(-0.4).translate(0, 0.85, 0.8),
    box(0.5, 0.75, 0.45, C.yellow, 0.15).rotateX(0.35).translate(0, 1.45, -0.15), sph(0.27, C.white, 10, 8).translate(0, 2.0, 0.08), box(0.3, 0.14, 0.2, C.ink).translate(0, 2.0, 0.26),
    box(0.16, 0.16, 0.7, C.yellow).rotateX(-0.7).translate(0.3, 1.4, 0.35), box(0.16, 0.16, 0.7, C.yellow).rotateX(-0.7).translate(-0.3, 1.4, 0.35),
    box(0.2, 0.6, 0.2, C.navy).rotateX(0.5).translate(0.28, 0.85, -0.05), box(0.2, 0.6, 0.2, C.navy).rotateX(0.5).translate(-0.28, 0.85, -0.05),
  ]), MAT.gloss);
  m.castShadow = true; return m;
}
export function whale() {
  const m = new THREE.Mesh(merge([
    sph(1, C.navy, 20, 14).scale(5, 4.4, 13), sph(1, C.cream, 18, 12).scale(4.6, 3.4, 11.5).translate(0, -1.3, 0.8),
    sph(1, C.navy, 12, 8).scale(1.9, 1.5, 6).translate(0, 0.4, -14), sph(1, C.navy, 10, 6).scale(4, 0.5, 2).rotateY(0.4).translate(3, 0.6, -19.5), sph(1, C.navy, 10, 6).scale(4, 0.5, 2).rotateY(-0.4).translate(-3, 0.6, -19.5),
    sph(1, C.navy, 10, 6).scale(3.4, 0.5, 1.7).rotateZ(-0.5).translate(5.6, -2, 3), sph(1, C.navy, 10, 6).scale(3.4, 0.5, 1.7).rotateZ(0.5).translate(-5.6, -2, 3),
    sph(0.45, C.white, 8, 6).translate(4.1, 0.6, 8), sph(0.45, C.white, 8, 6).translate(-4.1, 0.6, 8), sph(0.25, C.ink, 8, 6).translate(4.4, 0.6, 8.2), sph(0.25, C.ink, 8, 6).translate(-4.4, 0.6, 8.2),
  ]), MAT.gloss);
  m.castShadow = true; return m;
}

// animated waterfall sheet: cross-section path of [toward-mountain, up] points, `len` metres along the line
export function waterfallMesh(path, len) {
  const pos = [], uv = [], idx = [];
  let acc = 0;
  path.forEach(([m, y], i) => {
    if (i) acc += Math.hypot(m - path[i - 1][0], y - path[i - 1][1]);
    pos.push(m, y, -len / 2, m, y, len / 2); uv.push(0, acc / 20, 1, acc / 20);
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float t; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      void main(){
        float x = vUv.x * 26.0, y = vUv.y * 5.0 - t * 2.6;
        float s = h(vec2(floor(x), floor(y + h(vec2(floor(x), 1.0)) * 7.0)));
        float streak = smoothstep(0.35, 1.0, s) * (0.5 + 0.5 * sin(x * 6.283));
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        vec3 col = mix(vec3(0.42, 0.78, 0.95), vec3(1.0), 0.35 + 0.65 * streak);
        gl_FragColor = vec4(col, (0.72 + 0.28 * streak) * edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(g, mat);
}
