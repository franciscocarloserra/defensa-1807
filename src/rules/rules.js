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
};

const TYPES = {
  linea:     { name: 'Infantería', hp: 10, mv: 3, rng: 1, atk: 4, ch: 'I' },
  rifle:     { name: 'Rifles',     hp: 7,  mv: 3, rng: 3, atk: 3, ch: 'R' },
  soldado:   { name: 'Soldado',    hp: 9,  mv: 3, rng: 1, atk: 4, ch: 'S' },
  patricio:  { name: 'Patricio',   hp: 9,  mv: 3, rng: 2, atk: 4, ch: 'P' },
  miliciano: { name: 'Miliciano',  hp: 6,  mv: 3, rng: 2, atk: 3, ch: 'M', roof: true },
  minon:     { name: 'Miñón',      hp: 8,  mv: 3, rng: 2, atk: 3, ch: 'Ñ' },
  jefe:      { name: 'Jefe',       hp: 8,  mv: 3, rng: 2, atk: 3, ch: 'J' },
};

// Each scenario: factions in turn order, which side each belongs to, the side that wins by
// holding every `take` terrain at the end of its own turn, and the side that wins by lasting `turns`.
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
    take: { side: 'loc', at: ['fuerte'] }, holdOut: 'brit', turns: 12,
    help: `Liniers y los voluntarios entran por el norte y el oeste.<br>
      Ganan si al cerrar su turno ocupan el Fuerte sin ingleses adentro.<br>
      Los ingleses ganan resistiendo 12 turnos.`,
    setup: [
      ['ing', 'jefe', 14, 4, 'beresford'], ['ing', 'linea', 13, 3], ['ing', 'linea', 13, 6],
      ['ing', 'linea', 9, 4], ['ing', 'linea', 9, 5], ['ing', 'linea', 11, 5], ['ing', 'linea', 7, 4],
      ['rec', 'jefe', 9, 0, 'liniers'], ['rec', 'soldado', 3, 0], ['rec', 'soldado', 6, 0], ['rec', 'soldado', 12, 0], ['rec', 'soldado', 0, 0],
      ['cri', 'jefe', 0, 3, 'pueyrredon'], ['cri', 'miliciano', 0, 6], ['cri', 'miliciano', 4, 1], ['cri', 'miliciano', 10, 1], ['cri', 'miliciano', 0, 9],
    ],
  },
  {
    id: '1807', title: 'Defensa', date: '5 de julio de 1807', src: ['1807-segunda-invasion.md', 'regimiento-de-patricios.md', '1807-1810-consecuencias.md'],
    intro: `Las columnas de Whitelocke buscan llegar a la Plaza Mayor para tomar desde allí toda la ciudad.
      Álzaga convocó a la gente y se negó a capitular. Desde azoteas y casas los vecinos lanzan de todo, desde
      piedras hasta cargas de fusil. En Santo Domingo los ingleses chocan con los Patricios, regimiento criollo
      formado tras la primera invasión.`,
    order: ['ing', 'pat', 'cri'],
    sides: { ing: 'brit', pat: 'loc', cri: 'loc' },
    sideNames: { loc: 'Defensores', brit: 'Ingleses' },
    take: { side: 'brit', at: ['fuerte', 'cabildo'] }, holdOut: 'loc', turns: 20,
    help: `Los ingleses entran por el sur y el oeste.<br>
      Ganan si al cerrar su turno ocupan Fuerte y Cabildo.<br>
      Patricios y Criollos ganan resistiendo 20 turnos o rindiendo a todos.<br>
      Solo los Milicianos suben a las azoteas (defensa +40%).`,
    setup: [
      ['ing', 'jefe', 10, 21, 'craufurd'], ['ing', 'jefe', 0, 18, 'auchmuty'],
      ['ing', 'linea', 3, 21], ['ing', 'linea', 6, 21], ['ing', 'linea', 9, 21], ['ing', 'linea', 12, 21],
      ['ing', 'linea', 0, 6], ['ing', 'linea', 0, 15], ['ing', 'rifle', 0, 9], ['ing', 'rifle', 0, 12],
      ['pat', 'jefe', 11, 4, 'saavedra'], ['pat', 'patricio', 13, 4], ['pat', 'patricio', 14, 5], ['pat', 'patricio', 8, 4], ['pat', 'patricio', 10, 5],
      ['cri', 'jefe', 6, 4, 'alzaga'], ['cri', 'miliciano', 5, 7], ['cri', 'miliciano', 7, 7], ['cri', 'miliciano', 10, 10], ['cri', 'miliciano', 8, 13], ['cri', 'miliciano', 10, 14],
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
      Ganan si al cerrar su turno ocupan el Fuerte sin Patricios adentro.<br>
      Los Patricios ganan sosteniendo a Liniers 10 turnos o dispersando a todos.`,
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

const HELP_CONTROLS = `Tocá una unidad: azul = mover, rojo = atacar.<br>
  Tocá un lugar o un jefe para ver su ficha.<br>
  Un dedo mueve el mapa, dos dedos hacen zoom y giran.`;

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
