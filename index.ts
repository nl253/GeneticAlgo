/**
 * You MAY override the following methods using inheritance (just extend GeneticAlgorithm):
 * - createPop
 * - mutate
 * - crossover
 * - select
 * - randGeneVal
 * - isFinished
 * - compare
 */
/**
 * To remove dependency on Node.js standard library (and Node itself)
 * here is a minimal polyfill for the core `.on` and `.emit` methods in
 * the events.EventEmitter class.
 */
type EventHandler = (...args: any[]) => any;

export type RandGeneValFunc = (gene: number, gIdx: number) => number;

export class EventEmitter {
  private readonly events: Map<string, EventHandler[]> = new Map();

  public emit(e: string, ...args: any[]): boolean {
    const ouput = this.events.get(e) !== undefined;
    const fs = this.listeners(e);
    Promise.all(fs.map(f => new Promise((resolve, reject) => resolve(f(...args)))));
    return ouput;
  }

  public on(e: string, f: EventHandler): this {
    this.listeners(e).push(f);
    this.emit('newListener');
    return this;
  }

  public addListener(e: string, f: EventHandler): this {
    return this.on(e, f);
  }

  public eventNames(): string[] {
    return [...this.events.keys()];
  }

  public listenerCount(e: string): number {
    return this.listeners(e).length;
  }

  public off(e: string, f: EventHandler): this {
    const fs = this.listeners(e);
    const idx = fs.findIndex(l => l === f);
    this.listeners(e).splice(idx, 1);
    return this;
  }

  public removeListener(e: string, f: EventHandler): this {
    return this.off(e, f);
  }

  public listeners(e: string): EventHandler[] {
    let output = this.events.get(e);
    if (output === undefined) {
      output = [];
      this.events.set(e, output);
    }
    return output;
  }

  public prependListener(e: string, f: EventHandler): this {
    this.listeners(e).unshift(f);
    return this;
  }

  public removeAllListeners(e: string): this {
    this.events.set(e, []);
    return this;
  }
}

export class Duration {
  private static SEC = 1000;
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
export type Op = 'crossover' | 'mutate';
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
  logLvl: number,
  minImprove: number,
  nElite: NumOpt,
  nMutations: NumOpt,
  nRounds: number,
  nTrack: number,
  pMutate: NumOpt,
  popSize: number,
  boundUpper: number,
  boundLower: number,
  timeOutMS: number,
  weights: Float64Array | Float32Array | number[],
  validateFitness: boolean,
}>;
type NumOptResolved = {
                        start: number,
                        end: number,
                        whenFit: Behaviour,
                      };

function getNumOpt(percentageOf: number | undefined, o: NumOpt): { start: number, end: number, whenFit: Behaviour } {
  if (o.constructor.name === 'Number') {
    return getNumOpt(percentageOf, [o, o] as [number, number]);
  } else if (o.constructor.name === 'Array') {
    const [start, end]: [number, number] = o as [number, number];
    return getNumOpt(percentageOf, { start, end });
  } else if ((o as NumOptResolved).whenFit === undefined) {
    (o as NumOptResolved).whenFit = 'constant';
    return getNumOpt(percentageOf, o);
  } else if (percentageOf !== undefined && (o as NumOptResolved).start < 1.0) {
    (o as NumOptResolved).start *= percentageOf;
    return getNumOpt(percentageOf, o);
  } else if (percentageOf !== undefined && (o as NumOptResolved).end < 1.0) {
    (o as NumOptResolved).end *= percentageOf;
    return getNumOpt(percentageOf, o);
  } else {
    return o as NumOptResolved;
  }
}

function optToGetter(self: any,
                     name: string,
                     { start, end, whenFit }: NumOptResolved,
                     afterFunct?: (n: number) => number) {
  if (start === end) {
    self[name] = start;
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
    Object.defineProperty(self, name, { get: f });
  } else {
    // @ts-ignore
    const f2 = (function () { return afterFunct(f.bind(this)()); });
    Object.defineProperty(self, name, { get: f2 });
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
  public nGenes: number;
  public fitness: FitnessFunct[];
  public dtype: Dtype;

  public timeOutMS: number;
  public nRounds: number;
  public nTrack: number;
  public minImprove: number;

  public boundLower: number;
  public boundUpper: number;
  public randRange: number;

  public popSize: number;
  // value within search space bounds (guess from dtype)
  public randGeneVal!: RandGeneValFunc;
  public weights: Float64Array | Float32Array | number[];

  // dynamic getter generation
  public pMutate!: number;
  public nElite!: number;
  public nMutations!: number;

  protected pop: TypedArray;
  protected idxs: Uint32Array;
  protected scores: Float64Array[];
  protected bestScores: Float64Array[];

  public startTm: number;
  public rIdx: number;
  public rank: number;
  public cIdx: number;
  public op: Op;

  public constructor(fitness: FitnessFunct | FitnessFunct[], nGenes: number, dtype: Dtype = 'f64', opts: UserOpts = {}) {
    super();
    this.nGenes = nGenes;
    this.dtype  = dtype;

    // multi-objective optimisation
    // allow for many fitness functions
    this.fitness = Array.isArray(fitness) ? fitness : [fitness];

    Object.assign(this, {
      // how important each objective is
      weights: arrays.f64(this.fitness.length).fill(1),
      minImprove:      1E-6,
      nRounds:         1E6,
      nTrack:          100,
      popSize:         300,
      nElite:          { start:  0.05, end: 0.150 },
      pMutate:         { start:  0.10, end: 0.010, whenFit: 'increases' as Behaviour },
      nMutations:      { start: 10.00, end: 1.000, whenFit: 'decreases' as Behaviour },
      logLvl:          0,
      timeOutMS:       Duration.seconds(30),
      // check if NaN returned
      validateFitness: false,
      ...opts,
      op:     'mutate',
      rIdx:    0,
      startTm: -Infinity,
      rank:    0,
      cIdx:    0,
    });

    // register getters from user config merged with defaults into `this`
    optToGetter(this, 'nElite', getNumOpt(this.popSize, this.nElite), Math.round);
    optToGetter(this, 'nMutations', getNumOpt(nGenes, this.nMutations), Math.ceil);
    optToGetter(this, 'pMutate', getNumOpt(undefined, this.pMutate));

    // if rand gene value supplier was not given make one using rand uniform distribution with bounds based on `dtype`
    if (this.randGeneVal === undefined) {
      const nBits: 8 | 16 | 32 | 64 = dtype.endsWith('8') ? 8 : dtype.endsWith('16') ? 16 : dtype.endsWith('32') ? 32 : 64;

      // intelligently compute min and max bounds of search space based on `dtype`
      if (this.boundUpper === undefined) {
        if (dtype.startsWith('f')) {
          this.boundUpper = (3.4 * (10 ** 38) - 1) / 1E4;
        } else if (dtype.startsWith('i')) {
          this.boundUpper = 2 ** (nBits - 1) - 1;
        } else /* if (dtype.startsWith('u')) */ {
          this.boundUpper = 2 ** nBits - 1;
        }
      }

      if (this.boundLower === undefined) {
        if (dtype.startsWith('f')) {
          this.boundLower = (1.2 * (10 ** -38)) / 1E4;
        } else if (dtype.startsWith('i')) {
          this.boundLower = -(2 ** (nBits - 1)) + 1;
        } else /* if (dtype.startsWith('u')) */ {
          this.boundLower = 0;
        }
      }

      this.randRange  = this.boundUpper - this.boundLower;
    }

    this.pop = this.createPop();

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

    const maxScore: TypedArray = arrays.f64(this.fitness.length)
                                       .map((_, idx) =>
                                         this.scores[idx].reduce( (x1: number, x2: number) => Math.max(x1, x2)));

    // scores of fittest candidates for every objective
    this.bestScores =
        Array(this.fitness.length)
            .fill(0)
            .map((_, fIdx) =>
                     arrays.f64(this.nTrack)
                           .map((_, idx) => maxScore[fIdx] + idx * this.minImprove * 10000));


    this.idxs.sort(this.compare.bind(this)); // it's the idxs that are sorted based on scores

    if (this.logLvl >= 1) {
      this.on('start', () => console.log('started genetic algorithm at', new Date(), 'with opts', this));
      this.on('end', () => console.log('finished running genetic algorithm at', new Date(), `took ${this.timeTakenMS / 1000}sec, did ${this.rIdx} rounds`));
      for (const reason of ['stuck', 'rounds', 'timeout']) {
        this.on(reason, () => console.log(`[${reason}]`));
      }
    }

    const fmtTable = (heading: string, obj: object = {}, doUnderline: boolean = false, doNL: boolean = true) => {
      const lWidth = Object.keys(obj)
                           .map((k: string) => k.length)
                           .reduce((x1: number, x2: number) => Math.max(x1, x2));
      console.log(heading.toUpperCase());
      if (doUnderline) {
        console.log('-'.repeat(heading.length));
      }
      for (const k of Object.keys(obj)) {
        // @ts-ignore
        console.log(k.padEnd(lWidth, ' '), ' ', obj[k].toString());
      }
      if (doNL) {
        console.log('');
      }
    };

    if (this.logLvl >= 1) {
      this.on('score', () => {
        fmtTable(
            `round #${this.rIdx} (${(this.percentageDone * 100).toFixed(0)}% done)`,
            { nElite: this.nElite },
            true,
            false);
      });
    }

    if (this.logLvl >= 2) {
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

  public randGeneVal(gene: number, gIdx: number): number {
    return this.boundLower + this.randRange * Math.random();
  }

  public get bestCand(): TypedArray { return this.nthBestCand(0); }

  public nthBestCand(n: number): TypedArray {
    const offset = this.idxs[n] * this.nGenes;
    return this.pop.subarray(offset, offset + this.nGenes);
  }

  public get bestScore(): TypedArray {
    const scoresForEveryObj = arrays.f64(this.fitness.length);
    for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      scoresForEveryObj[fIdx] = this.bestScores[fIdx][this.rIdx % this.nTrack];
    }
    // console.log('rIdx', this.rIdx, 'best score for objective #1', scoresForEveryObj[0]);
    return scoresForEveryObj;
  }

  public get timeTakenMS(): number { return Date.now() - this.startTm; }

  public get percentageDoneRounds(): number { return this.rIdx / this.nRounds; }

  public get percentageDoneTime(): number { return this.timeTakenMS / this.timeOutMS; }

  public get percentageDone(): number { return Math.max(this.percentageDoneRounds, this.percentageDoneTime); }

  protected createPop(): TypedArray {
    const pop = arrays[this.dtype](this.popSize * this.nGenes);
    for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
      const offset = cIdx * this.nGenes;
      for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
        pop[offset + gIdx] = this.randGeneVal(pop[offset + gIdx], gIdx);
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
      for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
        this.bestScores[fIdx][this.rIdx % this.nTrack] =
            this.scores[fIdx].reduce((s1: number, s2: number) => {
              return Math.max(s1, s2);
            });
      }

      const oldPop: TypedArray = this.pop.map((val: number) => val);

      /* go over non-elite units (elitism - leave best units unaltered)
       *
       * NOTE: order of idxs is as follows: [best, 2nd best, ..., worst] */
      for (this.rank = this.nElite; this.rank < this.popSize; this.rank++) {
        this.cIdx = this.idxs[this.rank];
        if (Math.random() < this.pMutate) {
          this.op = 'mutate';
          this.mutate(this.nMutations);
        } else {
          this.op = 'crossover';
          this.crossover(oldPop, this.select());
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

  protected mutate(nMutations: number): void {
    const candStart = this.cIdx * this.nGenes;
    for (let i = 0; i < nMutations; i++) {
      const gIdx                 = Math.floor(Math.random() * this.nGenes);
      this.pop[candStart + gIdx] = this.randGeneVal(this.pop[candStart + gIdx], gIdx);
    }
  }

  protected crossover(oldPop: TypedArray, parentIdx: number): void {
    // avoid positional bias
    // don't use cross-over point, otherwise genes CLOSE to each other will be more likely to be inherited
    const meStart     = this.cIdx * this.nGenes;
    const parentStart = parentIdx * this.nGenes;
    for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
      if (Math.random() < 0.5) {
        this.pop[meStart + gIdx] = oldPop[parentStart + gIdx];
      }
    }
  }
}
