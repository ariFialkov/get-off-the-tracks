// Scenery prototypes (instanced along the track) and the tidy "side modules" that arrange them.
// Convention: anything with a "front" is modelled facing local -x, i.e. toward the track when it
// stands on the +x side; the placer mirrors it (rot -> PI - rot) for the other side.
import { C, box, cyl, cone, sph, blob, prism, shade, tint, merge } from './kit.js';

const PI = Math.PI;
export const BIOMES = [
  { name: 'meadow', grassA: 0x86e06f, grassB: 0x5fcf6c, leafA: 0x3fc463, leafB: 0x25a85a, pine: 0x1f8f68, rock: 0xa9b1ba, accent: 0xffd34d, fields: [0xf2d86a, 0x4fbf62, 0xa5e87a, 0xe8b85a] },
  { name: 'sakura', grassA: 0x9be887, grassB: 0x74d880, leafA: 0xffb0d0, leafB: 0xff7fb4, pine: 0x2f9e7c, rock: 0xb3b7c6, accent: 0xffa3c7, fields: [0xffd3e4, 0x69d27c, 0xc4f09a, 0xfff0a8] },
  { name: 'autumn', grassA: 0xd3df74, grassB: 0xb7d264, leafA: 0xffa233, leafB: 0xf2622f, pine: 0x4a9460, rock: 0xb6aca0, accent: 0xff9d3c, fields: [0xf5c04e, 0xd98a3a, 0xc9dc6a, 0xf0e08a] },
  { name: 'frost', grassA: 0xf1f8fd, grassB: 0xdcecf8, leafA: 0xbfeef2, leafB: 0x8fd6e8, pine: 0x34908a, rock: 0x9fb2c6, accent: 0x8fdcff, fields: [0xe3f1fb, 0xcfe6f6, 0xffffff, 0xd8f3f0] },
];

const cache = new Map();
export function getProtos(b) {
  if (cache.has(b.name)) return cache.get(b.name);
  const P = {};
  const def = (name, parts, o = {}) => {
    const geo = merge(parts);
    if (o.shade !== false) shade(geo, o.lo ?? 0.74, o.hi ?? 1.07);
    P[name] = { geo, glow: o.glow ? merge(o.glow) : null, shadow: o.shadow !== false, mat: o.mat, tint: o.tint ?? 0.1 };
  };
  const leafHi = tint(b.leafA, 0xffffff, 0.28), leafLo = tint(b.leafB, 0x103040, 0.18), pineHi = tint(b.pine, 0xffffff, 0.2), bark = 0x8a5a3c, barkD = 0x6e4630;
  const trunk = (h, r) => [cyl(r * 0.62, r, h, bark, 10).translate(0, h / 2, 0), cone(r * 1.5, h * 0.22, barkD, 10).translate(0, h * 0.11, 0)];

  def('tree', [
    ...trunk(3.6, 0.5),
    cyl(0.14, 0.2, 1.8, bark, 6).rotateZ(-0.9).translate(0.7, 3.2, 0), cyl(0.14, 0.2, 1.6, bark, 6).rotateZ(0.9).rotateY(1).translate(-0.5, 3.3, 0.4),
    blob(2.7, b.leafA, 0.16, 1).scale(1, 0.95, 1).translate(0, 5.6, 0),
    blob(1.9, b.leafB, 0.18, 2).translate(1.7, 4.5, 0.6), blob(1.8, leafLo, 0.18, 3).translate(-1.6, 4.4, -0.7), blob(1.7, b.leafB, 0.18, 4).translate(0.2, 4.6, 1.7), blob(1.6, leafLo, 0.18, 5).translate(-0.3, 4.5, -1.7),
    blob(1.7, leafHi, 0.16, 6).translate(0.3, 7.3, 0.2), blob(1.2, leafHi, 0.16, 7).translate(-1.1, 6.6, 0.8),
  ], { lo: 0.7 });
  def('tree2', [
    ...trunk(3.2, 0.42),
    blob(1.9, b.leafB, 0.14, 8).scale(1, 1.25, 1).translate(0, 4.8, 0), blob(1.6, b.leafA, 0.14, 9).scale(1, 1.3, 1).translate(0, 7, 0), blob(1.05, leafHi, 0.14, 10).scale(1, 1.4, 1).translate(0, 9, 0),
    blob(1, leafLo, 0.16, 11).translate(1.2, 4.2, 0.5), blob(0.9, leafLo, 0.16, 12).translate(-1.1, 4.5, -0.5),
  ], { lo: 0.7 });
  def('tree3', [
    ...trunk(4.4, 0.4),
    cyl(0.13, 0.2, 2.4, bark, 6).rotateZ(-1).translate(1, 4.4, 0), cyl(0.13, 0.2, 2.2, bark, 6).rotateZ(1).translate(-0.9, 4.2, 0),
    blob(2.2, b.leafA, 0.18, 13).scale(1.25, 0.6, 1.25).translate(0, 6.6, 0), blob(1.6, leafHi, 0.18, 14).scale(1.2, 0.6, 1.2).translate(0.5, 7.6, 0.3),
    blob(1.5, b.leafB, 0.18, 15).scale(1.2, 0.6, 1.2).translate(2.2, 5.4, 0.2), blob(1.4, b.leafB, 0.18, 16).scale(1.2, 0.6, 1.2).translate(-2, 5.2, -0.3),
  ], { lo: 0.7 });
  def('pine', [
    cyl(0.3, 0.46, 2.6, bark, 9).translate(0, 1.3, 0),
    cone(3, 3.6, b.pine, 16).translate(0, 3.6, 0), cone(2.5, 3.3, b.pine, 16).translate(0, 5.5, 0), cone(1.95, 3, tint(b.pine, pineHi, 0.5), 16).translate(0, 7.3, 0), cone(1.3, 2.8, pineHi, 16).translate(0, 9, 0),
    cyl(2.9, 3, 0.1, tint(b.pine, 0x000000, 0.25), 16).translate(0, 1.82, 0), cyl(2.4, 2.5, 0.1, tint(b.pine, 0x000000, 0.25), 16).translate(0, 3.87, 0),
  ], { lo: 0.66 });
  def('bush', [blob(1.25, b.leafB, 0.2, 17).scale(1.25, 0.8, 1).translate(0, 0.8, 0), blob(0.95, b.leafA, 0.2, 18).translate(1.15, 0.75, 0.3), blob(0.8, leafHi, 0.2, 19).translate(-0.9, 0.9, -0.3),
    ...[[0.4, 1.5, 0.6], [-0.5, 1.4, 0.5], [1.3, 1.3, -0.2]].map(([x, y, z]) => sph(0.16, b.accent, 8, 6).translate(x, y, z))]);
  def('rock', [blob(1.6, b.rock, 0.3, 20).scale(1.25, 0.8, 1).translate(0, 0.7, 0), blob(0.95, tint(b.rock, 0x000000, 0.2), 0.3, 21).scale(1, 0.8, 1.2).translate(1.6, 0.4, 0.5), blob(0.5, b.rock, 0.3, 22).translate(-1.4, 0.25, 0.9)], { lo: 0.62 });
  def('tuft', [cone(0.16, 0.9, b.leafB, 5).rotateZ(0.2).translate(0, 0.4, 0), cone(0.14, 0.7, b.leafA, 5).rotateZ(-0.35).translate(0.15, 0.3, 0.1), cone(0.14, 0.75, leafHi, 5).rotateX(0.35).translate(-0.1, 0.32, -0.12)], { shadow: false, tint: 0.2 });

  const win = (x, y, z, ry = 0) => merge([box(1.5, 1.4, 0.16, C.white, 0.06), box(1.2, 1.1, 0.2, 0x4c7fd0, 0.04), box(0.08, 1.1, 0.24, C.white), box(1.2, 0.08, 0.24, C.white), box(1.7, 0.14, 0.34, C.white, 0.04).translate(0, -0.78, 0.06)]).rotateY(ry).translate(x, y, z);
  const house = (wall, roof, trim) => merge([
    box(7.4, 0.5, 6.8, C.concreteD, 0.1).translate(0, 0.25, 0),
    box(7, 4.2, 6.4, wall, 0.3).translate(0, 2.5, 0),
    prism(8, 3, 7.6, roof).rotateY(PI / 2).translate(0, 4.5, 0),
    box(7.9, 0.24, 0.5, tint(roof, 0x000000, 0.2), 0.1).translate(0, 7.45, 0),
    box(1.5, 2.5, 0.2, C.white, 0.06).translate(0, 1.75, 3.2), box(1.2, 2.2, 0.26, trim, 0.06).translate(0, 1.65, 3.2), sph(0.09, C.yellow, 8, 6).translate(0.4, 1.6, 3.36), box(2, 0.25, 1, C.concrete, 0.06).translate(0, 0.42, 3.6),
    win(-2.2, 2.7, 3.2), win(2.2, 2.7, 3.2), win(-3.5, 2.7, 0, -PI / 2), win(3.5, 2.7, 0, PI / 2), win(0, 2.7, -3.2, PI),
    box(1.6, 0.3, 0.4, trim, 0.08).translate(-2.2, 1.8, 3.42), ...[-2.6, -2.2, -1.8].map((x, i) => sph(0.2, [C.pink, C.yellow, C.white][i], 8, 6).translate(x, 2.05, 3.44)),
    box(1, 2.3, 1, C.brick, 0.1).translate(2, 6.6, 0), box(1.25, 0.3, 1.25, C.concrete, 0.08).translate(2, 7.8, 0),
  ]).rotateY(-PI / 2);
  def('house', [house(C.cream, C.coral, C.teal)]);
  def('house2', [house(C.white, C.teal, C.coral)]);
  def('house3', [house(0xffe2a8, C.navy, C.red)]);
  def('barn', [merge([
    box(9.6, 0.5, 12.6, C.concreteD).translate(0, 0.25, 0), box(9, 5.2, 12, C.red, 0.25).translate(0, 3, 0),
    prism(10.4, 4, 13, C.white).translate(0, 5.5, 0), box(0.5, 0.3, 13.2, C.concrete, 0.1).translate(0, 9.5, 0),
    box(3.8, 4, 0.2, C.white, 0.06).translate(0, 2.5, 6.05), box(3.4, 3.6, 0.26, C.brickD, 0.06).translate(0, 2.4, 6.05),
    box(0.22, 4.9, 0.3, C.white).rotateZ(0.76).translate(0, 2.4, 6.1), box(0.22, 4.9, 0.3, C.white).rotateZ(-0.76).translate(0, 2.4, 6.1),
    box(1.6, 1.3, 0.24, C.white, 0.06).translate(0, 6.6, 6.2), box(1.3, 1, 0.3, C.ink, 0.06).translate(0, 6.6, 6.2),
    ...[-3, 0, 3].map((z) => box(0.2, 5.2, 0.5, C.white).translate(4.52, 3, z)), ...[-3, 0, 3].map((z) => box(0.2, 5.2, 0.5, C.white).translate(-4.52, 3, z)),
  ]).rotateY(-PI / 2)]);
  def('silo', [cyl(2.2, 2.2, 9, C.concrete, 22).translate(0, 4.5, 0), sph(2.2, C.steel, 22, 12).scale(1, 0.62, 1).translate(0, 9, 0), ...[2, 4.5, 7, 8.9].map((y) => cyl(2.26, 2.26, 0.22, C.red, 22).translate(0, y, 0)),
    box(0.5, 9, 0.1, C.steelD).translate(0, 4.5, 2.24), ...Array.from({ length: 9 }, (_, i) => box(0.6, 0.07, 0.14, C.steelD).translate(0, 0.8 + i, 2.3)), sph(0.3, C.red, 8, 6).translate(0, 10.4, 0)]);
  def('turbine', [merge([
    cyl(0.3, 0.75, 26, C.white, 16).translate(0, 13, 0), cyl(1, 1.1, 0.5, C.concrete, 16).translate(0, 0.25, 0), box(1.3, 1.3, 3.4, C.white, 0.55).translate(0, 26, 0.3), cone(0.7, 1.4, C.coral, 14).rotateX(PI / 2).translate(0, 26, 2.5),
    ...[0.3, 2.394, 4.488].map((a) => merge([box(0.9, 5, 0.22, C.white, 0.1).translate(0, 3, 0), box(0.55, 6.5, 0.16, C.white, 0.08).translate(0.1, 8.4, 0), box(0.94, 0.5, 0.26, C.coral, 0.08).translate(0.1, 11.4, 0)]).rotateZ(a).translate(0, 26, 2.1)),
  ]).rotateY(-PI / 2)], { lo: 0.8 });
  def('fence', [
    ...[-3.8, 0, 3.8].map((z) => merge([box(0.3, 1.35, 0.3, C.white, 0.06).translate(0, 0.68, z), cone(0.24, 0.3, C.white, 4).rotateY(PI / 4).translate(0, 1.48, z)])),
    box(0.12, 0.22, 8, C.white, 0.04).translate(0, 1.05, 0), box(0.12, 0.22, 8, C.white, 0.04).translate(0, 0.55, 0),
  ], { shadow: false, lo: 0.85, tint: 0 });
  def('bale', [cyl(1.2, 1.2, 1.7, C.hay, 20).rotateZ(PI / 2).translate(0, 1.2, 0), cyl(1.23, 1.23, 0.16, 0xd9a94e, 20).rotateZ(PI / 2).translate(0.4, 1.2, 0), cyl(1.23, 1.23, 0.16, 0xd9a94e, 20).rotateZ(PI / 2).translate(-0.4, 1.2, 0),
    cyl(0.75, 0.75, 1.74, 0xf8dc8c, 16).rotateZ(PI / 2).translate(0, 1.2, 0), cyl(0.3, 0.3, 1.78, 0xd9a94e, 12).rotateZ(PI / 2).translate(0, 1.2, 0)]);
  def('lamp', [cyl(0.24, 0.3, 0.5, C.dark, 10).translate(0, 0.25, 0), cyl(0.09, 0.13, 5.8, C.dark, 8).translate(0, 3.2, 0), cyl(0.07, 0.07, 1.6, C.dark, 6).rotateZ(PI / 2 - 0.25).translate(-0.75, 6.25, 0), box(0.9, 0.16, 0.42, C.dark, 0.06).translate(-1.6, 6.42, 0)],
    { glow: [box(0.7, 0.08, 0.3, 0xfff2c0).translate(-1.6, 6.32, 0)], shadow: false, tint: 0 });
  def('solar', [merge([box(4.6, 0.12, 2.8, C.white, 0.04), box(4.4, 0.16, 2.6, 0x23408a), ...[-1.1, 0, 1.1].map((x) => box(0.05, 0.18, 2.6, 0x9bbcf0).translate(x, 0, 0)), box(4.4, 0.18, 0.05, 0x9bbcf0)]).rotateX(-0.5).translate(0, 1.6, 0),
    cyl(0.09, 0.09, 1.9, C.steel, 6).translate(-1.6, 0.95, 0.3), cyl(0.09, 0.09, 1.9, C.steel, 6).translate(1.6, 0.95, 0.3), box(3.6, 0.1, 0.1, C.steel).translate(0, 1.5, 0.3)], { tint: 0 });
  def('sheep', [blob(0.78, C.white, 0.22, 23, 1).scale(1, 0.88, 1.3).translate(0, 1, 0), sph(0.32, C.dark, 10, 8).scale(0.85, 1, 1.15).translate(0, 1.2, 1.02), sph(0.1, C.dark, 6, 5).scale(1.6, 0.6, 1).translate(0.3, 1.35, 0.9), sph(0.1, C.dark, 6, 5).scale(1.6, 0.6, 1).translate(-0.3, 1.35, 0.9),
    blob(0.3, C.white, 0.2, 24, 1).translate(0, 1.5, 0.75), ...[[-0.35, -0.5], [0.35, -0.5], [-0.35, 0.5], [0.35, 0.5]].map(([x, z]) => cyl(0.08, 0.08, 0.6, C.dark, 6).translate(x, 0.3, z))], { shadow: false, tint: 0 });
  def('flowers', [cyl(1.9, 2.1, 0.16, tint(b.grassB, 0x000000, 0.12), 14).translate(0, 0.08, 0),
    ...[[0, 0], [0.9, 0.5], [-0.8, 0.7], [0.4, -0.9], [-0.7, -0.6], [1.2, -0.4], [-1.3, 0], [0.1, 1.2], [0.2, -0.3]].flatMap(([x, z], i) => [cyl(0.03, 0.03, 0.5, b.leafB, 4).translate(x, 0.35, z), sph(0.24, [b.accent, C.white, C.pink, C.coral][i % 4], 8, 6).scale(1, 0.7, 1).translate(x, 0.62, z), sph(0.1, C.yellow, 6, 4).translate(x, 0.74, z)])], { shadow: false, lo: 0.9, tint: 0 });
  const mast = (x) => [box(0.34, 8.4, 0.34, C.steel, 0.06).translate(x, 4.2, 0), box(0.9, 0.4, 0.9, C.concreteD, 0.08).translate(x, 0.2, 0), box(0.12, 1.2, 0.12, C.steelD).rotateZ(x > 0 ? 0.8 : -0.8).translate(x * 0.93, 7.5, 0)];
  def('gantry', [...mast(-5.5), ...mast(5.5),
    box(11.4, 0.2, 0.26, C.steel, 0.05).translate(0, 8.3, 0), box(11.4, 0.2, 0.26, C.steel, 0.05).translate(0, 7.5, 0),
    ...Array.from({ length: 8 }, (_, i) => box(0.1, 1.15, 0.12, C.steelD).rotateZ(i % 2 ? 0.86 : -0.86).translate(-4.9 + i * 1.4, 7.9, 0)),
    cyl(0.1, 0.1, 0.7, C.white, 8).translate(0, 7, 0), cyl(0.17, 0.17, 0.12, C.teal, 8).translate(0, 6.9, 0), cyl(0.17, 0.17, 0.12, C.teal, 8).translate(0, 7.15, 0), box(1.4, 0.06, 0.06, C.steelD).translate(0, 6.6, 0),
    box(0.9, 0.5, 0.3, C.navy, 0.08).translate(-5.5, 5, -0.3)], { glow: [sph(0.12, 0x60ff90, 8, 6).translate(-5.7, 5, -0.48), sph(0.12, 0xffc040, 8, 6).translate(-5.3, 5, -0.48)], lo: 0.85, tint: 0 });
  def('signal', [cyl(0.2, 0.26, 0.4, C.dark, 10).translate(0, 0.2, 0), cyl(0.1, 0.12, 4.4, C.dark, 8).translate(0, 2.4, 0), box(0.8, 1.9, 0.55, C.dark, 0.2).translate(0, 4.9, 0), box(1, 0.1, 0.8, C.dark, 0.04).translate(0, 5.9, 0)],
    { glow: [sph(0.2, 0x60ff90, 8, 6).translate(0, 4.4, 0.28), sph(0.2, 0xff5458, 8, 6).translate(0, 5.3, 0.28), sph(0.2, 0x60ff90, 8, 6).translate(0, 4.4, -0.28), sph(0.2, 0xff5458, 8, 6).translate(0, 5.3, -0.28)], tint: 0 });
  def('greenhouse', [box(6.2, 0.4, 12.2, C.white, 0.08).translate(0, 0.2, 0), box(5.9, 2.6, 11.9, 0xa6e6ff, 0.1).translate(0, 1.7, 0), prism(6.2, 1.6, 12, 0xbff0ff).translate(0, 3, 0),
    ...[-6, -3, 0, 3, 6].map((z) => box(6.1, 2.7, 0.14, C.white).translate(0, 1.7, z)), box(0.14, 0.14, 12.2, C.white).translate(0, 4.62, 0), box(6.2, 0.14, 12.2, C.white, 0.04).translate(0, 3.02, 0),
    box(1.2, 2.1, 0.2, C.white, 0.05).translate(0, 1.4, 6)], { tint: 0 });
  def('tank', [cyl(2.6, 2.6, 4, C.teal, 22).translate(0, 7.5, 0), cyl(2.68, 2.68, 0.3, C.white, 22).translate(0, 6.2, 0), cyl(2.68, 2.68, 0.3, C.white, 22).translate(0, 8.8, 0), cone(2.95, 1.6, C.white, 22).translate(0, 10.3, 0), sph(0.25, C.coral, 8, 6).translate(0, 11.2, 0),
    cyl(2.3, 2.3, 0.2, C.steelD, 16).translate(0, 5.5, 0), ...[[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]].map(([x, z]) => cyl(0.14, 0.18, 5.6, C.steelD, 8).translate(x, 2.8, z)),
    box(0.08, 4.9, 0.08, C.steelD).rotateZ(0.6).translate(0, 2.8, 1.7), box(0.08, 4.9, 0.08, C.steelD).rotateZ(-0.6).translate(0, 2.8, -1.7)], { tint: 0 });
  def('pole', [cyl(0.15, 0.2, 9, bark, 8).translate(0, 4.5, 0), box(2.8, 0.2, 0.2, bark, 0.04).translate(0, 8.4, 0), box(2, 0.16, 0.16, bark, 0.04).translate(0, 7.6, 0),
    ...[-1.2, 1.2, -0.85, 0.85].map((x, i) => cyl(0.08, 0.1, 0.3, C.teal, 6).translate(x, i < 2 ? 8.65 : 7.82, 0))], { shadow: false, tint: 0 });
  def('cloud', [blob(9, 0xffffff, 0.12, 30).scale(1.5, 0.55, 1), blob(7, 0xffffff, 0.12, 31).scale(1.3, 0.62, 1).translate(10, 1.5, 2), blob(6, 0xffffff, 0.12, 32).scale(1.3, 0.55, 1).translate(-10, 0.5, -1), blob(5.5, 0xffffff, 0.12, 33).translate(2, 3.6, 0), blob(4, 0xffffff, 0.12, 34).translate(-4, 2.6, 1)],
    { shadow: false, mat: 'cloud', lo: 0.82, hi: 1, tint: 0 });
  cache.set(b.name, P);
  return P;
}

// Each module fills a 48 m slot on one side of the line. Entries: [proto, lateral, dz, rotY, scale].
// Laterals are measured from the track centre; everything sits in neat rows.
const row = (name, lx, from, to, step, rot = 0, sc = 1) => { const a = []; for (let z = from; z <= to; z += step) a.push([name, lx, z, rot, sc]); return a; };
export const MODULES = [
  () => [...row('tree', 17, 4, 44, 10), ...row('tree2', 28, 9, 44, 10), ...row('bush', 12, 4, 44, 8)],
  () => [...row('tree', 18, 6, 42, 12), ...row('tree3', 30, 6, 42, 12), ...row('tree', 42, 6, 42, 12), ...row('fence', 12.5, 4, 44, 8)],
  () => [['house', 30, 14, 0, 1], ['barn', 52, 34, 0, 1], ['silo', 40, 42, 0, 1], ...row('fence', 14, 4, 44, 8), ['bale', 20, 30, 0.3, 1], ['bale', 23, 34, 1.2, 1], ['tree', 20, 8, 0, 1.1]],
  () => [...row('bale', 20, 6, 42, 12, 0.4), ...row('bale', 30, 12, 42, 12, 1.1), ...row('bale', 40, 6, 42, 12, 0.2), ...row('fence', 13, 4, 44, 8)],
  () => [['turbine', 44, 12, 0, 1], ['turbine', 62, 36, 0, 1.15], ...row('bush', 13, 6, 42, 9), ...row('flowers', 20, 6, 42, 9)],
  () => [['house', 26, 8, 0, 1], ['house2', 26, 24, 0, 1], ['house3', 26, 40, 0, 1], ...row('lamp', 13, 8, 40, 16, 0), ...row('bush', 17, 16, 32, 16), ...row('tree2', 40, 8, 40, 16)],
  () => [...row('solar', 18, 6, 42, 7.2, PI / 2), ...row('solar', 25, 6, 42, 7.2, PI / 2), ...row('solar', 32, 6, 42, 7.2, PI / 2), ['tank', 44, 24, 0, 1]],
  () => [...row('fence', 13, 4, 44, 8), ...row('sheep', 19, 8, 40, 8, 0.6), ...row('sheep', 26, 12, 40, 8, 2.2), ...row('sheep', 33, 8, 40, 8, 4), ['tree3', 44, 24, 0, 1.3]],
  () => [...row('flowers', 14, 4, 44, 5), ...row('flowers', 19, 6.5, 44, 5), ...row('flowers', 24, 4, 44, 5), ...row('tree3', 34, 6, 42, 12)],
  () => [['greenhouse', 22, 14, 0, 1], ['greenhouse', 22, 34, 0, 1], ['greenhouse', 34, 14, 0, 1], ['greenhouse', 34, 34, 0, 1], ...row('pole', 12.5, 0, 47, 24)],
  () => [...row('pine', 16, 4, 44, 8), ...row('pine', 24, 8, 44, 8), ...row('pine', 32, 4, 44, 8), ...row('rock', 12, 10, 40, 15)],
  () => [['signal', 7.5, 6, 0, 1], ...row('pole', 12.5, 0, 47, 24), ...row('tree', 22, 6, 42, 9), ...row('bush', 16, 6, 42, 6)],
  () => [...row('tree3', 16, 6, 42, 9), ...row('flowers', 11.5, 4, 44, 8), ...row('tree2', 27, 10, 42, 9), ['house2', 42, 24, 0, 1]],
];
export const ALPINE = () => [...row('pine', 15, 4, 44, 8), ...row('pine', 23, 8, 44, 8), ...row('pine', 34, 4, 44, 10), ...row('pine', 48, 6, 44, 12), ...row('rock', 11.5, 8, 44, 12)];
export const VALLEY = () => [...row('pine', 10, 4, 44, 10), ...row('pine', 22, 9, 44, 10), ...row('pine', 36, 4, 44, 10), ...row('pine', 52, 8, 44, 12), ...row('pine', 70, 4, 44, 12), ...row('rock', 60, 10, 40, 16)];
