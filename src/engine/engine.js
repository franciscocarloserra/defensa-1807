// Engine: real-time game state, my protagonist, CPU troops, combat, HUD (header, bar, overlay). Depends on src/rules/rules.js and src/rules/story.js.
// Rendering lives in src/render/render3d.js (ES module): every frame it calls tick(dt), walkMe() with W A S D, and fire() on click.
// Positions are in tiles, as floats (x right, y down the map).

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const $ = id => document.getElementById(id);

let SC, units = [], over = true, effects = [], drops = [], walls = []; // walls: barricades [x, y]
let MINE, me = null, order = 'atacar', clock = 0, takeT = 0, game = 0; // MINE: side the player chose; me: my ★
let HEROES = {};

const enemy = (a, b) => SC.sides[a.f] !== SC.sides[b.f];
const sideOf = u => SC.sides[u.f];
const stat = (u, k) => TYPES[u.t][k] + (u.hero ? HERO[k] || 0 : 0);
const arms = u => u.arms || ARMS[u.t] || (u.f === 'ing' ? ARMS_ING : ARMS_CITY);
const reach = (u, w = u.w) => WEAPONS[w].reach ?? 4 + 1.5 * TYPES[u.t].rng;
const tileOf = u => [Math.round(u.x), Math.round(u.y)];
const terrainOf = u => { const [x, y] = tileOf(u); return grid[y][x]; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unitName = u => (u.hero ? '★ ' : '') + (u.p ? PEOPLE[u.p].short : TYPES[u.t].name);
const isTunnel = (x, y) => TUNNELS.some(([a, b]) => a === x && b === y);
const atWall = u => walls.some(([x, y]) => Math.hypot(u.x - x, u.y - y) < 0.6);
const slowed = u => sideOf(u) !== SC.holdOut && atWall(u) && !u.air; // jumping clears it // the side that built them crosses freely
const passable = (u, x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && TERRAIN[grid[y][x]].cost !== Infinity && (!TERRAIN[grid[y][x]].roof || TYPES[u.t].roof || u.roof);

// Line of sight: roofs in between block it (the tiles at both ends don't, so azoteas shoot and get shot). Roof to roof always sees.
function sees(a, b) {
  const [ax, ay] = tileOf(a), [bx, by] = tileOf(b);
  if (TERRAIN[grid[ay][ax]].roof && TERRAIN[grid[by][bx]].roof) return true;
  const n = Math.ceil(dist(a, b) * 4);
  for (let i = 1; i < n; i++) {
    const x = Math.round(a.x + (b.x - a.x) * i / n), y = Math.round(a.y + (b.y - a.y) * i / n);
    if ((x !== ax || y !== ay) && (x !== bx || y !== by) && TERRAIN[grid[y][x]].roof) return false;
  }
  return true;
}

// Chiefs a side can pick as protagonist: setup rows that name a person.
const chiefs = (sc, side) => sc.setup.filter(r => r[4] && sc.sides[r[0]] === side).map(r => r[4]);

function newGame(sc = SC, heroes = HEROES, mine = MINE) {
  SC = sc; HEROES = heroes; MINE = mine; game++;
  units = sc.setup.map(([f, t, x, y, p]) => {
    const u = { f, t, x, y, p, hero: !!p && heroes[sc.sides[f]] === p, w: arms({ f, t })[0], cd: Math.random(), dir: 0 };
    u.hp = stat(u, 'hp'); u.post = { x, y };
    u.uses = Object.fromEntries((TYPES[t].tactics || []).filter(k => (sc.tactics || []).includes(k)).map(k => [k, TACTICS[k].uses]));
    return u;
  });
  me = units.find(u => u.hero && sideOf(u) === mine);
  me.ammo = AMMO; me.arms = me.f === 'ing' ? MY_ARMS_ING : MY_ARMS_CITY; me.w = me.arms[0]; me.oil = WEAPONS.aceite.uses;
  // The vecinos' weapons are mine too when I play the city: up to the azoteas, and grease or bricks (F).
  if (mine === SC.tunnels && sc.tactics) {
    me.roof = true;
    for (const k of sc.tactics) me.uses[k] = Math.max(me.uses[k] || 0, TACTICS[k].uses * 2);
  }
  waveT = WAVE_S; dest = null;
  // My squad: the SQUAD_MAX allies closest to me; the rest hold their posts (H recruits more on the way).
  units.filter(u => u !== me && sideOf(u) === MINE).sort((a, b) => dist(a, me) - dist(b, me)).slice(0, SQUAD_START).forEach(u => u.squad = true);
  drops = []; effects = []; walls = sc.barricades || []; order = 'seguir'; clock = sc.turns * TURN_S; takeT = 0; msgT = 0; over = false;
  draw();
  overlay(`<h2>${sc.sideNames[mine]} · ★ ${PEOPLE[me.p].short}</h2><p>${sc.help}</p><p>${HELP_CONTROLS}</p>`,
    [['¡A la calle!', () => $('map').requestPointerLock?.()]], true);
}

// --- overlay ------------------------------------------------------------------
// buttons: [[label, fn?, disabled?], ...]; every button closes the overlay before running fn. The game pauses while it is open.
function overlay(html, buttons = [['Continuar']], doc = false) {
  if (document.pointerLockElement) document.exitPointerLock();
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
const paused = () => !$('overlay').classList.contains('hidden');

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
    s.locked ? [['Volver', menu]] : [['Jugar', () => pickSide(s)], ['Volver', menu]], true);
}

// The player picks a side, then its protagonist (★: more life and attack; if it falls, that side loses).
// The CPU plays the other side with its first chief.
function pickSide(s) {
  const sides = [...new Set(s.order.map(f => s.sides[f]))];
  overlay(`<h2>${s.title}</h2><p>¿De qué bando sos?</p>`, sides.map(side => [s.sideNames[side], () =>
    overlay(`<h2>${s.sideNames[side]}</h2><p>Elegí tu protagonista. Si cae, tu bando pierde.</p>`,
      chiefs(s, side).map(p => [`★ ${PEOPLE[p].short}`, () =>
        newGame(s, Object.fromEntries(sides.map(k => [k, k === side ? p : chiefs(s, k)[0]])), side)]))]));
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

// --- me -----------------------------------------------------------------------
const MARGIN = 0.22; // keep this far from walls (tiles), so the camera doesn't go into the houses
const free = (x, y) => [-1, 1].every(sx => [-1, 1].every(sy => passable(me, Math.round(x + sx * MARGIN), Math.round(y + sy * MARGIN))));

// W A S D from render3d: dx, dy is the walking direction on the map (unit length). Slides along walls.
function walkMe(dx, dy, dt) {
  if (over || paused()) return;
  const s = MY_SPEED * dt * (slowed(me) ? BARRICADE_SLOW : 1), nx = me.x + dx * s, ny = me.y + dy * s;
  if (free(nx, ny)) { me.x = nx; me.y = ny; } else if (free(nx, me.y)) me.x = nx; else if (free(me.x, ny)) me.y = ny;
  me.moving = true;
  for (const d of drops) if (Math.hypot(d.x - me.x, d.y - me.y) < 0.6) { me.ammo += d.n; d.n = 0; flash(`🎒 +${DROP} cartuchos`); }
  drops = drops.filter(d => d.n);
}

// Click / Space from render3d: t is the enemy under the crosshair, or null.
function fire(t) {
  if (over || paused() || me.guard) return;
  if (t && !(units.includes(t) && enemy(me, t) && dist(me, t) <= reach(me) && sees(me, t))) t = null;
  shoot(me, t);
}

function setWeapon(i) {
  const w = arms(me)[i];
  if (w && w !== me.w) { me.w = w; me.cd = Math.max(me.cd, 0.4); hud(); }
}
const cycleWeapon = d => { const a = arms(me); setWeapon((a.indexOf(me.w) + d + a.length) % a.length); };

// F: from an azotea, throw grease or bricks on an enemy in the street next to me.
function throwDown() {
  if (!Object.keys(me.uses).length) return flash('Tu protagonista no tira cosas desde los techos.');
  if (!TERRAIN[terrainOf(me)].roof) return flash('Subí a una azotea para tirar grasa o ladrillos a la calle.');
  if (!Object.values(me.uses).some(n => n)) return flash('No te queda nada para tirar.');
  if (me.cd > 0) return;
  if (!pourOn(me)) flash('No hay enemigos en la calle de al lado.');
  hud();
}

// Orders to my squad. seguir: a column behind me · linea: abreast beside me · alto: hold where they stand ·
// ir: go to the spot I'm looking at · atacar: go after the nearest enemy.
const ORDERS = {
  seguir: ['📯 ¡Seguime! En columna detrás tuyo.', 'te sigue en columna'],
  linea:  ['📯 ¡En línea! Se abren a tus costados.', 'en línea a tu lado'],
  alto:   ['📯 ¡Alto! Se quedan donde están y tiran a lo que vean.', 'quieta'],
  ir:     ['📯 ¡Vayan allá! Van a donde mirás.', 'va a ⚐'],
  atacar: ['📯 ¡Al ataque! Salen a buscar al enemigo.', 'ataca'],
};
let dest = null; // ir: the spot
function setOrder(o) {
  order = o;
  const squad = units.filter(u => u.squad);
  if (o === 'alto') for (const u of squad) u.hold = { x: u.x, y: u.y };
  if (o === 'ir') { // walk my gaze up to 10 tiles, until a house
    const sx = Math.sin(me.look || 0), sy = Math.cos(me.look || 0);
    let d = 0;
    while (d < 10 && passable({ t: 'linea' }, Math.round(me.x + sx * (d + 0.25)), Math.round(me.y + sy * (d + 0.25)))) d += 0.25;
    dest = { x: me.x + sx * Math.max(0, d - 0.3), y: me.y + sy * Math.max(0, d - 0.3) };
  }
  flash(squad.length ? ORDERS[o][0] : 'No tenés tropa: H para sumar a los que estén cerca.');
}

// H: allies near me join my squad.
function recruit() {
  const n = units.filter(u => u !== me && !u.squad && sideOf(u) === MINE && dist(u, me) < RECRUIT_R && units.filter(o => o.squad).length < SQUAD_MAX && (u.squad = true)).length;
  flash(n ? `🤝 Se suman ${n} a tu tropa.` : 'No hay compañeros cerca para sumar.');
}

function tunnel() {
  if (SC.tunnels !== MINE) return flash('Tu bando no conoce los túneles.');
  const [x, y] = tileOf(me), i = TUNNELS.findIndex(([a, b]) => a === x && b === y);
  if (i < 0) return flash('Pará sobre una trampilla 🕳️ para usar el túnel.');
  [me.x, me.y] = TUNNELS[(i + 1) % TUNNELS.length];
  flash('🕳️ Saliste por otra trampilla.');
}

// --- combat -------------------------------------------------------------------
// a fires (or swings) its current weapon at d (null: at nothing). Returns false if it couldn't.
function shoot(a, d) {
  const W = WEAPONS[a.w];
  if (a.cd > 0) return false;
  if (a === me && W.ammo) {
    if (!me.ammo) { flash('Sin cartuchos: pasá a un arma blanca (2, 3…), o juntá una 🎒 donde cayó un soldado.'); return false; }
    me.ammo--;
  }
  if (a === me && W.uses) {
    if (!me.oil) { flash('No te queda aceite.'); return false; }
    me.oil--;
  }
  a.cd = W.reload * (a === me ? 1 : AI_SLOW);
  if (d) a.dir = Math.atan2(d.x - a.x, d.y - a.y);
  if (a.w === 'aceite') effects.push({ k: 'aceite', from: [a.x, a.y], to: d ? [d.x, d.y] : [a.x + Math.sin(a === me ? me.look || 0 : a.dir) * 2, a.y + Math.cos(a === me ? me.look || 0 : a.dir) * 2] });
  else effects.push({ k: a.w, by: a, to: d && { x: d.x, y: d.y } });
  if (!d) return true;
  if (d === me && W.melee && me.guard) { a.cd += 1; flash(`🛡️ ¡Paraste el golpe de ${unitName(a)}!`); return true; } // parried: the attacker is left open
  if (a !== me && !W.melee && Math.random() > AI_HIT * (d.air ? 0.4 : 1)) return true; // a jump makes me hard to hit
  const charge = a.w === 'bayoneta' && TYPES[a.t].charge || 1;
  hurt(a, d, stat(a, 'atk') * W.atk * charge, W.icon);
  if (W.melee && units.includes(d) && d !== me) { // the blow staggers and pushes back
    d.cd = Math.max(d.cd, 0.6);
    const k = 0.35 / (dist(a, d) || 1), nx = d.x + (d.x - a.x) * k, ny = d.y + (d.y - a.y) * k;
    if (passable(d, Math.round(nx), Math.round(ny))) { d.x = nx; d.y = ny; }
  }
  return true;
}

function hurt(a, d, power, how) {
  const def = Math.max(TERRAIN[terrainOf(d)].def, atWall(d) ? BARRICADE_DEF : 0);
  const dmg = Math.max(1, Math.round(power * (1 - def) * (1 + (Math.random() * 2 - 1) * DMG_SPREAD)));
  d.hp -= dmg;
  d.hitT = 0.3; d.alertT = 6; // whoever gets hit comes looking for a while
  if (a === me || d === me) flash(`${unitName(a)} ${how} ${unitName(d)}: −${dmg}${d.hp <= 0 ? ` (${SC.loss || (sideOf(a) === SC.capture && Object.values(WEAPONS).some(w => w.melee && w.icon === how) ? 'capturado' : 'baja')})` : ''}`);
  if (d.hp > 0) return;
  units = units.filter(u => u !== d);
  if (d !== me) drops.push({ x: d.x, y: d.y, n: DROP });
  if (d.hero) return finish(sideOf(a), `${PEOPLE[d.p].short} ${SC.loss ? 'fue dispersado' : 'cayó'}.`);
  const left = new Set(units.map(sideOf));
  if (left.size === 1) finish([...left][0], SC.loss ? 'adversarios dispersados.' : 'fuerzas enemigas rendidas.');
}

// Vecinos on an azotea pour boiling oil or water on an enemy in the street next to it.
function pourOn(u) {
  for (const k in u.uses) {
    if (!u.uses[k]) continue;
    const d = units.find(o => enemy(u, o) && dist(u, o) <= TACTICS[k].rng + 0.5 && !TERRAIN[terrainOf(o)].roof);
    if (!d) continue;
    u.uses[k]--; u.cd = 1.5;
    effects.push({ k, from: [u.x, u.y], to: [d.x, d.y] });
    hurt(u, d, TACTICS[k].dmg, TACTICS[k].icon);
    return true;
  }
  return false;
}

// --- CPU and my troops --------------------------------------------------------
// Next tile toward goal along what u can walk (BFS); goal is a point in tiles.
function nextTile(u, goal) {
  const [sx, sy] = tileOf(u), [gx, gy] = tileOf(goal), open = passable(u, gx, gy);
  const done = (x, y) => (x === gx && y === gy) || (!open && Math.abs(x - gx) + Math.abs(y - gy) === 1);
  if (done(sx, sy)) return open ? [goal.x, goal.y] : null;
  const prev = new Map([[key(sx, sy), null]]), q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (!passable(u, nx, ny) || prev.has(k)) continue;
      prev.set(k, [x, y]);
      if (done(nx, ny)) {
        let at = [nx, ny];
        while (prev.get(key(...at))[0] !== sx || prev.get(key(...at))[1] !== sy) at = prev.get(key(...at));
        return at;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

function step(u, goal, dt, speed = AI_SPEED) {
  if ((u.rp = (u.rp || 0) - dt) <= 0 || !u.next) { u.rp = 0.4 + Math.random() * 0.2; u.next = nextTile(u, goal); }
  if (!u.next) return;
  const dx = u.next[0] - u.x, dy = u.next[1] - u.y, d = Math.hypot(dx, dy), s = Math.min(speed * dt * (slowed(u) ? BARRICADE_SLOW : 1), d);
  if (d < 0.05) { u.next = null; return; }
  u.x += dx / d * s; u.y += dy / d * s;
  u.dir = Math.atan2(dx, dy);
  u.moving = true;
}

const objective = () => {
  const goals = [];
  grid.forEach((row, y) => row.forEach((t, x) => { if (SC.take.at.includes(t)) goals.push({ x, y }); }));
  return goals;
};

// One CPU-run unit (enemies, and my own troops following my orders): shoot what it can, then move.
function think(u, dt) {
  const foes = units.filter(o => enemy(u, o));
  if (!foes.length) return;
  const near = foes.reduce((b, o) => dist(u, o) < dist(u, b) ? o : b), dn = dist(u, near);
  const roof = TERRAIN[terrainOf(u)].roof, see = sees(u, near);
  if (u.cd === 0 && !(roof && pourOn(u))) for (const w of arms(u)) if (dn <= reach(u, w) && see) { u.w = w; shoot(u, near); break; }
  if (over) return;
  const melee = WEAPONS[arms(u)[0]].melee && TYPES[u.t].charge, inRange = see && dn <= (melee ? 0.8 : reach(u, 'fusil') * 0.7);
  let goal = near;
  if (u.squad && order !== 'atacar') { // in formation; fight what comes near it, but don't stray
    const spot = slot(u), fight = order !== 'alto' && see && dist(near, spot) < 5 && dist(u, spot) < 6;
    goal = fight ? (inRange ? null : near) : dist(u, spot) > 0.3 ? spot : null;
    if (goal) return step(u, goal, dt, order === 'seguir' || order === 'linea' ? MY_SPEED : AI_SPEED); // keep up with me
  }
  else if (inRange || (u.hero && dn > 5) || (roof && see)) goal = null; // the CPU's ★ stays back: if it falls, its side loses
  else if (SC.take.side === sideOf(u) && dn > SIGHT) goal = objective().reduce((b, o) => dist(u, o) < dist(u, b) ? o : b);
  // Tactical: the CPU only fights what it spots (close and in sight); otherwise defenders hold their post,
  // so I can move around the city, flank and pick my fights.
  else if (!u.squad && !(dn <= SIGHT && see) && !((u.alertT -= dt) > 0)) goal = dist(u, u.post) > 0.5 ? u.post : null;
  if (goal) step(u, goal, dt);
  else if (see) u.dir = Math.atan2(near.x - u.x, near.y - u.y);
}

// Each squad soldier's place for the current order: pairs in a column behind me, a line at my sides,
// a huddle around the ⚐ spot, or where it stood when I said alto. Inside a house, it falls back to me (or the spot).
function slot(u) {
  if (order === 'alto') return u.hold || u;
  const i = units.filter(o => o.squad).indexOf(u), side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
  const a = me.look || 0, fx = Math.sin(a), fy = Math.cos(a), px = Math.cos(a), py = -Math.sin(a); // forward, right
  const base = order === 'ir' ? dest : me;
  const [b, s] = order === 'seguir' ? [-(0.8 + 0.6 * k), 0.3 * side] : order === 'linea' ? [0, 0.6 * (k + 1) * side] : [-0.5 * Math.floor(i / 3), 0.5 * (i % 3 - 1)];
  const p = { x: base.x + fx * b + px * s, y: base.y + fy * b + py * s };
  return passable(u, Math.round(p.x), Math.round(p.y)) ? p : base;
}

// Soldiers don't stand inside each other.
function separate() {
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    const a = units[i], b = units[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= 0.35 || d === 0) continue;
    const push = (0.35 - d) / 2 / d;
    for (const [u, s] of [[a, -push], [b, push]]) {
      if (u === me) continue;
      const nx = u.x + dx * s, ny = u.y + dy * s;
      if (passable(u, Math.round(nx), Math.round(ny))) { u.x = nx; u.y = ny; }
    }
  }
}

// Reinforcements: every WAVE_S the attacking side brings in WAVE soldiers at its own entry points
// (its setup rows without a person), while it has fewer than WAVE_MAX × its starting troops.
let waveT = 0;
function reinforce() {
  const side = SC.take.side, rows = SC.setup.filter(r => !r[4] && SC.sides[r[0]] === side);
  const start = SC.setup.filter(r => SC.sides[r[0]] === side).length;
  if (units.filter(u => sideOf(u) === side).length >= start * WAVE_MAX) return;
  for (let i = 0; i < WAVE; i++) {
    const [f, t, x, y] = rows[Math.floor(Math.random() * rows.length)];
    const u = { f, t, x: x + (Math.random() - 0.5) * 0.3, y: y + (Math.random() - 0.5) * 0.3, hero: false, w: arms({ f, t })[0], cd: 1, dir: 0, uses: {} };
    u.hp = stat(u, 'hp'); u.post = { x, y };
    units.push(u);
  }
  flash(`🥁 Llegan refuerzos ${side === MINE ? 'tuyos' : 'enemigos'}: +${WAVE} ${SC.sideNames[side]}.`);
}

// --- clock --------------------------------------------------------------------
const TAKE_S = 3; // seconds the take side must hold its objectives
let hudT = 0, msg = '', msgT = 0;

function tick(dt) {
  if (over || paused()) return;
  clock -= dt;
  msgT -= dt;
  for (const u of [...units]) {
    u.moving = u === me && u.moving;
    u.cd = Math.max(0, u.cd - dt);
    u.hitT = Math.max(0, (u.hitT || 0) - dt);
    if (u !== me && u.hp > 0) think(u, dt);
    if (over) return;
  }
  separate();
  if ((waveT -= dt) <= 0) { waveT = WAVE_S; reinforce(); }
  const { side, at } = SC.take;
  const held = at.every(t => { const on = units.filter(u => terrainOf(u) === t); return on.length && on.every(u => sideOf(u) === side); });
  if (held && !takeT) flash(`⚑ ${SC.sideNames[side]} están tomando ${at.map(t => TERRAIN[t].name).join(' y ')}…`);
  takeT = held ? takeT + dt : 0;
  if (takeT > TAKE_S) return finish(side, `${at.map(t => TERRAIN[t].name).join(' y ')} tomado${at.length > 1 ? 's' : ''}.`);
  if (clock <= 0) return finish(SC.holdOut, 'resistieron hasta el final.');
  if ((hudT -= dt) <= 0) { hudT = 0.25; hud(); }
}

function flash(s) { msg = s; msgT = 3; hud(); }

function hud() {
  if (!me) return;
  const s = Math.max(0, Math.ceil(clock)), f = FACTIONS[me.f];
  $('turn').innerHTML = `${SC.id} · ⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · <span style="color:${f.color}">${SC.sideNames[MINE]}</span>`;
  const mine = units.filter(u => sideOf(u) === MINE).length, [x, y] = tileOf(me), place = placeAt(x, y);
  const w = arms(me).map((k, i) => (k === me.w ? `<b>${i + 1} ${WEAPONS[k].icon} ${WEAPONS[k].name}` : `<span class="dim">${i + 1} ${WEAPONS[k].icon}`) +
    (WEAPONS[k].uses ? ` ×${me.oil}` : '') + (k === me.w ? '</b>' : '</span>')).join(' ');
  bar(`❤️ ${Math.max(0, me.hp)}/${stat(me, 'hp')} · 🎒 ${me.ammo} · ${w}${me.cd > 0 ? ' · recargando…' : ''}` +
    `<br>👥 ${mine} contra ${units.length - mine} · tropa ${units.filter(u => u.squad).length}: ${ORDERS[order][1]}${me.guard ? ' · 🛡️ en guardia' : ''}` +
    (place && PLACES[place] ? ` · <a data-place="${place}">${place}</a>` : place ? ` · ${place}` : '') +
    (SC.tunnels === MINE && isTunnel(x, y) ? ' · 🕳️ T: túnel' : '') +
    (Object.keys(me.uses).length ? ' · ' + Object.entries(me.uses).map(([k, n]) => `${TACTICS[k].icon}${n}`).join(' ') + (TERRAIN[grid[y][x]].roof ? ' F: tirar' : '') : '') +
    (atWall(me) ? ' · 🪵 barricada' : '') +
    (msgT > 0 ? `<br>${msg}` : ''));
}

function finish(side, why) {
  over = true;
  draw();
  overlay(`<b style="font-size:20px">${side === MINE ? '¡Ganaste!' : 'Perdiste.'} ${SC.sideNames[side]} ganan: ${why}</b>`,
    [['Jugar de nuevo', () => newGame()], ['Otro bando', () => pickSide(SC)], ['Episodios', menu]]);
}

function bar(html) { $('bar').innerHTML = html; }

$('bar').onclick = e => {
  const a = e.target.closest('a');
  if (!a) return;
  if (a.dataset.person) { const p = PEOPLE[a.dataset.person]; card(p.name, p.role, p.text, p.src); }
  else { const p = PLACES[a.dataset.place]; card(a.dataset.place, '', p.text, p.src); }
};

function draw() { if (window.render3d) window.render3d(); }

// 1–6: weapon · Q R Z G E: squad orders · H: recruit · T: tunnel (W A S D, mouse and Space live in render3d, they depend on the camera).
addEventListener('keydown', e => {
  if (paused()) { if (e.key === 'Enter') { e.preventDefault(); $('ovbtns').firstChild?.click(); } return; }
  if (over || !me || e.metaKey || e.ctrlKey) return;
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '6') setWeapon(+k - 1);
  if (k === 'q') setOrder('seguir');
  if (k === 'r') setOrder('linea');
  if (k === 'z') setOrder('alto');
  if (k === 'g') setOrder('ir');
  if (k === 'e') setOrder('atacar');
  if (k === 'h') recruit();
  if (k === 't') tunnel();
  if (k === 'f') throwDown();
});
$('menu').onclick = menu;
$('help').onclick = () => overlay((SC ? `<p>${SC.help}</p><p>★ Protagonista: si cae, su bando pierde.</p>` +
  (SC.tactics || []).map(k => `<p>${TACTICS[k].icon} <b>${TACTICS[k].name}</b> (milicianos y vecinas, F): ${TACTICS[k].help}</p>`).join('') +
  `<p>🎯 <b>Armas</b>: ${WEAPONS_HELP}</p>` +
  (SC.barricades ? `<p>🪵 <b>Barricadas</b>: ${BARRICADE_HELP}</p>` : '') +
  (SC.tunnels ? `<p>🕳️ <b>Túneles</b>: ${TUNNEL_HELP}</p>` : '') +
  (SC.setup.some(r => TYPES[r[1]].charge) ? `<p>⚔️ <b>Bayoneta</b>: ${BAYONET_HELP}</p>` : '') : '') + `<p>${HELP_CONTROLS}</p>`, [['Seguir']]);
$('turn').textContent = 'Buenos Aires 1806–1810';
// QA: #1806, #1807, #1809 go straight to that episode's side picker, skipping the menu.
// Off github.io (local/LAN dev) with no hash, start the first playable episode the same way.
const DEV = !location.hostname.endsWith('github.io');
const deep = SCENARIOS.find(s => '#' + s.id === location.hash && !s.locked) || (DEV && !location.hash && SCENARIOS.find(s => !s.locked));
if (deep) pickSide(deep); else menu();
