// eslint-disable-next-line filenames/match-regex
const { GeneticAlgorithm, Duration, NRounds } = require('./index');

const DEFAULT_DURATION = Duration.seconds(1);
const DEFAULT_EVENT = 'round';
const DEFAULT_DELAY = 300;
const DEFAULT_NROUNDS = 20;
const DEFAULT_NGENES = 100;
const DEFAULT_POPSIZE = 200;
const DEFAULT_MIN_PERF = 0.85;

const DEFAULT_OPTS = {
  timeOutMS: DEFAULT_DURATION,
  popSize: DEFAULT_POPSIZE,
  nRounds: DEFAULT_NROUNDS,
};

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
  (candidate) => candidate.reduce((x, y) => x + y, 0),
  (candidate) => candidate.reduce((x, y) => x - y, 0),
  [
    (candidate) => candidate.reduce((x, y) => x + y, 0),
    (candidate) => candidate.reduce((x, y) => x - y, 0),
  ],
];

/**
 * @param {Function[]} checks
 * @param {{}} opts
 * @param {String} event
 * @param {String[]} dtypes
 * @param {(Function|Function[])[]} fitnessFuncts
 */
function simulate(
  checks = [],
  opts = {},
  event = DEFAULT_EVENT,
  dtypes = DATATYPES,
  fitnessFuncts = FUNCTS,
) {
  for (const dtype of dtypes) {
    for (const fitness of fitnessFuncts) {
      const mergedOpts = Object.assign({}, Object.assign(DEFAULT_OPTS, opts));
      const ga = new GeneticAlgorithm(fitness, DEFAULT_NGENES, dtype, mergedOpts);
      for (const f of checks) {
        ga.on(event, () => f(ga));
      }
      Array.from(ga.search());
    }
  }
}

describe('public variables are accessible', () => {
  test('search is a public method on GeneticAlgorithm', () => {
    simulate([(ga) => expect(ga).toHaveProperty('search')]);
  });

  test('rIdx INT is defined (and public) during runtime', () => {
    simulate([
      (ga) => expect(ga).toHaveProperty('rIdx'),
      (ga) => expect(Number.isInteger(ga.rIdx)).toBeTruthy(),
    ]);
  });

  test('op ("mutate" or "crossover") is defined (and public) during runtime after either occurrs', () => {
    simulate([
      (ga) => expect(ga).toHaveProperty('op'),
      (ga) => expect(ga.op).toMatch(/^(mutate|crossover)$/),
    ], {}, 'op');
  });

  test('rank INT is defined (and public) during runtime', () => {
    simulate([
      (ga) => expect(ga).toHaveProperty('rank'),
      (ga) => expect(Number.isInteger(ga.rank)).toBeTruthy(),
    ]);
  });

  test('cIdx is defined (and public) during runtime', () => {
    simulate([
      (ga) => expect(ga).toHaveProperty('cIdx'),
      (ga) => expect(Number.isInteger(ga.cIdx)).toBeTruthy(),
    ]);
  });

  test('start time (startTm INT) is defined and public during runtime', () => {
    simulate([
      (ga) => expect(ga).toHaveProperty('startTm'),
      (ga) => expect(Number.isInteger(ga.startTm)).toBeTruthy(),
    ], {}, 'start');
  });

  test('best candidate (0th best) is accessible and is not empty', () => {
    simulate([
      (ga) => expect(ga).toHaveProperty('bestCand'),
      (ga) => expect(ga.bestCand).toHaveProperty('length'),
      (ga) => expect(ga).toHaveProperty('nthBestCand'),
      (ga) => expect(ga.nthBestCand(0)).toStrictEqual(ga.bestCand),
    ]);
  });

});

describe('internals are valid', () => {

  test('pop TYPED ARRAY is valid and defined (and public) when starting', () => {
    simulate([
      (ga) => expect(ga).toHaveProperty('pop'),
      (ga) => expect(ga.pop).toHaveProperty('length'),
      (ga) => expect(ga.pop.length > 0).toBeTruthy(),
      (ga) => expect(ga.pop).not.toContain(null),
      (ga) => expect(ga.pop).not.toContain(undefined),
      (ga) => expect(ga.pop).not.toContain(Infinity),
      (ga) => expect(ga.pop).not.toContain(-Infinity),
      (ga) => expect(ga.pop).not.toContain(NaN),
    ], 'start');
  });

  test('idxs TYPED ARRAY is valid and defined (and public) when starting', () => {
    simulate([
      (ga) => expect(ga).toHaveProperty('idxs'),
      (ga) => expect(ga.idxs).toHaveProperty('length'),
      (ga) => expect(ga.idxs.length > 0).toBeTruthy(),
      (ga) => expect(ga.idxs).not.toContain(null),
      (ga) => expect(ga.idxs).not.toContain(undefined),
      (ga) => expect(ga.idxs).not.toContain(Infinity),
      (ga) => expect(ga.idxs).not.toContain(-Infinity),
      (ga) => expect(ga.idxs).not.toContain(NaN),
    ], 'start');
  });

  test('bestScores TYPED ARRAY is valid and defined (and public) when starting', () => {
    simulate([
      (ga) => expect(ga).toHaveProperty('bestScores'),
      (ga) => expect(ga.bestScores).toHaveProperty('length'),
      (ga) => expect(ga.bestScores.length > 0).toBeTruthy(),
      (ga) => expect(ga.bestScores).not.toContain(null),
      (ga) => expect(ga.bestScores).not.toContain(undefined),
      (ga) => expect(ga.bestScores).not.toContain(Infinity),
      (ga) => expect(ga.bestScores).not.toContain(-Infinity),
      (ga) => expect(ga.bestScores).not.toContain(NaN),
    ], 'start');
  });

  test('scores TYPED ARRAY is valid and defined (and public) when starting', () => {
    simulate([
      (ga) => expect(ga).toHaveProperty('scores'),
      (ga) => expect(ga.scores).toHaveProperty('length'),
      (ga) => expect(ga.scores.length > 0).toBeTruthy(),
      (ga) => expect(ga.scores).not.toContain(null),
      (ga) => expect(ga.scores).not.toContain(undefined),
      (ga) => expect(ga.scores).not.toContain(Infinity),
      (ga) => expect(ga.scores).not.toContain(-Infinity),
      (ga) => expect(ga.scores).not.toContain(NaN),
    ], 'start');
  });

  test('mutation & crossover modify pop', () => {
    simulate([
      (ga) => {
        const snaphshot = ga.pop;
        setTimeout(() => expect(ga.pop).not.arrayContaining(snaphshot), DEFAULT_DELAY);
      },
    ]);
  });

  test('time and % done are advancing', () => {
    simulate([
      (ga) => {
        const { percentageDone, rIdx, percentageDoneTime, percentageDoneRounds, timeTakenMS } = ga.percentageDone;
        setTimeout(() => {
          expect(ga.percentageDone).toBeGreaterThan(percentageDone);
          expect(ga.percentageDoneRounds).toBeGreaterThan(percentageDoneRounds);
          expect(ga.rIdx).toBeGreaterThan(rIdx);
          expect(ga.timeTakenMS).toBeGreaterThan(timeTakenMS);
          expect(ga.percentageDoneTime).toBeGreaterThan(percentageDoneTime)
        }, DEFAULT_DELAY);
      },
    ]);
  });

  describe('test dynamic vars', () => {
    const vars = [
      { name: 'pMutate', percentageOf: 1 },
      { name: 'nMutations', percentageOf: DEFAULT_NGENES },
      { name: 'nElite', percentageOf: DEFAULT_POPSIZE },
    ];
    for (const v of vars) {
      const { name, percentageOf } = v;
      const lBound = Math.random() / 2;
      const uBound = lBound + Math.random() / 2;
      let lowerBound = percentageOf === 1 ? lBound * percentageOf : Math.ceil(lBound * percentageOf);
      let upperBound = percentageOf === 1 ? uBound * percentageOf : Math.ceil(uBound * percentageOf);
      for (let i = 0; i < 2; i++) {
        describe(`${name} with ${i === 0 ? 'inc' : 'dec'}creasing bounds ${lowerBound}..${upperBound}`, () => {
          const smaller = Math.min(upperBound, lowerBound);
          const larger = Math.max(upperBound, lowerBound);
          const checkBetween = x => {
            expect(x).toBeGreaterThanOrEqual(smaller);
            expect(x).toBeLessThanOrEqual(larger);
          };
          test(`using [${lowerBound}, ${upperBound}] notation`, () => {
            simulate([(ga) => checkBetween(ga[name])], { pMutate: [lowerBound, upperBound] }, 'op');
          });
          test(`using { start: ${lowerBound}, end: ${upperBound} } notation`, () => {
            simulate([(ga) => checkBetween(ga[name])], { [name]: { start: lowerBound, end: upperBound } }, 'op');
          });
          test(`using { start: ${lowerBound}, end: ${upperBound}, whenFit: "constant" } notation`, () => {
            simulate([(ga) => checkBetween(ga[name])], { [name]: { start: lowerBound, end: upperBound, whenFit: 'constant' } }, 'op');
          });
        });
        // swap
        const tmp = upperBound;
        upperBound = lowerBound;
        lowerBound = tmp;
      }
    }
  });

});

test('scores are improving with time', () => {
  simulate([
    (ga) => {
      const snaphshot1 = ga.scores;
      const afterDelay = () => {
        const snaphshot2 = ga.scores;
        const sum1 = snaphshot1.reduce((x, y) => x + y, 0);
        const sum2 = snaphshot2.reduce((x, y) => x + y, 0);
        expect(sum2).toBeGreaterThan(sum1);
      };
      setTimeout(afterDelay, DEFAULT_DELAY);
    },
  ]);
});

describe('ga does well on simple problems', () => {
  const f = (cand) => cand.reduce((x, y) => x + y, 0);
  for (const dt of ['u', 'i']) {
    for (const nBits of [8, 16, 32]) {
      const bestPossible = 2 ** (dt === 'u' ? nBits : nBits - 1) * DEFAULT_NGENES;
      const dtype = `${dt}${nBits}`;
      const timeSec = 5;
      const nRounds = NRounds.MEDIUM;
      const timeOutMS = Duration.seconds(timeSec);
      test(`dtype = ${dtype}, best possible = ${bestPossible} (${timeSec} sec)`, () => {
        simulate(
          [
            (ga) => expect(f(ga.bestCand) / bestPossible).toBeGreaterThan(DEFAULT_MIN_PERF),
          ],
          { timeOutMS, nRounds },
          'end',
          [dtype],
          [f],
        );
      });
    }
  }
});

test.todo('idxs are sorted properly so that they are shifted to the left (towards 0) when candidates are fitter');
test.todo('dynamic parameters pMutate, nMutations and nElite are adjusted correctly');
