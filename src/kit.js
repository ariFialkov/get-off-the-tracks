// Tiny procedural modelling kit: every asset in the game is built from painted primitives
// merged into a single vertex-coloured geometry, so the whole world shares a few materials.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
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
// Geometry detail multiplier (set once at boot from the quality tier).
export let DETAIL = 1;
export const setDetail = (k) => { DETAIL = k; };
const sg = (n) => (n < 6 ? n : Math.max(6, Math.round(n * DETAIL)));
export const box = (w, h, d, c, r = 0) =>
  paint(r > 0 ? new RoundedBoxGeometry(w, h, d, DETAIL > 1 ? 4 : 3, Math.min(r, w / 2, h / 2, d / 2) * 0.99) : new THREE.BoxGeometry(w, h, d), c);
export const cyl = (rt, rb, h, c, seg = 14) => paint(new THREE.CylinderGeometry(rt, rb, h, sg(seg)), c);
export const cone = (r, h, c, seg = 14) => paint(new THREE.ConeGeometry(r, h, sg(seg)), c);
export const sph = (r, c, ws = 16, hs = 12) => paint(new THREE.SphereGeometry(r, sg(ws), sg(hs)), c);
// Organic lump: a subdivided icosphere pushed around by smooth noise (foliage, rocks, clouds, wool).
export function blob(r, c, rough = 0.14, seed = 1, detail = 2) {
  let g = new THREE.IcosahedronGeometry(1, DETAIL > 1 ? detail : Math.max(1, detail - 1));
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position, f = 2.3;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * f + seed) * Math.sin(y * f * 1.2 + seed * 2.1) * Math.sin(z * f * 0.9 + seed * 3.3) + 0.5 * Math.sin(x * f * 2.1 + seed * 5) * Math.sin(z * f * 2.3 + y * 2 + seed);
    const k = r * (1 + rough * n);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return paint(g, c);
}
// Gabled-roof prism (ridge along z), softly bevelled. Base centred at y = 0.
export function prism(w, h, d, c) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(0, h); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2 });
  g.translate(0, 0, -d / 2);
  return paint(g, c);
}
// Bake a soft ground-to-top gradient into vertex colours (cheap ambient occlusion).
export function shade(g, lo = 0.74, hi = 1.07) {
  g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, h = Math.max(0.001, g.boundingBox.max.y - y0), p = g.attributes.position, c = g.attributes.color;
  for (let i = 0; i < p.count; i++) { const t = Math.min(1, (p.getY(i) - y0) / h), k = lo + (hi - lo) * Math.sqrt(t); c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); }
  return g;
}
export const tint = (hex, toward, t) => new THREE.Color(hex).lerp(new THREE.Color(toward), t).getHex();
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
  water: null,
};
MAT.glow.color.setScalar(2.4);
// Animated stylised water: rolling two-tone swell, glints and foam flecks, fog-aware.
MAT.water = new THREE.ShaderMaterial({
  transparent: true, fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 }, deep: { value: new THREE.Color(0x1f8fdc) }, shallow: { value: new THREE.Color(0x5fd6f5) } }]),
  vertexShader: `varying vec3 vW;
    #include <fog_pars_vertex>
    void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `uniform float t; uniform vec3 deep, shallow; varying vec3 vW;
    #include <fog_pars_fragment>
    void main(){
      vec2 p = vW.xz * 0.05;
      float w = sin(p.x * 1.3 + t * 0.7 + sin(p.y * 0.9 + t * 0.4) * 1.6) * sin(p.y * 1.7 - t * 0.5 + sin(p.x * 1.1 - t * 0.3) * 1.4);
      float w2 = sin(p.x * 4.1 - t * 1.1 + w * 2.0) * sin(p.y * 3.7 + t * 0.9);
      vec3 col = mix(deep, shallow, 0.5 + 0.38 * w + 0.12 * w2);
      float glint = smoothstep(0.9, 1.0, sin(p.x * 9.0 + t * 1.6 + w * 4.0) * sin(p.y * 11.0 - t * 1.3 + w2));
      float foam = smoothstep(0.8, 0.98, w * w2 + 0.25 * w);
      float near = smoothstep(520.0, 60.0, distance(cameraPosition, vW));
      col += vec3(1.0) * (glint * 0.75 + foam * 0.28) * (0.25 + 0.75 * near);
      gl_FragColor = vec4(col, 0.93);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
});

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
