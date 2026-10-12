// 3D renderer (Three.js). Reads game state globals from src/engine/engine.js and calls onTap(x, y). GLBs from assets/ per MODELS, placeholder geometry otherwise.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const HEIGHT = { calle: 0, plaza: 0.03, recova: 0.03, manzana: 0.5, fuerte: 0.15, cabildo: 0.8, iglesia: 0.9, barranca: -0.25, rio: -0.5 };
const ROOF_VARIATION = 0.3;
const PALETTE = {
  calle: '#6b5a45', plaza: '#8f7f5c', recova: '#8f7f5c', fuerte: '#7f6a4c', cabildo: '#efe6cf',
  iglesia: '#d9cfb8', barranca: '#6f7a45', rio: '#7d6f55', // the river is brown, as in period engravings
};
const SKY = '#c7cdc9';
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
// granadero.glb is anachronistic (Granaderos a Caballo date from 1812); it stands in for Patricios
// until their own model exists, then gets replaced.
const MODELS = { patricio: 'assets/granadero.glb' };
const MODEL_HEIGHT = 0.8;
const CAMERA_FOV = 45;
const TAP_PX = 10, TAP_MS = 500;
const MOVE_MS = 260, DEATH_MS = 400, HOP = 0.35;
const SHADOW_MAP = 2048;
const DIM_ACTED = 0.4;

const cv = document.getElementById('map'), wrap = document.getElementById('wrap');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 30, 70);
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
const mats = Object.fromEntries(Object.entries(PALETTE).map(([k, c]) => [k, std(c, { map: groundTex })]));
mats.rio = std(PALETTE.rio, { roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.92 });
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
solid(COLS + 0.6, 0.5, ROWS + 0.6, 0, -1.25, 0, std('#2a2018'));

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
  solid(0.12, 2.2, 0.12, cx, 1.1, cz, std('#4a3320'));
  const flag = canvasTex(48, 32, (g, w, h) => { g.fillStyle = '#b8261c'; g.fillRect(0, 0, w, h); g.fillStyle = '#e3b53a'; g.fillRect(0, h / 4, w, h / 2); });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.5), new THREE.MeshStandardMaterial({ map: flag, side: THREE.DoubleSide }));
  f.position.set(cx + 0.42, 1.95, cz);
  scene.add(f);
}
// Ships at anchor in the river, as in the engravings.
for (const [sx, sz, r] of [[17.6, -8, 0.3], [18.8, -2, -0.2], [17.4, 4, 0.1], [19.2, 9, 0.4]]) {
  const ship = new THREE.Group(), wood = std('#4a3320'), sail = std('#efe9da', { side: THREE.DoubleSide });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 2.4), wood); hull.position.y = 0.05; ship.add(hull);
  for (const [z, h] of [[-0.7, 2], [0.1, 2.5], [0.8, 1.8]]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, h, 6), wood); mast.position.set(0, h / 2, z); ship.add(mast);
    for (const k of [0.45, 0.75]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * k + 0.2, h * 0.28), sail); s.position.set(0, h * k, z + 0.05); s.rotation.y = Math.PI / 2; ship.add(s); }
  }
  ship.traverse(o => { o.castShadow = true; });
  ship.position.set(sx - COLS / 2, HEIGHT.rio, sz); ship.rotation.y = r;
  scene.add(ship);
}
// Wider river beyond the board, out to the horizon.
solid(40, 0.1, 80, wx(15) + 20.5, HEIGHT.rio - 0.06, 0, mats.rio).castShadow = false;
// Cabildo tower on the plaza side; church towers and the cathedral dome.
function tower(x, z, base, h, mat) {
  solid(0.4, h, 0.4, x, base + h / 2, z, mat);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.4, 4), mat);
  cap.position.set(x, base + h + 0.2, z);
  cap.rotation.y = Math.PI / 4;
  cap.castShadow = true;
  scene.add(cap);
}
{
  const [cx, cz] = center(rect('Cabildo'));
  tower(cx + 0.85, cz, HEIGHT.cabildo, 1.1, mats.cabildo);
  for (const n of ['S. Francisco', 'S. Domingo']) {
    const [, , x0, y0] = rect(n);
    tower(wx(x0) - 0.3, wz(y0) - 0.3, HEIGHT.iglesia, 1.0, mats.iglesia);
  }
  const [dx, dz] = center(rect('Catedral'));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std('#b9ad94'));
  dome.position.set(dx, HEIGHT.iglesia, dz);
  dome.castShadow = true;
  scene.add(dome);
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
for (const l of LANDMARKS) if (l[1]) {
  const [map, a] = textTexture(l[1], '#f3ead6', '#000000a0'), [cx, cz] = center(l);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthWrite: false }));
  s.scale.set(0.42 * a, 0.42, 1);
  s.position.set(cx, HEIGHT[l[0]] + 1.9, cz);
  s.renderOrder = 10;
  scene.add(s);
}
{
  const [map, a] = textTexture('Río de la Plata', '#ffffff80');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * a, 0.5), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
  m.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  m.position.set(wx(15.5), HEIGHT.rio + 0.02, 0);
  scene.add(m);
}

// --- units ------------------------------------------------------------------
const UG = {
  base: new THREE.CylinderGeometry(0.36, 0.36, 0.05, 24),
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
for (const [t, url] of Object.entries(MODELS)) new GLTFLoader().load(url, gltf => {
  const m = gltf.scene, box = new THREE.Box3().setFromObject(m), s = MODEL_HEIGHT / (box.max.y - box.min.y);
  m.scale.setScalar(s);
  m.position.y = 0.05 - box.min.y * s;
  models[t] = m;
  for (const [u, g] of groups) if (u.t === t) {
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
  part(UG.base, FACTIONS[u.f].color, 0, 0.025, 0);
  if (models[u.t]) {
    const m = models[u.t].clone();
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
    d.mats.forEach(m => { m.opacity = op; });
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
  controls.update();
  renderer.render(scene, camera);
});

window.render3d = sync;
resize();
sync();
