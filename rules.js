// Rules: map, factions, unit stats, setup and alliances. Pure data, no DOM.
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

// Granaderos and Criollos are allies; everyone else is an enemy of the British.
const enemy = (a, b) => (a.f === 'ing') !== (b.f === 'ing');
