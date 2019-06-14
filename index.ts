import * as util        from 'util';
import { EventEmitter } from 'events';

type Dtype = 'u32' | 'u16' | 'u8' | 'f64' | 'f32' | 'i32' | 'i16' | 'i8';
type Behaviour = 'increases' | 'decreases' | 'constant';
type NumOpt /* user supplied */ = number | [number, number] | { start: number, end: number, whenFit?: Behaviour };
type Op = 'crossover' | 'mutate';
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
  emitFittest?: boolean,
  logLvl?: number,
  minImprove?: number,
  nElite?: NumOpt,
  nMutations?: NumOpt,
  nRounds?: number,
  nTrack?: number,
  pElite?: NumOpt,
  pMutate?: NumOpt,
  popSize?: number,
  randValMax?: number,
  randValMin?: number,
  timeOutMS?: number,
  tournamentSize?: NumOpt,
  weights?: Array<number> | TypedArray,
};
type ResolvedOpts = {
  emitFittest: boolean,
  logLvl: number,
  minImprove: number,
  nElite: NumOpt,
  nMutations: NumOpt,
  nRounds: number,
  nTrack: number,
  pElite: NumOpt,
  pMutate: NumOpt,
  popSize: number,
  randValMax: number,
  randValMin: number,
  timeOutMS: number,
  tournamentSize: NumOpt,
  weights: Array<number> | TypedArray,
};
type CustomFuncts = {
  compare?: (cIdx1: number, cIdx2: number) => number,
  crossover?: (cIdx: number, parentIdx: number) => void,
  getPop?: (dtype: Dtype, popSize: number, nGenes: number, geneValGen: (gIdx: number) => number) => TypedArray,
  isFinished?: (percentageDoneRounds: number, percentageDoneTime: number) => boolean,
  mutate?: (cIdx: number, nMutations: number, geneValGen: (gIdx: number) => number) => void,
  randGeneVal?: (gIdx: number) => number,
  select?: (tournamentSize: number, pElite: number, nElite: number) => number,
};

// interface Algorithm {
//   nthCand(n: number): TypedArray;
//   nthBestCand(n: number): TypedArray;
//   percentageDone(): number;
//   nthCandScore(n: number): number;
//   weights: Array<number> | TypedArray;
// }

function getNumOpt(percentageOf: number | undefined, o: NumOpt): { start: number, end: number, whenFit: Behaviour } {
  if (o.constructor.name === 'Number') {
    return getNumOpt(percentageOf, <[number, number]>[o, o]);
  } else if (o.constructor.name === 'Array') {
    const [start, end]: [number, number] = <[number, number]>o;
    return getNumOpt(percentageOf, { start, end });
  } else if ((<NumOptResolved>o).whenFit === undefined) {
    (<NumOptResolved>o).whenFit = 'constant';
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
    if (whenFit === 'constant') {
      Object.defineProperty(self, name, {
        get: function() {
          return start + (this.timeTakenMS / this.timeOutMS) * range;
        },
      });
    } else if (whenFit === 'decreases') {
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
  f64: (n: number) => new Float64Array(new ArrayBuffer(8 * n)),
  f32: (n: number) => new Float32Array(new ArrayBuffer(4 * n)),
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
    pElite:          { start: 0.1, end: 0.2, whenFit: 'decreases' },
    pMutate:         { start: 0.01, end: 0.8, whenFit: 'increases' },
    nMutations:      { start: 0.1, end: 1, whenFit: 'decreases' },
    tournamentSize:  { start: 2, end: 10, whenFit: 'decreases' },
    emitFittest:     false, // emit best candidate or index of best candidate
    logLvl:          0,
    timeOutMS:       30 * 1000, // 30 SEC
    validateFitness: false, // check if NaN returned
    weights:         (<TypedArray|undefined>undefined), // set later
  };

  private readonly nGenes: number;
  private readonly fitness: Array<FitnessFunct>;
  private readonly dtype: Dtype;

  private readonly timeOutMS: number;
  private readonly nRounds: number;
  private readonly nTrack: number;
  private readonly minImprove: number;

  private readonly popSize: number;
  // search space bounds (guess from dtype)
  private readonly randGeneVal!: (gIdx: number) => number;
  private readonly weights: Array<number> | TypedArray;
  private readonly pop: TypedArray;

  private readonly emitFittest: boolean;

  // dynamic getter generation
  private readonly tournamentSize!: number;
  private readonly pElite!: number;
  private readonly pMutate!: number;
  private readonly nElite!: number;
  private readonly nMutations!: number;

  private readonly idxs: Uint32Array;
  private readonly scores: Array<Float64Array>;
  private readonly bestScores: Array<Float64Array>;

  private startTm: number;
  private rIdx: number;
  private rank: number;
  private op: Op;

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
    const resolvedOpts: ResolvedOpts = Object.assign(Object.assign({}, this.DEFAULT_OPTS), opts);
    Object.assign(this, functs);

    // register getters from user config merged with defaults into `this`
    optToGetter(this, 'nElite', getNumOpt(resolvedOpts.popSize, resolvedOpts.nElite));
    optToGetter(this, 'nMutations', getNumOpt(nGenes, resolvedOpts.nMutations));
    optToGetter(this, 'pMutate', getNumOpt(undefined, resolvedOpts.pMutate));
    optToGetter(this, 'tournamentSize', getNumOpt(resolvedOpts.popSize, resolvedOpts.tournamentSize));
    optToGetter(this, 'pElite', getNumOpt(undefined, resolvedOpts.pElite));

    this.weights            = resolvedOpts.weights;
    this.nTrack             = resolvedOpts.nTrack;
    this.nRounds            = resolvedOpts.nRounds;
    this.emitFittest        = resolvedOpts.emitFittest;
    this.popSize            = resolvedOpts.popSize;
    this.minImprove         = resolvedOpts.minImprove;
    this.timeOutMS          = resolvedOpts.timeOutMS;
    this.rIdx               = 0;
    this.startTm            = -Infinity;
    this.rank               = 0;

    // indexes of candidates
    // re-sorted on each round as opposed to re-sorting `pop`
    this.idxs = arrays.u32(resolvedOpts.popSize).map((_, idx) => idx);

    // fitness score for every objective for every candidate
    this.scores = Array(this.fitness.length).fill(0).map(() => arrays.f64(resolvedOpts.popSize));

    // scores of fittest candidates for every objective
    this.bestScores = Array(this.fitness.length).fill(0).map(() => arrays.f64(this.nTrack));

    // if rand gene value supplier was not given make one using rand uniform distribution with bounds based on `dtype`
    if (functs.randGeneVal === undefined) {
      let nBits;
      let randValMin: number;
      let randValMax: number;

      if (dtype.endsWith('8')) {
        nBits = 8;
      } else if (dtype.endsWith('16')) {
        nBits = 16;
      } else if (dtype.endsWith('32')) {
        nBits = 32;
      } else {
        nBits = 64;
      }

      // intelligently compute min and max bounds of search space based on `dtype`
      if (resolvedOpts.randValMax === undefined) {
        if (dtype.startsWith('f')) {
          randValMax = (3.4 * (10 ** 38) - 1) / 1E4;
        } else if (dtype.startsWith('i')) {
          randValMax = 2 ** (nBits - 1) - 1;
        } else /* if (dtype.startsWith('u')) */ {
          randValMax = 2 ** nBits - 1;
        }
      } else {
        randValMax = resolvedOpts.randValMax;
      }

      if (resolvedOpts.randValMin === undefined) {
        if (dtype.startsWith('f')) {
          randValMin = (1.2 * (10 ** -38)) / 1E4;
        } else if (dtype.startsWith('i')) {
          randValMin = -(2 ** (nBits - 1)) + 1;
        } else /* if (dtype.startsWith('u')) */ {
          randValMin = 0;
        }
      } else {
        randValMin = resolvedOpts.randValMin;
      }

      const randRange = randValMax - randValMin;
      this.randGeneVal = (gIdx: number) => randValMin + randRange * Math.random();
    }

    this.pop = this.getPop(dtype, this.popSize, nGenes, this.randGeneVal);

    if (resolvedOpts.logLvl > 0) {
      this.on('start', env => console.log('started genetic algorithm at', new Date(), 'with opts', env));
      this.on('end', env => console.log('finished running genetic algorithm at', new Date(), `took ${env.timeTakenMS / 1000}sec, did ${env.rIdx} rounds`));
      for (const reason of ['stuck', 'rounds', 'timeout']) {
        this.on(reason, () => console.log(`[${reason}]`));
      }
    }

    if (resolvedOpts.logLvl > 1) {
      this.on('score', env => console.log(`[round ${`#${env.rIdx}`.padStart(6)}] best cand (#${env.idxs[0]}) = [${`${env.pop.slice(env.idxs[0] * env.nGenes, env.idxs[0] * env.nGenes + env.nGenes).join(', ')}]`.padStart( 4)}, best scores = [${env.bestScores[0].join(', ').toString()}]`));
    }

    if (resolvedOpts.logLvl > 2) {
      this.on('op', env => console.log(env.op.padStart('crossover'.length)));
    }
  }

  public get bestScore(): TypedArray { return this.bestScores[0]; }

  private get timeTakenMS(): number { return Date.now() - this.startTm; }

  private get percentageDoneRounds(): number { return this.rIdx / this.nRounds; }

  private get percentageDoneTime(): number { return this.timeTakenMS / this.timeOutMS; }

  public* search() {
    this.startTm = Date.now();
    this.emit('start', this);

    // ensure that at least `nTrack` rounds are completed BEFORE `stuck`
    for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      for (let cIdx = 0; cIdx < this.nTrack; cIdx++) {
        this.bestScores[fIdx][cIdx] = cIdx * this.minImprove;
      }
    }
    // bootstrap scores (code below assumes most fit come first)
    for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      const f = this.fitness[fIdx];
      for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
        this.scores[fIdx][cIdx] = f(this.pop.subarray(cIdx * this.nGenes, cIdx * this.nGenes + this.nGenes));
      }
    }

    this.idxs.sort(this.compare.bind(this)); // it's the idxs that are sorted based on scores

    while (true) {
      this.emit('round', this);

      if (this.isFinished(this.percentageDoneRounds, this.percentageDoneTime, this.bestScores)) {
        break;
      }

      this.rIdx++;

      for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
        for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
          this.scores[fIdx][cIdx] = this.fitness[fIdx](
              this.pop.subarray(cIdx * this.nGenes, cIdx * this.nGenes + this.nGenes));
        }
      }

      // re-sort candidates based on fitness (1st is most fit, last is least fit)
      this.idxs.sort(this.compare.bind(this));
      // Process.exit(0);

      // get score for every objective by getting the value from the best candidate
      for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
        this.bestScores[fIdx][this.rIdx % this.nTrack] =
            this.scores[fIdx].reduce((s1: number, s2: number) => Math.max(s1, s2));
      }

      this.emit('score', this);

      /* go over non-elite units (elitism - leave best units unaltered)
       *
       * NOTE: order of idxs is as follows: [best, 2nd best, ..., worst] */
      for (this.rank = this.nElite; this.rank < this.popSize; this.rank++) {
        const cIdx = this.idxs[this.rank];
        if (Math.random() < this.pMutate) {
          this.op = 'mutate';
          this.mutate(cIdx, this.nMutations, this.randGeneVal);
        } else {
          this.op = 'crossover';
          this.crossover(cIdx, this.select(this.tournamentSize, this.pElite, this.nElite));
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
    try {
      const dummy = Object.assign({}, this);
      delete dummy.pop;
      delete dummy.idxs;
      delete dummy.DEFAULT_OPTS;
      delete dummy.scores;
      delete dummy.bestScores;
      delete dummy._events;
      delete dummy._eventsCount;
      delete dummy._maxListeners;
      return util.inspect(dummy);
    } catch (e) {
      return 'GeneticAlgorithm'  ;
    }
  }

  public toString(): string { return `GeneticAlgorithm ${util.inspect(this)}`; }

  private getPop(dtype: Dtype, popSize: number, nGenes: number, geneValGen: (gIdx: number) => number): TypedArray {
    const pop = arrays[dtype](popSize * nGenes);
    for (let cIdx = 0; cIdx < popSize; cIdx++) {
      const offset = cIdx * nGenes;
      for (let gIdx = 0; gIdx < nGenes; gIdx++) {
        pop[offset + gIdx] = geneValGen(gIdx);
      }
    }
    return pop;
  }

  private isFinished(percentageDoneRounds: number, percentageDoneTime: number, bestScores: Array<TypedArray>): boolean {
    if (percentageDoneRounds === 1.0) {
      this.emit('rounds');
      return true;
    } else if (percentageDoneTime === 1.0) {
      this.emit('timeout');
      return true;
    }

    // track overall change for every objective
    const change           = arrays.f64(this.fitness.length);
    let improvedObjectives = 0;

    for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      for (let sIdx = 1; sIdx < this.nTrack; sIdx++) {
        change[fIdx] += bestScores[fIdx][sIdx] - bestScores[fIdx][sIdx - 1];
      }
      // diff between lst and fst (circular buffer)
      change[fIdx] += bestScores[fIdx][this.nTrack - 1] - bestScores[fIdx][0];
      if (change[fIdx] >= this.minImprove) {
        improvedObjectives++;
      }
    }

    if (improvedObjectives === 0) {
      this.emit('stuck');
      return true;
    } else {
      return false;
    }
  }

  private compare(cIdx1: number, cIdx2: number): number {
    let score1 = 0;
    let score2 = 0;
    // candidate #1 is better than #2 when it dominates across more objectives
    for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      const objectiveScores = this.scores[fIdx];
      if (objectiveScores[cIdx1] > objectiveScores[cIdx2]) {
        score1 += this.weights[fIdx];
      } else if (objectiveScores[cIdx1] < objectiveScores[cIdx2]) {
        score2 += this.weights[fIdx];
      }
    }
    return score1 > score2 ? -1 : score1 < score2 ? 1 : 0;
  }

  private select(tournamentSize: number, pElite: number, nElite: number): number {
    const idxs                               = arrays.u32(tournamentSize);
    for (let i = 0; i < tournamentSize; i++) {
      if (Math.random() < pElite) {
        // 0..nElite
        idxs[i] = this.idxs[Math.floor(Math.random() * nElite)];
        // nElite..popSize
      } else {
        idxs[i] = this.idxs[nElite + Math.floor(Math.random() * (this.popSize - nElite))];
      }
    }
    // assume for now 1st is best
    let bestIdx   = idxs[0];
    let bestScore = this.scores[bestIdx];
    // then start checking from the 2nd if any is better
    for (let i = 1; i < tournamentSize; i++) {
      const idx = idxs[i];
      if (this.scores[idx] > bestScore) {
        bestIdx   = idx;
        bestScore = this.scores[idx];
      }
    }
    return bestIdx;
  }

  private mutate(cIdx: number, nMutations: number, geneValGen: (gIdx: number) => number): void {
    const offset = cIdx * this.nGenes;
    for (let i = 0; i < nMutations; i++) {
      const gIdx = Math.floor(Math.random() * this.nGenes);
      this.pop[offset + gIdx] = geneValGen(gIdx);
    }
  }

  private crossover(cIdx: number, parentIdx: number): void {
    // avoid positional bias
    // don't use cross-over point, otherwise genes CLOSE to each other will be more likely to be inherited
    const offsetParent = parentIdx * this.nGenes;
    const offsetMe     = cIdx      * this.nGenes;
    for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
      if (Math.random() < 0.5) {
        this.pop[offsetMe + gIdx] = this.pop[offsetParent + gIdx];
      }
    }
  }
}

module.exports = GeneticAlgorithm;
