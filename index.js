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
const util              = require('util');
const { EventEmitter }  = require('events');

const arrays            = require('./arrays');
const registerLogging   = require('./logging');

const DEFAULT_OPTS = {
  // search space bounds (guess from dtype)
  randValMin:           undefined,
  randValMax:           undefined,
  minImprove:                1E-6,
  nRounds:                    1E6,
  nTrack:                     100,
  popSize:                    300,
  timeOutMS:             30 * 1000 /* 30 SEC */,
  // check if NaN returned
  validateFitness:          false,
  // emit best candidate or index of best candidate
  emitFittest:              false,

  tournamentSize:         [2, 10],
  nElite:              [0.1, 0.3],
  pElite:              [0.1, 0.2],

  logLvl:                       0,
};

class GeneticAlgorithm extends EventEmitter {
  /**
   * @param {!FitnessFunct|!Array<!FitnessFunct>} fitness
   * @param {!Number} nGenes
   * @param {!DType} dtype
   * @param {{nElite: !NumericOpt, tournamentSize: !NumericOpt, nMutations: !NumericOpt, pElite: !NumericOpt, nTrack: !Number, weights: !Array<!Number>, popSize: !Number, randVal: !NumericOpt}} opts
   * @param {{getPop: (function(!DType, !Number, !Number, !Number, !Number): !TypedArray), isFinished: (function(): !Boolean), compare: (function(!Number, !Number): !Number), randGeneVal: (function(!Number, !Number): !Number)}} functs
   */
  constructor(fitness, nGenes, dtype = 'f64', opts = {}, functs = {}) {
    super();
    Object.assign(this, functs);
    const userOpts = Object.assign(Object.assign({}, opts), DEFAULT_OPTS);

    // multi-objective optimisation
    // allow for many fitness functions
    this.fitness = Array.isArray(fitness) ? fitness : [fitness];

    // how important each objective is
    if (this.weights === undefined) {
      this.weights = userOpts.weights || arrays.f64(this.fitness.length).fill(1);
    }

    this.nGenes    = nGenes;
    this.dtype     = dtype;
    this.nBits     = parseInt(/8|16|32|64/.exec(dtype)[0]);
    this.rIdx      = 0; // round index
    this.startTm   = null;
    this.popSize   = userOpts.popSize;
    this.nRounds   = userOpts.nRounds;
    this.timeOutMS = userOpts.timeOutMS;
    this.nTrack    = userOpts.nTrack;

    this.registerGetter('nElite', userOpts.nElite, this.popSize);

    // create functions of rank (value changes depending on fitness in relation to other candidates)
    // f :: Num -> Num
    this.registerFunctRank('nMutations', userOpts.nMutations, this.popSize, false);
    this.registerFunctRank('pMutate', userOpts.pMutate, this.popSize, true);
    this.registerFunctRank('tournamentSize', userOpts.tournamentSize, this.popSize, false);
    this.registerFunctRank('pElite', userOpts.pElite, this.popSize, false);

    // indexes of candidates
    // re-sorted on each round as opposed to re-sorting `pop`
    this.idxs = arrays.u32(this.popSize).map((_, idx) => idx);

    // fitness score for every objective for every candidate
    this.scores = Array(this.fitness.length).fill(0).map(() => arrays.f64(this.popSize));

    // scores of fittest candidates from last nTrack rounds for every objective
    // metric of improvement
    this.bestScores = Array(this.fitness.length).map(() => arrays.f64(this.nTrack));

    // keep track of best candidate for every objective
    // used as circular buffer (index computed later from `rIdx` round index)
    this.bestIdxs     = arrays.u32(fitness.length);
    // needed to compute improvement (previous - current)
    this.bestIdxsPrev = arrays.u32(fitness.length);

    // used to stop the algorithm when a plateau is reached
    this.improvement  = Array(this.fitness.length).map(() => arrays.f64(this.nTrack));

    // this.registerGetter('tournamentSize', opts.tournamentSize, [2, 2 + Math.floor(this.popSize * 0.03)]);
    // default to a very small value of maxNMutations based on nGenes
    // this.nMutations = this.

    // translate {min, max} => [min, max]
    if (userOpts.randVal !== undefined && opts.randVal.constructor.name === 'Object') {
      userOpts.randVal = [opts.randVal.min, opts.randVal.max];
    }

    // intelligently compute min and max bounds of search space based on `dtype`
    if (userOpts.randVal[1] === undefined) {
      if (dtype.startsWith('f')) {
        this.randValMax = (3.4 * (10 ** 38) - 1) / 1E4;
      } else if (dtype.startsWith('i')) {
        this.randValMax = 2 ** (this.nBits - 1) - 1;
      } else if (dtype.startsWith('u')) {
        this.randValMax = 2 ** this.nBits - 1;
      }
    } else {
      this.randValMax = userOpts.randVal[1];
    }

    if (userOpts.randVal[0] === undefined) {
      if (dtype.startsWith('f')) {
        this.randValMin = (1.2 * (10 ** -38)) / 1E4;
      } else if (dtype.startsWith('i')) {
        this.randValMin = -(2 ** (this.nBits - 1)) + 1;
      } else if (dtype.startsWith('u')) {
        this.randValMin = 0;
      }
    } else {
      this.randValMin = userOpts.randVal[0];
    }

    this.pop = this.getPop(dtype, this.popSize, nGenes, this.randValMin, this.randValMax);
    registerLogging(userOpts.logLvl, this);
  }

  /**
   * Initialise population.
   *
   * @param {!DType} dtype
   * @param {!Number} popSize
   * @param {!Number} nGenes
   * @param {!Number} minVal
   * @param {!Number} maxVal
   * @returns {!TypedArray} pop
   * @private
   */
  getPop(dtype, popSize, nGenes, minVal, maxVal) {
    const pop = arrays[dtype](popSize);
    for (let cIdx = 0; cIdx < popSize; cIdx++) {
      const offset = cIdx * nGenes;
      for (let gIdx = 0; gIdx < nGenes; gIdx++) {
        // special treatment for unsigned (minRandVal is 0) to prevent too many zeroes
        if (dtype.startsWith('u')) {
          pop[offset + gIdx] = Math.floor(Math.random() * maxVal);
        } else {
          pop[offset + gIdx] = Math.floor(Math.random() * (Math.random() < 0.5 ? maxVal : minVal));
        }
      }
    }
    return pop;
  }

  /**
   * @returns {!Number} random gene value
   */
  randGeneVal(minVal, maxVal) {
    return minVal + (maxVal - minVal) * Math.random();
  }

  /**
   * An algorithm is finished when it is stuck or max number of rounds have taken place or timeout has been reached.
   *
   * An algorithm is stuck if it is not improving in any objective.
   *
   * @returns {!Boolean} isFinished
   * @private
   */
  isFinished() {
    const change = arrays.f64(this.fitness.length);
    let improvedObjectives = 0;
    for (let objIdx = 0; objIdx < this.fitness.length; objIdx++) {
      for (let i = 1; i < this.bestIdxs; i++) {
        change[objIdx] += this.bestScores[i] - this.bestScores[i - 1];
      }
      // for (let i = this.bestIdxs + 2; i < this.nTrack; i++) {
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

  /**
   * Define total ordering between candidates.
   *
   * @param {!Number} cIdx1
   * @param {!Number} cIdx2
   * @returns {!Number} ordering
   * @private
   */
  compare(cIdx1, cIdx2) {
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

  /**
   * Sort idxs.
   * @private
   */
  reorder() {
    // sort candidates based on fitness (1st is most fit, last is least fit)
    this.idxs.sort(this.compare);
  }

  /**
   * @returns {?Number} time taken in ms
   * @private
   */
  get timeTakenMS() {
    return this.startTm - Date.now();
  }

  /**
   * Create a function that returns a value in range [min, max] such that as time progresses, value
   * changes from min to max linearly.
   *
   * @param {!Number} min
   * @param {!Number} max
   * @param {!Number} [percentageOf]
   * @returns {function(): !Number} supplier
   * @private
   */
  getLinearSupplier(min, max, percentageOf) {
    if (percentageOf !== undefined) {
      return this.getLinearSupplier(...[min, max].map(x => x < 1.0 ? x * percentageOf : x));
    } else {
      return () => min + (this.timeTakenMS / this.timeOutMS) * (max - min);
    }
  }

  /**
   * Create a function that returns a value in range [min, max] such that as time progresses, value
   * changes from min to max linearly.
   *
   * @param {!Number} min
   * @param {!Number} max
   * @param {!Number} percentageOf
   * @param {!Boolean} [isRising]
   * @returns {function(!Number): !Number} supplier
   * @private
   */
  getLinearSupplierRanked(min, max, percentageOf, isRising) {
    if (percentageOf !== undefined) {
      return this.getLinearSupplier(...[min, max].map(x => x < 1.0 ? x * percentageOf : x));
    } else if (isRising) {
      return (rank) => min + (this.timeTakenMS / this.timeOutMS) * (max - min) * (1 - (rank / this.popSize));
    } else {
      return (rank) => min + (this.timeTakenMS / this.timeOutMS) * (max - min) * (rank / this.popSize);
    }
  }

  /**
   * Register a unary function for property `name` that takes rank (Number) as the parameter.
   *
   * @param {!String} name
   * @param {{min: !Number, max: !Number}|!Array|!Number|null|undefined} val
   * @param {!Number} percentageOf
   * @param {!Boolean} isRising whether the value should rise when candidate is better (i.e. rank is smaller such as 1-10 as opposed to 200-300)
   * @private
   */
  registerFunctRank(name, val, percentageOf, isRising) {
    if (Array.isArray(val)) {
      const [min, max] = val;
      // when [min, undefined] use min as a constant
      if (max === undefined || max === null) {
        this.registerFunctRank(name, min, percentageOf, isRising);
      } else /* min defined AND max defined */ {
        this[name] = this.getLinearSupplierRanked(min, max, percentageOf, isRising);
      }
    } else if (val.constructor.name === 'Object') {
      this.registerFunctRank(name, [val.min, val.max], percentageOf, isRising);
    } else if (/* val is Number AND */ percentageOf !== undefined) {
      this.registerFunctRank(name, Math.floor(val * percentageOf), percentageOf, isRising);
    } else /* if val is Number */ {
      this.registerFunctRank(name, [val, val], percentageOf, isRising);
    }
  }

  /**
   * Register getter for property `name`.
   *
   * @param {!String} name
   * @param {{min: !Number, max: !Number}|!Array|!Number|null|undefined} val
   * @param {!Number} [percentageOf]
   * @private
   */
  registerGetter(name, val, percentageOf) {
    if (Array.isArray(val)) {
      const [min, max] = val;
      // when [min, undefined] use min as a constant
      if (max === undefined || max === null) {
        this.registerGetter(name, min, percentageOf);
      } else /* min defined AND max defined */ {
        Object.defineProperty(this, name, { get: this.getLinearSupplier(min, max, percentageOf) });
      }
    } else if (val.constructor.name === 'Object') {
      this.registerGetter(name, [val.min, val.max], percentageOf);
    } else if (/* val is Number AND */ percentageOf !== undefined) {
      this.registerGetter(name, Math.floor(val * percentageOf));
    } else /* if val is Number */ {
      this[name] = val;
    }
  }

  /**
   * Tournament selection (selection pressure depends on tournamentSize).
   *
   * @returns {!Number} index of selected candidate
   * @private
   */
  select(rank) {
    const tournamentSize = this.tournamentSize(rank);
    const pElite = this.pElite(rank);
    const nElite = this.nElite;
    const idxs = arrays.u32(tournamentSize);
    for (let i = 0; i < tournamentSize; i++) {
      if (Math.random() < pElite) {
        idxs[i] = this.idxs[Math.floor(Math.random() * nElite)];
      }
    }
    let bestIdx = idxs[0];
    let bestScore = this.scores[bestIdx];
    for (let i = 1; i < tournamentSize; i++) {
      const idx = idxs[i];
      if (this.scores[idx] > bestScore) {
        bestIdx = idx;
        bestScore = this.scores[idx];
      }
    }
    return bestIdx;
  }

  /**
   * @private
   */
  score() {
    for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
      for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
        this.scores[fIdx][cIdx] = this.fitness[fIdx](this.pop.subarray(cIdx * this.nGenes, cIdx * this.nGenes + this.nGenes));
      }
    }
  }


  /**
   * Apply `nMutations` mutations to candidate `cIdx` by choosing a `randGeneVal`.
   *
   * @param {!Number} cIdx
   * @param {!Number} nMutations
   */
  mutate(cIdx, nMutations) {
    const offset = cIdx * this.nGenes;
    for (let i = 0; i < nMutations; i++) {
      this.pop[offset + Math.floor(Math.random() * this.nGenes)] = this.randGeneVal(this.randValMin, this.randValMax);
    }
  }

  /**
   * Default crossover function.
   */
  crossover(rank) {
    // avoid positional bias
    // don't use cross-over point, otherwise genes CLOSE to each other will be more likely to be inherited
    const offset = this.select(rank) * this.nGenes;
    for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
      if (Math.random() < 0.5) {
        this.pop[this.offset + gIdx] = this.pop[offset + gIdx];
      }
    }
  }

  * search() {
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
      this.bestIdxs = this.rIdx % this.nTrack; // index in an array acting as circular buffer
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
        this.best = this.pop.subarray(this.idxs[0] * this.nGenes, (this.idxs[0] + 1) * this.nGenes);
      }

      for (let objIdx = 0; objIdx < this.fitness.length; objIdx++) {
        this.bestIdxs[objIdx]  ;
      }

      this.bestIdx = this.idxs[0];

      // fitness of best candidate
      // store in circular buffer (simulated using array and bestIdxs)
      this.bestScore = this.bestScores[this.bestIdxs] = [];
      for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
        this.bestScore[fIdx] = this.bestScores[this.bestIdxs[fIdx]] += this.scores[fIdx].reduce((s1, s2) => Math.max(s1, s2));
      }

      // improvement for every objective (difference between last best score and current fittest candidate score)
      for (let fIdx = 0; fIdx < this.fitness.length; fIdx++) {
        this.improvement[fIdx] = this.bestScores[fIdx][this.bestIdxs[fIdx]] - this.bestScores[fIdx][this.bestIdxsPrev[fIdx]];
      }

      this.bestIdxsPrev = this.bestIdxs;

      this.emit('score', this);

      /* go over non-elite units (elitism - leave best units unaltered)
       *
       * NOTE: order of idxs is as follows: [best, 2nd best, ..., worst] */
      for (let ptr = this.nElite; ptr < this.popSize; ptr++) {
        const cIdx = this.idxs[ptr];
        if (Math.random() < this.pMutate(ptr)) {
          this.mutate(cIdx, this.nMutations(ptr));
        } else {
          this.crossover(ptr);
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
