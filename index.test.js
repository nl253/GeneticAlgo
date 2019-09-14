const { GeneticAlgorithm, Duration } = require('./index');

const DEFAULT_DURATION = Duration.seconds(2);
const DEFAULT_EVENT = 'round';
const NGENES = 100;

const dtypes = [
  'u8',
  'u16',
  'u32',
  'i8',
  'i16',
  'i32',
  'f32',
  'f64',
];

function simulate(
  checks = [],
  opts = {},
  event = DEFAULT_EVENT,
  duration = DEFAULT_DURATION,
  dtype = 'u32',
) {
  const fitness = candidate => candidate.reduce((x, y) => x + y, 0);
  const ga = new GeneticAlgorithm(fitness, NGENES, dtype, Object.assign({timeOutMS: duration}, opts));
  for (const f of checks) {
    ga.on(DEFAULT_EVENT, () => f(ga));
  }
  return [...ga.search()];
}

function simulateAll(
  checks = [],
  opts = {},
  durations = Array(dtypes.length).fill(DEFAULT_DURATION),
) {
  return dtypes.forEach((dtype, idx) => simulate(checks, opts, DEFAULT_EVENT, durations[idx], dtype));
}

test('rIdx INT is defined (and public) during runtime', () => {
  simulateAll([
    ga => expect(ga.rIdx).toBeDefined(),
    ga => expect(Number.isInteger(ga.rIdx)).toBeTruthy(),
  ]);
});

test('op ("mutate" or "crossover") is defined (and public) during runtime', () => {
  simulateAll([
    ga => expect(ga.op).toBeDefined(),
    ga => expect(ga.op).toMatch(/^(mutate|crossover)$/),
  ]);
});

test('rank INT is defined (and public) during runtime', () => {
  simulateAll([
    ga => expect(ga.rank).toBeDefined(),
    ga => expect(Number.isInteger(ga.rank)).toBeTruthy(),
  ]);
});

test('cIdx is defined (and public) during runtime', () => {
  simulateAll([
    ga => expect(ga.cIdx).toBeDefined(),
    ga => expect(Number.isInteger(ga.cIdx)).toBeTruthy(),
  ]);
});
