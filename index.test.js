/* eslint-disable @typescript-eslint/explicit-function-return-type,complexity */
// eslint-disable-next-line filenames/match-regex
const { GeneticAlgorithm, Duration, NRounds } = require('./index');


/**
 * @callback FitnessFunct
 * @param {TypedArray}
 * @returns {number}
 */

/**
 * @callback GeneticAlgorithmCheckFunct
 * @param {GeneticAlgorithm}
 */

/**
 * @typedef {'u32'|'u16'|'u8'|'f64'|'f32'|'i32'|'i16'|'i8'} DType
 * @typedef {Uint8Array|Uint16Array|Uint32Array|Int8Array|Int16Array|Int32Array|Float32Array|Float64Array} TypedArray
 * @typedef {'start'|'end'|'round'|'op'|'timeout'|'score'} GeneticAlgorithmEvent
 */

const DEFAULT_EVENT = 'round';
const DEFAULT_DELAY = 300;
const DEFAULT_NGENES = 100;
const DEFAULT_POPSIZE = 200;
const DEFAULT_MIN_PERF = 0.85;
const FLOAT_DELTA = 1E-4;

expect.extend({
  toBeInRange(x, min, max) {
    return {
      message: () => `expected ${x} not to in [${min}, ${max})`,
      pass: x >= (min - FLOAT_DELTA) && x < (max + FLOAT_DELTA),
    };
  },
  toBeValidNum(x) {
    return {
      message: () => `expected ${x} to be a valid number`,
      pass: ![null, undefined, Infinity, -Infinity, NaN].some((y) => Object.is(y, x)),
    };
  },
  toBeValidNumArray(xs) {
    return {
      message: () => `expected ${xs} to be a valid array of numbers`,
      pass: !xs.some((x) => [null, undefined, Infinity, -Infinity, NaN].some((y) => Object.is(y, x))),
    };
  },
  toBeArrayLike(x) {
    return {
      message: () => `expected ${x} to be Array-like`,
      pass: x.length !== undefined,
    };
  },
  toBeEmpty(x) {
    return {
      message: () => `expected ${x} to be empty`,
      pass: x.length === 0,
    };
  },
  toBeInt(x) {
    return {
      message: () => `expected ${x} to be an int`,
      pass: Number.isInteger(x),
    };
  },
  toBeNatural(x) {
    return {
      message: () => `expected ${x} to be int >= 0`,
      pass: Number.isInteger(x) && x >= 0,
    };
  },
});

const DEFAULT_OPTS = {
  timeOutMS: Duration.seconds(1),
  popSize: DEFAULT_POPSIZE,
  nRounds: 20,
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
      if (checks.constructor.name === 'Object') {
        for (const event of Object.keys(checks)) {
          ga.on(event, () => checks[event](ga));
        }
      } else {
        ga.on(DEFAULT_EVENT, () => checks(ga));
      }
      Array.from(ga.search());
    }
  }
};

test('variables are initialised and accessible', () => {
  const op = (ga) => {
    expect(ga).toHaveProperty('op');
    expect(ga.op).toMatch(/^(mutate|crossover)$/);
  };

  const start = (ga) => {
    const varNames = ['bestCand', 'startTm', 'search', 'nthBestCand', 'cIdx', 'rIdx', 'rank'];
    const intVarNames = ['cIdx', 'rIdx', 'rank'];
    for (const name of varNames) {
      expect(ga).toHaveProperty(name);
    }
    for (const name of intVarNames) {
      expect(ga[name]).toBeNatural();
    }
    expect(ga.bestCand).toHaveProperty('length');
    expect(ga.nthBestCand(0)).toStrictEqual(ga.bestCand);
    expect(ga.startTm).toBeNatural();
  };
  simulate({ start, op });
});

describe('internals are valid', () => {
  const start = (ga) => {
    const props = ['idxs', 'pop', 'bestScores', 'scores'];
    test(`${props.join(', ')} are valid TYPED ARRAYs, defined and public when starting`, () => {
      for (const prop of props) {
        expect(ga).toHaveProperty(prop);
        const val = ga[prop];
        expect(val).toBeArrayLike();
        expect(val).not.toBeEmpty();
        expect(val).toBeValidNumArray();
      }
    });
  };
  const round = (ga) => {
    const old = {};
    test('mutation & crossover modify pop', () => {
      const pop = [...ga.pop];
      if (old.pop !== undefined) {
        expect(old.pop).not.arrayContaining(pop);
      }
      old.pop = pop;
    });
    test('time and % done are advancing', () => {
      for (const variable of ['percentageDone', 'percentageDoneTime', 'percentageDoneRounds', 'rIdx', 'timeTakenMS']) {
        const val = ga[variable];
        if (old[variable] !== undefined) {
          expect(val).toBeGreaterThan(old[variable]);
        }
        old[variable] = val;
      }
    });
  };
  simulate({ start, round });

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
      const smaller = Math.min(upperBound, lowerBound);
      const larger = Math.max(upperBound, lowerBound);

      const optsArray = [{ [name]: [lowerBound, upperBound] }, { [name]: { start: lowerBound, end: upperBound }}];

      for (const opts of optsArray) {
        test(`${name} set using ${JSON.stringify(opts)} notation`, () => {
          let old;
          simulate((ga) => {
            const val = ga[name];
            expect(val).toBeInRange(smaller, larger);
            if (old !== undefined) {
              if (lowerBound < upperBound) {
                expect(val).toBeGreaterThanOrEqual(old - FLOAT_DELTA);
              } else if (lowerBound > upperBound) {
                expect(val).toBeLessThanOrEqual(old + FLOAT_DELTA);
              }
            }
            old = val;
          }, opts);
        });
      }

      for (const bound of [lowerBound, upperBound]) {
        const optsBrace = { [name]: { start: bound, end: bound, whenFit: 'constant' } };
        const optsConst = { [name]: bound };
        for (const opts of [optsBrace, optsConst]) {
          describe(`using ${JSON.stringify(opts)} notation`, () => {
            simulate((ga) => test(`value of ${name} should not change and be ${bound}`, () => expect(ga[name]).toBeCloseTo(bound)), opts);
          });
        }
      }

      // swap
      const tmp = upperBound;
      upperBound = lowerBound;
      lowerBound = tmp;
    }
  }
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
  const opts = { timeOutMS, nRounds };
  for (const dt of ['u', 'i']) {
    for (const nBits of [8, 16, 32]) {
      const bestPossible = 2 ** (dt === 'u' ? nBits : nBits - 1) * DEFAULT_NGENES;
      const dtype = `${dt}${nBits}`;
      describe(`dtype = ${dtype}, best possible = ${bestPossible} (${timeSec} sec)`, () => {
        const end = (ga) => test(`performance is >= ${DEFAULT_MIN_PERF}`, () => expect(f(ga.bestCand) / bestPossible).toBeGreaterThan(DEFAULT_MIN_PERF));
        simulate({ end }, opts, [dtype], [f]);
      });
    }
  }
});

test.todo('idxs are sorted properly so that they are shifted to the left (towards 0) when candidates are fitter');
test.todo('dynamic parameters pMutate, nMutations and nElite are adjusted correctly');
