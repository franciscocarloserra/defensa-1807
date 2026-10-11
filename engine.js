// Engine: game state, movement, combat, turns, HUD (header, bar, overlay). Depends on rules.js and story.js.
// Rendering lives in render3d.js (ES module): it sets window.render3d and calls onTap(x, y).

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const $ = id => document.getElementById(id);

let SC, ORDER, units = [], turn, fi = 0, sel, reach, over = true;

const enemy = (a, b) => SC.sides[a.f] !== SC.sides[b.f];
const unitAt = (x, y) => units.find(u => u.x === x && u.y === y);
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const targets = u => units.filter(o => enemy(u, o) && dist(u, o) <= TYPES[u.t].rng);
const unitName = u => u.p ? PEOPLE[u.p].short : TYPES[u.t].name;

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

function newGame(sc = SC) {
  SC = sc; ORDER = sc.order;
  units = sc.setup.map(([f, t, x, y, p]) => ({ f, t, x, y, p, hp: TYPES[t].hp, moved: false, acted: false }));
  turn = 1; fi = 0; sel = null; reach = null; over = false;
  bar('');
  announce();
}

// --- overlay ------------------------------------------------------------------
// buttons: [[label, fn?, disabled?], ...]; every button closes the overlay before running fn.
function overlay(html, buttons = [['Continuar']], doc = false) {
  $('ovtext').innerHTML = html;
  $('ovtext').classList.toggle('doc', doc);
  $('ovtext').scrollTop = 0;
  $('ovbtns').replaceChildren(...buttons.map(([label, fn, off]) => {
    const b = document.createElement('button');
    b.innerHTML = label;
    b.disabled = !!off;
    b.onclick = () => { $('overlay').classList.add('hidden'); fn && fn(); };
    return b;
  }));
  $('overlay').classList.remove('hidden');
}

const srcs = list => `<p class="src">Fuente: ${list.map(s => `data/${s}`).join(', ')}</p>`;

function menu() {
  const back = over ? [] : [['Volver a la partida']];
  overlay(`<h2>Buenos Aires 1806–1810</h2><p>Invasiones Inglesas y Revolución de Mayo en el casco histórico.<br>Elegí un episodio.</p>`, [
    ...SCENARIOS.map(s => [`<b>${s.title}</b> · ${s.date}${s.locked ? ' (sin fuentes)' : ''}`, () => intro(s)]),
    ['Protagonistas', people], ['Cronología', timeline], ...back,
  ]);
}

function intro(s) {
  const sides = s.locked ? '' : `<p>${s.order.map(f => `<b style="color:${FACTIONS[f].color}">${FACTIONS[f].name}</b>`).join(' · ')}</p><p>${s.help}</p>`;
  overlay(`<h2>${s.title}</h2><p class="date">${s.date}</p><p>${s.intro}</p>${sides}${srcs(s.src)}`,
    s.locked ? [['Volver', menu]] : [['Jugar', () => newGame(s)], ['Volver', menu]], true);
}

function card(title, sub, text, src, back) {
  overlay(`<h2>${title}</h2>${sub ? `<p class="date">${sub}</p>` : ''}<p>${text}</p>${srcs(src)}`, [[back ? 'Volver' : 'Cerrar', back]], true);
}

function people() {
  overlay(`<h2>Protagonistas</h2>` + Object.values(PEOPLE).map(p =>
    `<h3>${p.name}${p.years ? ` <small>(${p.years})</small>` : ''}</h3><p class="date">${p.role}</p><p>${p.text}</p>`).join('') +
    srcs([...new Set(Object.values(PEOPLE).flatMap(p => p.src))]), [['Volver', menu]], true);
}

function timeline() {
  let year = '';
  overlay(`<h2>Cronología</h2>` + TIMELINE.map(([y, d, t]) =>
    (y !== year ? `<h3>${year = y}</h3>` : '') + `<p><b>${d}.</b> ${t}</p>`).join('') +
    srcs([...new Set(TIMELINE.map(r => r[3]))]), [['Volver', menu]], true);
}

// --- turns --------------------------------------------------------------------
function announce() {
  const f = FACTIONS[ORDER[fi]];
  $('turn').innerHTML = `${SC.id} · T${turn}/${SC.turns} · <span style="color:${f.color}">${f.name}</span>`;
  overlay(`Turno ${turn}<br><b style="color:${f.color};font-size:22px">${f.name}</b>`);
  draw();
}

function finish(side, why) {
  over = true;
  draw();
  overlay(`<b style="font-size:20px">${SC.sideNames[side]} ganan: ${why}</b>`, [['Jugar de nuevo', () => newGame()], ['Episodios', menu]]);
}

function bar(html) { $('bar').innerHTML = html; }

// Bar text for a tile; names of people and places open their card.
function describe(x, y) {
  const t = TERRAIN[grid[y][x]], u = unitAt(x, y), place = placeAt(x, y);
  let s = `${place && PLACES[place] ? `<a data-place="${place}">${place}</a>` : place || t.name}${t.def ? ` · def +${t.def * 100}%` : ''}`;
  if (u) {
    const ty = TYPES[u.t], name = u.p ? `<a data-person="${u.p}">${PEOPLE[u.p].short}</a>` : ty.name;
    s = `<span style="color:${FACTIONS[u.f].color}">${name}</span> ${u.hp}/${ty.hp} · ataque ${ty.atk} · alcance ${ty.rng}<br>` + s;
  }
  bar(s);
}

$('bar').onclick = e => {
  const a = e.target.closest('a');
  if (!a) return;
  if (a.dataset.person) { const p = PEOPLE[a.dataset.person]; card(p.name, p.role, p.text, p.src); }
  else { const p = PLACES[a.dataset.place]; card(a.dataset.place, '', p.text, p.src); }
};

function attack(a, d) {
  const def = TERRAIN[grid[d.y][d.x]].def;
  const dmg = Math.max(1, Math.round(TYPES[a.t].atk * (1 - def) * (1 + (Math.random() * 2 - 1) * DMG_SPREAD)));
  d.hp -= dmg;
  a.moved = a.acted = true;
  let msg = `${unitName(a)} → ${unitName(d)}: −${dmg}`;
  if (d.hp <= 0) { units = units.filter(u => u !== d); msg += ` (${SC.loss || 'baja'})`; }
  sel = null; reach = null;
  bar(msg);
  draw();
  const left = new Set(units.map(u => SC.sides[u.f]));
  if (left.size === 1) finish([...left][0], SC.loss ? 'adversarios dispersados.' : 'fuerzas enemigas rendidas.');
}

// A side takes a terrain when it has a unit on it and the other side has none.
const takes = (side, t) => {
  const on = units.filter(u => grid[u.y][u.x] === t);
  return on.length && on.every(u => SC.sides[u.f] === side);
};

function endTurn() {
  if (over) return;
  const { side, at } = SC.take;
  if (SC.sides[ORDER[fi]] === side && at.every(t => takes(side, t)))
    return finish(side, `${at.map(t => TERRAIN[t].name).join(' y ')} tomado${at.length > 1 ? 's' : ''}.`);
  units.forEach(u => { u.moved = u.acted = false; });
  sel = null; reach = null;
  fi = (fi + 1) % ORDER.length;
  if (fi === 0 && ++turn > SC.turns) return finish(SC.holdOut, `resistieron ${SC.turns} turnos.`);
  bar('');
  announce();
}

function onTap(x, y) {
  if (over) return describe(x, y);
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
$('menu').onclick = menu;
$('help').onclick = () => overlay((SC ? `<p>${SC.help}</p>` : '') + `<p>${HELP_CONTROLS}</p>`, [['Cerrar']]);
$('turn').textContent = 'Buenos Aires 1806–1810';
// Deep link for QA: #1806, #1807, #1809 start that episode directly.
const deep = SCENARIOS.find(s => '#' + s.id === location.hash && !s.locked);
if (deep) { newGame(deep); $('overlay').classList.add('hidden'); } else menu();
