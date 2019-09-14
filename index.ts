/**
 * You MAY override the following methods using inheritance (just extend GeneticAlgorithm):
 * - mutate
 * - crossover
 * - select
 * - isFinished
 * - compare
 */
/**
 * To remove dependency on Node.js standard library (and Node itself)
 * here is a minimal polyfill for the core `.on` and `.emit` methods in
 * the events.EventEmitter class.
 */
export type EventListener = (...args: any[]) => any;

export const LogLvl = Object.freeze({
  SILENT:  0,
  NORMAL:  1,
  VERBOSE: 2,
});

export const PopSize = Object.freeze({
  HUGE: 1500,
  LARGE: 1000,
  MEDIUM: 300,
  SMALL:  100,
  TINY:  50,
});

// noinspection ConfusingFloatingPointLiteralJS
export const NRounds = Object.freeze({
  LARGE:  1E6,
  MEDIUM: 1E5,
  SMALL:  1E4,
});

const MinImprove = Object.freeze({
  SENSITIVE:   1E-6,
  MEDIUM:      1E-4,
  INSENSITIVE: 1E-2,
});

const NTrack = Object.freeze({
  TINY:    10,
  SMALL:   50,
  LARGE:  300,
  MEDIUM: 100,
});

export const NElite = Object.freeze({
  ADAPTIVE: { start:  0.05, end: 0.150 },
  SMALL:  0.001,
  MEDIUM: 0.050,
  LARGE:  0.150,
});

export const PMutate = Object.freeze({
  ADAPTIVE: { start:  0.10, end: 0.010, whenFit: 'increases' as Behaviour },
  SMALL:  0.001,
  MEDIUM: 0.010,
  LARGE:  0.100,
});

export const NMutations = Object.freeze({
  ADAPTIVE: { start: 10.00, end: 1.000, whenFit: 'decreases' as Behaviour },
  TINY:   1,
  SMALL:  3,
  MEDIUM: 5,
  LARGE:  7,
});

export class EventEmitter {
  private readonly events: Map<string, EventListener[]> = new Map();

  public emit(e: string, ...args: any[]): boolean {
    const ouput = this.events.get(e) !== undefined;
    this.listeners(e, false).forEach(f => f(...args));
    return ouput;
  }

  // noinspection FunctionNamingConventionJS
  public on(e: string, f: EventListener): this {
    this.listeners(e, false).push(f);
    this.emit('newListener');
    return this;
  }

  // noinspection JSUnusedGlobalSymbols
  public addListener(e: string, f: EventListener): this {
    return this.on(e, f);
  }

  // noinspection JSUnusedGlobalSymbols
  public eventNames(): string[] {
    return [...this.events.keys()];
  }

  // noinspection JSUnusedGlobalSymbols
  public listenerCount(e: string): number {
    return this.listeners(e, false).length;
  }

  // noinspection FunctionNamingConventionJS
  public off(e: string, f: EventListener): this {
    const fs = this.listeners(e, false);
    const idx = fs.findIndex(l => l === f);
    fs.splice(idx, 1);
    return this;
  }

  // noinspection JSUnusedGlobalSymbols
  public removeListener(e: string, f: EventListener): this {
    return this.off(e, f);
  }

  public listeners(e: string, clone = true): EventListener[] {
    let output = this.events.get(e);
    if (output === undefined) {
      output = [];
      this.events.set(e, output);
    }
    return clone ? [...output] : output;
  }

  // noinspection JSUnusedGlobalSymbols
  public prependListener(e: string, f: EventListener): this {
    this.listeners(e, false).unshift(f);
    return this;
  }

  // noinspection JSUnusedGlobalSymbols
  public removeAllListeners(e: string): this {
    this.events.set(e, []);
    return this;
  }
}

export class Duration {
  private static readonly SEC = 1000;
  public static seconds(n: number): number {
    return Duration.SEC * n;
  }
  public static secondsFromMS(n: number): number {
    return n / Duration.seconds(1);
  }
  public static minutes(n: number): number {
    return Duration.seconds(60) * n;
  }
  public static minutesFromMS(n: number): number {
    return n / Duration.minutes(1);
  }
  public static hours(n: number): number {
    return Duration.minutes(60) * n;
  }
  public static hoursFromMS(n: number): number {
    return n / Duration.hours(1);
  }
  public static days(n: number): number {
    return Duration.hours(24) * n;
  }
  public static daysFromMS(n: number): number {
    return n / Duration.days(1);
  }
  public static weeks(n: number): number {
    return Duration.days(7) * n;
  }
  public static weeksFromMS(n: number): number {
    return n / Duration.weeks(1);
  }
  public static months(n: number): number {
    return Duration.days(30) * n;
  }
  public static monthsFromMS(n: number): number {
    return n / Duration.months(1);
  }
  public static years(n: number): number {
    return Duration.days(365) * n;
  }
  public static yearsFromMS(n: number): number {
    return n / Duration.years(1);
  }
}

export type Dtype = 'u32'
                  | 'u16'
                  | 'u8'
                  | 'f64'
                  | 'f32'
                  | 'i32'
                  | 'i16'
                  | 'i8';
export type Behaviour = 'increases'
                      | 'decreases'
                      | 'constant';
// user supplied
export type NumOpt = number
                   | [number, number]
                   | {
                       start: number,
                       end: number,
                       whenFit?: Behaviour,
                     };
type Op = 'crossover' | 'mutate';
export type TypedArray = Uint8Array
                       | Uint16Array
                       | Uint32Array
                       | Int8Array
                       | Int16Array
                       | Int32Array
                       | Float32Array
                       | Float64Array;
export type FitnessFunct = (candidate: TypedArray) => number;
export type UserOpts = Partial<{
  nElite: NumOpt,
  nMutations: NumOpt,
  pMutate: NumOpt,
  nRounds: number,
  popSize: number,
  timeOutMS: number,
  weights: Float64Array | Float32Array | number[],
  // TODO minImprove: number,
  // TODO nTrack: number,
  // TODO validateFitness: boolean,
  logLvl: number,
  randGeneVal: () => number | [number, number];
  log: (...msg: any[]) => any;
}>;
type NumOptResolved = {
                        start: number,
                        end: number,
                        whenFit: Behaviour,
                      };


function getNumOpt(percentageOf: number | undefined, o: NumOpt): NumOptResolved {
  if (o.constructor.name === 'Number') {
    return getNumOpt(percentageOf, [o, o] as [number, number]);

  } else if (Array.isArray(o)) {
    const [start, end]: [number, number] = o as [number, number];
    return getNumOpt(percentageOf, { start, end });
  }

  const opt = o as NumOptResolved;

  if (opt.whenFit === undefined) {
    return getNumOpt(percentageOf, { whenFit: 'constant', ...opt });
  }

  if (percentageOf !== undefined) {
    const { start, end } = opt;
    if (start < 1.0) {
      return getNumOpt(percentageOf, { ...opt, start: start * percentageOf });
    } else if (end < 1.0) {
      return getNumOpt(percentageOf, { ...opt, end: end * percentageOf });
    }
  }

  return opt;
}

function fmtTable(heading: string, obj: object = {}, doUnderline: boolean = false, doNL: boolean = true, log: (...msg: any[]) => any = console.log): void {
  const lWidth = Object.keys(obj)
    .map((k: string) => k.length)
    .reduce((x1: number, x2: number) => Math.max(x1, x2));
  log(heading.toUpperCase());
  if (doUnderline) {
    log('-'.repeat(heading.length));
  }
  for (const k of Object.keys(obj)) {
    // @ts-ignore
    log(k.padEnd(lWidth, ' '), ' ', obj[k].toString());
  }
  if (doNL) {
    log('');
  }
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

export class GeneticAlgorithm extends EventEmitter {
  protected readonly nGenes: number;
  protected readonly fitness: FitnessFunct[];

  protected readonly timeOutMS   = Duration.seconds(30);
  protected readonly nRounds     = NRounds.LARGE;
  private readonly nTrack     = NTrack.TINY;
  private readonly minImprove = MinImprove.SENSITIVE;

  protected readonly popSize = PopSize.MEDIUM;
  protected readonly weights: Float64Array | Float32Array | number[];

  // dynamic getter generation
  public readonly pMutate!: number;
  public readonly nElite!: number;
  public readonly nMutations!: number;

  // check if NaN returned
  // TODO public readonly validateFitness = true;

  // @ts-ignore
  protected oldPop: TypedArray;
  public readonly pop: TypedArray;
  public readonly idxs: Uint32Array;
  public readonly scores: Float64Array[];
  public readonly bestScores: Float64Array[];

  protected readonly randGeneVal: () => number;

  protected readonly log: (...msg: any[]) => any = console.log;
  private readonly logLvl = LogLvl.SILENT;

  public startTm = -Infinity;
  public rIdx    = 0;
  public rank    = 0;
  public cIdx    = 0;
  public op: Op  = 'mutate';


  public constructor(fitness: FitnessFunct | FitnessFunct[], nGenes: number, dtype: Dtype = 'f64', opts: UserOpts = {}) {
    super();
    this.nGenes = nGenes;
    // multi-objective optimisation
    // allow for many fitness functions
    this.fitness = Array.isArray(fitness) ? fitness : [fitness];

    this.weights = opts.weights === undefined ? arrays.f64(this.fitness.length).fill(1) : opts.weights;

    Object.assign(this, opts);

    // register getters from user config merged with defaults into `this`
    this.optToGetter('nElite', getNumOpt(this.popSize, opts.nElite !== undefined && opts.nElite !== null ? opts.nElite : NElite.ADAPTIVE), Math.round);
    this.optToGetter( 'nMutations', getNumOpt(nGenes, opts.nMutations !== undefined && opts.nMutations !== null ? opts.nMutations : NMutations.ADAPTIVE), Math.ceil);
    this.optToGetter('pMutate', getNumOpt(undefined, opts.pMutate !== undefined && opts.pMutate !== null ? opts.pMutate : PMutate.ADAPTIVE));

    // if rand gene value supplier was not given make one using rand uniform distribution with bounds based on `dtype`
    // you can also specify bounds using [bound lower, bound upper] syntax, this will also use uniform distribution
    if (opts.randGeneVal === undefined) {
      const nBits: 8 | 16 | 32 | 64 = dtype.endsWith('8') ? 8 : dtype.endsWith('16') ? 16 : dtype.endsWith('32') ? 32 : 64;

      let boundUpper: number;

      // intelligently compute min and max bounds of search space based on `dtype`
      if (dtype.startsWith('f')) {
        boundUpper = (3.4 * (10 ** 38) - 1) / 1E4;
      } else if (dtype.startsWith('i')) {
        boundUpper = 2 ** (nBits - 1) - 1;
      } else /* if (dtype.startsWith('u')) */ {
        boundUpper = 2 ** nBits - 1;
      }

      let boundLower: number;

      if (dtype.startsWith('f')) {
        boundLower = (1.2 * (10 ** -38)) / 1E4;
      } else if (dtype.startsWith('i')) {
        boundLower = -(2 ** (nBits - 1)) + 1;
      } else /* if (dtype.startsWith('u')) */ {
        boundLower = 0;
      }
      const randRange = boundUpper - boundLower;
      this.randGeneVal = () => boundLower + randRange * Math.random();

    } else if (Array.isArray(opts.randGeneVal)) {
      const [boundLower, boundUpper] = opts.randGeneVal;
      const randRange = boundUpper - boundLower;
      this.randGeneVal = () => boundLower + randRange * Math.random();

    } else /* if func */ {
      this.randGeneVal = opts.randGeneVal as () => number;
    }

    this.pop = GeneticAlgorithm.createPop(dtype, this.popSize, nGenes, this.randGeneVal);

    // indexes of candidates
    // re-sorted on each round as opposed to re-sorting `pop`
    this.idxs = arrays.u32(this.popSize)
                      .map((_, idx) => idx);

    // fitness score for every objective for every candidate
    this.scores = Array(this.fitness.length).fill(0)
                                            .map((_, fIdx) => {
                                              return arrays.f64(this.popSize)
                                                           .map((_, cIdx) => this.fitness[fIdx](this.pop.subarray(cIdx * nGenes, cIdx * nGenes + nGenes)))
                                            });

    // max scores for every objective
    const maxScore: Float64Array = arrays.f64(this.fitness.length)
                                         .map((_, idx) => this.scores[idx].reduce( (x1: number, x2: number) => Math.max(x1, x2)));

    // scores of `nTrack` fittest candidates for every objective
    this.bestScores =
        Array(this.fitness.length).fill(0)
                                  .map((_, fIdx) =>
                                           arrays.f64(this.nTrack) // pretend progress was made to avoid quitting on 1st round
                                                 .map((_, idx) => maxScore[fIdx] + idx * this.minImprove * 10000));


    this.idxs.sort(this.compare.bind(this)); // it's the idxs that are sorted based on scores

    if (this.logLvl >= LogLvl.NORMAL) {
      this.on('start', () => this.log('started genetic algorithm at ', new Date(), ' with opts ', this));
      this.on('end', () => this.log('finished running genetic algorithm at ', new Date(), ` took ${this.timeTakenMS / 1000}sec, did ${this.rIdx} rounds`));
      for (const reason of ['stuck', 'rounds', 'timeout']) {
        this.on(reason, () => this.log(`[${reason}]`));
      }
    }

    if (this.logLvl >= LogLvl.NORMAL) {
      this.on('score', () => {
        fmtTable(
            `round #${this.rIdx} (${(this.percentageDone * 100).toFixed(0)}% done)`,
            { nElite: this.nElite },
            true,
            false);
      });
    }

    if (this.logLvl >= LogLvl.VERBOSE) {
      this.on('op', () => {
        const obj: { pMutate: string | number, nMutations: undefined | string | number } = { pMutate : `${(this.pMutate * 100).toFixed(0)}%`, nMutations: '' };
        if (this.op === 'mutate') {
          obj.nMutations = this.nMutations;
        }
        const heading = `${this.rank}${this.rank === 1 ? 'st' : this.rank === 2 ? 'nd' : this.rank === 3 ? 'rd' : 'th'} best cand`;
        fmtTable(heading, obj, false, true);
      });
    }
  }

  private optToGetter(name: string, { start, end, whenFit }: NumOptResolved, afterFunct?: (n: number) => number) {
    if (start === end) {
      // @ts-ignore
      this[name] = start;
      return;
    }
    const range = end - start;
    let f: () => number;
    if (whenFit === 'constant') {
      // @ts-ignore
      f = function() { return start + this.percentageDone * range; };
    } else {
      if (start <= end) {
        if (whenFit === 'decreases') {
          // @ts-ignore
          f = function() { return start + this.percentageDone * range * (this.rank / this.popSize); };
        } else {
          // @ts-ignore
          f = function() { return start + this.percentageDone * range * (1 - (this.rank / this.popSize)); };
        }
      } else {
        if (whenFit === 'increases') {
          // @ts-ignore
          f = function() { return start + this.percentageDone * range * (this.rank / this.popSize); };
        } else {
          // @ts-ignore
          f = function() { return start + this.percentageDone * range * (1 - (this.rank / this.popSize)); };
        }
      }
    }
    if (afterFunct === undefined) {
      Object.defineProperty(this, name, { get: f });
    } else {
      // @ts-ignore
      const f2 = (function () { return afterFunct(f.bind(this)()); });
      Object.defineProperty(this, name, { get: f2 });
    }
  }

  public get bestCand(): TypedArray { return this.nthBestCand(0); }

  public nthBestCand(n: number): TypedArray {
    const offset = this.idxs[n] * this.nGenes;
    return this.pop.subarray(offset, offset + this.nGenes);
  }

  public get bestScore(): Float64Array {
    const scoresForEveryObj = arrays.f64(this.fitness.length);
    const idx = this.rIdx % this.nTrack;
    for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      scoresForEveryObj[fIdx] = this.bestScores[fIdx][idx];
    }
    return scoresForEveryObj;
  }

  public get timeTakenMS(): number { return Date.now() - this.startTm; }

  public get percentageDoneRounds(): number { return this.rIdx / this.nRounds; }

  public get percentageDoneTime(): number { return this.timeTakenMS / this.timeOutMS; }

  public get percentageDone(): number { return Math.max(this.percentageDoneRounds, this.percentageDoneTime); }

  static createPop(dtype: Dtype, popSize: number, nGenes: number, randGeneValFunc: () => number): TypedArray {
    const pop = arrays[dtype](popSize * nGenes);
    for (let cIdx = 0; cIdx < popSize; cIdx++) {
      const offset = cIdx * nGenes;
      for (let gIdx = 0; gIdx < nGenes; gIdx++) {
        pop[offset + gIdx] = randGeneValFunc();
      }
    }
    return pop;
  }

  protected isFinished(): boolean {
    if (this.percentageDoneRounds >= 1.0) {
      this.emit('rounds');
      return true;
    } else if (this.percentageDoneTime >= 1.0) {
      this.emit('timeout');
      return true;
    }

    return false; // TODO implement plateau detection

    // // track overall change for every objective
    // const change = arrays.f64(this.fitness.length);
    //
    // for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
    //   for (let i = this.rIdx; i < this.nTrack - 1; i++) {
    //     change[fIdx] += bestScores[fIdx][i + 1] - bestScores[fIdx][i];
    //   }
    //   for (let i = 0; i < this.rIdx - 1; i++) {
    //     change[fIdx] += bestScores[fIdx][i + 1] - bestScores[fIdx][i];
    //   }
    // }
    //
    // console.log('change', change, 'rIdx', this.rIdx);
    //
    // const allDidntChange =
    //           change.reduce((prevTooSmall: boolean, current: number) => {
    //             return prevTooSmall && current < this.minImprove;
    //           }, true);
    //
    // if (allDidntChange) {
    //   this.emit('stuck');
    //   return true;
    // } else {
    //   return false;
    // }
  }

  protected compare(cIdx1: number, cIdx2: number): number {
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

  public* search() {
    this.startTm = Date.now();
    this.emit('start');

    while (true) {
      this.emit('round');

      if (this.isFinished()) {
        break;
      }

      this.rIdx++;

      // get score for every objective by getting the value from the best candidate
      const currRoundScoreIdx = this.rIdx % this.nTrack;
      for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
        this.bestScores[fIdx][currRoundScoreIdx] =
            this.scores[fIdx].reduce((s1: number, s2: number) => Math.max(s1, s2));
      }

      this.oldPop = this.pop.map((val: number) => val);

      /* go over non-elite units (elitism - leave best units unaltered)
       *
       * NOTE: order of idxs is as follows: [best, 2nd best, ..., worst] */
      for (this.rank = this.nElite; this.rank < this.popSize; this.rank++) {
        this.cIdx = this.idxs[this.rank];
        if (Math.random() < this.pMutate) {
          this.op = 'mutate';
          this.mutate();
        } else {
          this.op = 'crossover';
          this.crossover();
        }
        this.emit('op');
      }

      this.emit('score');

      for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
        for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
          this.scores[fIdx][cIdx] = this.fitness[fIdx](
              this.pop.subarray(cIdx * this.nGenes, cIdx * this.nGenes + this.nGenes));
        }
      }

      // re-sort candidates based on fitness (1st is most fit, last is least fit)
      this.idxs.sort(this.compare.bind(this));
    }

    this.emit('end');

    for (let ptr = 0; ptr < this.popSize; ptr++) {
      const offset = this.nGenes * this.idxs[ptr];
      yield this.pop.subarray(offset, offset + this.nGenes);
    }
  }

  protected select(): number {
    const rand  = Math.random;

    // begin with a fallback value
    let candIdx = Math.floor(rand() * this.popSize);

    // candidates are already sorted according to fitness
    // choose with probability skewed to be higher when fit
    for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
      const p = 1E3 + 0.35 * rand() * this.percentageDone * (1 - (cIdx / this.popSize));
      if (rand() < p) {
        candIdx = cIdx;
        break;
      }
    }

    return this.idxs[candIdx];
  }

  protected mutate(): void {
    const candStart = this.cIdx * this.nGenes;
    for (let i = 0; i < this.nMutations; i++) {
      const gIdx                 = Math.floor(Math.random() * this.nGenes);
      this.pop[candStart + gIdx] = this.randGeneVal();
    }
  }

  protected crossover(): void {
    const parentIdx = this.select();
    // avoid positional bias
    // don't use cross-over point, otherwise genes CLOSE to each other will be more likely to be inherited
    const meStart     = this.cIdx * this.nGenes;
    const parentStart = parentIdx * this.nGenes;
    for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
      if (Math.random() < 0.5) {
        this.pop[meStart + gIdx] = this.oldPop[parentStart + gIdx];
      }
    }
  }
}
