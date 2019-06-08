/* eslint-disable sort-keys,global-require,no-magic-numbers,complexity,max-lines,no-undefined,null,null,key-spacing,no-multi-spaces */
/**
 * TODO keep track of old scores for every objective
 * TODO algorithms is stuck if it makes no progress on all objectives
 * TODO better handling of isFinished
 * TODO compute improvement whilst considering all objectives
 * TODO rethink the require architecture
 *
 * 1. Have an option to replace function such as getPopulation so that the user of the API can have custom initalisation.
 * 2. Have the option to set static and dynamic values for parameters.
 * 3. For each option you can specify a constant, a [min, max] range or you may not specify it and a default will be chosen.
 *
 * @typedef {function((Uint8Array|Uint16Array|Uint32Array|Int32Array|Int16Array|Int8Array|Float64Array|Float32Array)): !Number} FitnessFunct
 * @typedef {Float64Array|Float32Array|Int32Array|Int16Array|Int8Array|Uint32Array|Uint16Array|Uint8Array} TypedArray
 */
const util              = require('util');
const { EventEmitter }  = require('events');

const arr               = require('./dtype');
const registerLogging   = require('./logging');

const DEFAULT_OPTS = {
  // search space bounds (guess from dtype)
  randVal: [undefined, undefined],
  minImprove:                1E-6,
  nRounds:                    1E6,
  nTrack:                     100,
  popSize:                    300,
  timeOutMS:             30 * 1000 /* 30 SEC */,
  // check if NaN returned
  validateFitness:          false,
  // emit best candidate or index of best candidate
  emitFittest:              false,
  logLvl:                       0,
};

class GeneticAlgorithm extends EventEmitter {
  /**
   * @param {!FitnessFunct|!Array<!FitnessFunct>} fitness
   * @param {!Number} nGenes
   * @param {'f64'|'f32'|'i32'|'i16'|'i8'|'u32'|'u16'|'u8'} dtype
   * @param {{score: function(), mutate: function(), crossover: function(), getPop: function(), isFinished: function(): (!String|!Boolean), select: function(): !Number, tournamentSize: !Number, pMutate: function(): !Number, nMutations: !Number, pElite: !Number, maxRandVal: !Number, nElite: !Number, minImprove: !Number, maxNMutations: !Number, popSize: !Number, timeOutMS: !Number, nTrack: !Number, emitFittest: ?Boolean, nRounds: !Number}} [opts]
   * @param {Object<String, function>} functs
   */
  constructor(fitness, nGenes, dtype = 'f64', opts = {}, functs = {}) {
    super();

    // require('./validate')(fitness, nGenes, dtype, opts);
    Object.assign(this, Object.assign(Object.assign({}, DEFAULT_OPTS), opts));
    Object.assign(this, functs);

    // multi-objective optimisation
    // allow for many fitness functions
    if (fitness.constructor.name === 'Array') {
      this.fitness = fitness;
    } else {
      this.fitness = [fitness];
    }

    this.nGenes = nGenes;
    this.dtype  = dtype;
    this.nBits  = parseInt(/8|16|32|64/.exec(dtype)[0]);
    this.rIdx   = 0;
    this.ptr    = 0;
    this.offset = 0;

    // fitness score for every objective for every candidate
    this.scores = Array(this.fitness.length)
      .fill(0)
      .map(() => arr.f64(this.popSize));

    // scores of fittest candidates from last nTrack rounds
    // metric of improvement
    this.maxScores = Array(this.fitness.length)
      .map(() => arr.f64(this.nTrack));

    // used as circular buffer
    this.maxScoreIdx     = [];
    this.maxScoreIdxPrev = [];

    // indexes of candidates
    // re-sorted on each round as opposed to resorting `pop`
    this.candIdxs = arr.u32(this.popSize).map((_, idx) => idx);

    this.registerGetter('nElite', opts.nElite, [0.1, 0.3], this.popSize);
    this.registerGetter('pElite', opts.pElite, [0.1, 0.2], this.popSize);
    this.registerGetter('tournamentSize', opts.tournamentSize, [2, 2 + Math.floor(this.popSize * 0.03)], this.popSize);
    // default to a very small value of maxNMutations based on nGenes
    this.registerGetter('nMutations', opts.nMutations, [1, 1 + Math.floor(Math.log2(nGenes) / 2)], nGenes);
    // this.registerGetter('pMutate', opts.pMutate, [0.01, 0.5], nGenes);

    // intelligently compute min and max bounds of search space based on `dtype`
    if (this.randVal[1] === undefined) {
      if (dtype.startsWith('f')) {
        this.randVal[1] = (3.4 * (10 ** 38) - 1) / 1E4;
      } else if (dtype.startsWith('i')) {
        this.randVal[1] = 2 ** (this.nBits - 1) - 1;
      } else if (dtype.startsWith('u')) {
        this.randVal[1] = 2 ** this.nBits - 1;
      }
    }
    if (this.randVal[0] === undefined) {
      if (dtype.startsWith('f')) {
        this.randVal[0] = (1.2 * (10 ** -38)) / 1E4;
      } else if (dtype.startsWith('i')) {
        this.randVal[0] = -(2 ** (this.nBits - 1)) + 1;
      } else if (dtype.startsWith('u')) {
        this.randVal[0] = 0;
      }
    }

    if (this.score === undefined) {
      this.score = require('./score')(this.validateFitness);
    }

    this.pop = this.getPop();
    registerLogging(this.logLvl, this);
  }

  /**
   * Initialise population.
   *
   * @returns {!TypedArray} pop
   * @private
   */
  getPop() {
    const pop = arr[this.dtype](this.popSize);
    for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
      const offset = cIdx * this.nGenes;
      for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
        // special treatment for unsigned (minRandVal is 0) to prevent too many zeroes
        if (this.dtype.startsWith('u')) {
          pop[offset + gIdx] = Math.floor(Math.random() * this.randVal[1]);
        } else {
          pop[offset + gIdx] = Math.floor(Math.random() * (Math.random() < 0.5 ? this.randVal[1] : this.randVal[0]));
        }
      }
    }
    // eslint-disable-next-line no-magic-numbers
    return pop;
  }

  /**
   * @returns {!Boolean|'stuck'|'rounds'|'timeout'}
   * @private
   */
  isFinished() {
    let disDiff = 0;
    for (let i = 1; i < this.maxScoreIdx; i++) {
      disDiff += this.maxScores[i] - this.maxScores[i - 1];
    }
    for (let i = this.maxScoreIdx + 2; i < this.nTrack; i++) {
      disDiff += this.maxScores[i] - this.maxScores[i - 1];
    }
    // diff between lst and fst
    disDiff += this.maxScores[this.nTrack - 1] - this.maxScores[0];

    if (disDiff < this.minImprove) {
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

  /**
   * Sort candIdxs.
   * @private
   */
  reorder() {
    // sort candidates based on fitness (1st is most fit, last is least fit)
    this.candIdxs.sort((cIdx1, cIdx2) => {
      let score1 = 0;
      let score2 = 0;
      // candidate #1 is better than #2 when it dominates across more objectives
      for (const objectiveScores of this.scores) {
        if (objectiveScores[cIdx1] > objectiveScores[cIdx2]) {
          score1++;
        } else if (objectiveScores[cIdx1] < objectiveScores[cIdx2]) {
          score2++;
        }
      }
      return score1 > score2 ? -1 : score1 < score2 ? 1 : 0;
    });
  }

  /**
   * @returns {?Number} time taken in ms
   * @private
   */
  get timeTakenMS() {
    return this.startTm - Date.now();
  }

  /**
   * @param {!Array<!Number>} pair
   * @param {!Number} [percentageOf]
   * @returns {function(): !Number} supplier
   * @private
   */
  getLinearSupplier(pair, percentageOf) {
    if (percentageOf !== undefined) {
      return this.getLinearSupplier(pair.map(x => x < 1.0 ? x * percentageOf : x));
    } else {
      return () => pair[0] + (this.timeTakenMS / this.timeOutMS) * (pair[1] - pair[0]);
    }
  }

  /**
   * @param {!String} name
   * @param {?Array|?Number|undefined} val
   * @param {?Array|?Number|undefined} fallback
   * @param {!Number} [percentageOf]
   * @private
   */
  registerGetter(name, val, fallback, percentageOf) {
    if (val === undefined || val === null) {
      this.registerGetter(name, fallback, undefined, percentageOf);
    } else if (val.constructor.name === 'Array') {
      if (val[1] === undefined) {
        this.registerGetter(name, val[0], fallback, percentageOf);
      } else {
        Object.defineProperty(this, name, { get: this.getLinearSupplier(val, percentageOf) });
      }
    } else if (percentageOf !== undefined) {
      this.registerGetter(name, fallback, Math.floor(val * percentageOf));
    } else {
      this[name] = val;
    }
  }

  /**
   * @returns {'mutate'|'crossover'} op
   * @private
   */
  get op() {
    return Math.random() < this.pMutate ? 'mutate' : 'crossover';
  }

  /**
   * Tournament selection (selection pressure depends on tournamentSize).
   *
   * @returns {!Number} index of selected candidate
   * @private
   */
  select() {
    const idxs = new Uint32Array(new ArrayBuffer(4 * this.tournamentSize));
    if (Math.random() < this.pElite) {
      for (let i = 0; i < this.tournamentSize; i++) {
        idxs[i] = this.candIdxs[Math.floor(Math.random() * this.nElite)];
      }
    } else {
      for (let i = 0; i < this.tournamentSize; i++) {
        idxs[i] = this.candIdxs[this.nElite + Math.floor(Math.random() * (this.popSize - this.nElite))];
      }
    }
    let bestIdx = idxs[0];
    let bestScore = this.scores[bestIdx];
    for (let i = 1; i < this.tournamentSize; i++) {
      const idx = idxs[i];
      if (this.scores[idx] > bestScore) {
        bestIdx = idx;
        bestScore = this.scores[idx];
      }
    }
    return bestIdx;
  }

  /**
   * Default mutate function.
   * @private
   */
  mutate() {
    const randValUpper = this.randVal[1] - this.randVal[0];
    for (let i = 0; i < this.nMutations; i++) {
      this.pop[this.offset + Math.floor(Math.random() * this.nGenes)] = this.randVal[0] + Math.floor(Math.random() * randValUpper);
    }
  }

  /**
   * You want to apply mutation to the fittest BUT crossover to the least fit.
   * To do that, make the probability a function of the position in the array.
   *
   * You also want to increase the p of mutation as you approach the end of running the algorithm
   * meaning as timeTakenMS approaches timeOutMS, pMutate approaches 1.0.
   * @private
   */
  get pMutate() {
    return 0.8 * (1 - ((this.ptr - this.nElite) / (this.popSize - this.nElite))) * (1 - (this.timeTakenMS / this.timeOutMS));
  }

  // /**
  //  * Compute the number of unique mutations (on different genes).
  //  *
  //  * @returns {!Number} number of mutations
  //  */
  // get nMutations() {
  //   const { minNMutations, maxNMutations, timeTakenMS, timeOutMS } = this;
  //   // at first, carry out more mutations (more exploration)
  //   // later, exploit more and alter only 1 dimension
  //   // so that you don't stray too far off the fitness peak
  //   return minNMutations + Math.floor(Math.random() * (maxNMutations - minNMutations) * (1 - (timeTakenMS / timeOutMS)));
  // }

  /**
   * Default crossover function.
   */
  crossover() {
    // avoid positional bias
    // don't use cross-over point, otherwise genes CLOSE to each other will be more likely to be inherited
    const offset1 = this.select() * this.nGenes;
    const offset2 = this.select() * this.nGenes;
    for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
      this.pop[this.offset + gIdx] = this.pop[(Math.random() < 0.5 ? offset1 : offset2) + gIdx];
    }
  }

  * search() {
    this.startTm = Date.now();

    // ensure it doesn't finish during first nTrack rounds
    for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      this.maxScores[fIdx][this.nTrack - 1] = Infinity;
    }

    this.emit('start', this);

    // bootstrap elite scores
    this.score();
    this.reorder();

    while (true) {
      this.maxScoreIdx = this.rIdx % this.nTrack; // index in an array acting as circular buffer
      this.emit('round', this);

      if (this.isFinished()) {
        break;
      }

      ++this.rIdx;

      this.score();

      // re-sort candidates based on fitness (1st is most fit, last is least fit)
      this.reorder();

      // can be disabled for better performance
      if (this.emitFittest) {
        // fittest candidate
        this.best = this.pop.subarray(this.candIdxs[0] * this.nGenes, (this.candIdxs[0] + 1) * this.nGenes);
      }

      this.bestIdx = this.candIdxs[0];

      // fitness of best candidate
      // store in circular buffer (simulated using array and maxScoreIdx)
      this.bestScore = this.maxScores[this.maxScoreIdx] = [];
      for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
        this.bestScore[fIdx] = this.maxScores[this.maxScoreIdx[fIdx]] += this.scores[fIdx].reduce((s1, s2) => Math.max(s1, s2));
      }

      // improvement for every objective (difference between last best score and current fittest candidate score)
      for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
        this.improvement[fIdx] = this.maxScores[fIdx][this.maxScoreIdx[fIdx]] - this.maxScores[fIdx][this.maxScoreIdxPrev[fIdx]];
      }

      this.maxScoreIdxPrev = this.maxScoreIdx;

      this.emit('score', this);

      /* go over non-elite units (elitism - leave best units unaltered)
       *
       * NOTE: order of candIdxs is as follows: [best, 2nd best, ..., worst] */
      for (this.ptr = this.nElite; this.ptr < this.popSize; this.ptr++) {
        this.cIdx = this.candIdxs[this.ptr];
        this.offset = this.cIdx * this.nGenes;
        if (this.op === 'mutate') {
          this.mutate();
        } else {
          this.crossover();
        }
        this.emit('op', this);
      }
    }

    this.emit('end', this);

    for (let ptr = 0; ptr < this.popSize; ptr++) {
      const offset = this.nGenes * this.candIdxs[ptr];
      yield this.pop.subarray(offset, offset + this.nGenes);
    }
  }

  /**
   * @returns {!String}
   */
  [util.inspect.custom]() {
    return this.toString();
  }

  /**
   * @returns {!String}
   */
  toString() {
    return `GeneticAlgorithm ${util.inspect(this.opts)}`;
  }
}

module.exports = GeneticAlgorithm;
// vim:hlsearch:sw=2:ts=4:expandtab:foldmethod=manual:nu:
