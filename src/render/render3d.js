// 3D renderer (Three.js). Reads game state globals from src/engine/engine.js and calls onTap(x, y). GLBs from assets/ per MODELS, placeholder geometry otherwise.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Water } from 'three/addons/objects/Water.js';

const HEIGHT = { calle: 0, plaza: 0.03, recova: 0.03, manzana: 0.5, fuerte: 0.15, cabildo: 0.8, iglesia: 0.9, barranca: -0.25, rio: -0.5 };
const ROOF_VARIATION = 0.3;
const PALETTE = {
  calle: '#6b5a45', plaza: '#8f7f5c', recova: '#8f7f5c', fuerte: '#7f6a4c', cabildo: '#efe6cf',
  iglesia: '#d9cfb8', barranca: '#86704c', rio: '#7d6f55', // the river is brown, as in period engravings
};
const SKY = '#2e2620'; // dim room around the table
const WHITEWASH = ['#ece3cc', '#e2d5b8', '#d8c8a6', '#efe9da'];
// Colors from the uniform plates in data/ (Patricios, Pardos, Morenos, Naturales, Marineros, British line and rifles).
const UNIT_LOOK = {
  linea:     { coat: '#b8261c', legs: '#e8e4d8', hat: 'shako',   hatColor: '#151515', belts: true },
  rifle:     { coat: '#1f3d24', legs: '#1f3d24', hat: 'shako',   hatColor: '#151515' },
  soldado:   { coat: '#1e2d5a', legs: '#e8e4d8', hat: 'tophat',  hatColor: '#151515', plume: '#c8372d' },
  patricio:  { coat: '#1d2f5e', legs: '#e8e4d8', hat: 'tophat',  hatColor: '#151515', belts: true, plume: '#e8e4d8' },
  miliciano: { coat: ['#1d3f8a', '#b8261c', '#2a3f70'], legs: '#d8c9a3', hat: 'tophat', hatColor: '#1a1a1a', plume: '#c8372d' },
  minon:     { coat: '#2f5a33', legs: '#d8c9a3', hat: 'brim',    hatColor: '#1e2a1a' },
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
const SOLDIER_BASE = '#2f6fc0'; // base under the granadero model, blue
const MODEL_HEIGHT = 0.8;
const CAMERA_FOV = 45;
const TAP_PX = 10, TAP_MS = 500;
const MOVE_MS = 260, DEATH_MS = 400, HOP = 0.35;
const SHADOW_MAP = 2048;
const DIM_ACTED = 0.4;
const BASE_STAIN = 0.5; // faction color blended into the wood of figure bases

const cv = document.getElementById('map'), wrap = document.getElementById('wrap');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 35, 75);
const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight('#f4ecdc', '#5a4a36', 1.3));
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
const TABLE_Y = -1.62, frameMat = std('#3a2616', { roughness: 0.6 });
solid(COLS + 0.6, -1 - TABLE_Y, ROWS + 0.6, 0, (TABLE_Y - 1) / 2, 0, frameMat); // board, down to the table
// Wooden table the whole diorama rests on: planks with grain, knots and dark seams.
{
  const PLANK = 128, wood = canvasTex(1024, 1024, (g, w, h) => {
    for (let p = 0; p < h / PLANK; p++) {
      const y0 = p * PLANK, base = 0.85 + Math.random() * 0.3;
      g.fillStyle = `rgb(${142 * base | 0},${92 * base | 0},${54 * base | 0})`; g.fillRect(0, y0, w, PLANK);
      for (let i = 0; i < 70; i++) { // grain: long wavy streaks
        const y = y0 + Math.random() * PLANK, a = 1 + Math.random() * 3, f = 0.004 + Math.random() * 0.01, ph = Math.random() * 7;
        g.strokeStyle = `rgba(${Math.random() < 0.6 ? '60,30,10' : '220,170,110'},${0.08 + Math.random() * 0.18})`;
        g.lineWidth = 0.5 + Math.random() * 1.8;
        g.beginPath();
        for (let x = 0; x <= w; x += 16) g.lineTo(x, Math.min(y0 + PLANK - 2, Math.max(y0 + 2, y + Math.sin(x * f + ph) * a)));
        g.stroke();
      }
      for (let k = 0; k < (Math.random() < 0.6 ? 1 : 0); k++) { // knot with rings
        const kx = Math.random() * w, ky = y0 + 25 + Math.random() * (PLANK - 50);
        for (let r = 14; r > 1; r -= 3) { g.strokeStyle = `rgba(70,35,12,${0.25 + (14 - r) / 30})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(kx, ky, r * 2.2, r, 0, 0, 7); g.stroke(); }
      }
      g.fillStyle = 'rgba(25,12,5,.75)'; g.fillRect(0, y0, w, 3); // seam between planks
      const end = Math.random() * w; g.fillRect(end, y0, 3, PLANK); // butt joint
    }
    noise(g, w, h, 6000, 0.08);
  });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(4, 4);
  wood.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const TABLE = 80;
  const table = new THREE.Mesh(new THREE.PlaneGeometry(TABLE, TABLE).rotateX(-Math.PI / 2), std('#fff', { map: wood, roughness: 0.55 }));
  table.position.set(7, TABLE_Y, 0);
  table.receiveShadow = true;
  scene.add(table);
  const fw = wood.clone(); fw.repeat.set(1, 1); fw.needsUpdate = true;
  frameMat.map = fw; frameMat.color.set('#7a5638');
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
// River: reflective animated water as long as the board and as wide as it (COLS), over a muddy bed.
const RIVER_X0 = wx(15) - 0.5, RIVER_W = COLS, RIVER_D = ROWS + 0.6, WATER_Y = HEIGHT.rio - 0.02;
solid(RIVER_W, WATER_Y - 0.05 - TABLE_Y, RIVER_D, RIVER_X0 + RIVER_W / 2, (WATER_Y - 0.05 + TABLE_Y) / 2, 0, std('#3a2e20')).castShadow = false; // bed
// One frame around the whole diorama (land and river), same height and thickness on all four sides.
{
  const T = 0.3, TOP = 0.1, x0 = -COLS / 2, x1 = RIVER_X0 + RIVER_W, zh = ROWS / 2; // inner faces flush with the tiles
  const hgt = TOP - TABLE_Y, cy = (TOP + TABLE_Y) / 2, xm = (x0 + x1) / 2;
  for (const sx of [-1, 1]) solid(T, hgt, 2 * zh + 2 * T, sx < 0 ? x0 - T / 2 : x1 + T / 2, cy, 0, frameMat);
  for (const sz of [-1, 1]) solid(x1 - x0, hgt, T, xm, cy, sz * (zh + T / 2), frameMat);
}
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
  const REEDS = 160, reed = new THREE.ConeGeometry(0.025, 0.4, 4).translate(0, 0.2, 0);
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
const baseWood = canvasTex(256, 64, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w, a = 2 + Math.random() * 6;
    g.strokeStyle = `rgba(${Math.random() < 0.7 ? '60,35,15' : '255,230,190'},${0.1 + Math.random() * 0.25})`;
    g.lineWidth = 0.5 + Math.random() * 1.5; g.beginPath();
    for (let y = 0; y <= h; y += 4) g.lineTo(x + Math.sin(y * 0.15 + x) * a * 0.3, y);
    g.stroke();
  }
});
baseWood.wrapS = THREE.RepeatWrapping;
const UG = {
  // turned plinth: foot, cove, bevelled top (profile r, y)
  base: new THREE.LatheGeometry([[0, 0], [0.38, 0], [0.385, 0.012], [0.37, 0.02], [0.345, 0.028], [0.35, 0.04], [0.335, 0.05], [0.31, 0.055], [0, 0.055]].map(([x, y]) => new THREE.Vector2(x, y)), 40),
  inlay: new THREE.TorusGeometry(0.352, 0.006, 6, 48).rotateX(Math.PI / 2),
  body: new THREE.CylinderGeometry(0.12, 0.17, 0.38, 12),
  head: new THREE.SphereGeometry(0.1, 12, 8),
  shako: new THREE.CylinderGeometry(0.09, 0.1, 0.16, 10),
  bearskin: new THREE.CylinderGeometry(0.11, 0.12, 0.28, 10),
  brim: new THREE.CylinderGeometry(0.19, 0.19, 0.02, 16),
  crown: new THREE.CylinderGeometry(0.08, 0.09, 0.09, 10),
  bicorne: new THREE.BoxGeometry(0.34, 0.1, 0.1),
  tophat: new THREE.CylinderGeometry(0.1, 0.09, 0.2, 10),
  plume: new THREE.CylinderGeometry(0.02, 0.03, 0.14, 6),
  legs: new THREE.CylinderGeometry(0.15, 0.12, 0.14, 12),
  belt: new THREE.BoxGeometry(0.04, 0.4, 0.02),
  musket: new THREE.BoxGeometry(0.03, 0.56, 0.03),
};
const groups = new Map(), dying = [], models = {};

// Swap placeholders for the model once it loads; keep placeholders if it fails.
for (const url of new Set([...Object.values(MODELS), BRITISH_GLB, CRIOLLO_GLB])) new GLTFLoader().load(url, gltf => {
  const m = gltf.scene, box = new THREE.Box3().setFromObject(m), s = MODEL_HEIGHT / (box.max.y - box.min.y);
  m.scale.setScalar(s);
  const c = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
  m.position.set(-c.x, 0.05 - box.min.y * s, -c.z); // centered on the base
  models[url] = m;
  for (const [u, g] of groups) if (modelOf(u) === url) {
    const n = makeUnit(u);
    n.position.copy(g.position); n.rotation.copy(g.rotation); n.userData.anim = g.userData.anim;
    scene.remove(g); groups.set(u, n);
  }
}, undefined, e => console.error('model ' + url, e));

function makeUnit(u) {
  const look = UNIT_LOOK[u.t], g = new THREE.Group(), mats = [];
  const part = (geo, color, x, y, z) => {
    const m = std(color, { roughness: 0.7, transparent: true });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh); mats.push(m);
    return mesh;
  };
  const tone = modelOf(u) === SOLDIER_GLB ? SOLDIER_BASE : FACTIONS[u.f].color;
  const base = part(UG.base, new THREE.Color('#6b4a2e').lerp(new THREE.Color(tone), BASE_STAIN), 0, 0, 0);
  Object.assign(base.material, { map: baseWood, roughness: 0.4 });
  base.receiveShadow = true;
  const inlay = part(UG.inlay, tone, 0, 0.04, 0); // lacquered band in the faction's own color
  Object.assign(inlay.material, { roughness: 0.25, metalness: 0.3 });
  if (models[modelOf(u)]) {
    const m = models[modelOf(u)].clone();
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); o.material.transparent = true; mats.push(o.material); } });
    g.add(m);
  } else {
    const coat = Array.isArray(look.coat) ? look.coat[groups.size % look.coat.length] : look.coat || FACTIONS[u.f].color;
    part(UG.legs, look.legs, 0, 0.12, 0);
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
    const [map, a] = textTexture(PEOPLE[u.p].short, '#fff', '#000000b0');
    const name = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthWrite: false, transparent: true }));
    name.scale.set(NAME_SCALE * a, NAME_SCALE, 1);
    name.position.y = 1.18;
    name.renderOrder = 11;
    g.add(name); mats.push(name.material);
  }
  g.userData = { unit: u, mats, hp };
  g.traverse(o => { o.userData.unit = u; });
  scene.add(g);
  return g;
}

const posOf = u => new THREE.Vector3(wx(u.x), top[u.y][u.x], wz(u.y));

// --- highlights ---------------------------------------------------------------
const hl = new THREE.Group();
scene.add(hl);
const hlGeo = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
const hlMove = new THREE.MeshBasicMaterial({ color: '#4fa0ff', transparent: true, opacity: 0.45, depthWrite: false });
const hlHit = new THREE.MeshBasicMaterial({ color: '#ff3c3c', transparent: true, opacity: 0.55, depthWrite: false });
const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.48, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff' }));
scene.add(ring);

function mark(x, y, mat) {
  const m = new THREE.Mesh(hlGeo, mat);
  m.position.set(wx(x), top[y][x] + 0.03, wz(y));
  hl.add(m);
}

// Called by game.js draw() after every state change.
function sync() {
  showStreets(SC && SC.streets);
  const now = performance.now(), alive = new Set(units);
  for (const [u, g] of groups) if (!alive.has(u)) { groups.delete(u); dying.push({ g, t0: now }); }
  for (const u of units) {
    let g = groups.get(u);
    const to = posOf(u);
    if (!g) { g = makeUnit(u); g.position.copy(to); groups.set(u, g); }
    else if (!g.position.equals(to) && !(g.userData.anim && g.userData.anim.to.equals(to))) {
      g.userData.anim = { from: g.position.clone(), to, t0: now };
      g.rotation.y = Math.atan2(to.x - g.position.x, to.z - g.position.z);
    }
    const r = u.hp / TYPES[u.t].hp, d = g.userData;
    d.hp.scale.x = 0.5 * r;
    d.hp.material.color.set(r > 0.6 ? '#7f7' : r > 0.3 ? '#fd4' : '#f54');
    const op = u.f === ORDER[fi] && u.acted ? DIM_ACTED : 1;
    d.mats.forEach(m => { m.opacity = op * (m.userData.k ?? 1); });
  }
  hl.clear();
  if (reach) for (const k of reach) mark(k % COLS, Math.floor(k / COLS), hlMove);
  if (sel && !sel.acted) for (const o of targets(sel)) mark(o.x, o.y, hlHit);
}

// --- camera, input, loop ------------------------------------------------------
const controls = new OrbitControls(camera, cv);
controls.enableDamping = true;
controls.screenSpacePanning = false;
controls.maxPolarAngle = 1.3;
controls.minDistance = 5;
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

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = null;
cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
cv.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_PX || performance.now() - down.t > TAP_MS) return;
  down = null;
  const r = cv.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([...groups.values(), ...pickables], true)[0];
  if (!hit) return;
  const u = hit.object.userData.unit;
  if (u) onTap(u.x, u.y);
  else onTap(hit.object.userData.x, hit.object.userData.y);
});

renderer.setAnimationLoop(now => {
  for (const g of groups.values()) {
    const a = g.userData.anim;
    if (!a) continue;
    const t = Math.min(1, (now - a.t0) / MOVE_MS);
    g.position.lerpVectors(a.from, a.to, t);
    g.position.y += Math.sin(Math.PI * t) * HOP;
    if (t === 1) g.userData.anim = null;
  }
  for (let i = dying.length - 1; i >= 0; i--) {
    const { g, t0 } = dying[i], t = Math.min(1, (now - t0) / DEATH_MS);
    g.scale.setScalar(1 - t);
    if (t === 1) { scene.remove(g); dying.splice(i, 1); }
  }
  const s = sel && groups.get(sel);
  ring.visible = !!s;
  if (s) ring.position.set(s.position.x, s.position.y + 0.06, s.position.z);
  water.material.uniforms.time.value = now / 1800;
  controls.update();
  renderer.render(scene, camera);
});

window.render3d = sync;
resize();
sync();
