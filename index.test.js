// TODO check that pop is modified on mutate and crossover
// TODO check that compare does correct sorting on a 2-element array
// TODO check that pElite, pMutate and nMutations are correctly changing
const { GeneticAlgorithm, Duration } = require('./index');

const DEFAULT_DURATION = Duration.seconds(1);
const DEFAULT_EVENT = 'round';
const DEFAULT_DELAY = 300;
const NGENES = 100;
const DEFAULT_POPSIZE = 200;

const DATATYPES = [
  'u8',
  'u16',
  'u32',
  'i8',
  'i16',
  'i32',
  'f32',
  'f64',
];

const FUNCTS = [
  candidate => candidate.reduce((x, y) => x + y, 0),
  candidate => candidate.reduce((x, y) => x - y, 0),
  [
    candidate => candidate.reduce((x, y) => x + y, 0),
    candidate => candidate.reduce((x, y) => x - y, 0),
  ],
];

/**
 * @param {Function[]} checks
 * @param {{}} opts
 * @param {String} event
 * @param {String[]} dtypes
 * @param {(Function|Function[])[]} fitnessFuncts
 * @param {Number} duration
 */
function simulateAll(
  checks = [],
  opts = {},
  event = DEFAULT_EVENT,
  dtypes = DATATYPES,
  fitnessFuncts = FUNCTS,
) {
  return dtypes.forEach((dtype, idx) => fitnessFuncts.forEach((fitness) => {
    const ga = new GeneticAlgorithm(
      fitness,
      NGENES,
      dtype,
      Object.assign({ timeOutMS: DEFAULT_DURATION, popSize: DEFAULT_POPSIZE }, opts),
    );
    for (const f of checks) {
      ga.on(event, () => f(ga));
    }
    Array.from(ga.search());
  }));
}

test('search is a public method on GeneticAlgorithm', () => {
  simulateAll([
    ga => expect(ga).toHaveProperty('search'),
  ]);
});

test('rIdx INT is defined (and public) during runtime', () => {
  simulateAll([
    ga => expect(ga).toHaveProperty('rIdx'),
    ga => expect(Number.isInteger(ga.rIdx)).toBeTruthy(),
  ]);
});

test('op ("mutate" or "crossover") is defined (and public) during runtime after either occurrs', () => {
  simulateAll([
    ga => expect(ga).toHaveProperty('op'),
    ga => expect(ga.op).toMatch(/^(mutate|crossover)$/),
  ], {}, 'op');
});

test('rank INT is defined (and public) during runtime', () => {
  simulateAll([
    ga => expect(ga).toHaveProperty('rank'),
    ga => expect(Number.isInteger(ga.rank)).toBeTruthy(),
  ]);
});

test('cIdx is defined (and public) during runtime', () => {
  simulateAll([
    ga => expect(ga).toHaveProperty('cIdx'),
    ga => expect(Number.isInteger(ga.cIdx)).toBeTruthy(),
  ]);
});

test('pop TYPED ARRAY is valid and defined (and public) when starting', () => {
  simulateAll([
    ga => expect(ga).toHaveProperty('pop'),
    ga => expect(ga.pop).toHaveProperty('length'),
    ga => expect(ga.pop.length > 0).toBeTruthy(),
    ga => expect(ga.pop).not.toContain(null),
    ga => expect(ga.pop).not.toContain(undefined),
    ga => expect(ga.pop).not.toContain(Infinity),
    ga => expect(ga.pop).not.toContain(-Infinity),
    ga => expect(ga.pop).not.toContain(NaN),
  ], 'start');
});

test('idxs TYPED ARRAY is valid and defined (and public) when starting', () => {
  simulateAll([
    ga => expect(ga).toHaveProperty('idxs'),
    ga => expect(ga.idxs).toHaveProperty('length'),
    ga => expect(ga.idxs.length > 0).toBeTruthy(),
    ga => expect(ga.idxs).not.toContain(null),
    ga => expect(ga.idxs).not.toContain(undefined),
    ga => expect(ga.idxs).not.toContain(Infinity),
    ga => expect(ga.idxs).not.toContain(-Infinity),
    ga => expect(ga.idxs).not.toContain(NaN),
  ], 'start');
});

test('bestScores TYPED ARRAY is valid and defined (and public) when starting', () => {
  simulateAll([
    ga => expect(ga).toHaveProperty('bestScores'),
    ga => expect(ga.bestScores).toHaveProperty('length'),
    ga => expect(ga.bestScores.length > 0).toBeTruthy(),
    ga => expect(ga.bestScores).not.toContain(null),
    ga => expect(ga.bestScores).not.toContain(undefined),
    ga => expect(ga.bestScores).not.toContain(Infinity),
    ga => expect(ga.bestScores).not.toContain(-Infinity),
    ga => expect(ga.bestScores).not.toContain(NaN),
  ], 'start');
});

test('scores TYPED ARRAY is valid and defined (and public) when starting', () => {
  simulateAll([
    ga => expect(ga).toHaveProperty('scores'),
    ga => expect(ga.scores).toHaveProperty('length'),
    ga => expect(ga.scores.length > 0).toBeTruthy(),
    ga => expect(ga.scores).not.toContain(null),
    ga => expect(ga.scores).not.toContain(undefined),
    ga => expect(ga.scores).not.toContain(Infinity),
    ga => expect(ga.scores).not.toContain(-Infinity),
    ga => expect(ga.scores).not.toContain(NaN),
  ], 'start');
});

test('start time (startTm INT) is defined and public during runtime', () => {
  simulateAll([
    ga => expect(ga).toHaveProperty('startTm'),
    ga => expect(Number.isInteger(ga.startTm)).toBeTruthy(),
  ], {}, 'start');
});

test('scores are improving with time', () => {
  simulateAll([
    ga => {
      const snaphshot1 = ga.scores;
      setTimeout(() => {
        const snaphshot2 = ga.scores;
        const sum1 = snaphshot1.reduce((x, y) => x + y, 0);
        const sum2 = snaphshot2.reduce((x, y) => x + y, 0);
        expect(sum2).toBeGreaterThan(sum1);
      }, DEFAULT_DELAY);
    },
  ]);
});

test('time and % done are advancing', () => {
  simulateAll([
    ga => {
      const pDone1 = ga.percentageDone;
      setTimeout(() => expect(ga.percentageDone).toBeGreaterThan(pDone1), DEFAULT_DELAY);
    },
    ga => {
      const rIdx1 = ga.rIdx;
      setTimeout(() => expect(ga.rIdx).toBeGreaterThan(rIdx1), DEFAULT_DELAY);
    },
    ga => {
      const tm1 = ga.timeTakenMS;
      setTimeout(() => expect(ga.timeTakenMS).toBeGreaterThan(tm1), DEFAULT_DELAY);
    },
    ga => {
      const pDoneTime = ga.percentageDoneTime;
      setTimeout(() => expect(ga.percentageDoneTime).toBeGreaterThan(pDoneTime), DEFAULT_DELAY);
    },
    ga => {
      const pDoneRounds = ga.percentageDoneRounds;
      setTimeout(() => expect(ga.percentageDoneRounds).toBeGreaterThan(pDoneRounds), DEFAULT_DELAY);
    },
  ]);
});

test('best candidate (0th best) is accessible and is not empty', () => {
  simulateAll([
    ga => expect(ga).toHaveProperty('bestCand'),
    ga => expect(ga.bestCand).toHaveProperty('length'),
    ga => expect(ga.bestCand.length > 0).toBeTruthy(),
    ga => expect(ga).toHaveProperty('nthBestCand'),
    ga => expect(ga.nthBestCand(0)).toStrictEqual(ga.bestCand),
  ]);
});


describe('ga does well on simple problems', () => {
  const f = (cand) => cand.reduce((x, y) => x + y, 0);
  for (const dt of ['u', 'i']) {
    for (const nBits of [8, 16, 32]) {
      const bestPossible = 2 ** (dt === 'u' ? nBits : nBits - 1) * NGENES;
      const dtype = `${dt}${nBits}`;
      const timeSec = 5;
      test(`dtype = ${dtype}, best possible = ${bestPossible} (${timeSec} sec)`, () => {
        simulateAll(
          [ga => expect(f(ga.bestCand) / bestPossible).toBeGreaterThan(0.85)],
          { timeOutMS: Duration.seconds(timeSec) },
          'end',
          [dtype],
          [f],
        );
      });
    }
  }
});
