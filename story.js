// Story content: people, places and timeline. Pure data, no DOM.
// Every entry is a summary of a file in data/ (named in `src`); nothing here comes from elsewhere.

const PEOPLE = {
  liniers: {
    name: 'Santiago de Liniers', short: 'Liniers', years: '1753–1810', role: 'Capitán de fragata · virrey interino',
    text: `Inmigrante francés. Llegó al Río de la Plata con la expedición de Pedro de Cevallos (1776) y volvió en 1788;
      se casó con María Martina Sarratea. En 1806 reunió 1.000 hombres en Montevideo, desembarcó en Las Conchas el 4 de
      agosto y el 12 rodeó a los ingleses, que capitularon. Fue nombrado virrey interino y Conde de Buenos Aires.
      Superó la asonada de 1809 con el apoyo de las milicias. En 1810 encabezó en Córdoba un movimiento
      contrarrevolucionario y fue fusilado en Cabeza de Tigre (monte de Papagayos) el 26 de agosto.`,
    src: ['santiago-de-liniers.md', '1806-primera-invasion.md', '1807-1810-consecuencias.md'],
  },
  beresford: {
    name: 'William Carr Beresford', short: 'Beresford', role: 'Brigadier General británico',
    text: `Dirigió la primera invasión junto al Comodoro Home Popham. El 28 de junio de 1806 izó la bandera británica en
      el Fuerte y asumió como gobernador; su libre comercio provocó la reacción de los comerciantes y del Cabildo.
      Rodeado tras el ataque del 12 de agosto, se replegó sobre la Recova y el Fuerte y decidió capitular.`,
    src: ['1806-primera-invasion.md'],
  },
  popham: {
    name: 'Home Popham', short: 'Popham', role: 'Comodoro británico',
    text: `Con Beresford al mando de la flota que llegó a la Banda Oriental el 6 de junio de 1806. Decidieron atacar
      Buenos Aires por los caudales reales que debían enviarse a España.`,
    src: ['1806-primera-invasion.md'],
  },
  pueyrredon: {
    name: 'Juan Martín de Pueyrredón', short: 'Pueyrredón', role: 'Jefe de paisanos',
    text: `Reunió a 1.000 paisanos y fue sorprendido en Perdriel por los ingleses. Las tropas de Liniers acamparon en su
      quinta de San Isidro. En la Reconquista tomó la bandera del Regimiento 71.`,
    src: ['1806-primera-invasion.md'],
  },
  sobremonte: {
    name: 'Virrey Sobremonte', short: 'Sobremonte', role: 'Virrey del Río de la Plata',
    text: `Tras la derrota de sus 600 hombres en 1806 se retiró hacia Córdoba con los caudales reales. Delegó el mando de
      las tropas en Liniers y una junta de guerra lo destituyó el 10 de febrero de 1807.`,
    src: ['1806-primera-invasion.md', '1807-segunda-invasion.md'],
  },
  ruizhuidobro: {
    name: 'Ruiz Huidobro', short: 'Ruiz Huidobro', role: 'Gobernador de Montevideo',
    text: `Colaboró con Liniers en la Reconquista. Ante el sitio inglés de Montevideo invitó a sus habitantes
      “a morir antes que rendirse”.`,
    src: ['1806-primera-invasion.md', '1807-segunda-invasion.md'],
  },
  whitelocke: {
    name: 'John Whitelocke', short: 'Whitelocke', role: 'Teniente general británico',
    text: `Al mando de la segunda invasión, con los brigadieres Auchmuty y Craufurd. Llegó a Ensenada el 28 de junio de
      1807 y aceptó la rendición el 7 de julio.`,
    src: ['1807-segunda-invasion.md'],
  },
  craufurd: {
    name: 'Craufurd', short: 'Craufurd', role: 'Brigadier británico',
    text: `Brigadier de Whitelocke en la segunda invasión (1807).`,
    src: ['1807-segunda-invasion.md'],
  },
  auchmuty: {
    name: 'Auchmuty', short: 'Auchmuty', role: 'Brigadier británico',
    text: `Brigadier de Whitelocke en la segunda invasión (1807). La fuente lo escribe “Auchmutchy”.`,
    src: ['1807-segunda-invasion.md'],
  },
  alzaga: {
    name: 'Martín de Álzaga', short: 'Álzaga', role: 'Alcalde de primer voto',
    text: `En 1807 convocó a la gente en la Plaza Mayor y se negó a capitular. El 1º de enero de 1809 encabezó la
      delegación del Cabildo que, con el cuerpo de miñones, exigió la renuncia de Liniers y una junta como en España.`,
    src: ['1807-segunda-invasion.md', '1807-1810-consecuencias.md'],
  },
  saavedra: {
    name: 'Cornelio Saavedra', short: 'Saavedra', role: 'Comandante de Patricios',
    text: `Jefe del primer batallón del Regimiento de Patricios, formado el 15 de septiembre de 1806. En la asonada del
      1º de enero de 1809 acudió en apoyo de Liniers.`,
    src: ['regimiento-de-patricios.md', '1807-1810-consecuencias.md'],
  },
  patricios: {
    name: 'Otros Patricios', role: 'Regimiento de Patricios',
    text: `Esteban Romero y José Domingo Urién (jefes del segundo y tercer batallón), Manuel Belgrano, Juan José Viamonte,
      Feliciano Chiclana y Gregorio Perdriel, entre otros. Todos sus integrantes eran criollos.`,
    src: ['regimiento-de-patricios.md'],
  },
  cisneros: {
    name: 'Baltasar Hidalgo de Cisneros', short: 'Cisneros', role: 'Virrey',
    text: `Designado por la Junta Central de Sevilla, llegó en julio de 1809 a ocupar el cargo de virrey.`,
    src: ['1807-1810-consecuencias.md'],
  },
  moreno: {
    name: 'Mariano Moreno', short: 'Moreno', role: 'Primera Junta',
    text: `El 28 de julio de 1810, ante las dudas de Francisco Ortiz de Ocampo e Hipólito Vieytes, envió a Juan José
      Castelli a cumplir la orden de fusilamiento de los jefes de la contrarrevolución de Córdoba.`,
    src: ['1807-1810-consecuencias.md'],
  },
};

const PLACES = {
  'Fuerte': {
    text: `28 de junio de 1806: se iza la bandera británica y Beresford asume como gobernador. 12 de agosto: rodeados,
      los ingleses se repliegan sobre la Recova y el Fuerte.`,
    src: ['1806-primera-invasion.md'],
  },
  'Recova': {
    text: `Al verse rodeados el 12 de agosto de 1806, los ingleses se repliegan sobre la Recova y el Fuerte.`,
    src: ['1806-primera-invasion.md'],
  },
  'Plaza Mayor': {
    text: `Objetivo de Liniers en 1806 y de los ingleses en 1807, “para desde allí tomar toda la ciudad”. En 1807 Álzaga
      convocó allí a la gente y se negó a capitular.`,
    src: ['1806-primera-invasion.md', '1807-segunda-invasion.md'],
  },
  'Cabildo': {
    text: `Reaccionó contra el libre comercio de Beresford. El 14 de agosto de 1806 un Cabildo Abierto pidió al virrey que
      designara a Liniers Capitán General. El 1º de enero de 1809 una delegación encabezada por Álzaga exigió la
      renuncia de Liniers.`,
    src: ['1806-primera-invasion.md', '1807-1810-consecuencias.md'],
  },
  'Catedral': {
    text: `La actual calle San Martín se llamaba de la Catedral. Por ella y por la de la Merced (hoy Reconquista) entraron
      las tropas de Liniers el 12 de agosto de 1806.`,
    src: ['1806-primera-invasion.md'],
  },
  'S. Domingo': {
    text: `5 de julio de 1807: al llegar a Santo Domingo, los ingleses reciben el ataque de los patricios y no pueden resistir.`,
    src: ['1807-segunda-invasion.md'],
  },
};

// [year, date, text, src]
const TIMELINE = [
  ['1806', '6 de junio', 'La flota de Beresford y Popham llega a la Banda Oriental.', '1806-primera-invasion.md'],
  ['1806', '25 de junio', '1.600 soldados británicos desembarcan en Quilmes; los 600 hombres de Sobremonte son derrotados.', '1806-primera-invasion.md'],
  ['1806', '26 de junio', 'Combate en el Puente de Gálvez con el Regimiento 71; el puente es destruido.', '1806-primera-invasion.md'],
  ['1806', '28 de junio', 'Bandera británica en el Fuerte; Beresford gobernador.', '1806-primera-invasion.md'],
  ['1806', '4 de agosto', 'Liniers desembarca en Las Conchas con 1.000 hombres.', '1806-primera-invasion.md'],
  ['1806', '10 de agosto', 'Las tropas de Liniers, ya 4.000, ocupan Retiro.', '1806-primera-invasion.md'],
  ['1806', '12 de agosto', 'Reconquista: ataque por las calles de la Merced y de la Catedral; Beresford capitula.', '1806-primera-invasion.md'],
  ['1806', '14 de agosto', 'Cabildo Abierto: piden a Liniers como Capitán General.', '1806-primera-invasion.md'],
  ['1806', '15 de septiembre', 'Se forma el Regimiento de Patricios.', 'regimiento-de-patricios.md'],
  ['1806', '28 de octubre', 'Los ingleses se presentan ante Montevideo.', '1807-segunda-invasion.md'],
  ['1807', '3 de febrero', 'Liniers es derrotado en Colonia.', '1807-segunda-invasion.md'],
  ['1807', '10 de febrero', 'Sobremonte es destituido por una junta de guerra.', '1807-segunda-invasion.md'],
  ['1807', '28 de junio', 'Whitelocke llega a Ensenada.', '1807-segunda-invasion.md'],
  ['1807', '5 de julio', 'Defensa: lucha en las calles y desde las azoteas; los Patricios en Santo Domingo.', '1807-segunda-invasion.md'],
  ['1807', '7 de julio', 'Whitelocke acepta la rendición.', '1807-segunda-invasion.md'],
  ['1809', '1º de enero', 'Asonada de Álzaga y los miñones; Saavedra y los Patricios sostienen a Liniers.', '1807-1810-consecuencias.md'],
  ['1809', 'julio', 'Llega el virrey Cisneros; Liniers se establece en Córdoba.', '1807-1810-consecuencias.md'],
  ['1810', '27 de mayo', 'Circular de la Junta: los diputados del interior se incorporan; expediciones al Alto Perú y Paraguay.', '1807-1810-consecuencias.md'],
  ['1810', '28 de julio', 'Moreno envía a Castelli a cumplir la orden de fusilamiento.', '1807-1810-consecuencias.md'],
  ['1810', '26 de agosto', 'Fusilamiento de Liniers y los jefes de la contrarrevolución en Cabeza de Tigre.', '1807-1810-consecuencias.md'],
];
