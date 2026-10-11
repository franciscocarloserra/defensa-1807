// Defensa 1807 — turn-based PoC, hotseat, no images.
// Map is schematic: 1 street tile + 2x2 tiles per block. Positions approximate, pending period maps.

const COLS = 17, ROWS = 22;
const TURN_LIMIT = 20;
const DMG_SPREAD = 0.2; // ±20% random damage

const TERRAIN = {
  calle:    { name: 'Calle',    cost: 1, def: 0,    color: '#3b3b3b' },
  manzana:  { name: 'Azotea',   cost: 2, def: 0.4,  color: '#5b4733', roof: true },
  plaza:    { name: 'Plaza',    cost: 1, def: 0,    color: '#6e6449' },
  recova:   { name: 'Recova',   cost: 1, def: 0.25, color: '#8a6d48' },
  fuerte:   { name: 'Fuerte',   cost: 1, def: 0.5,  color: '#7d5b39' },
  cabildo:  { name: 'Cabildo',  cost: 1, def: 0.4,  color: '#b39a62' },
  iglesia:  { name: 'Iglesia',  cost: 1, def: 0.4,  color: '#8c7b6b' },
  barranca: { name: 'Barranca', cost: 2, def: 0.2,  color: '#465639' },
  rio:      { name: 'Río',      cost: Infinity, def: 0, color: '#1c3550' },
};

// [terrain, label, x0, y0, x1, y1]
const LANDMARKS = [
  ['plaza', '', 7, 4, 11, 5],
  ['recova', '', 9, 4, 9, 5],
  ['fuerte', 'Fuerte', 13, 3, 14, 6],
  ['cabildo', 'Cabildo', 4, 4, 5, 5],
  ['iglesia', 'Catedral', 7, 1, 8, 2],
  ['iglesia', 'S. Francisco', 7, 10, 8, 11],
  ['iglesia', 'S. Domingo', 10, 16, 11, 17],
];

// Modern names, for orientation only (several were renamed after 1807).
const STREETS_X = { 0: 'Chacabuco', 3: 'Perú', 6: 'Bolívar', 9: 'Defensa', 12: 'Balcarce' };
const STREETS_Y = { 0: 'Mitre', 3: 'Rivadavia', 6: 'Yrigoyen', 9: 'Alsina', 12: 'Moreno', 15: 'Belgrano', 18: 'Venezuela', 21: 'México' };

const FACTIONS = {
  ing: { name: 'Ingleses',   color: '#c8372d' },
  gra: { name: 'Granaderos', color: '#2f6fc0' },
  cri: { name: 'Criollos',   color: '#d9b84a' },
};
const ORDER = ['ing', 'gra', 'cri'];

const TYPES = {
  linea:     { name: 'Infantería', hp: 10, mv: 3, rng: 1, atk: 4, ch: 'I' },
  rifle:     { name: 'Rifles',     hp: 7,  mv: 3, rng: 3, atk: 3, ch: 'R' },
  granadero: { name: 'Granadero',  hp: 9,  mv: 3, rng: 2, atk: 4, ch: 'G' },
  miliciano: { name: 'Miliciano',  hp: 6,  mv: 3, rng: 2, atk: 3, ch: 'M', roof: true },
};

const SETUP = [
  ['ing', 'linea', 3, 21], ['ing', 'linea', 6, 21], ['ing', 'linea', 9, 21], ['ing', 'linea', 12, 21],
  ['ing', 'linea', 0, 6], ['ing', 'linea', 0, 15], ['ing', 'rifle', 0, 9], ['ing', 'rifle', 0, 12],
  ['gra', 'granadero', 13, 4], ['gra', 'granadero', 14, 5], ['gra', 'granadero', 8, 4], ['gra', 'granadero', 10, 5],
  ['cri', 'miliciano', 5, 7], ['cri', 'miliciano', 7, 7], ['cri', 'miliciano', 10, 10], ['cri', 'miliciano', 8, 13], ['cri', 'miliciano', 10, 14],
];

const HELP = `Ingleses entran por el sur y el oeste.<br>
Ganan si al cerrar su turno ocupan Fuerte y Cabildo.<br>
Granaderos y Criollos ganan resistiendo ${TURN_LIMIT} turnos o rindiendo a todos.<br><br>
Tocá una unidad: azul = mover, rojo = atacar.<br>
Solo los Milicianos suben a las azoteas (defensa +40%).`;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const $ = id => document.getElementById(id);
const cv = $('map'), ctx = cv.getContext('2d');
const key = (x, y) => y * COLS + x;

const grid = [];
for (let y = 0; y < ROWS; y++) {
  grid.push([]);
  for (let x = 0; x < COLS; x++) {
    grid[y].push(x >= 15 ? 'rio' : x >= 13 ? 'barranca' : (x % 3 === 0 || y % 3 === 0) ? 'calle' : 'manzana');
  }
}
for (const [t, , x0, y0, x1, y1] of LANDMARKS)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y][x] = t;

let units, turn, fi, sel, reach, over, tile = 20;

const unitAt = (x, y) => units.find(u => u.x === x && u.y === y);
const enemy = (a, b) => (a.f === 'ing') !== (b.f === 'ing');
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const targets = u => units.filter(o => enemy(u, o) && dist(u, o) <= TYPES[u.t].rng);

function reachable(u) {
  const mv = TYPES[u.t].mv, best = new Map([[key(u.x, u.y), 0]]), q = [[u.x, u.y, 0]], out = new Set();
  while (q.length) {
    q.sort((a, b) => a[2] - b[2]);
    const [x, y, c] = q.shift();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const t = TERRAIN[grid[ny][nx]];
      if (t.roof && !TYPES[u.t].roof) continue;
      const nc = c + t.cost, k = key(nx, ny);
      if (nc > mv || (best.has(k) && best.get(k) <= nc)) continue;
      const o = unitAt(nx, ny);
      if (o && enemy(u, o)) continue;
      best.set(k, nc);
      q.push([nx, ny, nc]);
      if (!o) out.add(k);
    }
  }
  return out;
}

function newGame() {
  units = SETUP.map(([f, t, x, y]) => ({ f, t, x, y, hp: TYPES[t].hp, moved: false, acted: false }));
  turn = 1; fi = 0; sel = null; reach = null; over = false;
  bar('');
  announce();
}

function overlay(html, btn, fn) {
  $('ovtext').innerHTML = html;
  $('ovbtn').textContent = btn;
  $('ovbtn').onclick = () => { $('overlay').classList.add('hidden'); fn && fn(); };
  $('overlay').classList.remove('hidden');
}

function announce() {
  const f = FACTIONS[ORDER[fi]];
  $('turn').innerHTML = `T${turn}/${TURN_LIMIT} · <span style="color:${f.color}">${f.name}</span>`;
  overlay(`Turno ${turn}<br><b style="color:${f.color};font-size:22px">${f.name}</b>`, 'Continuar');
  draw();
}

function finish(msg) {
  over = true;
  draw();
  overlay(`<b style="font-size:20px">${msg}</b>`, 'Nueva partida', newGame);
}

function bar(html) { $('bar').innerHTML = html; }

function describe(x, y) {
  const t = TERRAIN[grid[y][x]], u = unitAt(x, y);
  let s = `${t.name}${t.def ? ` · def +${t.def * 100}%` : ''}`;
  if (u) {
    const ty = TYPES[u.t];
    s = `<span style="color:${FACTIONS[u.f].color}">${ty.name}</span> ${u.hp}/${ty.hp} · ataque ${ty.atk} · alcance ${ty.rng}<br>` + s;
  }
  bar(s);
}

function attack(a, d) {
  const def = TERRAIN[grid[d.y][d.x]].def;
  const dmg = Math.max(1, Math.round(TYPES[a.t].atk * (1 - def) * (1 + (Math.random() * 2 - 1) * DMG_SPREAD)));
  d.hp -= dmg;
  a.moved = a.acted = true;
  let msg = `${TYPES[a.t].name} → ${TYPES[d.t].name}: −${dmg}`;
  if (d.hp <= 0) { units = units.filter(u => u !== d); msg += ' (baja)'; }
  sel = null; reach = null;
  bar(msg);
  draw();
  if (!units.some(u => u.f === 'ing')) finish('Defensores ganan: invasores rendidos.');
  else if (!units.some(u => u.f !== 'ing')) finish('Ingleses ganan: defensa aniquilada.');
}

const holds = t => units.some(u => u.f === 'ing' && grid[u.y][u.x] === t);

function endTurn() {
  if (over) return;
  if (ORDER[fi] === 'ing' && holds('fuerte') && holds('cabildo')) return finish('Ingleses ganan: Fuerte y Cabildo tomados.');
  units.forEach(u => { u.moved = u.acted = false; });
  sel = null; reach = null;
  fi = (fi + 1) % ORDER.length;
  if (fi === 0 && ++turn > TURN_LIMIT) return finish('Defensores ganan: la ciudad resistió.');
  bar('');
  announce();
}

function onTap(x, y) {
  if (over) return;
  const u = unitAt(x, y);
  if (sel) {
    if (u && enemy(sel, u) && !sel.acted && targets(sel).includes(u)) return attack(sel, u);
    if (!u && reach && reach.has(key(x, y))) {
      sel.x = x; sel.y = y; sel.moved = true; reach = null;
      if (!targets(sel).length) { sel.acted = true; sel = null; }
      describe(x, y);
      return draw();
    }
  }
  if (u && u.f === ORDER[fi] && !u.acted) {
    sel = u;
    reach = u.moved ? null : reachable(u);
  } else {
    sel = null; reach = null;
  }
  describe(x, y);
  draw();
}

function resize() {
  const w = $('wrap').clientWidth - 8, h = $('wrap').clientHeight - 8;
  tile = Math.max(8, Math.floor(Math.min(w / COLS, h / ROWS)));
  const dpr = devicePixelRatio || 1;
  cv.width = COLS * tile * dpr; cv.height = ROWS * tile * dpr;
  cv.style.width = COLS * tile + 'px'; cv.style.height = ROWS * tile + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function text(s, x, y, size, color, rot = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = `${size}px system-ui,sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

function draw() {
  if (!units) return;
  const T = tile;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    ctx.fillStyle = TERRAIN[grid[y][x]].color;
    ctx.fillRect(x * T, y * T, T, T);
    ctx.strokeStyle = '#0003';
    ctx.strokeRect(x * T + 0.5, y * T + 0.5, T - 1, T - 1);
  }
  const small = Math.max(7, T * 0.38);
  for (const [x, n] of Object.entries(STREETS_X)) text(n, (+x + 0.5) * T, 19.5 * T, small, '#fff6', -Math.PI / 2);
  for (const [y, n] of Object.entries(STREETS_Y)) text(n, 1.5 * T, (+y + 0.5) * T, small, '#fff6');
  for (const [, label, x0, y0, x1, y1] of LANDMARKS)
    if (label) text(label, (x0 + x1 + 1) / 2 * T, (y0 + y1 + 1) / 2 * T, Math.max(7, T * 0.42), '#000b', x1 - x0 < y1 - y0 ? -Math.PI / 2 : 0);
  text('Río de la Plata', 16 * T, 14 * T, small, '#fff5', -Math.PI / 2);

  if (reach) for (const k of reach) {
    ctx.fillStyle = '#4fa0ff59';
    ctx.fillRect((k % COLS) * T, Math.floor(k / COLS) * T, T, T);
  }
  if (sel && !sel.acted) for (const o of targets(sel)) {
    ctx.fillStyle = '#ff3c3c73';
    ctx.fillRect(o.x * T, o.y * T, T, T);
  }

  const mine = ORDER[fi];
  for (const u of units) {
    const cx = (u.x + 0.5) * T, cy = (u.y + 0.5) * T, ty = TYPES[u.t];
    ctx.globalAlpha = u.f === mine && u.acted ? 0.45 : 1;
    ctx.beginPath(); ctx.arc(cx, cy, T * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = FACTIONS[u.f].color; ctx.fill();
    ctx.lineWidth = u === sel ? 2.5 : 1; ctx.strokeStyle = u === sel ? '#fff' : '#000a'; ctx.stroke();
    text(ty.ch, cx, cy, T * 0.5, '#fff');
    ctx.fillStyle = '#000'; ctx.fillRect(u.x * T + 2, (u.y + 1) * T - 4, T - 4, 3);
    ctx.fillStyle = '#7f7'; ctx.fillRect(u.x * T + 2, (u.y + 1) * T - 4, (T - 4) * u.hp / ty.hp, 3);
    ctx.globalAlpha = 1;
  }
}

cv.addEventListener('pointerup', e => {
  const r = cv.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / tile), y = Math.floor((e.clientY - r.top) / tile);
  if (x >= 0 && y >= 0 && x < COLS && y < ROWS) onTap(x, y);
});
$('end').onclick = endTurn;
$('help').onclick = () => overlay(HELP, 'Cerrar');
addEventListener('resize', resize);
newGame();
resize();
