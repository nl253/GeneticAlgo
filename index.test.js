/* eslint-disable @typescript-eslint/explicit-function-return-type,complexity */
// eslint-disable-next-line filenames/match-regex
const { GeneticAlgorithm, Duration, NRounds } = require('./index');

/**
 * @callback FitnessFunct
 * @param {TypedArray}
 * @returns {number}
 */

/**
 * @typedef {'u32'|'u16'|'u8'|'f64'|'f32'|'i32'|'i16'|'i8'} DType
 * @typedef {Uint8Array|Uint16Array|Uint32Array|Int8Array|Int16Array|Int32Array|Float32Array|Float64Array} TypedArray
 * @typedef {'start'|'end'|'round'|'op'|'timeout'|'score'} GeneticAlgorithmEvent
 */

/**
 * @callback GeneticAlgorithmCheckFunct
 * @param {GeneticAlgorithm}
 */

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

/**
 * @type {DType[]}
 */
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

/**
 * @type {Array<FitnessFunct|FitnessFunct[]>}
 */
const FUNCTS = [
  (candidate) => candidate.reduce((x, y) => x + y, 0),
  (candidate) => candidate.reduce((x, y) => x - y, 0),
  [
    (candidate) => candidate.reduce((x, y) => x + y, 0),
    (candidate) => candidate.reduce((x, y) => x - y, 0),
  ],
];

/**
 * @param {GeneticAlgorithmCheckFunct[]} checks
 * @param {Record<string, *>} opts
 * @param {GeneticAlgorithmEvent} event
 * @param {DType[]} dtypes
 * @param {FitnessFunct|FitnessFunct[]} fitnessFuncts
 */
const simulate = (
  checks = [],
  opts = {},
  event = DEFAULT_EVENT,
  dtypes = DATATYPES,
  fitnessFuncts = FUNCTS,
) => {
  const mergedOpts = { ...DEFAULT_OPTS, ...opts };
  for (const dtype of dtypes) {
    for (const fitness of fitnessFuncts) {
      const ga = new GeneticAlgorithm(fitness, DEFAULT_NGENES, dtype, mergedOpts);
      for (const f of checks) {
        ga.on(event, () => f(ga));
      }
      Array.from(ga.search());
    }
  }
};

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

  for (const prop of [
    'idxs',
    'pop',
    'bestScores',
    'scores'
  ]) {
    test(`${prop} TYPED ARRAY is valid, defined and public when starting`, () => {
      simulate([
        (ga) => expect(ga).toHaveProperty(prop),
        (ga) => expect(ga[prop]).toHaveProperty('length'),
        (ga) => expect(ga[prop].length > 0).toBe(true),
        (ga) => expect(ga[prop]).not.toContain(null),
        (ga) => expect(ga[prop]).not.toContain(undefined),
        (ga) => expect(ga[prop]).not.toContain(Infinity),
        (ga) => expect(ga[prop]).not.toContain(-Infinity),
        (ga) => expect(ga[prop]).not.toContain(NaN),
      ], {}, 'start');
    });
  }

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
          expect(ga.percentageDoneTime).toBeGreaterThan(percentageDoneTime);
        }, DEFAULT_DELAY);
      },
    ]);
  });

  describe('dynamic vars', () => {
    const vars = [
      { name: 'pMutate', percentageOf: 1 },
      { name: 'nMutations', percentageOf: DEFAULT_NGENES },
      { name: 'nElite', percentageOf: DEFAULT_POPSIZE },
    ];
    for (const v of vars) {
      const { name, percentageOf } = v;
      const lBound = Math.random() / 2;
      const uBound = lBound + Math.random() / 2;
      let lowerBound = percentageOf === 1 ? lBound : Math.ceil(lBound * percentageOf);
      let upperBound = percentageOf === 1 ? uBound : Math.ceil(uBound * percentageOf);

      for (let i = 0; i < 2; i++) {
        describe(`${name} with ${i === 0 ? 'inc' : 'dec'}creasing bounds ${lowerBound}..${upperBound}`, () => {
          const smaller = Math.min(upperBound, lowerBound);
          const larger = Math.max(upperBound, lowerBound);

          /**
           * @param {number} x
           */
          const checkBetween = (x) => {
            expect(x).toBeGreaterThanOrEqual(smaller);
            expect(x).toBeLessThanOrEqual(larger);
          };

          test(`using [${lowerBound}, ${upperBound}] notation`, () => {
            simulate([(ga) => checkBetween(ga[name])], { [name]: [lowerBound, upperBound] }, 'op');
          });

          test(`using { start: ${lowerBound}, end: ${upperBound} } notation`, () => {
            simulate([(ga) => checkBetween(ga[name])], { [name]: { start: lowerBound, end: upperBound } }, 'op');
          });

          test(`using { start: ${lowerBound}, end: ${upperBound}, whenFit: "constant" } notation`, () => {
            simulate(
              [(ga) => expect(ga[name]).toBeCloseTo(lowerBound)],
              { [name]: { start: lowerBound, end: lowerBound, whenFit: 'constant' } },
              'op',
            );
          });

          for (const bound of [lowerBound, upperBound]) {
            test(`using { start: ${lowerBound}, end: ${upperBound}, whenFit: "constant" } notation`, () => {
              simulate(
                [(ga) => expect(ga[name]).toBeCloseTo(bound)],
                { [name]: { start: bound, end: bound, whenFit: 'constant' } },
                'op',
              );
            });

            test(`using ${bound} notation`, () => {
              simulate(
                [(ga) => expect(ga[name]).toBeCloseTo(bound)],
                { [name]: bound },
                'op',
              );
            });
          }
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
  for (const dt of [
    'u',
    'i'
  ]) {
    for (const nBits of [
      8,
      16,
      32
    ]) {
      const bestPossible = 2 ** (dt === 'u' ? nBits : nBits - 1) * DEFAULT_NGENES;
      const dtype = `${dt}${nBits}`;
      const timeSec = 5;
      const nRounds = NRounds.MEDIUM;
      const timeOutMS = Duration.seconds(timeSec);
      test(`dtype = ${dtype}, best possible = ${bestPossible} (${timeSec} sec)`, () => {
        simulate(
          [(ga) => expect(f(ga.bestCand) / bestPossible).toBeGreaterThan(DEFAULT_MIN_PERF)],
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
