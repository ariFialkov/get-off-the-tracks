// Scenery prototypes (instanced along the track) and the tidy "side modules" that arrange them.
import { C, box, cyl, cone, sph, merge } from './kit.js';

export const BIOMES = [
  { name: 'meadow', grassA: 0x8fe07a, grassB: 0x6fd070, leafA: 0x47c46a, leafB: 0x2fae62, pine: 0x2f9470, rock: 0xa9b1ba, accent: 0xffd34d },
  { name: 'sakura', grassA: 0xa4e48c, grassB: 0x83d87e, leafA: 0xffb3d1, leafB: 0xff8fbd, pine: 0x3aa27c, rock: 0xb3b7c2, accent: 0xffa3c7 },
  { name: 'autumn', grassA: 0xd6dc7a, grassB: 0xbfd06a, leafA: 0xffa33c, leafB: 0xf56f3c, pine: 0x4f9460, rock: 0xb0a9a0, accent: 0xff9d3c },
  { name: 'frost', grassA: 0xeef6fb, grassB: 0xdcecf6, leafA: 0xc8ecf2, leafB: 0x9fd9e6, pine: 0x3d8f86, rock: 0x9fb0c2, accent: 0x8fdcff },
];

const cache = new Map();
export function getProtos(b) {
  if (cache.has(b.name)) return cache.get(b.name);
  const P = {};
  const def = (name, parts, o = {}) => { P[name] = { geo: merge(parts), glow: o.glow ? merge(o.glow) : null, shadow: o.shadow !== false, mat: o.mat }; };

  def('tree', [
    cyl(0.4, 0.55, 3.2, C.woodD, 7).translate(0, 1.6, 0),
    sph(2.7, b.leafA, 12, 9).scale(1, 1.05, 1).translate(0, 5.3, 0),
    sph(1.8, b.leafB, 10, 7).translate(1.5, 4.2, 0.7), sph(1.6, b.leafB, 10, 7).translate(-1.4, 4.5, -0.6),
    sph(1.4, b.leafA, 10, 7).translate(0.2, 7.2, 0.3),
  ]);
  def('tree2', [
    cyl(0.35, 0.5, 4, C.woodD, 7).translate(0, 2, 0),
    sph(2.1, b.leafB, 12, 9).scale(1, 1.7, 1).translate(0, 6.6, 0),
    sph(1.4, b.leafA, 10, 7).translate(0.9, 4.6, 0.5),
  ]);
  def('pine', [
    cyl(0.35, 0.5, 2.4, C.woodD, 6).translate(0, 1.2, 0),
    cone(2.8, 4, b.pine, 9).translate(0, 4, 0), cone(2.2, 3.6, b.pine, 9).translate(0, 6.2, 0), cone(1.5, 3.2, b.pine, 9).translate(0, 8.3, 0),
  ]);
  def('bush', [sph(1.3, b.leafB, 9, 6).scale(1.2, 0.8, 1).translate(0, 0.8, 0), sph(1, b.leafA, 9, 6).translate(1.1, 0.7, 0.3)]);
  def('rock', [sph(1.6, b.rock, 7, 5).scale(1.2, 0.8, 1).translate(0, 0.7, 0), sph(1, C.rockD, 6, 4).scale(1, 0.8, 1.2).translate(1.5, 0.4, 0.5)]);
  const house = (wall, roof) => [
    box(7, 4.4, 6.4, wall, 0.35).translate(0, 2.2, 0),
    cone(5.9, 3.2, roof, 4).rotateY(Math.PI / 4).scale(1, 1, 0.92).translate(0, 5.9, 0),
    box(1.3, 2.3, 0.3, C.woodD, 0.1).translate(0, 1.15, 3.2),
    box(1.3, 1.2, 0.3, C.navy, 0.1).translate(-2.1, 2.5, 3.2), box(1.3, 1.2, 0.3, C.navy, 0.1).translate(2.1, 2.5, 3.2),
    box(0.9, 2, 0.9, C.brick, 0.1).translate(2, 6.4, -1),
  ];
  def('house', house(C.cream, C.coral));
  def('house2', house(C.white, C.teal));
  def('house3', house(0xffe2a8, C.navy));
  def('barn', [
    box(9, 5.5, 12, C.red, 0.3).translate(0, 2.75, 0), cone(7.8, 3.6, C.white, 4).rotateY(Math.PI / 4).scale(0.85, 1, 1.12).translate(0, 7.2, 0),
    box(3.4, 3.8, 0.3, C.white, 0.1).translate(0, 1.9, 6.05), box(2.8, 3.2, 0.34, C.brickD, 0.1).translate(0, 1.7, 6.08),
  ]);
  def('silo', [cyl(2.2, 2.2, 9, C.concrete, 14).translate(0, 4.5, 0), sph(2.2, C.steel, 14, 8).scale(1, 0.6, 1).translate(0, 9, 0), box(4.5, 0.3, 0.3, C.red).translate(0, 7, 2.2)]);
  def('turbine', [
    cyl(0.35, 0.7, 26, C.white, 10).translate(0, 13, 0), box(1.2, 1.2, 3, C.white, 0.4).translate(0, 26, 0.4), sph(0.7, C.coral, 8, 6).translate(0, 26, 2),
    ...[0, 2.094, 4.188].map((a) => box(0.7, 11, 0.2, C.white, 0.1).translate(0, 5.5, 0).rotateZ(a + 0.3).translate(0, 26, 2)),
  ]);
  def('fence', [
    box(0.25, 1.3, 0.25, C.white).translate(0, 0.65, -3.8), box(0.25, 1.3, 0.25, C.white).translate(0, 0.65, 0), box(0.25, 1.3, 0.25, C.white).translate(0, 0.65, 3.8),
    box(0.12, 0.2, 8, C.white).translate(0, 1.05, 0), box(0.12, 0.2, 8, C.white).translate(0, 0.55, 0),
  ], { shadow: false });
  def('bale', [cyl(1.2, 1.2, 1.7, C.hay, 12).rotateZ(Math.PI / 2).translate(0, 1.2, 0), cyl(1.22, 1.22, 0.2, C.wood, 12).rotateZ(Math.PI / 2).translate(0, 1.2, 0)]);
  def('lamp', [cyl(0.12, 0.16, 6, C.dark, 6).translate(0, 3, 0), box(1.6, 0.14, 0.2, C.dark).translate(-0.7, 6, 0)], { glow: [sph(0.32, 0xfff2c0, 8, 6).translate(-1.4, 5.85, 0)], shadow: false });
  def('solar', [box(4.4, 0.15, 2.6, C.navy).rotateX(-0.5).translate(0, 1.6, 0), box(4.6, 0.1, 2.8, C.white).rotateX(-0.5).translate(0, 1.54, 0), cyl(0.1, 0.1, 1.6, C.steel, 5).translate(-1.6, 0.8, 0), cyl(0.1, 0.1, 1.6, C.steel, 5).translate(1.6, 0.8, 0)]);
  def('sheep', [sph(0.75, C.white, 8, 6).scale(1, 0.85, 1.3).translate(0, 0.95, 0), sph(0.33, C.dark, 7, 5).translate(0, 1.15, 1), ...[[-0.35, -0.5], [0.35, -0.5], [-0.35, 0.5], [0.35, 0.5]].map(([x, z]) => cyl(0.09, 0.09, 0.6, C.dark, 5).translate(x, 0.3, z))], { shadow: false });
  def('flowers', [cyl(1.9, 2.1, 0.18, b.grassB, 10).translate(0, 0.09, 0), ...[[0, 0], [0.9, 0.5], [-0.8, 0.7], [0.4, -0.9], [-0.7, -0.6], [1.2, -0.4]].map(([x, z], i) => sph(0.36, [b.accent, C.white, C.pink][i % 3], 6, 5).translate(x, 0.45, z))], { shadow: false });
  def('gantry', [
    cyl(0.2, 0.26, 8.2, C.steel, 7).translate(-5.4, 4.1, 0), cyl(0.2, 0.26, 8.2, C.steel, 7).translate(5.4, 4.1, 0),
    box(11.4, 0.34, 0.34, C.steel, 0.1).translate(0, 8, 0), box(11.4, 0.14, 0.14, C.steelD).translate(0, 7.3, 0),
    box(0.16, 0.9, 0.16, C.white).translate(0, 7.1, 0), box(0.5, 0.5, 0.5, C.concreteD).translate(-5.4, 0.25, 0), box(0.5, 0.5, 0.5, C.concreteD).translate(5.4, 0.25, 0),
  ]);
  def('signal', [cyl(0.12, 0.14, 4.4, C.dark, 6).translate(0, 2.2, 0), box(0.7, 1.7, 0.5, C.dark, 0.15).translate(0, 4.6, 0)], { glow: [sph(0.2, 0x60ff90, 7, 5).translate(0, 4.2, 0.26), sph(0.2, 0xff5458, 7, 5).translate(0, 5, 0.26)] });
  def('greenhouse', [box(6, 3, 12, C.glass, 0.5).translate(0, 1.5, 0), box(6.1, 0.2, 12.1, C.white).translate(0, 3, 0), box(6.1, 0.4, 12.1, C.white).translate(0, 0.2, 0), ...[-4, 0, 4].map((z) => box(6.15, 3, 0.18, C.white).translate(0, 1.5, z))]);
  def('tank', [cyl(2.6, 2.6, 4, C.teal, 14).translate(0, 7.5, 0), cone(2.9, 1.5, C.white, 14).translate(0, 10.2, 0), ...[[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]].map(([x, z]) => cyl(0.15, 0.15, 5.6, C.steelD, 5).translate(x, 2.8, z))]);
  def('pole', [cyl(0.16, 0.2, 9, C.woodD, 6).translate(0, 4.5, 0), box(2.6, 0.18, 0.18, C.woodD).translate(0, 8.4, 0)], { shadow: false });
  def('cloud', [sph(9, 0xffffff, 10, 7).scale(1.4, 0.55, 1), sph(7, 0xffffff, 10, 7).scale(1.2, 0.6, 1).translate(9, 1.5, 2), sph(6, 0xffffff, 10, 7).scale(1.2, 0.55, 1).translate(-9, 0.5, -1), sph(5, 0xffffff, 9, 6).translate(2, 3.5, 0)], { shadow: false, mat: 'cloud' });
  cache.set(b.name, P);
  return P;
}

// Each module fills a 48 m slot on one side of the line. Entries: [proto, lateral, dz, rotY, scale].
// Laterals are measured from the track centre; everything sits in neat rows.
const row = (name, lx, from, to, step, rot = 0, sc = 1) => { const a = []; for (let z = from; z <= to; z += step) a.push([name, lx, z, rot, sc]); return a; };
export const MODULES = [
  (r) => [...row('tree', 17, 4, 44, 10), ...row('tree2', 28, 9, 44, 10), ...row('bush', 12, 4, 44, 8)],
  (r) => [...row('tree', 18, 6, 42, 12), ...row('tree', 30, 6, 42, 12), ...row('tree', 42, 6, 42, 12), ...row('fence', 12.5, 4, 44, 8)],
  (r) => [['house', 30, 14, -Math.PI / 2, 1], ['barn', 50, 34, -Math.PI / 2, 1], ['silo', 40, 40, 0, 1], ...row('fence', 14, 4, 44, 8), ['bale', 20, 30, 0.3, 1], ['bale', 23, 34, 1.2, 1], ['tree', 20, 8, 0, 1.1]],
  (r) => [...row('bale', 20, 6, 42, 12, 0.4), ...row('bale', 30, 12, 42, 12, 1.1), ...row('bale', 40, 6, 42, 12, 0.2), ...row('fence', 13, 4, 44, 8)],
  (r) => [['turbine', 44, 12, -Math.PI / 2, 1], ['turbine', 62, 36, -Math.PI / 2, 1.15], ...row('bush', 13, 6, 42, 9), ...row('flowers', 20, 6, 42, 9)],
  (r) => [['house', 26, 8, -Math.PI / 2, 1], ['house2', 26, 24, -Math.PI / 2, 1], ['house3', 26, 40, -Math.PI / 2, 1], ...row('lamp', 13, 8, 40, 16, 0), ...row('bush', 17, 16, 32, 16), ...row('tree2', 40, 8, 40, 16)],
  (r) => [...row('solar', 18, 6, 42, 7.2, Math.PI / 2), ...row('solar', 25, 6, 42, 7.2, Math.PI / 2), ...row('solar', 32, 6, 42, 7.2, Math.PI / 2), ['tank', 44, 24, 0, 1]],
  (r) => [...row('fence', 13, 4, 44, 8), ...row('sheep', 19, 8, 40, 8, 0.6), ...row('sheep', 26, 12, 40, 8, 2.2), ...row('sheep', 33, 8, 40, 8, 4), ['tree', 44, 24, 0, 1.3]],
  (r) => [...row('flowers', 14, 4, 44, 5), ...row('flowers', 19, 6.5, 44, 5), ...row('flowers', 24, 4, 44, 5), ...row('tree2', 34, 6, 42, 12)],
  (r) => [['greenhouse', 22, 14, 0, 1], ['greenhouse', 22, 34, 0, 1], ['greenhouse', 34, 14, 0, 1], ['greenhouse', 34, 34, 0, 1], ...row('pole', 12.5, 0, 47, 24)],
  (r) => [...row('pine', 16, 4, 44, 8), ...row('pine', 24, 8, 44, 8), ...row('pine', 32, 4, 44, 8), ...row('rock', 12, 10, 40, 15)],
  (r) => [['signal', 7.5, 6, Math.PI, 1], ...row('pole', 12.5, 0, 47, 24), ...row('tree', 22, 6, 42, 9), ...row('bush', 16, 6, 42, 6)],
];
export const ALPINE = (r) => [...row('pine', 15, 4, 44, 8), ...row('pine', 23, 8, 44, 8), ...row('pine', 34, 4, 44, 10), ...row('pine', 48, 6, 44, 12), ...row('rock', 11.5, 8, 44, 12)];
export const VALLEY = (r) => [...row('pine', 10, 4, 44, 10), ...row('pine', 22, 9, 44, 10), ...row('pine', 36, 4, 44, 10), ...row('pine', 52, 8, 44, 12), ...row('pine', 70, 4, 44, 12), ...row('rock', 60, 10, 40, 16)];
