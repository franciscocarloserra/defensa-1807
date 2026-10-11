// Engine: game state, movement, combat, turns, HUD (header, bar, overlay). Depends on rules.js.
// Rendering lives in render3d.js (ES module): it sets window.render3d and calls onTap(x, y).

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const $ = id => document.getElementById(id);

let units, turn, fi, sel, reach, over;

const unitAt = (x, y) => units.find(u => u.x === x && u.y === y);
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

function draw() { if (window.render3d) window.render3d(); }

$('end').onclick = endTurn;
$('help').onclick = () => overlay(HELP, 'Cerrar');
newGame();
