// Streaming terrain: a curvilinear heightfield strip that follows the track, plus rails,
// sleepers, roads and neatly arranged scenery — generated in 96 m chunks around the train.
import * as THREE from 'three';
import { C, MAT, box } from './kit.js';
import { win, smooth, clamp, RAIL_H } from './track.js';
import { getProtos, MODULES, ALPINE, VALLEY } from './props.js';

const HALF = [0, 3, 6, 9, 12, 16, 21, 27, 34, 42, 52, 64, 78, 95, 115, 140, 170, 205, 250, 330];
const LX = [...HALF.slice(1).reverse().map((v) => -v), ...HALF];
export const CL = 96;
const NZ = 24;
export const DZ = CL / NZ;

function hash(i, j, s) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y);
  let u = x - i, v = y - j; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const sleeperGeo = new THREE.BoxGeometry(3.3, 0.2, 0.62);
// soft mottled detail map multiplied over the vertex colours (grass / gravel grain)
let _tex;
function groundTexture() {
  if (_tex) return _tex;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), im = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N * 6.283, v = j / N * 6.283;
    let n = Math.sin(u * 3 + Math.sin(v * 2) * 1.5) * Math.sin(v * 4 + Math.sin(u * 3) * 1.2) * 0.5 + Math.sin(u * 9 + v * 7) * Math.sin(v * 11 - u * 5) * 0.3 + (hash(i >> 1, j >> 1, 7) - 0.5) * 0.25;
    const g = Math.max(0, Math.min(255, 236 + n * 22));
    im.data.set([g, g, g, 255], (j * N + i) * 4);
  }
  x.putImageData(im, 0, 0);
  _tex = new THREE.CanvasTexture(c); _tex.wrapS = _tex.wrapT = THREE.RepeatWrapping; _tex.colorSpace = THREE.SRGBColorSpace; _tex.anisotropy = 4;
  return _tex;
}
const _d = new THREE.Object3D(), _col = new THREE.Color(), _c2 = new THREE.Color();

export class Terrain {
  constructor(track, biome, seed, parent) {
    this.track = track; this.biome = biome; this.seed = seed | 0;
    this.protos = getProtos(biome);
    this.group = new THREE.Group(); parent.add(this.group);
    this.chunks = new Map();
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: groundTexture() });
    this.roadMat = new THREE.MeshLambertMaterial({ color: C.asphalt });
    this.mainLine = { z0: -1e9, z1: 1e9, off: (z) => track.weave(z), main: true };
  }
  h(x, z) {
    const t = this.track, s = this.seed;
    const lx = x - t.X0(z), a = Math.abs(lx);
    let flat = 0, add = 0, dropW = 0;
    for (const zn of t.zones) {
      if (z <= zn.z0 || z >= zn.z1) continue;
      const w = win(z, zn.z0, zn.z1, zn.edge);
      switch (zn.type) {
        case 'flat': flat = Math.max(flat, w * (1 - smooth(zn.width, zn.width * 2.2, a))); break;
        case 'drop': if (zn.base == null) zn.base = t.Y((zn.z0 + zn.z1) / 2); add -= (zn.amt + t.Y(z) - zn.base) * w; dropW = Math.max(dropW, w); break; // level floor
        case 'cover': add += zn.amt * w * (0.7 + 0.45 * noise(x * 0.007, z * 0.007, s + 5)); break;
        case 'rise': add += zn.amt * w * smooth(zn.start, zn.start + zn.width, zn.side * lx) * (0.8 + 0.3 * noise(x * 0.01, z * 0.01, s + 6)); break;
        case 'sink': add -= zn.amt * w * smooth(zn.start, zn.start + zn.width, zn.side * lx); break;
      }
    }
    const hills = (noise(x * 0.011, z * 0.011, s) * 13 + noise(x * 0.035, z * 0.035, s + 1) * 3) * smooth(8, 60, a);
    const far = smooth(120, 300, a) * (30 + 75 * noise(x * 0.004, z * 0.004, s + 2));
    return t.Y(z) + (hills * (1 - 0.9 * dropW) + far * (1 - 0.92 * dropW * (1 - smooth(200, 310, a)))) * (1 - flat) + add;
  }
  zoneInfo(z, side) {
    const o = { drop: 0, water: false, alpine: false, none: false, clear: 0, busy: false };
    for (const zn of this.track.zones) {
      if (z <= zn.z0 || z >= zn.z1) continue;
      o.busy = true;
      if (zn.type === 'drop') { o.drop = Math.max(o.drop, zn.amt); if (zn.water) o.water = true; }
      if (zn.type === 'cover') o.alpine = true;
      if (zn.type === 'rise' && zn.side === side) o.alpine = true;
      if (zn.type === 'sink' && zn.side === side) o.none = true;
      if (zn.clear) o.clear = Math.max(o.clear, zn.clear);
    }
    return o;
  }
  update(zMin, zMax) {
    const i0 = Math.floor((zMin - 260) / CL), i1 = Math.floor((zMax + 960) / CL);
    for (const [i, ch] of this.chunks) if (i < i0 || i > i1) { this.disposeChunk(ch); this.chunks.delete(i); }
    let built = 0;
    for (let i = i0; i <= i1; i++) if (!this.chunks.has(i)) { this.chunks.set(i, this.build(i)); if (++built >= 2 && this.warm) break; }
    this.warm = true;
  }
  disposeChunk(g) {
    g.traverse((o) => { if (o.userData.own) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
    g.removeFromParent();
  }
  dispose() { for (const ch of this.chunks.values()) this.disposeChunk(ch); this.chunks.clear(); this.group.removeFromParent(); this.mat.dispose(); }

  build(ci) {
    const t = this.track, b = this.biome, g = new THREE.Group(), z0 = ci * CL;
    const NC = LX.length, rows = NZ + 3;
    // heights on an extended grid (one extra row each end for seamless normals)
    const H = new Float32Array(rows * NC), XS = new Float32Array(rows), CV = new Float32Array(rows), DW = new Float32Array(rows);
    for (let j = 0; j < rows; j++) {
      const z = z0 + (j - 1) * DZ, x0 = t.X0(z);
      XS[j] = x0; CV[j] = t.cover(z);
      let dw = 0; for (const zn of t.zones) if (zn.type === 'drop' && z > zn.z0 && z < zn.z1) dw += win(z, zn.z0, zn.z1, zn.edge);
      DW[j] = dw;
      for (let i = 0; i < NC; i++) H[j * NC + i] = this.h(x0 + LX[i], z);
    }
    const pos = new Float32Array((NZ + 1) * NC * 3), nor = new Float32Array((NZ + 1) * NC * 3), col = new Float32Array((NZ + 1) * NC * 3), uv = new Float32Array((NZ + 1) * NC * 2);
    const fields = b.fields.map((c) => new THREE.Color(c)), rockB = new THREE.Color(b.rock).multiplyScalar(0.72);
    const rockC = new THREE.Color(b.rock), ballast = new THREE.Color(C.ballast), sand = new THREE.Color(C.sand), snow = new THREE.Color(0xffffff);
    for (let j = 1; j <= NZ + 1; j++) {
      const z = z0 + (j - 1) * DZ, dX = (XS[j + 1] - XS[j - 1]) / (2 * DZ), ty = t.Y(z);
      for (let i = 0; i < NC; i++) {
        const k = ((j - 1) * NC + i) * 3, y = H[j * NC + i], x = XS[j] + LX[i];
        pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
        const ku = ((j - 1) * NC + i) * 2; uv[ku] = x / 14; uv[ku + 1] = z / 14;
        const il = Math.max(0, i - 1), ir = Math.min(NC - 1, i + 1);
        const hx = (H[j * NC + ir] - H[j * NC + il]) / (LX[ir] - LX[il]);
        const hz = (H[(j + 1) * NC + i] - H[(j - 1) * NC + i]) / (2 * DZ) - hx * dX;
        const inv = 1 / Math.hypot(hx, 1, hz);
        nor[k] = -hx * inv; nor[k + 1] = inv; nor[k + 2] = -hz * inv;
        _col.set(b.grassA).lerp(_c2.set(b.grassB), noise(x * 0.03, z * 0.03, this.seed + 9));
        const steep = smooth(0.82, 0.6, inv);
        const a = Math.abs(LX[i]);
        // patchwork farmland further out, soft meadow variation close in
        if (a > 46) { const f = fields[Math.floor(hash(Math.floor(x / 58), Math.floor(z / 58), this.seed + 31) * fields.length)]; _col.lerp(f, 0.6 * smooth(46, 70, a) * (1 - smooth(60, 110, y - ty))); }
        _col.multiplyScalar(0.9 + 0.2 * noise(x * 0.09, z * 0.09, this.seed + 4));
        // layered rock on the steep faces
        const band = 0.5 + 0.5 * Math.sin(y * 0.42 + noise(x * 0.03, z * 0.03, this.seed + 3) * 5);
        _col.lerp(_c2.copy(rockC).lerp(rockB, smooth(0.35, 0.65, band)), steep);
        _col.lerp(snow, smooth(95, 140, y - ty) * 0.85);
        if (DW[j] > 0.5 && y < ty - 20) _col.lerp(sand, 0.35 * (1 - steep));
        if (a <= 6 && CV[j] < 0.01) _col.lerp(ballast, (a <= 3 ? 1 : 0.45) * clamp(1 - DW[j] * 3));
        col[k] = _col.r; col[k + 1] = _col.g; col[k + 2] = _col.b;
      }
    }
    const idx = [];
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NC - 1; i++) {
        if (Math.abs(LX[i]) <= 9 && Math.abs(LX[i + 1]) <= 9) { // leave a mouth for tunnel portals
          const c0 = CV[j + 1], c1 = CV[j + 2];
          if ((c0 > 0.001 || c1 > 0.001) && Math.min(c0, c1) < 11) continue;
        }
        const a = j * NC + i, bb = a + 1, c = a + NC, d = c + 1;
        idx.push(a, c, bb, bb, c, d);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, this.mat); mesh.receiveShadow = true; mesh.userData.own = true;
    g.add(mesh);
    this.rails(g, z0);
    this.scenery(g, ci, z0);
    this.group.add(g);
    return g;
  }

  rails(g, z0) {
    const t = this.track, z1 = z0 + CL, STEP = 3;
    const P = [], N = [], sleepers = [];
    const quad = (a, b, c, d, nx, ny, nz) => { for (const p of [a, c, b, b, c, d]) { P.push(p[0], p[1], p[2]); N.push(nx, ny, nz); } };
    for (const line of [this.mainLine, ...t.lines]) {
      const a = Math.max(z0, line.z0), b = Math.min(z1, line.z1);
      if (b <= a) continue;
      const ctr = (z) => [t.X0(z) + line.off(z), t.Y(z)];
      for (let z = Math.ceil(a / STEP) * STEP; z < b - 0.01; z += STEP) {
        const zb = Math.min(z + STEP, b);
        if (line.main && (t.inGap(z + 0.1) || t.inGap(zb - 0.1) || t.cover(z) > 11 && false)) continue;
        const [xa, ya] = ctr(z), [xb, yb] = ctr(zb);
        const dx = xb - xa, len = Math.hypot(dx, zb - z), lx = (zb - z) / len, lz = -dx / len;
        for (const s of [-0.95, 0.95]) {
          const w = 0.11, top = RAIL_H, bot = 0.08;
          const p = (x, y, zz, o, h) => [x + lx * (s + o), y + h, zz + lz * (s + o)];
          quad(p(xa, ya, z, -w, top), p(xa, ya, z, w, top), p(xb, yb, zb, -w, top), p(xb, yb, zb, w, top), 0, 1, 0);
          quad(p(xa, ya, z, w, top), p(xa, ya, z, w, bot), p(xb, yb, zb, w, top), p(xb, yb, zb, w, bot), lx, 0, lz);
          quad(p(xa, ya, z, -w, bot), p(xa, ya, z, -w, top), p(xb, yb, zb, -w, bot), p(xb, yb, zb, -w, top), -lx, 0, -lz);
        }
        if (!line.bare) for (const zs of [z + 0.75, z + 2.25]) { if (zs < b) sleepers.push([line, zs]); }
      }
    }
    if (P.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      const m = new THREE.Mesh(geo, MAT.rail); m.userData.own = true; g.add(m);
    }
    if (sleepers.length) {
      const im = new THREE.InstancedMesh(sleeperGeo, MAT.sleeper, sleepers.length);
      sleepers.forEach(([line, z], i) => {
        const x = t.X0(z) + line.off(z), y = t.Y(z);
        _d.position.set(x, y + 0.12, z);
        _d.lookAt(t.X0(z + 1) + line.off(z + 1), t.Y(z + 1) + 0.12, z + 1);
        _d.scale.set(1, 1, 1); _d.updateMatrix(); im.setMatrixAt(i, _d.matrix);
      });
      im.receiveShadow = true; g.add(im);
    }
    // roads running alongside the line
    for (const r of t.roads) {
      const a = Math.max(z0, r.z0), b = Math.min(z1, r.z1);
      if (b <= a) continue;
      const pp = [], n = Math.ceil((b - a) / 4);
      for (let i = 0; i <= n; i++) {
        const z = a + ((b - a) * i) / n, x = t.X0(z) + r.off(z), y = t.Y(z) + 0.1;
        pp.push(x - r.w / 2, y, z, x + r.w / 2, y, z);
      }
      const ii = []; for (let i = 0; i < n; i++) { const k = i * 2; ii.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); geo.setIndex(ii); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, this.roadMat); m.receiveShadow = true; m.userData.own = true; g.add(m);
    }
  }

  scenery(g, ci, z0) {
    const t = this.track, inst = new Map();
    const put = (name, x, y, z, rot, sc) => {
      let a = inst.get(name); if (!a) inst.set(name, (a = []));
      _d.position.set(x, y, z); _d.rotation.set(0, rot, 0); _d.scale.setScalar(sc); _d.updateMatrix(); a.push(_d.matrix.clone());
    };
    for (let slot = 0; slot < 2; slot++) {
      const zs = z0 + slot * 48, zm = zs + 24;
      for (const side of [-1, 1]) {
        const info = this.zoneInfo(zm, side);
        if (info.none || info.water) continue;
        const r = hash(ci * 2 + slot, side, this.seed + 77);
        let mod;
        if (info.drop > 25) mod = VALLEY; else if (info.alpine) mod = ALPINE;
        else if (info.busy && !info.clear) mod = MODULES[Math.floor(r * 2)];
        else mod = MODULES[Math.floor(r * MODULES.length)];
        for (const [name, lx, dz, rot, sc] of mod(r)) {
          const z = zs + dz;
          if (info.clear && lx < info.clear) continue;
          const zi = this.zoneInfo(z, side);
          if (zi.none || zi.water || (zi.clear && lx < zi.clear) || (zi.drop > 25) !== (info.drop > 25)) continue;
          const x = t.X0(z) + side * lx, y = this.h(x, z);
          if (Math.abs(this.h(x + 2.5, z) - y) > 2.6 || Math.abs(this.h(x, z + 2.5) - y) > 2.6) continue;
          if (t.cover(z) > 0 && lx < 14) continue;
          put(name, x, y - 0.15, z, side > 0 ? rot : Math.PI - rot, sc * (0.9 + 0.25 * hash(Math.round(z), Math.round(lx), this.seed)));
        }
      }
      // grass tufts tidy along the ballast edge
      for (const side of [-1, 1]) {
        const info = this.zoneInfo(zm, side);
        if (info.busy || zs < 160) continue;
        for (let k = 0; k < 12; k++) { const z = zs + k * 4 + 1, r = hash(Math.round(z), side, this.seed + 55); if (r < 0.7) { const x = t.X0(z) + side * (7.6 + r * 2.4); put('tuft', x, this.h(x, z) - 0.05, z, r * 6, 0.8 + r); } }
      }
      // catenary gantries on open plain track
      if (zs > 320 && !t.busy(zm) && !t.inGap(zm) && !t.noPoles.some((r) => zm > r[0] && zm < r[1])) put('gantry', t.X(zm), t.Y(zm), zm, Math.atan2(t.X(zm + 1) - t.X(zm - 1), 2), 1);
      // clouds
      for (const side of [-1, 1]) {
        const r = hash(ci * 2 + slot, side * 3, this.seed + 12);
        if (r < 0.55) put('cloud', t.X0(zm) + side * (90 + r * 500), t.Y(zm) + 150 + r * 160, zm + r * 40, r * 6, 1.6 + r * 3);
      }
    }
    for (const [name, mats] of inst) {
      const p = this.protos[name];
      const im = new THREE.InstancedMesh(p.geo, p.mat === 'cloud' ? MAT.cloud : MAT.solid, mats.length);
      mats.forEach((m, i) => {
        im.setMatrixAt(i, m);
        if (p.tint) { const r = hash(Math.round(m.elements[12]), Math.round(m.elements[14]), 91), q = hash(Math.round(m.elements[14]), Math.round(m.elements[12]), 17); im.setColorAt(i, _col.setRGB(1 - p.tint + r * p.tint * 1.6, 1 - p.tint * 0.6 + q * p.tint * 1.2, 1 - p.tint + r * p.tint)); }
      });
      im.castShadow = p.shadow; im.receiveShadow = false;
      g.add(im);
      if (p.glow) { const gm = new THREE.InstancedMesh(p.glow, MAT.glow, mats.length); mats.forEach((m, i) => gm.setMatrixAt(i, m)); g.add(gm); }
    }
  }
}
