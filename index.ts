import * as util        from 'util';
import { EventEmitter } from 'events';

type Dtype = 'u32' | 'u16' | 'u8' | 'f64' | 'f32' | 'i32' | 'i16' | 'i8';

enum Behaviour { INCREASES, DECREASES, CONSTANT }

type NumOpt = number | [number, number] | { start: number, end: number, whenFit?: Behaviour };
type NumOptResolved = { start: number, end: number, whenFit: Behaviour };
type TypedArray =
    Uint8Array
    | Uint16Array
    | Uint32Array
    | Int8Array
    | Int16Array
    | Int32Array
    | Float32Array
    | Float64Array;
type FitnessFunct = (candidate: TypedArray) => number;
type UserOpts = {
  pElite?: NumOpt,
  nRounds?: number,
  nElite?: NumOpt,
  tournamentSize?: NumOpt,
  pMutate?: NumOpt,
  nMutations?: NumOpt,
  nTrack?: number,
  minImprove?: number,
  popSize?: number,
  weights?: Array<number> | TypedArray,
  randValMin?: number,
  randValMax?: number,
  logLvl?: 0 | 1 | 2 | 3,
  emitFittest?: boolean,
  timeOutMS?: number,
};
type ResolvedOpts = {
  nRounds: number,
  emitFittest: boolean,
  pElite: NumOpt,
  nElite: NumOpt,
  tournamentSize: NumOpt,
  pMutate: NumOpt,
  nMutations: NumOpt,
  minImprove: number,
  nTrack: number,
  popSize: number,
  weights: Array<number> | TypedArray,
  randValMin: number,
  randValMax: number,
  logLvl: 0 | 1 | 2 | 3,
  timeOutMS: number,
};
type CustomFuncts = {
  compare?: () => number,
  isFinished?: () => boolean,
  getPop?: () => TypedArray,
  select?: () => number,
  mutate?: () => void,
  crossover?: () => void,
};

function getNumOpt(percentageOf: number | undefined, o: NumOpt): { start: number, end: number, whenFit: Behaviour } {
  if (o.constructor.name === 'Number') {
    return getNumOpt(percentageOf, <[number, number]>[o, o]);
  } else if (o.constructor.name === 'Array') {
    const [start, end]: [number, number] = <[number, number]>o;
    return getNumOpt(percentageOf, { start, end });
  } else if ((<NumOptResolved>o).whenFit === undefined) {
    (<NumOptResolved>o).whenFit = Behaviour.CONSTANT;
    return getNumOpt(percentageOf, o);
  } else if (percentageOf !== undefined && (<NumOptResolved>o).start < 1.0) {
    (<NumOptResolved>o).start *= percentageOf;
    return getNumOpt(percentageOf, o);
  } else if (percentageOf !== undefined && (<NumOptResolved>o).end < 1.0) {
    (<NumOptResolved>o).end *= percentageOf;
    return getNumOpt(percentageOf, o);
  } else {
    return <NumOptResolved>o;
  }
}

function optToGetter(
    self: any, name: string, { start, end, whenFit }: { start: number, end: number, whenFit: Behaviour }) {
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

// noinspection JSUnusedGlobalSymbols
const arrays = {
  f32: (n: number) => new Float32Array(new ArrayBuffer(4 * n)),
  f64: (n: number) => new Float64Array(new ArrayBuffer(8 * n)),
  i32: (n: number) => new Int32Array(new ArrayBuffer(4 * n)),
  u32: (n: number) => new Uint32Array(new ArrayBuffer(4 * n)),
  i16: (n: number) => new Int16Array(new ArrayBuffer(2 * n)),
  u16: (n: number) => new Uint16Array(new ArrayBuffer(2 * n)),
  i8:  (n: number) => new Int8Array(new ArrayBuffer(n)),
  u8:  (n: number) => new Uint8Array(new ArrayBuffer(n)),
};

class GeneticAlgorithm extends EventEmitter {
  private readonly DEFAULT_OPTS = {
    minImprove:      1E-6,
    nRounds:         1E6,
    nTrack:          100,
    popSize:         300,
    nElite:          { start: 0.1, end: 0.3 },
    pElite:          { start: 0.1, end: 0.2, whenFit: Behaviour.DECREASES },
    pMutate:         { start: 0.01, end: 0.8, whenFit: Behaviour.INCREASES },
    tournamentSize:  { start: 2, end: 10, whenFit: Behaviour.DECREASES },
    emitFittest:     false, // emit best candidate or index of best candidate
    logLvl:          0,
    timeOutMS:       30 * 1000, // 30 SEC
    validateFitness: false, // check if NaN returned
    weights:         (<TypedArray|undefined>undefined), // set later
  };

  public readonly dtype: Dtype;
  public readonly emitFittest: boolean;
  public readonly fitness: Array<FitnessFunct>;
  public readonly minImprove: number;
  public readonly nBits: 8 | 16 | 32 | 64;
  public readonly nGenes: number;
  public readonly nRounds: number;
  public readonly nTrack: number;
  public readonly pop: TypedArray;
  public readonly popSize: number;
  // search space bounds (guess from dtype)
  public readonly randValMax: number;
  public readonly randValMin: number;
  public readonly timeOutMS: number;
  public readonly weights: Array<number> | TypedArray;

  // dynamic getter generation
  public readonly tournamentSize!: number;
  public readonly pElite!: number;
  public readonly pMutate!: number;
  public readonly nElite!: number;
  public readonly nMutations!: number;

  public readonly idxs: Uint32Array;
  public readonly scores: Array<Float64Array>;
  public readonly bestScores: Float64Array;
  public readonly bestScoresPrev: Float64Array;
  public readonly bestCandIdxs: Uint32Array;
  public readonly improvement: Array<Float64Array>;

  private startTm: number;
  private cIdx: number;
  private rIdx: number;
  private rank: number;

  public constructor(
      fitness: FitnessFunct | Array<FitnessFunct>,
      nGenes: number,
      dtype: Dtype,
      opts: UserOpts       = {},
      functs: CustomFuncts = {}) {
    super();
    this.nGenes = nGenes;
    this.dtype  = dtype;

    // multi-objective optimisation
    // allow for many fitness functions
    this.fitness = Array.isArray(fitness) ? fitness : [fitness];

    // how important each objective is
    if (opts.weights === undefined) {
      this.DEFAULT_OPTS.weights = arrays.f64(this.fitness.length).fill(1);
    }

    // @ts-ignore
    const resolvedOpts: ResolvedOpts = Object.assign(Object.assign({}, opts), this.DEFAULT_OPTS);
    Object.assign(this, functs);

    // register getters from user config merged with defaults into `this`
    optToGetter(this, 'nElite', getNumOpt(resolvedOpts.popSize, resolvedOpts.nElite));
    optToGetter(this, 'nMutations', getNumOpt(nGenes, resolvedOpts.nMutations));
    optToGetter(this, 'pMutate', getNumOpt(undefined, resolvedOpts.pMutate));
    optToGetter(this, 'tournamentSize', getNumOpt(resolvedOpts.popSize, resolvedOpts.tournamentSize));
    optToGetter(this, 'pElite', getNumOpt(undefined, resolvedOpts.pElite));

    this.weights     = resolvedOpts.weights;
    this.nTrack      = resolvedOpts.nTrack;
    this.nRounds     = resolvedOpts.nRounds;
    this.emitFittest = resolvedOpts.emitFittest;
    this.popSize     = resolvedOpts.popSize;
    this.minImprove  = resolvedOpts.minImprove;
    this.timeOutMS   = resolvedOpts.timeOutMS;
    this.rIdx        = 0;
    this.startTm     = -Infinity;
    this.rank        = 0;
    this.cIdx        = 0;

    // indexes of candidates
    // re-sorted on each round as opposed to re-sorting `pop`
    this.idxs = arrays.u32(resolvedOpts.popSize).map((_, idx) => idx);

    // fitness score for every objective for every candidate
    this.scores = Array(this.fitness.length).fill(0).map(() => arrays.f64(resolvedOpts.popSize));

    // scores of fittest candidates for every objective
    this.bestScores = arrays.f64(this.fitness.length);
    // previous scores of fittest candidates for every objective
    // needed to compute improvement (previous - current)
    this.bestScoresPrev = arrays.f64(this.fitness.length);

    // used to stop the algorithm when a plateau is reached
    this.improvement = Array(this.fitness.length).map(() => arrays.f64(this.nTrack));

    // keep track of best candidate for every objective
    this.bestCandIdxs = arrays.u32(this.fitness.length);

    if (dtype.endsWith('8')) {
      this.nBits = 8;
    } else if (dtype.endsWith('16')) {
      this.nBits = 16;
    } else if (dtype.endsWith('32')) {
      this.nBits = 32;
    } else {
      this.nBits = 64;
    }

    // intelligently compute min and max bounds of search space based on `dtype`
    if (resolvedOpts.randValMax === undefined) {
      if (dtype.startsWith('f')) {
        this.randValMax = (3.4 * (10 ** 38) - 1) / 1E4;
      } else if (dtype.startsWith('i')) {
        this.randValMax = 2 ** (this.nBits - 1) - 1;
      } else /* if (dtype.startsWith('u')) */ {
        this.randValMax = 2 ** this.nBits - 1;
      }
    } else {
      this.randValMax = resolvedOpts.randValMax;
    }

    if (resolvedOpts.randValMin === undefined) {
      if (dtype.startsWith('f')) {
        this.randValMin = (1.2 * (10 ** -38)) / 1E4;
      } else if (dtype.startsWith('i')) {
        this.randValMin = -(2 ** (this.nBits - 1)) + 1;
      } else /* if (dtype.startsWith('u')) */ {
        this.randValMin = 0;
      }
    } else {
      this.randValMin = resolvedOpts.randValMin;
    }

    this.pop = this.getPop();

    if (resolvedOpts.logLvl > 0) {
      this.on('start', env => console.log('started genetic algorithm at', new Date(), 'with opts', env));
      this.on('end', env => console.log('finished running genetic algorithm at', new Date(),
                                        `took ${env.timeTakenMS / 1000}sec, did ${env.rIdx} rounds`));
      for (const reason of ['stuck', 'rounds', 'timeout']) {
        this.on(reason, () => console.log(`[${reason}]`));
      }
    }

    if (resolvedOpts.logLvl > 1) {
      this.on('score', env => console.log(
          `[round ${`#${env.rIdx}`.padStart(6)}] best cand = ${`#${env.bestIdx}`.padStart(
              4)}, best score = ${env.bestScore.toString().padStart(15)}, improvement = ${env.improvement.toString()
                                                                                             .padStart(12)}`));
    }

    if (resolvedOpts.logLvl > 2) {
      this.on('op', env => console.log(env.op.padStart('crossover'.length),
                                       `(p = ${(env.op === 'crossover' ? (1 - env.pMutate) : env.pMutate).toFixed(2)})`,
                                       env.op === 'crossover' ? `on ${`#${env.pIdx1}`.padStart(
                                           4)} & ${`#${env.pIdx2}`.padStart(4)}` : `on ${`#${env.ptr}`.padStart(
                                           4)} ${' '.repeat(7)}(${env.nMutations} mutations)`));
    }
  }

  private get timeTakenMS(): number {
    return this.startTm - Date.now();
  }

  private getPop(): TypedArray {
    const pop = arrays[this.dtype](this.popSize);
    for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
      const offset = cIdx * this.nGenes;
      for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
        // special treatment for unsigned (minRandVal is 0) to prevent too many zeroes
        if (this.dtype.startsWith('u')) {
          pop[offset + gIdx] = Math.floor(Math.random() * this.randValMax);
        } else {
          pop[offset + gIdx] = Math.floor(Math.random() * (Math.random() < 0.5 ? this.randValMax : this.randValMin));
        }
      }
    }
    return pop;
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
    }

    if (this.rIdx >= this.nRounds) {
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

  private mutate(): void {
    const offset = this.cIdx * this.nGenes;
    for (let i = 0; i < this.nMutations; i++) {
      this.pop[offset + Math.floor(Math.random() * this.nGenes)] = this.randValMin + (this.randValMax - this.randValMin)
                                                                   * Math.random();
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
      this.bestScoresPrev[fIdx] = Infinity;
    }

    this.emit('start', this);

    // bootstrap elite scores
    for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
        this.scores[fIdx][cIdx] = this.fitness[fIdx](
            this.pop.subarray(cIdx * this.nGenes, cIdx * this.nGenes + this.nGenes));
      }
    }
    this.idxs.sort(this.compare);

    while (true) {
      this.emit('round', this);

      if (this.isFinished()) {
        break;
      }

      ++this.rIdx;

      for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
        for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
          this.scores[fIdx][cIdx] = this.fitness[fIdx](
              this.pop.subarray(cIdx * this.nGenes, cIdx * this.nGenes + this.nGenes));
        }
      }

      // re-sort candidates based on fitness (1st is most fit, last is least fit)
      this.idxs.sort(this.compare);

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

  public [util.inspect.custom](): string { return this.toString(); }

  public toString(): string { return `GeneticAlgorithm ${util.inspect(this)}`; }
}

module.exports = GeneticAlgorithm;
