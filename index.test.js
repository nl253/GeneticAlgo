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
 * @param {GeneticAlgorithm} ga
 */

const DEFAULT_DURATION = Duration.seconds(1);
const DEFAULT_EVENT = 'round';
const DEFAULT_DELAY = 300;
const DEFAULT_NROUNDS = 20;
const DEFAULT_NGENES = 100;
const DEFAULT_POPSIZE = 200;
const DEFAULT_MIN_PERF = 0.85;
const FLOAT_DELTA = 1E-4;

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
 * @param {Object<GeneticAlgorithmCheckFunct>|GeneticAlgorithmCheckFunct} checks
 * @param {Record<string, *>} opts
 * @param {DType[]} dtypes
 * @param {FitnessFunct|FitnessFunct[]} fitnessFuncts
 */
const simulate = (checks = {}, opts = {}, dtypes = DATATYPES, fitnessFuncts = FUNCTS) => {
  const mergedOpts = { ...DEFAULT_OPTS, ...opts };
  for (const dtype of dtypes) {
    for (const fitness of fitnessFuncts) {
      const ga = new GeneticAlgorithm(fitness, DEFAULT_NGENES, dtype, mergedOpts);
      if (checks.constructor.name !== 'Object') {
        ga.on(DEFAULT_EVENT, () => checks(ga));
      } else {
        for (const event of Object.keys(checks)) {
          ga.on(event, () => checks[event](ga));
        }
      }
      Array.from(ga.search());
    }
  }
};

describe('variables are initialised and accessible', () => {

  test('op ("mutate" or "crossover") is defined (and public) during runtime after either occurrs', () => {
    const op = (ga) => {
      expect(ga).toHaveProperty('op');
      expect(ga.op).toMatch(/^(mutate|crossover)$/);
    };
    simulate({ op });
  });

  const start = (ga) => {
    for (const internalVar of ['cIdx', 'rIdx', 'rank']) {
      test(`${internalVar} INT is defined (and public) during runtime`, () => {
        expect(ga).toHaveProperty(internalVar);
        expect(Number.isInteger(ga[internalVar])).toBeTruthy();
      });
    }
    test('best candidate (0th best) is accessible and is not empty', () => {
      expect(ga).toHaveProperty('bestCand');
      expect(ga.bestCand).toHaveProperty('length');
      expect(ga).toHaveProperty('nthBestCand');
      expect(ga.nthBestCand(0)).toStrictEqual(ga.bestCand);
    });
    test('start time (startTm INT) is defined and public during runtime', () => {
      expect(ga).toHaveProperty('startTm');
      expect(Number.isInteger(ga.startTm)).toBeTruthy();
    });
    test('search is a public method on GeneticAlgorithm', () => {
      expect(ga).toHaveProperty('search');
    });
  };
  simulate({ start });
});

describe('internals are valid', () => {

  for (const prop of ['idxs', 'pop', 'bestScores', 'scores']) {
    test(`${prop} TYPED ARRAY is valid, defined and public when starting`, () => {
      const start = (ga) => {
        expect(ga).toHaveProperty(prop);
        const val = ga[prop];
        expect(val).toHaveProperty('length');
        expect(val.length > 0).toBe(true);
        expect(val).not.toContain(null);
        expect(val).not.toContain(undefined);
        expect(val).not.toContain(Infinity);
        expect(val).not.toContain(-Infinity);
        expect(val).not.toContain(NaN);
      };
      simulate({ start });
    });
  }

  simulate(
    (ga) => {
      test('mutation & crossover modify pop', () => {
        const snapshot = ga.pop;
        const afterDelay = () => expect(ga.pop).not.arrayContaining(snapshot);
        setTimeout(afterDelay, DEFAULT_DELAY);
      });
      test('time and % done are advancing', () => {
        const { percentageDone, rIdx, percentageDoneTime, percentageDoneRounds, timeTakenMS } = ga;
        const afterDelay = () => {
          if (ga.rIdx - rIdx >= 100) {
            expect(ga.percentageDone).toBeGreaterThan(percentageDone);
            expect(ga.percentageDoneRounds).toBeGreaterThan(percentageDoneRounds);
            expect(ga.rIdx).toBeGreaterThan(rIdx);
            expect(ga.timeTakenMS).toBeGreaterThan(timeTakenMS);
            expect(ga.percentageDoneTime).toBeGreaterThan(percentageDoneTime);
          }
        };
        setTimeout(afterDelay, DEFAULT_DELAY);
      });
    }
  );

  describe('dynamic vars', () => {
    const vars = [
      { name: 'pMutate', percentageOf: 1 },
      { name: 'nMutations', percentageOf: DEFAULT_NGENES },
      { name: 'nElite', percentageOf: DEFAULT_POPSIZE },
    ];

    for (const { name, percentageOf } of vars) {
      const lBound = parseFloat((Math.random() / 2).toFixed(2));
      const uBound = parseFloat((lBound + Math.random() / 2).toFixed(2));
      let lowerBound = percentageOf === 1 ? lBound : Math.ceil(lBound * percentageOf);
      let upperBound = percentageOf === 1 ? uBound : Math.ceil(uBound * percentageOf);

      for (let i = 0; i < 2; i++) {
        describe(`${name} with ${i === 0 ? 'inc' : 'dec'}creasing bounds ${lowerBound}..${upperBound}`, () => {
          const smaller = Math.min(upperBound, lowerBound);
          const larger = Math.max(upperBound, lowerBound);

          for (const opts of [{ [name]: [lowerBound, upperBound] }, { [name]: { start: lowerBound, end: upperBound }}]) {
            test(`using [${lowerBound}, ${upperBound}] notation`, () => {
              const op = (ga) => {
                const { rIdx } = ga;
                const val = ga[name];
                expect(val).toBeGreaterThanOrEqual(smaller - FLOAT_DELTA);
                expect(val).toBeLessThanOrEqual(larger + FLOAT_DELTA);
                const snapshot1 = val;
                const afterDelay = () => {
                  if (ga.rIdx - rIdx >= 50) {
                    const snapshot2 = ga[name];
                    if (lowerBound < upperBound) {
                      expect(snapshot2).toBeGreaterThanOrEqual(snapshot1 - FLOAT_DELTA);
                    } else if (lowerBound > upperBound) {
                      expect(snapshot2).toBeLessThanOrEqual(snapshot1 + FLOAT_DELTA);
                    }
                  }
                };
                setTimeout(afterDelay, DEFAULT_DELAY);
              };
              simulate({ op }, opts);
            });
          }

          for (const bound of [lowerBound, upperBound]) {
            const optsBrace = { [name]: { start: bound, end: bound, whenFit: 'constant' } };
            const optsConst = { [name]: bound };
            for (const opts of [optsBrace, optsConst]) {
              test(`using ${JSON.stringify(opts)} notation`, () => {
                const op = (ga) => expect(ga[name]).toBeCloseTo(bound);
                simulate({ op }, opts);
              });
            }
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
  simulate(
    (ga) => {
      const snapshot1 = ga.scores;
      const afterDelay = () => {
        const snapshot2 = ga.scores;
        const sum1 = snapshot1.reduce((x, y) => x + y, 0);
        const sum2 = snapshot2.reduce((x, y) => x + y, 0);
        expect(sum2).toBeGreaterThan(sum1);
      };
      setTimeout(afterDelay, DEFAULT_DELAY);
    },
  );
});

describe('ga does well on simple problems', () => {
  const f = (cand) => cand.reduce((x, y) => x + y, 0);
  const timeSec = 5;
  const timeOutMS = Duration.seconds(timeSec);
  const nRounds = NRounds.MEDIUM;
  for (const dt of ['u', 'i']) {
    for (const nBits of [8, 16, 32]) {
      const bestPossible = 2 ** (dt === 'u' ? nBits : nBits - 1) * DEFAULT_NGENES;
      const dtype = `${dt}${nBits}`;
      test(`dtype = ${dtype}, best possible = ${bestPossible} (${timeSec} sec)`, () => {
        const opts = { timeOutMS, nRounds };
        const end = (ga) => expect(f(ga.bestCand) / bestPossible).toBeGreaterThan(DEFAULT_MIN_PERF);
        simulate({ end }, opts, [dtype], [f]);
      });
    }
  }
});

test.todo('idxs are sorted properly so that they are shifted to the left (towards 0) when candidates are fitter');

test.todo('dynamic parameters pMutate, nMutations and nElite are adjusted correctly');
