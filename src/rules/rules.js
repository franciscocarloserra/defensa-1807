// Rules: map, factions, unit stats and scenarios (episodes). Pure data, no DOM.
// Map is schematic: 1 street tile + 2x2 tiles per block. Positions approximate, pending period maps.
// Historical facts come only from data/; each scenario names its source.

const COLS = 17, ROWS = 22;
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
  ['plaza', 'Plaza Mayor', 7, 4, 11, 5],
  ['recova', '', 9, 4, 9, 5],
  ['fuerte', 'Fuerte', 13, 3, 14, 6],
  ['cabildo', 'Cabildo', 4, 4, 5, 5],
  ['iglesia', 'Catedral', 7, 1, 8, 2],
  ['iglesia', 'S. Francisco', 7, 10, 8, 11],
  ['iglesia', 'S. Domingo', 10, 16, 11, 17],
];

// Period street names only (data/calles-1806-1810.md). Streets with no known name for the period stay unlabeled
// (the source says some were known only by their location).
const STREETS_X = { 0: 'San Pedro', 3: 'San José', 6: 'De la Compañía', 9: 'San Martín' };
const STREETS_Y = { 0: 'Santa Teresa', 3: 'Las Torres', 6: 'Del Cabildo', 9: 'San Carlos', 15: 'Santo Domingo', 18: 'Santa Catalina', 21: 'San Bartolomé' };
// 1808 nomenclature (Liniers' decree), same source; Bolívar has no 1808 name there and keeps the earlier one.
const STREETS_1808 = {
  x: { 0: 'Lasala', 3: 'Unquera', 6: 'De la Compañía', 9: 'Liniers', 12: 'Gana' },
  y: { 0: 'Lezica', 3: 'Reconquista', 6: 'Villota', 9: 'Álzaga', 12: 'Villanueva', 15: 'Pirán', 18: 'Basualdo', 21: 'Agüero' },
};

const FACTIONS = {
  ing: { name: 'Ingleses',          color: '#c8372d' },
  rec: { name: 'Tropas de Liniers', color: '#e6e1d3' },
  pat: { name: 'Patricios',         color: '#2f6fc0' },
  cri: { name: 'Criollos',          color: '#d9b84a' },
  min: { name: 'Miñones',           color: '#4f9a54' },
  arr: { name: 'Arribeños',         color: '#9a6a34' },
  caz: { name: 'Cazadores',         color: '#3f7a6a' },
  pym: { name: 'Pardos y Morenos',  color: '#a33b3b' },
  vec: { name: 'Vecinos',           color: '#c98bb0' },
};

const TYPES = {
  linea:     { name: 'Infantería', hp: 10, mv: 3, rng: 1, atk: 4, ch: 'I', charge: 1.5 }, // bayonet: x1.5 attacking next to it after moving
  rifle:     { name: 'Rifles',     hp: 7,  mv: 3, rng: 3, atk: 3, ch: 'R' },
  soldado:   { name: 'Soldado',    hp: 9,  mv: 3, rng: 1, atk: 4, ch: 'S' },
  patricio:  { name: 'Patricio',   hp: 9,  mv: 3, rng: 2, atk: 4, ch: 'P' },
  miliciano: { name: 'Miliciano',  hp: 6,  mv: 3, rng: 2, atk: 3, ch: 'M', roof: true, tactics: ['grasa', 'agua', 'ladrillos'] },
  vecina:    { name: 'Vecina',     hp: 7,  mv: 3, rng: 1, atk: 3, ch: 'V', roof: true, tactics: ['grasa', 'ladrillos'] },
  minon:     { name: 'Miñón',      hp: 8,  mv: 3, rng: 2, atk: 3, ch: 'Ñ' },
  jefe:      { name: 'Jefe',       hp: 8,  mv: 3, rng: 2, atk: 3, ch: 'J' },
};

// The protagonist each side picks among its chiefs: bonus over the chief's stats. If it falls, its side loses.
const HERO = { hp: 8, atk: 1 };

// Real time: each scenario turn lasts TURN_S seconds of clock. Speeds in tiles/s.
const TURN_S = 20, MY_SPEED = 1.8, AI_SPEED = 1.2;
const AMMO = 15, DROP = 4;        // my cartridges at start; a fallen soldier leaves a cartridge box with DROP
const AI_HIT = 0.5, AI_SLOW = 1.4; // CPU shots hit half the time and reload 40% slower than mine
const SIGHT = 9;
const SQUAD_START = 8, SQUAD_MAX = 14, RECRUIT_R = 3; // my squad: closest allies at start, cap, and H's reach (tiles)
const WAVE_S = 20, WAVE = 4, WAVE_MAX = 2; // attackers' reinforcements: every 20 s, 4 more, up to twice the starting troops                  // CPU units notice enemies this close (tiles)

// Period tactics: "desde los techos se arrojaban piedras, ladrillos y grasa hirviendo" (data/1807-defensa-vecinos.md);
// boiling water from the team brief (docs/INTENT.md). Thrown from an azotea on an enemy in the street next to it
// (key F for me); `uses` per unit and game.
const TACTICS = {
  grasa:     { name: 'Grasa hirviendo', icon: '🫕', roof: true, rng: 1, dmg: 7, uses: 1, help: 'desde una azotea, sobre un enemigo en la calle de al lado. Una vez por persona.' },
  agua:      { name: 'Agua hirviendo',  icon: '♨️', roof: true, rng: 1, dmg: 4, uses: 2, help: 'como la grasa, más débil. Dos veces por persona.' },
  ladrillos: { name: 'Ladrillos',       icon: '🧱', roof: true, rng: 1, dmg: 3, uses: 3, help: 'desde la azotea a la calle de al lado. Tres por persona.' },
};
// Weapons (keys 1–6, or the mouse wheel). reach in tiles (firearms: grow with the type's rng), reload in seconds, atk multiplier.
// melee: hand to hand (knocks back and staggers; right click parries it). uses: thrown, limited per game.
// Stones: the 1807 neighbours threw "desde piedras hasta cargas de fusil" from the roofs (data/1807-segunda-invasion.md).
// Fusil Modelo 1792, oil, sabres, swords and tacuara cane lances for the city (data/1807-armas.md).
const WEAPONS = {
  fusil1792: { name: 'Fusil Modelo 1792', icon: '🎯', reach: null, reload: 2.5, atk: 1, ammo: true },
  fusil:     { name: 'Fusil inglés', icon: '🎯', reach: null, reload: 2.5, atk: 1, ammo: true },
  bayoneta:  { name: 'Bayoneta', icon: '🗡️', reach: 1,   reload: 0.9, atk: 1.3, melee: true },
  sable:     { name: 'Sable',    icon: '⚔️', reach: 1,   reload: 0.7, atk: 1.2, melee: true },
  espada:    { name: 'Espada',   icon: '🤺', reach: 1.1, reload: 0.6, atk: 1.1, melee: true },
  tacuara:   { name: 'Lanza tacuara', icon: '🔱', reach: 1.8, reload: 1.1, atk: 1.4, melee: true },
  piedras:   { name: 'Piedras',  icon: '🪨', reach: 3.5, reload: 1.2, atk: 0.6 },
  aceite:    { name: 'Aceite hirviendo', icon: '🫗', reach: 2.5, reload: 1.5, atk: 1.8, uses: 3 },
};
// By type; others by side: the British carry their musket, bayonet and sabre, the city the 1792 musket and a sword.
const ARMS = {
  linea: ['bayoneta', 'fusil'], rifle: ['sable', 'fusil'], patricio: ['sable', 'fusil1792'],
  miliciano: ['tacuara', 'fusil1792', 'piedras'], vecina: ['tacuara', 'fusil1792', 'piedras'],
};
const ARMS_ING = ['sable', 'fusil'], ARMS_CITY = ['espada', 'fusil1792'];
// What my ★ carries.
const MY_ARMS_ING = ['fusil', 'bayoneta', 'sable'], MY_ARMS_CITY = ['fusil1792', 'sable', 'espada', 'tacuara', 'piedras', 'aceite'];
const WEAPONS_HELP = '1 a 6 o la rueda del mouse cambian de arma. Fusil: lejos, recarga lenta, gasta cartuchos. ' +
  'Sable, espada, bayoneta y lanza tacuara: cuerpo a cuerpo (la tacuara llega más lejos); el golpe empuja al otro. ' +
  'Clic derecho: parar sus golpes. Piedras: alcance corto. Aceite hirviendo: tres ollas, a 2 pasos.';
const BAYONET_HELP = 'la Infantería inglesa carga a la bayoneta: x1,5 cuerpo a cuerpo.';

// Smuggling tunnels: entrances on the street; the side in the scenario's `tunnels` jumps from one to the next.
// The other side never sees them.
const TUNNELS = [[6, 3], [3, 12], [9, 15], [12, 9], [13, 13], [12, 18]];
// Barricades and trenches cutting the streets (data/1807-defensa-vecinos.md), per scenario: whoever stands at one
// takes cover (defense BARRICADE_DEF); the other side crosses it slowly (speed × BARRICADE_SLOW).
const BARRICADE_DEF = 0.5, BARRICADE_SLOW = 0.35;
const BARRICADE_HELP = 'cortan la calle: detrás de una te cubrís (defensa +50%); el enemigo la cruza muy lento.';
const TUNNEL_HELP = 'solo el bando local los conoce y los ve. Parado sobre una trampilla, T te lleva a la siguiente.';

// Each scenario: factions, which side each belongs to, the side that wins by holding every `take` terrain
// (with no enemy on it), and the side that wins by lasting `turns` × TURN_S seconds.
// Setup rows: [faction, type, x, y, person?] — person is a key of PEOPLE (story.js).
const SCENARIOS = [
  {
    id: '1806', title: 'Reconquista', date: '12 de agosto de 1806', src: ['1806-primera-invasion.md'],
    intro: `Beresford gobierna la ciudad desde el Fuerte. Liniers desembarcó en Las Conchas con 1.000 hombres
      y, sumando voluntarios, llega a 4.000. Entran por las calles de la Merced y de la Catedral (al norte de este mapa)
      y avanzan sobre la Plaza Mayor.`,
    order: ['rec', 'cri', 'ing'],
    sides: { rec: 'loc', cri: 'loc', ing: 'brit' },
    sideNames: { loc: 'Reconquistadores', brit: 'Ingleses' },
    take: { side: 'loc', at: ['fuerte'] }, holdOut: 'brit', turns: 12, tactics: ['grasa', 'agua'], tunnels: 'loc',
    help: `Liniers y los voluntarios entran por el norte y el oeste.<br>
      Ganan si ocupan el Fuerte sin ingleses adentro.<br>
      Los ingleses ganan resistiendo 4 minutos.`,
    setup: [
      ['ing', 'jefe', 14, 4, 'beresford'], ['ing', 'linea', 13, 3], ['ing', 'linea', 13, 6],
      ['ing', 'linea', 9, 4], ['ing', 'linea', 9, 5], ['ing', 'linea', 11, 5], ['ing', 'linea', 7, 4],
      ['rec', 'jefe', 9, 0, 'liniers'], ['rec', 'soldado', 3, 0], ['rec', 'soldado', 6, 0], ['rec', 'soldado', 12, 0], ['rec', 'soldado', 0, 0],
      ['cri', 'jefe', 0, 3, 'pueyrredon'], ['cri', 'miliciano', 0, 6], ['cri', 'miliciano', 4, 1], ['cri', 'miliciano', 10, 1], ['cri', 'miliciano', 0, 9],
    ],
  },
  {
    id: '1807', title: 'Defensa', date: '5 de julio de 1807', src: ['1807-segunda-invasion.md', 'regimiento-de-patricios.md', '1807-1810-consecuencias.md', '1807-defensa-vecinos.md'],
    intro: `Las columnas de Whitelocke buscan llegar a la Plaza Mayor para tomar desde allí toda la ciudad.
      Álzaga convocó a la gente y se negó a capitular. Desde azoteas y casas los vecinos lanzan de todo, desde
      piedras hasta cargas de fusil. En Santo Domingo los ingleses chocan con los Patricios, regimiento criollo
      formado tras la primera invasión. Por primera vez se armó a todos los habitantes sin distinción de origen:
      Patricios, Arribeños, Cazadores, pardos y morenos. Las calles se cortaron con trincheras y barricadas, y la
      Plaza Mayor fue fortificada.`,
    order: ['ing', 'pat', 'cri', 'arr', 'caz', 'pym', 'vec'],
    sides: { ing: 'brit', pat: 'loc', cri: 'loc', arr: 'loc', caz: 'loc', pym: 'loc', vec: 'loc' },
    sideNames: { loc: 'Defensores', brit: 'Ingleses' },
    take: { side: 'brit', at: ['fuerte', 'cabildo'] }, holdOut: 'loc', turns: 20, tactics: ['grasa', 'agua', 'ladrillos'], tunnels: 'loc',
    capture: 'loc', barricades: [[6, 6], [9, 6], [12, 6], [3, 4], [3, 9], [6, 12]],
    help: `Los ingleses entran por el sur y el oeste.<br>
      Ganan si ocupan Fuerte y Cabildo.<br>
      Patricios y Criollos ganan resistiendo casi 7 minutos o rindiendo a todos.<br>
      Milicianos y vecinas suben a las azoteas (defensa +40%) y tiran grasa y ladrillos (F).<br>
      Con Manuela Pedraza o Martina Céspedes podés subir a los techos.`,
    setup: [
      ['ing', 'jefe', 10, 21, 'craufurd'], ['ing', 'jefe', 0, 18, 'auchmuty'],
      ['ing', 'linea', 3, 21], ['ing', 'linea', 6, 21], ['ing', 'linea', 9, 21], ['ing', 'linea', 12, 21],
      ['ing', 'linea', 0, 6], ['ing', 'linea', 0, 15], ['ing', 'rifle', 0, 9], ['ing', 'rifle', 0, 12],
      ['pat', 'jefe', 11, 4, 'saavedra'], ['pat', 'patricio', 13, 4], ['pat', 'patricio', 14, 5], ['pat', 'patricio', 8, 4], ['pat', 'patricio', 10, 5],
      ['cri', 'jefe', 6, 4, 'alzaga'], ['cri', 'miliciano', 5, 7], ['cri', 'miliciano', 7, 7], ['cri', 'miliciano', 10, 10], ['cri', 'miliciano', 8, 13], ['cri', 'miliciano', 10, 14],
      ['arr', 'patricio', 3, 6], ['arr', 'patricio', 3, 3], ['caz', 'miliciano', 4, 10], ['caz', 'miliciano', 11, 7],
      ['pym', 'miliciano', 5, 13], ['pym', 'miliciano', 7, 16],
      ['vec', 'vecina', 4, 7, 'pedraza'], ['vec', 'vecina', 8, 7, 'cespedes'],
      ['ing', 'linea', 3, 18], ['ing', 'linea', 6, 18], ['ing', 'linea', 0, 3], ['ing', 'rifle', 9, 18],
      ['ing', 'linea', 2, 21], ['ing', 'linea', 5, 21], ['ing', 'linea', 8, 21], ['ing', 'linea', 11, 21], ['ing', 'rifle', 0, 20], ['ing', 'linea', 0, 13],
    ],
  },
  {
    id: '1809', title: 'Asonada', date: '1º de enero de 1809', src: ['1807-1810-consecuencias.md', 'regimiento-de-patricios.md', 'calles-1806-1810.md'],
    intro: `Una delegación del Cabildo encabezada por Álzaga, con el cuerpo de miñones, exige la renuncia del
      virrey Liniers y una junta como en España. Saavedra acude con los Patricios en apoyo de Liniers.
      Mecánica provisoria: los combates representan dispersar al adversario, no bajas.`,
    order: ['min', 'pat'],
    sides: { min: 'cab', pat: 'vir' },
    sideNames: { cab: 'Miñones', vir: 'Patricios' },
    take: { side: 'cab', at: ['fuerte'] }, holdOut: 'vir', turns: 10, loss: 'dispersado', streets: STREETS_1808,
    help: `Los Miñones parten del Cabildo.<br>
      Ganan si ocupan el Fuerte sin Patricios adentro.<br>
      Los Patricios ganan sosteniendo a Liniers algo más de 3 minutos o dispersando a todos.`,
    setup: [
      ['min', 'jefe', 4, 4, 'alzaga'], ['min', 'minon', 5, 4], ['min', 'minon', 5, 5], ['min', 'minon', 4, 5],
      ['min', 'minon', 7, 4], ['min', 'minon', 7, 5], ['min', 'minon', 6, 3],
      ['pat', 'jefe', 14, 4, 'liniers'], ['pat', 'jefe', 6, 9, 'saavedra'], ['pat', 'patricio', 13, 5],
      ['pat', 'patricio', 3, 9], ['pat', 'patricio', 9, 9], ['pat', 'patricio', 0, 6], ['pat', 'patricio', 12, 6],
    ],
  },
  {
    id: '1810', title: 'Mayo', date: '1810', src: ['1807-1810-consecuencias.md'], locked: true,
    intro: `Las fuentes cargadas tratan la Primera Junta y la contrarrevolución de Córdoba, pero no hechos en el
      casco histórico. Falta documentación para armar este episodio.`,
  },
];

const HELP_CONTROLS = `Hacé clic en la ciudad para tomar el mouse (Esc lo suelta).<br>
  W A S D o flechas: caminar · mouse: mirar · clic: disparar o golpear · clic derecho: parar · Espacio: saltar · 1–6 o rueda: arma.<br>
  Tu tropa (los más cercanos): Q en columna detrás tuyo · R en línea a tus costados · Z ¡alto! · G que vayan a donde mirás · E al ataque · H sumar a los compañeros cerca.<br>
  T: túnel (si tu bando los conoce).<br>
  F: desde una azotea, tirar grasa o ladrillos a la calle (si jugás con la ciudad, podés subir a los techos).<br>
  El mapita de arriba a la derecha: ▲ sos vos, ⚑ el objetivo, celeste fuerte tu tropa, ⚐ adonde la mandaste.<br>
  🎒 Cartuchos: pasá por donde cayó un soldado para juntar los suyos.<br>
  El otro bando lo juega la computadora: cada soldado cuida su puesto y pelea lo que ve; si le tirás, te sale a buscar. Recorré, flanqueá y elegí tus peleas.`;

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

// The landmark (label) under a tile, for place cards. Later landmarks overwrite earlier ones in the grid.
function placeAt(x, y) {
  const l = [...LANDMARKS].reverse().find(([t, , x0, y0, x1, y1]) => t === grid[y][x] && x >= x0 && x <= x1 && y >= y0 && y <= y1);
  return l && (l[1] || TERRAIN[l[0]].name);
}
