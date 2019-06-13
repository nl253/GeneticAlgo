/* eslint-disable sort-keys,global-require,no-magic-numbers,complexity,max-lines,no-undefined,null,null,key-spacing,no-multi-spaces */
/**
 * TODO keep track of old scores for every objective
 * TODO algorithms is stuck if it makes no progress on all objectives
 * TODO better handling of isFinished
 * TODO compute improvement whilst considering all objectives
 * TODO rethink the require architecture
 *
 * 1. Have an option to replace function such as getPopulation so that the user of the API can have custom initialisation.
 * 2. Have the option to set static and dynamic values for parameters.
 * 3. For each option you can specify a constant, a [min, max] range or you may not specify it and a default will be chosen.
 *
 * @typedef {Float64Array|Float32Array|Int32Array|Int16Array|Int8Array|Uint32Array|Uint16Array|Uint8Array} TypedArray
 * @typedef {'f64'|'f32'|'i32'|'i16'|'i8'|'u32'|'u16'|'u8'} DType
 * @typedef {function(TypedArray): !Number} FitnessFunct
 * @typedef {!Array<?Number>|{min: !Number, max: ?Number}|!Number} NumericOpt
 */
import * as util        from 'util';
import { EventEmitter } from 'events';

import registerLogging from './logging';

enum Dtype { U32, U16, U8, F64, F32, I32, I16, I8 }

enum Behaviour { INCREASES, DECREASES, CONSTANT }

type NumOpt = number | [number, number] | { start: number, end: number, whenFit?: Behaviour };
type TypedArray =
    Uint8Array
    | Uint16Array
    | Uint32Array
    | Int8Array
    | Int16Array
    | Int32Array
    | Float32Array
    | Float64Array;
type FitnessFunct = (TypedArray) => number;
type UserOpts = {
  pElite?: NumOpt,
  nElite?: NumOpt,
  tournamentSize?: NumOpt,
  pMutate?: NumOpt,
  nMutations?: NumOpt,
  nTrack?: number,
  popSize?: number,
  weights?: Array<number> | TypedArray,
  randValMin?: number,
  randValMax?: number,
  logLvl?: 0 | 1 | 2 | 3,
  timeOutMS?: number,
};
// type CustomFuncts = {
//   compare?: (cIdx1: number, cIdx2: number) => number,
//   isFinished?: (rIdx: number, timeTakenMS: number, improvement: TypedArray) => boolean,
//   getPop?: (nGenes: number, popSize: number) => TypedArray,
//   randGeneVal?: (gIdx: number, min: number, max: number) => number,
//   select?: (cIdx: number, rank: number) => number,
//   mutate?: (cIdx: number, rank: number) => Array<number> | TypedArray /* gene indexes for mutation */,
//   crossover?: (cIdx: number, rank: number, parents: Array<number>) => Array<number> | TypedArray,
// };

function getNumOpt(percentageOf: number | undefined, o: NumOpt): { start: number, end: number, whenFit: Behaviour } {
  if (o.constructor.name === 'Number') {
    // @ts-ignore
    return getNumOpt(percentageOf, [o, o]);
  } else if (o.constructor.name === 'Array') {
    // @ts-ignore
    const [start, end]: [number, number] = o;
    // @ts-ignore
    return getNumOpt(percentageOf, { start, end });
    // @ts-ignore
  } else if (o.whenFit === undefined) {
    // @ts-ignore
    o.whenFit = Behaviour.CONSTANT;
    return getNumOpt(percentageOf, o);
    // @ts-ignore
  } else if (percentageOf !== undefined && o.start < 1.0) {
    // @ts-ignore
    o.start *= percentageOf;
    return getNumOpt(percentageOf, o);
    // @ts-ignore
  } else if (percentageOf !== undefined && o.end < 1.0) {
    // @ts-ignore
    o.end *= percentageOf;
    return getNumOpt(percentageOf, o);
  } else {
    // @ts-ignore
    return o;
  }
}

function optToGetter(
    self: object, name: string, { start, end, whenFit }: { start: number, end: number, whenFit: Behaviour }) {
  return () => {
    if (start === end) {
      self[name] = start;
      return;
    }
    const range = end - start;
    if (whenFit === Behaviour.CONSTANT) {
      Object.defineProperty(self, name, {
        get: function() {
          return start + (this.timeTakenMS / this.timeOutMS) * range;
        },
      });
    } else if (whenFit === Behaviour.DECREASES) {
      Object.defineProperty(self, name, {
        get: function() {
          return start + (this.timeTakenMS / this.timeOutMS) * range * (this.rank / this.popSize);
        },
      });
    } else {
      Object.defineProperty(self, name, {
        get: function() {
          return start + (this.timeTakenMS / this.timeOutMS) * range * (1 - (this.rank / this.popSize));
        },
      });
    }
  };
}

const arrays = {
  f32: n => new Float32Array(new ArrayBuffer(4 * n)),
  f64: n => new Float64Array(new ArrayBuffer(8 * n)),
  i32: n => new Int32Array(new ArrayBuffer(4 * n)),
  u32: n => new Uint32Array(new ArrayBuffer(4 * n)),
  i16: n => new Int16Array(new ArrayBuffer(2 * n)),
  u16: n => new Uint16Array(new ArrayBuffer(2 * n)),
  i8:  n => new Int8Array(new ArrayBuffer(n)),
  u8:  n => new Uint8Array(new ArrayBuffer(n)),
};

class GeneticAlgorithm extends EventEmitter {
  private readonly DEFAULTS = {
    minImprove: 1E-6,
    nRounds:    1E6,
    nTrack:     100,
    popSize:    300,

    nElite:         { start: 0.1, end: 0.3 },
    pElite:         { start: 0.1, end: 0.2, whenFit: Behaviour.DECREASES },
    pMutate:        { start: 0.01, end: 0.8, whenFit: Behaviour.INCREASES },
    tournamentSize: { start: 2, end: 10, whenFit: Behaviour.DECREASES },

    emitFittest:     false, // emit best candidate or index of best candidate
    logLvl:          0,
    timeOutMS:       30 * 1000, // 30 SEC
    validateFitness: false, // check if NaN returned
  };

  public readonly dtype: Dtype;
  public readonly emitFittest: boolean;
  public readonly fitness: Array<FitnessFunct>;
  public readonly minImprove: number;
  public readonly nBits: 8 | 16 | 32 | 64;
  public readonly nElite: number;
  public readonly nGenes: number;
  public readonly popSize: number;
  public readonly nMutations: number;
  public readonly nRounds: number;
  public readonly nTrack: number;
  public readonly pElite: number;
  public readonly pMutate: number;
  public readonly pop: TypedArray;
  public readonly timeOutMS: number;
  public readonly tournamentSize: number;
  public readonly weights: Array<number> | TypedArray;
  // search space bounds (guess from dtype)
  public readonly randValMax: number;
  public readonly randValMin: number;

  public startTm: number;
  public readonly idxs: Uint32Array;
  public readonly scores: Array<Float64Array>;
  public readonly bestScores: Float64Array;
  public readonly bestScoresPrev: Float64Array;
  public readonly bestCandIdxs: Uint32Array;
  public readonly improvement: Array<Float64Array>;

  private cIdx: number;
  private rIdx: number;
  private rank: number;

  public constructor(
      fitness: FitnessFunct | Array<FitnessFunct>,
      nGenes: number,
      dtype: Dtype,
      opts: UserOpts = {},
      functs         = {}) {
    super();
    this.nGenes = nGenes;
    this.dtype  = dtype;

    // multi-objective optimisation
    // allow for many fitness functions
    this.fitness = Array.isArray(fitness) ? fitness : [fitness];

    // how important each objective is
    if (opts.weights === undefined) {
      this.weights = arrays.f64(this.fitness.length).fill(1);
    }

    Object.assign(opts, this.DEFAULTS);
    Object.assign(this, functs);

    // register getters from user config merged with defaults into `this`
    optToGetter(this, 'nElite', getNumOpt(opts.popSize, opts.nElite));
    optToGetter(this, 'nMutations', getNumOpt(nGenes, opts.nMutations));
    optToGetter(this, 'pMutate', getNumOpt(undefined, opts.pMutate));
    optToGetter(this, 'tournamentSize', getNumOpt(opts.popSize, opts.tournamentSize));
    optToGetter(this, 'pElite', getNumOpt(undefined, opts.pElite));

    this.rIdx      = 0;
    this.timeOutMS = opts.timeOutMS;

    // indexes of candidates
    // re-sorted on each round as opposed to re-sorting `pop`
    this.idxs = arrays.u32(opts.popSize).map((_, idx) => idx);

    // fitness score for every objective for every candidate
    this.scores = Array(this.fitness.length).fill(0).map(() => arrays.f64(opts.popSize));

    // scores of fittest candidates
    // metric of improvement
    this.bestScores     = arrays.f64(this.fitness.length);
    // needed to compute improvement (previous - current)
    this.bestScoresPrev = arrays.f64(this.fitness.length);

    // keep track of best candidate for every objective
    this.bestCandIdxs = arrays.u32(this.fitness.length);

    // used to stop the algorithm when a plateau is reached
    this.improvement = Array(this.fitness.length).map(() => arrays.f64(this.nTrack));

    // this.registerGetter('tournamentSize', opts.tournamentSize, [2, 2 + Math.floor(this.popSize * 0.03)]);
    // default to a very small value of maxNMutations based on nGenes
    // this.nMutations = this.

    // intelligently compute min and max bounds of search space based on `dtype`
    if (opts.randValMax === undefined) {
      if (dtype === Dtype.F32 || dtype == Dtype.F64) {
        this.randValMax = (3.4 * (10 ** 38) - 1) / 1E4;
      } else if (dtype === Dtype.I8 || dtype === Dtype.I16 || dtype === Dtype.I32) {
        this.randValMax = 2 ** (this.nBits - 1) - 1;
      } else if (dtype === Dtype.U8 || dtype === Dtype.U16 || dtype === Dtype.U32) {
        this.randValMax = 2 ** this.nBits - 1;
      }
    } else {
      this.randValMax = opts.randValMax;
    }

    if (opts.randValMin === undefined) {
      if (dtype === Dtype.F32 || dtype == Dtype.F64) {
        this.randValMin = (1.2 * (10 ** -38)) / 1E4;
      } else if (dtype === Dtype.I8 || dtype === Dtype.I16 || dtype === Dtype.I32) {
        this.randValMin = -(2 ** (this.nBits - 1)) + 1;
      } else if (dtype === Dtype.U8 || dtype === Dtype.U16 || dtype === Dtype.U32) {
        this.randValMin = 0;
      }
    } else {
      this.randValMin = opts.randValMin;
    }

    this.pop = this.getPop();
    registerLogging(opts.logLvl, this);
  }

  private get timeTakenMS() { return this.startTm - Date.now(); }

  private getPop(): TypedArray {
    const pop = arrays[this.dtype](this.popSize);
    for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
      const offset = cIdx * this.nGenes;
      for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
        // special treatment for unsigned (minRandVal is 0) to prevent too many zeroes
        if (this.dtype === Dtype.U32 || this.dtype == Dtype.U16 || this.dtype === Dtype.U8) {
          pop[offset + gIdx] = Math.floor(Math.random() * this.randValMax);
        } else {
          pop[offset + gIdx] = Math.floor(Math.random() * (Math.random() < 0.5 ? this.randValMax : this.randValMin));
        }
      }
    }
    return pop;
  }

  private randGeneVal(): number {
    return this.randValMin + (this.randValMax - this.randValMin) * Math.random();
  }

  private isFinished(): boolean {
    const change           = arrays.f64(this.fitness.length);
    let improvedObjectives = 0;
    for (let objIdx = 0; objIdx < this.fitness.length; objIdx++) {
      for (let i = 1; i < this.bestCandIdxs[objIdx]; i++) {
        change[objIdx] += this.bestScores[i] - this.bestScores[i - 1];
      }
      // for (let i = this.bestCandIdxs + 2; i < this.nTrack; i++) {
      //   change += this.bestScores[i] - this.bestScores[i - 1];
      // }
      // diff between lst and fst (circular buffer)
      change[objIdx] += this.bestScores[this.nTrack - 1] - this.bestScores[0];
      if (change[objIdx] >= this.minImprove) {
        improvedObjectives++;
      }
    }

    if (improvedObjectives === 0) {
      this.emit('stuck');
      return true;
    } else if (this.rIdx >= this.nRounds) {
      this.emit('rounds');
      return true;
    } else if (this.timeTakenMS >= this.timeOutMS) {
      this.emit('timeout');
      return true;
    }

    return false;
  }

  private compare(cIdx1: number, cIdx2: number): number {
    let score1 = 0;
    let score2 = 0;
    // candidate #1 is better than #2 when it dominates across more objectives
    for (let objIdx = 0; objIdx < this.fitness.length; objIdx++) {
      const objectiveScores = this.scores[objIdx];
      if (objectiveScores[cIdx1] > objectiveScores[cIdx2]) {
        score1 += this.weights[objIdx];
      } else if (objectiveScores[cIdx1] < objectiveScores[cIdx2]) {
        score2 += this.weights[objIdx];
      }
    }
    return score1 > score2 ? -1 : score1 < score2 ? 1 : 0;
  }

  private reorder(): void {
    // sort candidates based on fitness (1st is most fit, last is least fit)
    this.idxs.sort(this.compare);
  }

  private select(): number {
    const { tournamentSize, pElite, nElite } = this;
    const idxs                               = arrays.u32(tournamentSize);
    for (let i = 0; i < tournamentSize; i++) {
      if (Math.random() < pElite) {
        idxs[i] = this.idxs[Math.floor(Math.random() * nElite)];
      }
    }
    let bestIdx   = idxs[0];
    let bestScore = this.scores[bestIdx];
    for (let i = 1; i < tournamentSize; i++) {
      const idx = idxs[i];
      if (this.scores[idx] > bestScore) {
        bestIdx   = idx;
        bestScore = this.scores[idx];
      }
    }
    return bestIdx;
  }

  private score(): void {
    for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
        this.scores[fIdx][cIdx] = this.fitness[fIdx](
            this.pop.subarray(cIdx * this.nGenes, cIdx * this.nGenes + this.nGenes));
      }
    }
  }

  private mutate(): void {
    const offset = this.cIdx * this.nGenes;
    for (let i = 0; i < this.nMutations; i++) {
      this.pop[offset + Math.floor(Math.random() * this.nGenes)] = this.randGeneVal();
    }
  }

  private crossover(): void {
    // avoid positional bias
    // don't use cross-over point, otherwise genes CLOSE to each other will be more likely to be inherited
    const offset = this.select() * this.nGenes;
    for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
      if (Math.random() < 0.5) {
        this.pop[offset + gIdx] = this.pop[offset + gIdx];
      }
    }
  }

  public* search() {
    this.startTm = Date.now();

    // ensure it doesn't finish during first nTrack rounds
    for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      this.bestScores[fIdx][this.nTrack - 1] = Infinity;
    }

    this.emit('start', this);

    // bootstrap elite scores
    this.score();
    this.reorder();

    while (true) {
      this.emit('round', this);

      if (this.isFinished()) {
        break;
      }

      ++this.rIdx;

      this.score();

      // re-sort candidates based on fitness (1st is most fit, last is least fit)
      this.reorder();

      // for (let objIdx = 0; objIdx < this.fitness.length; objIdx++) {
      //   this.bestCandIdxs[objIdx];
      // }

      // // fitness of best candidate
      // // store in circular buffer (simulated using array and bestCandIdxs)
      // this.bestScore = this.bestScores[this.bestCandIdxs] = [];
      // for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      //   this.bestScore[fIdx] = this.bestScores[this.bestCandIdxs[fIdx]] += this.scores[fIdx].reduce(
      //       (s1, s2) => Math.max(s1, s2));
      // }

      // // improvement for every objective (difference between last best score and current fittest candidate score)
      // for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      //   this.improvement[fIdx] = this.bestScores[fIdx][this.bestCandIdxs[fIdx]]
      //                            - this.bestScores[fIdx][this.bestIdxsPrev[fIdx]];
      // }

      this.emit('score', this);

      /* go over non-elite units (elitism - leave best units unaltered)
       *
       * NOTE: order of idxs is as follows: [best, 2nd best, ..., worst] */
      for (this.rank = this.nElite; this.rank < this.popSize; this.rank++) {
        this.cIdx = this.idxs[this.rank];
        if (Math.random() < this.pMutate) {
          this.mutate();
        } else {
          this.crossover();
        }
        this.emit('op', this);
      }
    }

    this.emit('end', this);

    for (let ptr = 0; ptr < this.popSize; ptr++) {
      const offset = this.nGenes * this.idxs[ptr];
      yield this.pop.subarray(offset, offset + this.nGenes);
    }
  }

  public [util.inspect.custom](): string {
    return this.toString();
  }

  public toString(): string {
    return `GeneticAlgorithm ${util.inspect(this)}`;
  }
}

module.exports = GeneticAlgorithm;
// vim:hlsearch:sw=2:ts=4:expandtab:foldmethod=manual:nu:
