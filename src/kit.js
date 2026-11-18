// Tiny procedural modelling kit: every asset in the game is built from painted primitives
// merged into a single vertex-coloured geometry, so the whole world shares a few materials.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const C = {
  white: 0xf6f8fb, cream: 0xfff1d6, dark: 0x27313f, ink: 0x161b24,
  steel: 0x9aa7b8, steelD: 0x5d6978, concrete: 0xd3d9df, concreteD: 0xa9b2bc,
  red: 0xff5458, coral: 0xff7663, orange: 0xff9d3c, yellow: 0xffd34d,
  teal: 0x1fc8b9, blue: 0x3b9dff, navy: 0x2a4a8e, sky: 0xa5deff, purple: 0x9478ff, pink: 0xffa3c7,
  green: 0x63d06b, greenD: 0x3caa58, pine: 0x2f9470,
  wood: 0xc08a56, woodD: 0x8e6040, brick: 0xdc6d52, brickD: 0xc2573f,
  rock: 0xa2abb5, rockD: 0x7b8591, sand: 0xf3dfb2, ballast: 0xbdb5a8, asphalt: 0x4a5260,
  glass: 0x8fdcff, water: 0x45bfee, hay: 0xf0c96a,
};

const _c = new THREE.Color();
export function paint(g, color) {
  if (g.index) g = g.toNonIndexed();
  if (g.attributes.uv) g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
export const box = (w, h, d, c, r = 0) =>
  paint(r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.99) : new THREE.BoxGeometry(w, h, d), c);
export const cyl = (rt, rb, h, c, seg = 10) => paint(new THREE.CylinderGeometry(rt, rb, h, seg), c);
export const cone = (r, h, c, seg = 10) => paint(new THREE.ConeGeometry(r, h, seg), c);
export const sph = (r, c, ws = 12, hs = 8) => paint(new THREE.SphereGeometry(r, ws, hs), c);
export const merge = (list) => mergeGeometries(list.filter(Boolean), false);

export const MAT = {
  solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
  double: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  gloss: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x555555 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }),
  rail: new THREE.MeshLambertMaterial({ color: 0x8894a6 }),
  sleeper: new THREE.MeshLambertMaterial({ color: 0x7a6656 }),
  tube: new THREE.MeshBasicMaterial({ color: 0x10141b, side: THREE.DoubleSide }),
  cloud: new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 }),
  water: new THREE.MeshPhongMaterial({ color: 0x3fb8ec, shininess: 120, specular: 0xaaddff, transparent: true, opacity: 0.9 }),
};
MAT.glow.color.setScalar(2.4);

// Sweep a 2-D profile ([lateral, up] points) along the track between z0 and z1.
// `center(z)` returns {x,y}; the profile is laid out perpendicular to the path.
export function sweep(center, z0, z1, step, profile, closed = false) {
  const n = Math.max(1, Math.round((z1 - z0) / step));
  const m = profile.length;
  const pos = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    const c = center(z), a = center(z - 0.5), b = center(z + 0.5);
    const dx = b.x - a.x, len = Math.hypot(dx, 1);
    const lx = 1 / len, lz = -dx / len; // lateral unit vector (horizontal)
    for (const [l, u] of profile) pos.push(c.x + lx * l, c.y + u, z + lz * l);
  }
  const idx = [];
  const mm = closed ? m : m - 1;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < mm; j++) {
      const a = i * m + j, b = i * m + ((j + 1) % m), c = a + m, d = b + m;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function archProfile(rx, ry, seg = 14) {
  const p = [];
  for (let i = 0; i <= seg; i++) { const a = Math.PI * (i / seg); p.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
  return p;
}

// Arch-shaped wall with an arch hole (tunnel portal faces). Origin at ground centre, facing +Z.
export function archWall(w, h, rx, ry, depth, color) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h); s.lineTo(w / 2, h); s.lineTo(w / 2, 0);
  s.lineTo(rx, 0);
  for (let i = 1; i <= 16; i++) { const a = Math.PI * (i / 16); s.lineTo(Math.cos(a) * rx, Math.sin(a) * ry); }
  s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return paint(g, color);
}

let _glowTex;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,250,225,0.85)');
  g.addColorStop(0.45, 'rgba(255,235,170,0.25)'); g.addColorStop(1, 'rgba(255,220,140,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}
