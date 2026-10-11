// 3D renderer (Three.js). Reads game state globals from game.js and calls onTap(x, y). Placeholder geometry only.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const HEIGHT = { calle: 0, plaza: 0.03, recova: 0.03, manzana: 0.45, fuerte: 0.15, cabildo: 0.8, iglesia: 0.9, barranca: -0.25, rio: -0.5 };
const ROOF_VARIATION = 0.3;
const PALETTE = {
  calle: '#6b5a45', plaza: '#8f7f5c', recova: '#8f7f5c', fuerte: '#7f6a4c', cabildo: '#efe6cf',
  iglesia: '#d9cfb8', barranca: '#56703f', rio: '#2a5576',
};
const WHITEWASH = ['#ece3cc', '#e2d5b8', '#d8c8a6', '#efe9da'];
const UNIT_LOOK = {
  linea:     { coat: '#b8261c', hat: 'shako',    hatColor: '#151515' },
  rifle:     { coat: '#1f3d24', hat: 'shako',    hatColor: '#151515' },
  granadero: { coat: '#1d3f8a', hat: 'bearskin', hatColor: '#1a1a1a' },
  miliciano: { coat: '#c9b98f', hat: 'brim',     hatColor: '#5a3b1e' },
};
const CAMERA_FOV = 45;
const TAP_PX = 10, TAP_MS = 500;
const MOVE_MS = 260, DEATH_MS = 400, HOP = 0.35;
const SHADOW_MAP = 2048;
const DIM_ACTED = 0.4;

const cv = document.getElementById('map'), wrap = document.getElementById('wrap');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#15171d');
scene.fog = new THREE.Fog('#15171d', 35, 75);
const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight('#ffe9cc', '#3a2a1a', 1.1));
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
const mats = Object.fromEntries(Object.entries(PALETTE).map(([k, c]) => [k, std(c)]));
mats.rio = std(PALETTE.rio, { roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9 });
const washMats = WHITEWASH.map(c => std(c));
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
// Fuerte: low walls and corner bastions around the patio.
{
  const [, , x0, y0, x1, y1] = rect('Fuerte'), [cx, cz] = center(rect('Fuerte'));
  const w = x1 - x0 + 1, d = y1 - y0 + 1, wall = std('#8d7556'), H = 0.7;
  solid(w, H, 0.14, cx, H / 2, wz(y0) - 0.5, wall);
  solid(w, H, 0.14, cx, H / 2, wz(y1) + 0.5, wall);
  solid(0.14, H, d, wx(x0) - 0.5, H / 2, cz, wall);
  solid(0.14, H, d, wx(x1) + 0.5, H / 2, cz, wall);
  for (const bx of [wx(x0) - 0.5, wx(x1) + 0.5]) for (const bz of [wz(y0) - 0.5, wz(y1) + 0.5])
    solid(0.5, H + 0.1, 0.5, bx, (H + 0.1) / 2, bz, wall).rotation.y = Math.PI / 4;
}
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
}
for (const [x, n] of Object.entries(STREETS_X)) groundText(n, wx(+x), wz(19.5), Math.PI / 2);
for (const [y, n] of Object.entries(STREETS_Y)) groundText(n, wx(1.5), wz(+y), 0);
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
  musket: new THREE.BoxGeometry(0.03, 0.56, 0.03),
};
const groups = new Map(), dying = [];

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
  part(UG.body, look.coat, 0, 0.24, 0);
  part(UG.head, '#e0b48c', 0, 0.52, 0);
  if (look.hat === 'brim') { part(UG.brim, look.hatColor, 0, 0.6, 0); part(UG.crown, look.hatColor, 0, 0.65, 0); }
  else part(UG[look.hat], look.hatColor, 0, look.hat === 'shako' ? 0.66 : 0.72, 0);
  part(UG.musket, '#4a3320', 0.19, 0.33, 0).rotation.z = -0.15;
  const hpBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#000' }));
  const hp = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#7f7' }));
  for (const s of [hpBg, hp]) { s.center.set(0, 0.5); s.scale.set(0.5, 0.06, 1); s.position.set(-0.25, 0.98, 0); g.add(s); }
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
