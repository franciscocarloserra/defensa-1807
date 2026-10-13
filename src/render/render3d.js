// 3D renderer (Three.js), first person. Reads game state globals from src/engine/engine.js; each frame calls tick(dt), walkMe() and fire(). GLBs from assets/ per MODELS, placeholder geometry otherwise.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Water } from 'three/addons/objects/Water.js';

const HEIGHT = { calle: 0, plaza: 0.03, recova: 0.03, manzana: 0.85, fuerte: 0.15, cabildo: 0.8, iglesia: 0.9, barranca: -0.25, rio: -0.5 };
const ROOF_VARIATION = 0.3;
const PALETTE = {
  calle: '#6b5a45', plaza: '#8f7f5c', recova: '#8f7f5c', fuerte: '#7f6a4c', cabildo: '#efe6cf',
  iglesia: '#d9cfb8', barranca: '#86704c', rio: '#7d6f55', // the river is brown, as in period engravings
};
const SKY = '#a9c6dc'; // open sky over the pampa (fog fades the field into it)
const WHITEWASH = ['#ece3cc', '#e2d5b8', '#d8c8a6', '#efe9da'];
// Colors from the uniform plates in data/ (Patricios, Pardos, Morenos, Naturales, Marineros, British line and rifles).
const UNIT_LOOK = {
  linea:     { coat: '#b8261c', legs: '#e8e4d8', hat: 'shako',   hatColor: '#151515', belts: true },
  rifle:     { coat: '#1f3d24', legs: '#1f3d24', hat: 'shako',   hatColor: '#151515' },
  soldado:   { coat: '#1e2d5a', legs: '#e8e4d8', hat: 'tophat',  hatColor: '#151515', plume: '#c8372d' },
  patricio:  { coat: '#1d2f5e', legs: '#e8e4d8', hat: 'tophat',  hatColor: '#151515', belts: true, plume: '#e8e4d8' },
  miliciano: { coat: ['#1d3f8a', '#b8261c', '#2a3f70'], legs: '#d8c9a3', hat: 'tophat', hatColor: '#1a1a1a', plume: '#c8372d' },
  minon:     { coat: '#2f5a33', legs: '#d8c9a3', hat: 'brim',    hatColor: '#1e2a1a' },
  vecina:    { coat: ['#7a3b5a', '#4a3b6a'], legs: '#3a2a2a', hat: 'brim', hatColor: '#2a2020' },
  jefe:      { coat: null,      legs: '#e8e4d8', hat: 'bicorne', hatColor: '#151515' }, // coat = faction color
};
const NAME_SCALE = 0.26;
// Meshy models replacing the placeholder figure, per unit type. Height in tiles.
// granadero.glb is anachronistic (Granaderos a Caballo date from 1812); it stands in for all local
// infantry (Liniers' troops, Patricios, militia) until period models exist, then gets replaced.
const SOLDIER_GLB = 'assets/granadero.glb';
const BRITISH_GLB = 'assets/soldado-ingles.glb';
const MODELS = { soldado: SOLDIER_GLB, patricio: SOLDIER_GLB, miliciano: SOLDIER_GLB, linea: BRITISH_GLB, rifle: BRITISH_GLB };
const CATHEDRAL_GLB = 'assets/catedral.glb', CABILDO_GLB = 'assets/cabildo.glb', LANDMARK_FILL = 0.95; // share of the footprint
const FORT_GLB = 'assets/fuerte.glb', FORT_FILL = 1.35;
const HOUSE_GLBS = [1, 2, 3, 4].map(n => `assets/casa-colonial-${n}.glb`), HOUSE_FILL = 1; // share of the tile
const SHIP_GLB = 'assets/navio.glb', SHIP_LENGTH = 3.6; // tiles, bow to stern
// Chiefs: British ones share the British soldier model, Liniers and Pueyrredón the criollo; the rest keep the placeholder.
const CRIOLLO_GLB = 'assets/criollo.glb', CRIOLLO_PEOPLE = ['liniers', 'pueyrredon'];
const modelOf = u => u.t !== 'jefe' ? MODELS[u.t] : u.f === 'ing' ? BRITISH_GLB : CRIOLLO_PEOPLE.includes(u.p) ? CRIOLLO_GLB : undefined;
const MODEL_HEIGHT = 0.8;
const CAMERA_FOV = 45;
const TAP_PX = 10, TAP_MS = 500;
const DEATH_MS = 400;
const SHADOW_MAP = 2048;

const cv = document.getElementById('map'), wrap = document.getElementById('wrap');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 30, 90);
const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight('#e8f0f8', '#4e5a30', 1.3));
const sun = new THREE.DirectionalLight('#ffd49a', 2.4);
sun.position.set(-9, 16, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
sun.shadow.bias = -0.0005;
scene.add(sun);

const wx = x => x - COLS / 2 + 0.5, wz = y => y - ROWS / 2 + 0.5;
const hash = (x, y) => ((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1 + 1) % 1;

// --- terrain ---------------------------------------------------------------
const top = grid.map((row, y) => row.map((t, x) => HEIGHT[t] + (t === 'manzana' ? hash(x, y) * ROOF_VARIATION : 0)));
const box = new THREE.BoxGeometry(1, 1, 1);
const std = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
// Procedural canvas textures: noisy ground, brick azoteas, whitewashed facades with a barred window.
function canvasTex(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const noise = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
const groundTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); noise(g, w, h, 900, 0.25); });
const roofTex = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#b07a52'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#8a5a3a'; g.lineWidth = 1;
  for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 * 8; x < w; x += 16) g.strokeRect(x, y, 16, 8);
  noise(g, w, h, 400, 0.2);
  g.strokeStyle = '#e8e0cc'; g.lineWidth = 6; g.strokeRect(0, 0, w, h); // pretil (parapet)
});
// Box side UVs span the whole height h+1 (1 below ground); the window sits in the visible top ~35%.
const facadeTex = canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 300, 0.12);
  g.fillStyle = '#2b2620'; g.fillRect(22, 14, 20, 22);
  g.fillStyle = '#3d5a3a'; g.fillRect(16, 14, 6, 22); g.fillRect(42, 14, 6, 22); // shutters
  g.strokeStyle = '#111'; for (let x = 26; x < 42; x += 5) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x, 36); g.stroke(); }
  g.fillStyle = 'rgba(90,70,50,.35)'; g.fillRect(0, 40, w, 4);
});
// Mud for streets and plazas: wet/dry blotches, cracked dry crust, hoof and boot prints, a few stones,
// and glossy puddles. Returns color, bump and roughness maps drawn together so they line up.
function mudMaps({ ruts = false, puddles = 3, stones = 40 } = {}) {
  const S = 512, cs = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = c.height = S; return c; });
  const [col, bump, rough] = cs.map(c => c.getContext('2d'));
  const R = Math.random, both = (fn) => { fn(col, 0); fn(bump, 1); };
  col.fillStyle = '#fff'; col.fillRect(0, 0, S, S);
  bump.fillStyle = '#808080'; bump.fillRect(0, 0, S, S);
  rough.fillStyle = '#e6e6e6'; rough.fillRect(0, 0, S, S);
  // blotches: darker = wetter and lower
  for (let i = 0; i < 120; i++) {
    const x = R() * S, y = R() * S, r = 20 + R() * 70, wet = R() < 0.5;
    const gc = col.createRadialGradient(x, y, 0, x, y, r);
    gc.addColorStop(0, wet ? 'rgba(40,25,10,.22)' : 'rgba(255,240,210,.18)'); gc.addColorStop(1, 'rgba(0,0,0,0)');
    col.fillStyle = gc; col.fillRect(x - r, y - r, 2 * r, 2 * r);
    const gb = bump.createRadialGradient(x, y, 0, x, y, r);
    gb.addColorStop(0, wet ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.2)'); gb.addColorStop(1, 'rgba(0,0,0,0)');
    bump.fillStyle = gb; bump.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // wheel ruts along both axes (streets only)
  if (ruts) for (const p of [0.32, 0.68]) for (const vert of [0, 1]) for (let k = 0; k < 3; k++) {
    const off = p * S + (R() - 0.5) * 10, wd = 9 + R() * 5;
    both((g, b) => {
      g.strokeStyle = b ? 'rgba(0,0,0,.35)' : 'rgba(45,28,12,.28)'; g.lineWidth = wd; g.beginPath();
      for (let t = 0; t <= S; t += 32) { const o = off + Math.sin(t * 0.02 + k) * 4; vert ? g.lineTo(o, t) : g.lineTo(t, o); }
      g.stroke();
    });
  }
  // cracks in the dry crust
  for (let i = 0; i < 70; i++) {
    let x = R() * S, y = R() * S;
    both((g, b) => { g.strokeStyle = b ? 'rgba(0,0,0,.5)' : 'rgba(50,32,15,.45)'; g.lineWidth = 1; });
    col.beginPath(); bump.beginPath(); col.moveTo(x, y); bump.moveTo(x, y);
    for (let s = 0; s < 4 + R() * 5; s++) { x += (R() - 0.5) * 22; y += (R() - 0.5) * 22; col.lineTo(x, y); bump.lineTo(x, y); }
    col.stroke(); bump.stroke();
  }
  // hoof and boot prints
  for (let i = 0; i < 90; i++) {
    const x = R() * S, y = R() * S, a = R() * 6.3, hoof = R() < 0.4;
    both((g, b) => {
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = b ? 'rgba(0,0,0,.45)' : 'rgba(40,24,10,.35)';
      g.beginPath();
      if (hoof) { g.arc(0, 0, 6, 0.3, Math.PI * 2 - 0.3); g.lineTo(0, 0); } else g.ellipse(0, 0, 3.5, 8, 0, 0, 7);
      g.fill(); g.restore();
    });
  }
  // stones poking out of the mud
  for (let i = 0; i < stones; i++) {
    const x = R() * S, y = R() * S, r = 3 + R() * 6, l = 150 + R() * 60, a = R() * 3;
    col.fillStyle = `rgb(${l},${l - 6},${l - 18})`; col.beginPath(); col.ellipse(x, y, r, r * 0.7, a, 0, 7); col.fill();
    col.strokeStyle = 'rgba(30,20,10,.5)'; col.lineWidth = 1.2; col.stroke();
    bump.fillStyle = '#e0e0e0'; bump.beginPath(); bump.ellipse(x, y, r, r * 0.7, a, 0, 7); bump.fill();
    rough.fillStyle = '#b0b0b0'; rough.beginPath(); rough.ellipse(x, y, r, r * 0.7, a, 0, 7); rough.fill();
  }
  // puddles: dark, flat and glossy, with a pale rim of dried silt
  for (let i = 0; i < puddles; i++) {
    const x = 40 + R() * (S - 80), y = 40 + R() * (S - 80), rx = 18 + R() * 30, ry = rx * (0.5 + R() * 0.4), a = R() * 3;
    const blob = (g, grow) => { g.beginPath(); for (let t = 0; t < 6.3; t += 0.3) { const k = 1 + Math.sin(t * 3 + i) * 0.12 + grow; g.lineTo(x + Math.cos(t + a) * rx * k, y + Math.sin(t + a) * ry * k); } g.fill(); };
    col.fillStyle = 'rgba(200,180,140,.35)'; blob(col, 0.18);
    col.fillStyle = 'rgba(45,35,25,.85)'; blob(col, 0);
    col.fillStyle = 'rgba(190,200,205,.25)'; blob(col, -0.4); // sky glint
    bump.fillStyle = '#3a3a3a'; blob(bump, 0);
    rough.fillStyle = '#141414'; blob(rough, 0);
  }
  noise(col, S, S, 9000, 0.12);
  noise(bump, S, S, 9000, 0.3);
  const [map, bumpMap, roughnessMap] = cs.map((c, i) => {
    const t = new THREE.CanvasTexture(c);
    if (i === 0) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
  return { map, bumpMap, roughnessMap, bumpScale: 3, roughness: 1 };
}
// Barranca: bare trodden earth with sparse dry, yellowed grass.
const grassTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '90,65,40' : '200,175,130'},${Math.random() * 0.3})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 14, 0, 7); g.fill(); }
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * w, y = Math.random() * h, d = Math.random() * 0.45;
    g.strokeStyle = `rgba(${Math.random() < 0.3 ? '85,90,40' : '210,190,120'},${d})`; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 3 - 1.5, y - 3 - Math.random() * 4); g.stroke();
  }
});
// Shore: wet mud darkening toward the water line (v = 0 at the waterline).
const mudTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8f7b58'); gr.addColorStop(0.5, '#7a6448'); gr.addColorStop(1, '#4a3a28');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  noise(g, w, h, 1500, 0.25);
  for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(160,150,130,.6)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 1.5 + Math.random() * 2, 0, 0, 7); g.fill(); }
});
// Tileable water normal map: sum of sines with integer frequencies so it wraps seamlessly.
const waterNormals = (() => {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N), waves = [];
  for (let i = 0; i < 24; i++) waves.push([Math.round(Math.random() * 16 - 8) || 1, Math.round(Math.random() * 16 - 8), Math.random() * 6.3, 1 / (1 + i * 0.35)]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let dx = 0, dy = 0;
    for (const [kx, ky, ph, a] of waves) { const c2 = Math.cos(2 * Math.PI * (kx * x + ky * y) / N + ph) * a; dx += c2 * kx; dy += c2 * ky; }
    const nx = -dx * 0.035, ny = -dy * 0.035, l = Math.hypot(nx, ny, 1), o = (y * N + x) * 4;
    img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();
const mats = Object.fromEntries(Object.entries(PALETTE).map(([k, c]) => [k, std(c, { map: groundTex })]));
mats.calle = std(PALETTE.calle, mudMaps({ ruts: true, puddles: 2, stones: 60 }));
mats.plaza = std(PALETTE.plaza, mudMaps({ puddles: 4, stones: 25 }));
mats.recova = mats.plaza;
mats.barranca = std(PALETTE.barranca, { map: grassTex });
mats.rio = new THREE.MeshBasicMaterial({ visible: false }); // river tiles stay pickable; the Water mesh draws it
for (const k of ['cabildo', 'iglesia']) mats[k] = std(PALETTE[k], { map: facadeTex });
const roofMat = std('#fff', { map: roofTex });
const washMats = WHITEWASH.map(c => { const side = std(c, { map: facadeTex }); return [side, side, roofMat, side, side, side]; });
const pickables = [];

function solid(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(box, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  return m;
}

for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
  const t = grid[y][x], h = top[y][x];
  const mat = t === 'manzana' ? washMats[Math.floor(hash(y, x) * WHITEWASH.length)] : mats[t];
  const m = solid(1, h + 1, 1, wx(x), (h - 1) / 2, wz(y), mat);
  m.castShadow = t !== 'rio';
  m.userData = { x, y };
  pickables.push(m);
}
const TABLE_Y = -1.62, frameMat = std('#5a4630'); // earth under the city and the field
solid(COLS + 0.6, -1 - TABLE_Y, ROWS + 0.6, 0, (TABLE_Y - 1) / 2, 0, frameMat);
// Open country around the city: grass to the horizon, tufts of pasto and a few lone trees (instead of a table).
const FIELD = 160, FIELD_Y = -0.012;
{
  const grassTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#6f8a3e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { // patches of lighter and darker grass
      const c = Math.random() < 0.5 ? 'rgba(150,170,80,.18)' : 'rgba(55,80,30,.2)';
      g.fillStyle = c; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 6 + Math.random() * 25, Math.random() * 3, 0, 7); g.fill();
    }
    for (let i = 0; i < 9000; i++) { // blades
      const x = Math.random() * w, y = Math.random() * h, l = 3 + Math.random() * 6;
      g.strokeStyle = `rgba(${Math.random() < 0.3 ? '185,190,110' : '50,85,30'},${0.25 + Math.random() * 0.4})`;
      g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 2 - 1, y - l); g.stroke();
    }
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(FIELD / 4, FIELD / 4);
  grassTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const grassMat = std('#fff', { map: grassTex });
  // Land side only (the river runs on the other), around the board: left of it, and above and below it.
  const xr = wx(15) - 0.5, x0 = -COLS / 2, zh = ROWS / 2;
  const patch = (xa, xb, za, zb) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, zb - za).rotateX(-Math.PI / 2), grassMat);
    m.geometry.attributes.uv.array.forEach((v, i, arr) => { arr[i] = v * (i % 2 ? (zb - za) : (xb - xa)) / FIELD; });
    m.position.set((xa + xb) / 2, FIELD_Y, (za + zb) / 2);
    m.receiveShadow = true;
    scene.add(m);
  };
  patch(-FIELD / 2, x0, -FIELD / 2, FIELD / 2);
  patch(x0, xr, -FIELD / 2, -zh);
  patch(x0, xr, zh, FIELD / 2);
  for (const sz of [-1, 1]) // earth bank down to the river, above and below the board
    solid(0.2, -FIELD_Y - TABLE_Y, FIELD / 2 - zh, xr - 0.1, (FIELD_Y + TABLE_Y) / 2, sz * (zh + FIELD / 2) / 2, frameMat).castShadow = false;
  // Tufts and trees, scattered off the board.
  const off = (x, z, m) => x < xr - 0.3 && !(x > x0 - m && z > -zh - m && z < zh + m);
  const TUFTS = 3000, tuft = new THREE.ConeGeometry(0.06, 0.22, 4).translate(0, 0.1, 0);
  const tufts = new THREE.InstancedMesh(tuft, std('#fff'), TUFTS), o = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < TUFTS; i++) {
    let x, z;
    do { const r = 1 + Math.random() ** 1.5 * 45, a = Math.random() * 7; x = r * Math.cos(a); z = r * Math.sin(a); } while (!off(x, z, 0.3));
    o.position.set(x, FIELD_Y, z); o.rotation.set(Math.random() * 0.3 - 0.15, Math.random() * 7, Math.random() * 0.3 - 0.15);
    o.scale.set(1, 0.6 + Math.random() * 1.2, 1); o.updateMatrix(); tufts.setMatrixAt(i, o.matrix);
    tufts.setColorAt(i, tint.setHSL(0.2 + Math.random() * 0.08, 0.45, 0.25 + Math.random() * 0.15));
  }
  scene.add(tufts);
  const trunkMat = std('#4b3a28'), leafMat = std('#3d5a2a');
  for (let i = 0; i < 28; i++) { // ombúes: thick trunk, wide crown
    let x, z;
    do { x = -FIELD / 2 * 0.4 + Math.random() * (xr + FIELD / 2 * 0.4); z = (Math.random() * 2 - 1) * 35; } while (!off(x, z, 3));
    const s = 0.7 + Math.random() * 0.6, tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.7, 7), trunkMat); trunk.position.y = 0.35;
    tree.add(trunk);
    for (let k = 0; k < 4; k++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.45 + Math.random() * 0.2, 9, 7), leafMat);
      c.position.set(Math.random() * 0.6 - 0.3, 0.95 + Math.random() * 0.25, Math.random() * 0.6 - 0.3);
      tree.add(c);
    }
    tree.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    tree.position.set(x, FIELD_Y, z); tree.scale.setScalar(s); tree.rotation.y = Math.random() * 7;
    scene.add(tree);
  }
}

// Block tiles: a spread of Meshy colonial houses, one per tile, stretched to the tile and its roof height
// (units stand on the azoteas). The boxes stay as invisible pick targets; keep them visible if a house fails.
{
  const tiles = pickables.filter(m => grid[m.userData.y][m.userData.x] === 'manzana');
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  // Quantized (int16) attributes would clamp once baked to new coordinates; copy them to float.
  const dequantize = geo => {
    const g = geo.clone(), get = ['getX', 'getY', 'getZ', 'getW'];
    for (const [name, a] of Object.entries(g.attributes)) {
      const f = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a[get[j]](i);
      g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
    }
    return g;
  };
  let pending = HOUSE_GLBS.length;
  const variants = [];
  HOUSE_GLBS.forEach((url, i) => new GLTFLoader().load(url, gltf => {
    // Bake each mesh into a unit box: x/z in [-0.5, 0.5], y in [0, 1].
    const root = gltf.scene; root.updateMatrixWorld(true);
    const parts = [];
    root.traverse(o => { if (o.isMesh) parts.push({ geo: dequantize(o.geometry).applyMatrix4(o.matrixWorld), mat: o.material }); });
    const box = new THREE.Box3(); for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const norm = new THREE.Matrix4().makeScale(1 / size.x, 1 / size.y, 1 / size.z).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
    for (const p of parts) p.geo.applyMatrix4(norm);
    variants[i] = parts;
    if (!--pending) place();
  }, undefined, e => { console.error('model ' + url, e); if (!--pending) place(); }));
  function place() {
    const ok = HOUSE_GLBS.map((_, i) => i).filter(i => variants[i]);
    if (!ok.length) return;
    const pick = tiles.map(m => ok[Math.floor(hash(m.userData.x + 3, m.userData.y + 11) * ok.length)]);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (const i of ok) {
      const mine = tiles.filter((_, k) => pick[k] === i);
      for (const { geo, mat } of variants[i]) {
        const inst = new THREE.InstancedMesh(geo, mat, mine.length);
        mine.forEach((m, k) => {
          const { x, y } = m.userData, turn = Math.floor(hash(y + 5, x + 2) * 4) * Math.PI / 2;
          mtx.compose(new THREE.Vector3(wx(x), 0, wz(y)), q.setFromAxisAngle(up, turn), new THREE.Vector3(HOUSE_FILL, top[y][x], HOUSE_FILL));
          inst.setMatrixAt(k, mtx);
        });
        inst.castShadow = inst.receiveShadow = true;
        scene.add(inst);
      }
    }
    for (const m of tiles) m.material = hidden;
  }
}

const rect = name => LANDMARKS.find(l => l[1] === name || (!l[1] && l[0] === name));
const center = ([, , x0, y0, x1, y1]) => [(wx(x0) + wx(x1)) / 2, (wz(y0) + wz(y1)) / 2];

// Recova: arcade roof on pillars, see-through so units under it stay visible.
{
  const [, , x0, y0, , y1] = rect('recova'), len = y1 - y0 + 1, [cx, cz] = center(rect('recova'));
  const roof = solid(0.8, 0.08, len, cx, 0.62, cz, std('#c9b48a', { transparent: true, opacity: 0.55 }));
  roof.castShadow = true;
  for (let i = 0; i <= len * 2; i++) for (const s of [-0.35, 0.35])
    solid(0.07, 0.6, 0.07, wx(x0) + s, 0.3, wz(y0) - 0.5 + i / 2, std('#d8c8a6'));
}
// Fuerte: four-pointed star wall as drawn on the 1807 plan (data/), with the Spanish flag.
{
  const [, , x0, y0, x1, y1] = rect('Fuerte'), [cx, cz] = center(rect('Fuerte'));
  const rx = (x1 - x0 + 1) / 2 + 0.35, rz = (y1 - y0 + 1) / 2 + 0.35, H = 0.55;
  const star = (sx, sz) => {
    const sh = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + Math.PI / 4, r = i % 2 ? 0.8 : 1.25; // points on the diagonals
      sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * sx, Math.sin(a) * r * sz);
    }
    return sh;
  };
  const outer = star(rx, rz);
  outer.holes.push(star(rx * 0.8, rz * 0.8));
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: H, bevelEnabled: false }).rotateX(-Math.PI / 2), std('#a08866', { map: groundTex }));
  wall.position.set(cx, 0, cz);
  wall.castShadow = wall.receiveShadow = true;
  scene.add(wall);
  const pole = solid(0.12, 2.2, 0.12, cx, 1.1, cz, std('#4a3320'));
  const flag = canvasTex(48, 32, (g, w, h) => { g.fillStyle = '#b8261c'; g.fillRect(0, 0, w, h); g.fillStyle = '#e3b53a'; g.fillRect(0, h / 4, w, h / 2); });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.5), new THREE.MeshStandardMaterial({ map: flag, side: THREE.DoubleSide }));
  f.position.set(cx + 0.42, 1.95, cz);
  scene.add(f);
  // The fort's walls and bastions reach past the tiles; units still garrison it.
  landmarkModel('Fuerte', FORT_GLB, [wall, f, pole], { fill: FORT_FILL, keepTiles: true });
}
// Ships at anchor in the river, as in the engravings.
const ships = [];
for (const [sx, sz, r] of [[21, -8, 0.3], [23, -2.5, -0.2], [21, 3, 0.1], [23.5, 8.5, 0.4]]) {
  const ship = new THREE.Group(), wood = std('#4a3320'), sail = std('#efe9da', { side: THREE.DoubleSide });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 2.4), wood); hull.position.y = 0.05; ship.add(hull);
  for (const [z, h] of [[-0.7, 2], [0.1, 2.5], [0.8, 1.8]]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, h, 6), wood); mast.position.set(0, h / 2, z); ship.add(mast);
    for (const k of [0.45, 0.75]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * k + 0.2, h * 0.28), sail); s.position.set(0, h * k, z + 0.05); s.rotation.y = Math.PI / 2; ship.add(s); }
  }
  ship.traverse(o => { o.castShadow = true; });
  ship.position.set(sx - COLS / 2, HEIGHT.rio, sz); ship.rotation.y = r;
  scene.add(ship); ships.push(ship);
}
// Swap the placeholder ships for the Meshy model; keep placeholders if it fails.
new GLTFLoader().load(SHIP_GLB, gltf => {
  const m = gltf.scene, d = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
  if (d.x > d.z) m.rotation.y = Math.PI / 2; // placeholders run bow-stern along z
  m.scale.setScalar(SHIP_LENGTH / Math.max(d.x, d.z));
  const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
  m.position.set(-c.x, -0.22 - b.min.y, -c.z); // centered, hull sunk below the waterline
  m.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const pivot = new THREE.Group().add(m);
  for (const ship of ships) {
    const n = pivot.clone();
    n.position.copy(ship.position); n.rotation.copy(ship.rotation);
    scene.remove(ship); scene.add(n);
  }
}, undefined, e => console.error('model ' + SHIP_GLB, e));
// River: reflective animated water out to the horizon, over a muddy bed.
const RIVER_X0 = wx(15) - 0.5, RIVER_W = 70, RIVER_D = FIELD, WATER_Y = HEIGHT.rio - 0.02;
solid(RIVER_W, WATER_Y - 0.05 - TABLE_Y, RIVER_D, RIVER_X0 + RIVER_W / 2, (WATER_Y - 0.05 + TABLE_Y) / 2, 0, std('#3a2e20')).castShadow = false; // bed
const water = new Water(new THREE.PlaneGeometry(RIVER_W, RIVER_D), {
  textureWidth: 512, textureHeight: 512, waterNormals,
  sunDirection: sun.position.clone().normalize(), sunColor: '#ffe2b0',
  waterColor: '#4a3c28', // brown, as in period engravings
  distortionScale: 1.2, fog: true,
});
water.material.uniforms.size.value = 9; // higher = smaller, choppier waves
water.rotation.x = -Math.PI / 2;
water.position.set(RIVER_X0 + RIVER_W / 2, WATER_Y, 0);
scene.add(water);
// Shore: muddy slope from the barranca down under the waterline, with reeds.
{
  const z0 = -RIVER_D / 2, z1 = RIVER_D / 2, xs = RIVER_X0 + 0.75, ytop = HEIGHT.barranca, ybot = WATER_Y - 0.15;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([RIVER_X0, ytop, z0, RIVER_X0, ytop, z1, xs, ybot, z0, xs, ybot, z1], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, RIVER_D, 1, 0, 0, RIVER_D, 0], 2));
  geo.setIndex([0, 1, 2, 2, 1, 3]);
  geo.computeVertexNormals();
  mudTex.wrapS = THREE.RepeatWrapping;
  const bank = new THREE.Mesh(geo, std('#fff', { map: mudTex, side: THREE.DoubleSide }));
  bank.receiveShadow = true;
  scene.add(bank);
  const REEDS = 900, reed = new THREE.ConeGeometry(0.025, 0.4, 4).translate(0, 0.2, 0);
  const reeds = new THREE.InstancedMesh(reed, std('#fff'), REEDS), o = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < REEDS; i++) {
    const t = Math.random() * 0.7, z = z0 + Math.random() * RIVER_D;
    o.position.set(RIVER_X0 + 0.1 + t, ytop + (ybot - ytop) * (t / 0.75), z);
    o.rotation.set(Math.random() * 0.3 - 0.15, 0, Math.random() * 0.3 - 0.15);
    o.scale.setScalar(0.6 + Math.random() * 0.8);
    o.updateMatrix(); reeds.setMatrixAt(i, o.matrix);
    reeds.setColorAt(i, tint.setHSL(0.1 + Math.random() * 0.05, 0.3, 0.32 + Math.random() * 0.15)); // dry, straw-colored
  }
  reeds.castShadow = true;
  scene.add(reeds);
}
// Cabildo tower on the plaza side; church towers and the cathedral dome.
function tower(x, z, base, h, mat) {
  const shaft = solid(0.4, h, 0.4, x, base + h / 2, z, mat);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.4, 4), mat);
  cap.position.set(x, base + h + 0.2, z);
  cap.rotation.y = Math.PI / 4;
  cap.castShadow = true;
  scene.add(cap);
  return [shaft, cap];
}
// Swap a landmark's blocks and extras for its Meshy model, fitted to the footprint; keep them if it fails.
// rot: extra turn (radians) to face the door; fill: share of the footprint; keepTiles: units still stand on it.
function landmarkModel(name, url, extras, { rot = 0, fill = LANDMARK_FILL, keepTiles = false } = {}) {
  const l = rect(name), [, , x0, y0, x1, y1] = l, [cx, cz] = center(l);
  new GLTFLoader().load(url, gltf => {
    const m = gltf.scene, d = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
    if ((d.x > d.z) !== (x1 - x0 > y1 - y0) && x1 - x0 !== y1 - y0) m.rotation.y = Math.PI / 2; // long side along the footprint
    m.rotation.y += rot;
    m.scale.setScalar(fill * Math.max(x1 - x0 + 1, y1 - y0 + 1) / Math.max(d.x, d.z));
    const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
    m.position.set(cx - c.x, (keepTiles ? 0 : HEIGHT.plaza) - b.min.y, cz - c.z);
    m.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    if (!keepTiles) for (const t of pickables) if (t.userData.x >= x0 && t.userData.x <= x1 && t.userData.y >= y0 && t.userData.y <= y1) {
      t.scale.y = 1 + HEIGHT.plaza; t.position.y = (HEIGHT.plaza - 1) / 2; t.material = mats.plaza;
    }
    for (const e of extras) scene.remove(e);
    scene.add(m);
  }, undefined, e => console.error('model ' + url, e));
}
{
  const [cx, cz] = center(rect('Cabildo'));
  landmarkModel('Cabildo', CABILDO_GLB, tower(cx + 0.85, cz, HEIGHT.cabildo, 1.1, mats.cabildo), { rot: Math.PI / 2 }); // door to the Plaza Mayor
  for (const n of ['S. Francisco', 'S. Domingo']) {
    const [, , x0, y0] = rect(n);
    tower(wx(x0) - 0.3, wz(y0) - 0.3, HEIGHT.iglesia, 1.0, mats.iglesia);
  }
  const [dx, dz] = center(rect('Catedral'));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std('#b9ad94'));
  dome.position.set(dx, HEIGHT.iglesia, dz);
  dome.castShadow = true;
  scene.add(dome);
  landmarkModel('Catedral', CATHEDRAL_GLB, [dome]);
}

// --- labels -----------------------------------------------------------------
function textTexture(s, color, bg) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 48, font = `600 ${fs}px system-ui,sans-serif`;
  g.font = font;
  c.width = Math.ceil(g.measureText(s).width) + 28; c.height = fs + 22;
  g.font = font;
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, c.width, c.height, 14); g.fill(); }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(s, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return [tex, c.width / c.height];
}
function groundText(s, x, z, rot, h = 0.3) {
  const [map, a] = textTexture(s, '#ffffffa0');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(h * a, h), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
  m.rotation.set(-Math.PI / 2, 0, rot);
  m.position.set(x, 0.02, z);
  scene.add(m);
  return m;
}
// Street names depend on the episode (pre-1808 by default, 1808 names where the scenario says so).
const streetLabels = new THREE.Group();
scene.add(streetLabels);
const STREETS_DEFAULT = { x: STREETS_X, y: STREETS_Y };
let streetsShown;
function showStreets(st = STREETS_DEFAULT) {
  if (st === streetsShown) return;
  streetsShown = st;
  streetLabels.children.forEach(m => { m.geometry.dispose(); m.material.map.dispose(); m.material.dispose(); });
  streetLabels.clear();
  for (const [x, n] of Object.entries(st.x)) streetLabels.add(groundText(n, wx(+x), wz(19.5), Math.PI / 2));
  for (const [y, n] of Object.entries(st.y)) streetLabels.add(groundText(n, wx(1.5), wz(+y), 0));
}
showStreets();
{
  const [map, a] = textTexture('Río de la Plata', '#ffffff80');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * a, 0.5), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
  m.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  m.position.set(wx(15.5), HEIGHT.rio + 0.02, 0);
  scene.add(m);
}

// --- units ------------------------------------------------------------------
const UG = {
  body: new THREE.CylinderGeometry(0.12, 0.17, 0.38, 12),
  head: new THREE.SphereGeometry(0.1, 12, 8),
  shako: new THREE.CylinderGeometry(0.09, 0.1, 0.16, 10),
  bearskin: new THREE.CylinderGeometry(0.11, 0.12, 0.28, 10),
  brim: new THREE.CylinderGeometry(0.19, 0.19, 0.02, 16),
  crown: new THREE.CylinderGeometry(0.08, 0.09, 0.09, 10),
  bicorne: new THREE.BoxGeometry(0.34, 0.1, 0.1),
  tophat: new THREE.CylinderGeometry(0.1, 0.09, 0.2, 10),
  plume: new THREE.CylinderGeometry(0.02, 0.03, 0.14, 6),
  leg: new THREE.CylinderGeometry(0.055, 0.045, 0.2, 8),
  belt: new THREE.BoxGeometry(0.04, 0.4, 0.02),
  musket: new THREE.BoxGeometry(0.03, 0.56, 0.03),
};
const groups = new Map(), dying = [], models = {};

// Swap placeholders for the model once it loads; keep placeholders if it fails.
for (const url of new Set([...Object.values(MODELS), BRITISH_GLB, CRIOLLO_GLB])) new GLTFLoader().load(url, gltf => {
  const m = gltf.scene, box = new THREE.Box3().setFromObject(m), s = MODEL_HEIGHT / (box.max.y - box.min.y);
  m.scale.setScalar(s);
  const c = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
  m.position.set(-c.x, -box.min.y * s, -c.z); // feet on the ground
  models[url] = m;
  for (const [u, g] of groups) if (modelOf(u) === url) {
    const n = makeUnit(u);
    n.position.copy(g.position); n.rotation.copy(g.rotation); n.visible = g.visible; n.userData.y = g.userData.y;
    scene.remove(g); groups.set(u, n);
  }
}, undefined, e => console.error('model ' + url, e));

const UNIT_SCALE = 0.6; // figures smaller than a block, so the city reads at street scale

function makeUnit(u) {
  const look = UNIT_LOOK[u.t], g = new THREE.Group(), mats = [], legs = [];
  const part = (geo, color, x, y, z) => {
    const m = std(color, { roughness: 0.7, transparent: true });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh); mats.push(m);
    return mesh;
  };
  if (models[modelOf(u)]) {
    const m = models[modelOf(u)].clone();
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); o.material.transparent = true; mats.push(o.material); } });
    g.add(m);
  } else {
    const coat = Array.isArray(look.coat) ? look.coat[groups.size % look.coat.length] : look.coat || FACTIONS[u.f].color;
    for (const x of [-0.06, 0.06]) { // each leg hangs from the hip so it can swing
      const hip = new THREE.Group(); hip.position.set(x, 0.2, 0); g.add(hip);
      const l = part(UG.leg, look.legs, 0, -0.1, 0); g.remove(l); hip.add(l); legs.push(hip);
    }
    part(UG.body, coat, 0, 0.3, 0).scale.y = 0.75;
    if (look.belts) for (const r of [0.6, -0.6]) part(UG.belt, '#f2efe6', 0, 0.3, 0.13).rotation.z = r;
    if (look.plume) part(UG.plume, look.plume, 0.07, 0.8, 0);
    part(UG.head, '#e0b48c', 0, 0.52, 0);
    if (look.hat === 'brim') { part(UG.brim, look.hatColor, 0, 0.6, 0); part(UG.crown, look.hatColor, 0, 0.65, 0); }
    else part(UG[look.hat], look.hatColor, 0, { shako: 0.66, bicorne: 0.64, tophat: 0.7 }[look.hat] || 0.72, 0);
    part(UG.musket, '#4a3320', 0.19, 0.33, 0).rotation.z = -0.15;
  }
  const hpBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#000' }));
  const hp = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#7f7' }));
  for (const s of [hpBg, hp]) { s.center.set(0, 0.5); s.scale.set(0.5, 0.06, 1); s.position.set(-0.25, 0.98, 0); g.add(s); }
  if (u.p) {
    const [map, a] = textTexture((u.hero ? '★ ' : '') + PEOPLE[u.p].short, u.hero ? '#f3d58a' : '#fff', '#000000b0');
    const name = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthWrite: false, transparent: true }));
    name.scale.set(NAME_SCALE * a / UNIT_SCALE, NAME_SCALE / UNIT_SCALE, 1);
    name.position.y = 1.18;
    name.renderOrder = 11;
    g.add(name); mats.push(name.material);
  }
  g.scale.setScalar(UNIT_SCALE);
  g.userData = { unit: u, mats, hp, legs };
  g.traverse(o => { o.userData.unit = u; });
  scene.add(g);
  return g;
}

const posOf = u => new THREE.Vector3(wx(u.x), top[Math.round(u.y)][Math.round(u.x)], wz(u.y)); // u.x, u.y: tiles, floats

// Called by engine draw() on big changes (new game, end); units also follow the engine every frame.
function sync() {
  showStreets(SC && SC.streets);
  trapdoors.visible = !!SC && SC.tunnels === MINE;
  syncWalls();
  syncUnits(performance.now());
}

const BOB = 0.025, STEP_MS = 110, SWAY = 0.09;
function syncUnits(now) {
  const alive = new Set(units);
  for (const [u, g] of groups) if (!alive.has(u)) { groups.delete(u); dying.push({ g, t0: now }); }
  for (const u of units) {
    let g = groups.get(u);
    const p = posOf(u);
    if (!g) { g = makeUnit(u); g.position.copy(p); groups.set(u, g); }
    g.position.x = p.x; g.position.z = p.z;
    g.userData.y = (g.userData.y ?? p.y) + (p.y - (g.userData.y ?? p.y)) * 0.2; // ease up/down steps (azoteas, barranca)
    const ph = now / STEP_MS + (g.id % 7), w = u.moving ? 1 : 0; // gait: bob, rock side to side, swing the legs
    g.position.y = g.userData.y + w * Math.abs(Math.sin(ph)) * BOB;
    g.rotation.set(0, u.dir, w * Math.sin(ph) * SWAY, 'YXZ');
    if (g.userData.legs) for (const [i, l] of g.userData.legs.entries()) l.rotation.x = w * Math.sin(ph + i * Math.PI) * 0.6;
    g.visible = u !== me || over; // I don't see my own figure from inside it
    const r = Math.max(0, u.hp) / stat(u, 'hp'), d = g.userData;
    d.hp.scale.x = 0.5 * r;
    d.hp.material.color.set(u.hitT > 0 ? '#fff' : r > 0.6 ? '#7f7' : r > 0.3 ? '#fd4' : '#f54');
  }
}

// Smuggling-tunnel trapdoors: only the side that knows them sees them.
const trapdoors = new THREE.Group();
scene.add(trapdoors);
for (const [x, y] of TUNNELS) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.4), std('#3b2614', { roughness: 0.9 }));
  m.position.set(wx(x), top[y][x] + 0.015, wz(y));
  trapdoors.add(m);
}

// Barricades: a pile of sacks and planks across the street, per scenario.
const barricades = new THREE.Group(), sackMat = std('#a08a62', { roughness: 0.95 }), plankMat = std('#5a3d22');
scene.add(barricades);
function syncWalls() {
  barricades.clear();
  for (const [x, y] of SC ? walls : []) {
    const across = x % 3 === 0 && y % 3 !== 0 ? 'x' : 'z'; // lie across the street's length
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2 - (i % 2); j++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.12), i % 2 ? plankMat : sackMat);
      const o = (i - 2) * 0.17 + (j ? 0.05 : 0);
      m.position.set(wx(x) + (across === 'x' ? o : 0), top[y][x] + 0.05 + j * 0.09, wz(y) + (across === 'z' ? o : 0));
      if (across === 'z') m.rotation.y = Math.PI / 2;
      m.castShadow = m.receiveShadow = true;
      barricades.add(m);
    }
  }
}

// Cartridge boxes left where soldiers fell.
const crates = new THREE.Group(), crateGeo = new THREE.BoxGeometry(0.14, 0.08, 0.1), crateMat = std('#6b4a2e');
scene.add(crates);
let cratesKey = '';
function syncCrates() {
  const k = drops.map(d => d.x.toFixed(2) + d.y.toFixed(2)).join();
  if (k === cratesKey) return;
  cratesKey = k;
  crates.clear();
  for (const d of drops) { const m = new THREE.Mesh(crateGeo, crateMat); m.position.copy(posOf(d)).y += 0.04; m.castShadow = true; crates.add(m); }
}

// --- effects ------------------------------------------------------------------
// Short-lived meshes that fade out: musket tracers and smoke, boiling oil and water.
const fx = [];
function fade(objs, ms, grow = 0) {
  scene.add(...objs);
  fx.push({ objs, ms, grow, t0: performance.now(), op: objs.map(o => o.material.opacity) });
}
const fxMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
function beam(a, b, r, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6), mat);
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
const smokeGeo = new THREE.SphereGeometry(0.07, 8, 6);

function shotFx({ k, by, to }) {
  if (by === me) kick(k);
  if (WEAPONS[k].melee) return;
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const a = by === me ? camera.position.clone().add(fwd.clone().multiplyScalar(0.4)).add(new THREE.Vector3(0, -0.06, 0)) : posOf(by).add(new THREE.Vector3(0, 0.3, 0));
  const b = to ? posOf(to).add(new THREE.Vector3(0, 0.25, 0)) : a.clone().add(fwd.multiplyScalar(reach(me)));
  if (k === 'piedras') return fade([beam(a, b, 0.012, fxMat('#9a9488', 0.8))], 250);
  const smoke = new THREE.Mesh(smokeGeo, fxMat('#d9d4c8', 0.6));
  smoke.position.copy(a);
  fade([beam(a, b, 0.006, fxMat('#ffe7a0', 0.9))], 120);
  fade([smoke], 1200, 3);
}

// Boiling grease/water poured (or bricks thrown) from a roof: a falling stream and a splash.
function pour({ k, from, to }) {
  const color = { grasa: '#d98a1c', aceite: '#e0b23a', ladrillos: '#a5532f' }[k] || '#bfe6ff';
  const a = posOf({ x: from[0], y: from[1] }).add(new THREE.Vector3(0, 0.2, 0)), b = posOf({ x: to[0], y: to[1] });
  const splash = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20).rotateX(-Math.PI / 2), fxMat(color, 0.85));
  splash.position.copy(b).y += 0.04;
  fade([beam(a, b, 0.05, fxMat(color, 0.85)), splash], 900);
}

// --- first person -------------------------------------------------------------
// My ★'s eyes: W A S D walk, the mouse looks (pointer lock), click fires or strikes, right button parries, Space jumps, wheel changes weapon. Touch: left side walks, right side looks, tap fires.
const JUMP_V = 1.6, GRAVITY = 5.5; // jump: up speed and gravity, in scene units (a tile is about 1)
let jumpY = 0, jumpV = 0;
const EYE = 0.42, FPS_FOV = 70, LOOK = 0.0025, STICK_PX = 50;
let yaw = 0, pitch = 0, inFps = false, fpsGame = -1, eyeY = 0;
const fps = () => !!(SC && me && !over);
camera.rotation.order = 'YXZ';

// What I hold (musket, blade, lance, stone or pot), fixed to the camera.
const hand = new THREE.Group();
camera.add(hand);
scene.add(camera);
const musket = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.44), std('#4a3320'));
const blade = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.12), std('#d0d0d0', { metalness: 0.8, roughness: 0.3 }));
const stone = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std('#8a8478'));
musket.position.set(0.09, -0.09, -0.26);
blade.position.set(0.09, -0.08, -0.53);
stone.position.set(0.1, -0.09, -0.22);
const steel = std('#d0d0d0', { metalness: 0.8, roughness: 0.3 });
const sword = new THREE.Group(), lance = new THREE.Group(), pot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.06, 12), std('#3a3a3a', { metalness: 0.5 }));
const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.01), std('#b08d3a', { metalness: 0.7 }));
const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.36), steel);
swordBlade.position.z = -0.18; sword.add(hilt, swordBlade);
sword.position.set(0.11, -0.1, -0.2); sword.rotation.x = 0.25;
const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.9, 6).rotateX(Math.PI / 2), std('#b9a65c'));
const tip = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.08, 6).rotateX(-Math.PI / 2), steel);
cane.position.z = -0.25; tip.position.z = -0.74; lance.add(cane, tip);
lance.position.set(0.1, -0.1, -0.1);
pot.position.set(0.1, -0.1, -0.22);
hand.add(musket, blade, stone, sword, lance, pot);
let kickT = -1e9, kickK = 'fusil';
function kick(k) { kickT = performance.now(); kickK = k; }
function syncHand(now) {
  const w = me.w;
  musket.visible = w.startsWith('fusil') || w === 'bayoneta'; blade.visible = w === 'bayoneta'; stone.visible = w === 'piedras';
  sword.visible = w === 'sable' || w === 'espada'; lance.visible = w === 'tacuara'; pot.visible = w === 'aceite';
  swordBlade.scale.set(1, w === 'sable' ? 1.4 : 0.6, w === 'sable' ? 1 : 1.15);
  const t = Math.min(1, (now - kickT) / 250), s = Math.sin(Math.PI * t), cut = kickK === 'sable' || kickK === 'espada';
  hand.position.z = kickK === 'bayoneta' || kickK === 'tacuara' ? -0.16 * s : kickK === 'piedras' || kickK === 'aceite' ? -0.08 * s : cut ? -0.06 * s : 0.05 * (1 - t) * (t < 1);
  hand.position.x = cut ? -0.1 * s : 0;
  hand.rotation.z = cut ? 0.9 * s : 0; // sabre and sword cut sideways
  hand.position.y = (me.moving ? Math.sin(now / 110) * 0.006 : 0) + (me.guard ? 0.05 : 0);
  hand.rotation.y = me.guard ? 0.9 : 0; // guard: the blade across
}

function look(dx, dy) {
  yaw -= dx * LOOK;
  pitch = THREE.MathUtils.clamp(pitch - dy * LOOK, -1.2, 1.2);
}

function enterFps() {
  inFps = true;
  if (fpsGame !== game) { // a new game: face the nearest enemy
    fpsGame = game;
    const foe = units.filter(u => enemy(me, u)).sort((a, b) => dist(me, a) - dist(me, b))[0];
    if (foe) yaw = Math.atan2(-(foe.x - me.x), -(foe.y - me.y));
    pitch = 0;
    eyeY = posOf(me).y + EYE;
  }
  controls.enabled = false;
  camera.fov = FPS_FOV; camera.near = 0.02; camera.updateProjectionMatrix();
  document.body.classList.add('fps');
}
function leaveFps() {
  inFps = false;
  controls.enabled = true;
  camera.fov = CAMERA_FOV; camera.near = 0.1;
  framed = false; resize(); // back to the whole city
  document.body.classList.remove('fps');
}

const ray = new THREE.Raycaster(), mid = new THREE.Vector2();
function shootNow() {
  if (!fps() || paused()) return;
  ray.setFromCamera(mid, camera);
  const foes = units.filter(u => enemy(me, u));
  let t = ray.intersectObjects(foes.map(u => groups.get(u)).filter(Boolean), true)[0]?.object.userData.unit || null;
  if (!t) { // a little aim help: the enemy closest to the crosshair
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    let best = 0.08;
    for (const u of foes) {
      const a = posOf(u).add(new THREE.Vector3(0, 0.25, 0)).sub(camera.position).angleTo(fwd);
      if (a < best && dist(me, u) <= reach(me) && sees(me, u)) { best = a; t = u; }
    }
  }
  fire(t);
}

// --- camera, input, loop ------------------------------------------------------
const controls = new OrbitControls(camera, cv);
controls.enableDamping = true;
controls.screenSpacePanning = false;
controls.maxPolarAngle = 1.42;
controls.minDistance = 2;
controls.maxDistance = 60;
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.addEventListener('change', () => {
  const t = controls.target;
  t.x = THREE.MathUtils.clamp(t.x, -COLS / 2, COLS / 2);
  t.z = THREE.MathUtils.clamp(t.z, -ROWS / 2, ROWS / 2);
});

let framed = false;
function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!framed && w && h) {
    framed = true;
    const tan = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));
    const dist = Math.max(COLS / 2 / (tan * camera.aspect), ROWS / 2 / tan) * 0.75;
    controls.target.set(0, 0, 1);
    camera.position.copy(controls.target).add(new THREE.Vector3(0, 1, 0.8).normalize().multiplyScalar(dist));
    controls.update();
  }
}
new ResizeObserver(resize).observe(wrap);

const locked = () => document.pointerLockElement === cv;
addEventListener('mousemove', e => { if (locked()) look(e.movementX, e.movementY); });
cv.addEventListener('mousedown', e => {
  if (!locked()) return;
  if (e.button === 0) shootNow();
  if (e.button === 2 && me) me.guard = true; // right button: parry
});
addEventListener('mouseup', e => { if (e.button === 2 && me) me.guard = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { if (inFps && !paused()) { e.preventDefault(); cycleWeapon(Math.sign(e.deltaY)); } }, { passive: false });

// Without pointer lock (touch, or before the first click): drag looks, the left side of a touch screen is a joystick.
const drags = new Map();
let stick = null;
cv.addEventListener('pointerdown', e => {
  if (!inFps || locked()) return;
  const r = cv.getBoundingClientRect();
  if (e.pointerType === 'touch' && e.clientX - r.left < r.width * 0.4) stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
  else drags.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() });
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (stick && stick.id === e.pointerId) {
    stick.dx = THREE.MathUtils.clamp((e.clientX - stick.x0) / STICK_PX, -1, 1);
    stick.dy = THREE.MathUtils.clamp((e.clientY - stick.y0) / STICK_PX, -1, 1);
  }
  const d = drags.get(e.pointerId);
  if (d) { look((e.clientX - d.x) * 1.5, (e.clientY - d.y) * 1.5); d.x = e.clientX; d.y = e.clientY; }
});
const release = e => {
  if (stick && stick.id === e.pointerId) stick = null;
  const d = drags.get(e.pointerId);
  drags.delete(e.pointerId);
  if (!d || e.type !== 'pointerup' || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > TAP_PX || performance.now() - d.t > TAP_MS) return;
  if (e.pointerType === 'touch') shootNow(); else cv.requestPointerLock?.(); // a click takes the mouse
};
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', release);

const KEYS = { w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
const held = new Set();
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (!inFps || paused() || e.metaKey || e.ctrlKey) return;
  if (KEYS[k]) { e.preventDefault(); held.add(k); }
  if (k === ' ') { e.preventDefault(); if (!jumpY) jumpV = JUMP_V; }
});
addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
addEventListener('blur', () => { held.clear(); if (me) me.guard = false; });

// Walking direction on the map from the keys (or the touch stick), relative to where I look.
function moveMe(dt) {
  let f = 0, r = 0;
  for (const k of held) { f += KEYS[k][1]; r += KEYS[k][0]; }
  if (stick) { f -= stick.dy; r += stick.dx; }
  const n = Math.hypot(f, r);
  if (n < 0.2) return;
  f /= Math.max(1, n); r /= Math.max(1, n);
  const s = Math.sin(yaw), c = Math.cos(yaw);
  const dx = -s * f + c * r, dy = -c * f - s * r, m = Math.hypot(dx, dy);
  walkMe(dx / m * Math.min(1, n), dy / m * Math.min(1, n), dt);
}

// Minimap (top right, first person only): streets and blocks, the objective ⚑, my squad (bright) and other allies, enemies in sight, the ⚐ spot I sent them to, and me as ▲.
const mini = document.getElementById('mini'), mg = mini.getContext('2d'), MINI = 8; // px per tile
mini.width = COLS * MINI; mini.height = ROWS * MINI;
const MINI_COLORS = { calle: '#3a3a3a', manzana: '#6b5a44', rio: '#1c3550' };
let miniT = 0;
function drawMini(now) {
  if (now - miniT < 100) return;
  miniT = now;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const t = grid[y][x];
    mg.fillStyle = MINI_COLORS[t] || TERRAIN[t].color;
    mg.fillRect(x * MINI, y * MINI, MINI, MINI);
  }
  mg.fillStyle = '#ffd54a'; mg.font = 'bold 11px system-ui'; mg.textAlign = 'center'; mg.textBaseline = 'middle';
  for (const o of objective()) mg.fillText('⚑', (o.x + 0.5) * MINI, (o.y + 0.5) * MINI);
  mg.fillStyle = '#8a6d48';
  for (const [x, y] of walls) mg.fillRect(x * MINI + 1, y * MINI + 3, MINI - 2, 2);
  for (const u of units) {
    if (u === me) continue;
    const foe = enemy(me, u);
    if (foe && !(dist(me, u) < SIGHT && sees(me, u)) && !units.some(o => !enemy(me, o) && o !== me && dist(o, u) < 4 && sees(o, u))) continue; // fog: enemies my side sees
    mg.fillStyle = foe ? '#ff4a3a' : u.squad ? '#7fd0ff' : '#3f6f8f'; // my squad bright, other allies dim
    mg.beginPath(); mg.arc((u.x + 0.5) * MINI, (u.y + 0.5) * MINI, u.hero ? 3.2 : 2.2, 0, 7); mg.fill();
  }
  if (order === 'ir' && dest) { mg.fillStyle = '#fff'; mg.fillText('⚐', (dest.x + 0.5) * MINI, (dest.y + 0.5) * MINI); }
  const cx = (me.x + 0.5) * MINI, cy = (me.y + 0.5) * MINI, a = Math.atan2(-Math.cos(yaw), -Math.sin(yaw)); // facing on the map (dx, dy) = (−sin, −cos)
  mg.save(); mg.translate(cx, cy); mg.rotate(a);
  mg.fillStyle = '#fff'; mg.strokeStyle = '#000'; mg.lineWidth = 1.5;
  mg.beginPath(); mg.moveTo(6, 0); mg.lineTo(-4, 4); mg.lineTo(-2, 0); mg.lineTo(-4, -4); mg.closePath(); mg.stroke(); mg.fill();
  mg.restore();
}

let lastT = 0;
renderer.setAnimationLoop(now => {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (fps() && !inFps) enterFps();
  if (!fps() && inFps) leaveFps();
  if (inFps) {
    me.moving = false;
    me.look = Math.atan2(-Math.sin(yaw), -Math.cos(yaw)); // where I face, as a unit's dir
    if (jumpV || jumpY) { jumpY = Math.max(0, jumpY + jumpV * dt); jumpV = jumpY ? jumpV - GRAVITY * dt : 0; }
    me.air = jumpY > 0.05;
    moveMe(dt);
    tick(dt);
  }
  for (const e of effects.splice(0)) (e.from ? pour : shotFx)(e);
  syncUnits(now);
  syncCrates();
  if (inFps) {
    const p = posOf(me);
    eyeY += (p.y + EYE - eyeY) * 0.2;
    camera.position.set(p.x, eyeY + jumpY + (me.moving && !jumpY ? Math.abs(Math.sin(now / 110)) * BOB : 0), p.z);
    camera.rotation.set(pitch, yaw, 0);
    syncHand(now);
    drawMini(now);
    document.getElementById('hurt').style.opacity = me.hitT > 0 ? me.hitT / 0.3 : 0;
  }
  hand.visible = inFps;
  for (let i = dying.length - 1; i >= 0; i--) {
    const { g, t0 } = dying[i], t = Math.min(1, (now - t0) / DEATH_MS);
    g.scale.setScalar((1 - t) * UNIT_SCALE);
    if (t === 1) { scene.remove(g); dying.splice(i, 1); }
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i], t = Math.min(1, (now - f.t0) / f.ms);
    f.objs.forEach((o, j) => { o.material.opacity = f.op[j] * (1 - t); if (f.grow) o.scale.setScalar(1 + f.grow * t); });
    if (t === 1) { scene.remove(...f.objs); f.objs.forEach(o => { o.geometry !== smokeGeo && o.geometry.dispose(); o.material.dispose(); }); fx.splice(i, 1); }
  }
  water.material.uniforms.time.value = now / 1800;
  if (!inFps) controls.update();
  renderer.render(scene, camera);
});

window.render3d = sync;
resize();
sync();
