/* eslint-disable sort-keys,global-require */
/**
 * @typedef {Object} Opts
 * @property {!String} dtype
 * @property {!Number} nGenes
 * @property {!Boolean} isMultimodal
 * @property {!Number} maxNGeneMut
 * @property {!Number} minNGeneMut
 * @property {!Number} minRandVal
 * @property {!Number} maxRandVal
 * @property {!Number} nElite
 * @property {!Number} pElite
 * @property {!Number} minImp
 * @property {!Number} nTrack
 * @property {!Number} popSize
 * @property {!Number} timeOutMS
 * @property {!Boolean} validateFitness
 * @property {!Number} nRounds
 */

/**
 * @typedef {Opts} Env
 * @property {!Function} emit
 * @property {!Number} rIdx
 * @property {!Number} startTm
 * @property {!TypedArray} pop
 * @property {?Number} timeTakenMS
 * @property {!Uint32Array} candIdxs
 * @property {Float64Array} scores
 * @property {Float64Array} maxScores
 * @property {?Number} maxScoreIdx
 * @property {?Number} maxScoreIdxPrev
 * @property {!Function} f
 * @property {!Number} nBits
 */

/**
 * Implements:
 *
 * - elitism
 * - local-minimum detection
 * - truncation selection
 * - timeout finish
 * - nRound finish
 * - adaptive pMutate
 */

const util = require('util');
const { EventEmitter } = require('events');

const SEC = 1000;
const bitRegex = /8|16|32|64/;
// noinspection JSUnusedLocalSymbols
const { DTYPES,  f32, f64, u8, u16, u32, i8, i16, i32 } = require('./dtype');
const { MIN_POPSIZE, MIN_NTRACK, MIN_NELITE } = require('./defaults');

const DEFAULTS = {
  crossover: require('./crossover'),
  doMutate: require('./doMutate'),
  emitFittest: true,
  initPop: require('./initPop'),
  isFinished: require('./finished'),
  isMultimodal: false,
  maxNGeneMut: null,
  maxRandVal: null,
  minImp: 1E-6,
  minNGeneMut: 1,
  minRandVal: null,
  multimodal: require('./multimodal'),
  mutate: require('./mutate'),
  nElite: 0.2,
  nRounds: 1E6,
  nTrack: 100,
  pElite: null,
  pMutate: null,
  popSize: 300,
  score: null,
  timeOutMS: 30 * SEC,
  validateFitness: true,
};

class GeneticAlgorithm extends EventEmitter {
  /**
   * @param {!function((Uint8Array|Uint16Array|Uint32Array|Int32Array|Int16Array|Int8Array|Float64Array|Float32Array)): !Number} f
   * @param {!Number} nGenes
   * @param {'f64'|'f32'|'i32'|'i16'|'i8'|'u32'|'u16'|'u8'} dtype
   * @param {{mutate: function({ pop: !TypedArray, minNGeneMut: !Number, maxNGeneMut: !Number, nGenes: !Number }), isMultimodal: ?Boolean, pElite: !Number, maxRandVal: !Number, minRandVal: !Number, nElite: !Number, minImp: !Number, maxNGeneMut: !Number, minNGeneMut: !Number, pMutate: ?Number, popSize: !Number, timeOutMS: !Number, nTrack: !Number}} [opts]
   */
  constructor(f, nGenes, dtype, opts = {}) {
    super();

    // validation on `f`, `nGenes` and `dtype`
    for (const v of ['f', 'dtype', 'nGenes']) {
      if (eval(v) === undefined) {
        throw new Error(`you MUST set ${v}`);
      }
    }

    if (nGenes.constructor.name !== 'Number' || !Number.isInteger(nGenes)) {
      throw new Error('nGenes MUST be an Int');
    }

    if (nGenes < 1) {
      throw new Error('nGenes MUST be at least 1');
    }

    if (!DTYPES.has(dtype)) {
      throw new Error(`unrecognised dtype "${dtype}", choose from: ${Array.from(DTYPES).join(', ')}`);
    }

    if (f.constructor.name !== 'Function') {
      throw new Error(`fitness function must be a Function`);
    }

    this.f = f;
    this.nGenes = nGenes;
    this.dtype = dtype;
    this.nBits = parseInt(bitRegex.exec(dtype)[0]);

    // validation on `opts`

    /**
     * @param {*} v value
     * @param {!Function} p predicate
     * @param {!String} msg
     */
    const assert = (v, p, msg) => {
      if (opts[v] !== undefined && !p(opts[v])) {
        throw new Error(msg);
      }
    };

    const assNum = vName => assert(vName, n => n.constructor.name === 'Number', `${vName} must be a Number`);
    const assProb = vName => assert(vName, p => p >= 0 && p <= 1, `${vName} is a probability so it MUST be BETWEEN 0 AND 1`);
    const assPos = vName => assert(vName, val => val >= 0, `${vName} MUST be positive`);
    const assInt = vName => assert(vName, n => Number.isInteger(n), `${vName} MUST be an integer`);
    // const assFloat = vName => assert(vName, n => !Number.isInteger(n), `${vName} MUST be a float`);
    const assLTE = (vName, n) => assert(vName, val => val <= n, `${vName} MUST be less than or equal to ${n}`);
    // const assLE = (vName, n) => assert(vName, val => val < n, `${vName} MUST be less than ${n}`);
    const assGTE = (vName, n) => assert(vName, val => val >= n, `${vName} MUST be greater than or equal to ${n}`);
    // const assGT = (vName, n) => assert(vName, val => val > n, `${vName} MUST be greater than ${n}`);

    for (const vName of [
      'maxNGeneMut',
      'minImp',
      'minNGeneMut',
      'nElite',
      'nRounds',
      'nTrack',
      'pElite',
      'pMutate',
      'popSize',
      'timeOutMS',
    ]) {
      assNum(vName);
      assPos(vName);
    }

    for (const vName of [
      'maxNGeneMut',
      'minNGeneMut',
      'nRounds',
      'nTrack',
      'popSize',
      'timeOutMS',
    ]) {
      assNum(vName);
      assInt(vName);
    }

    assGTE('popSize', MIN_POPSIZE);
    assGTE('nTrack', MIN_NTRACK);

    for (const vName of ['pMutate', 'pElite']) {
      assNum(vName);
      assProb(vName);
    }

    // eslint-disable-next-line no-undefined
    if (opts.nElite !== undefined && opts.popSize !== undefined && opts.nElite > opts.popSize) {
      throw new Error('nElite CANNOT be greater than popSize');
    }

    assert('nElite', nElite => Number.isInteger(nElite) || nElite <= 1, 'nElite must be EITHER an Int specifying the number of elite candidate OR a ratio, a Float between 0 and 1');
    assert('nElite', nElite => !Number.isInteger(nElite) || nElite >= MIN_NELITE, `nElite MUST be a ratio 0..1 OR an in greater than or equal to ${MIN_NELITE}`);

    assLTE('minNGeneMut', nGenes);
    assGTE('minNGeneMut', 1);

    assert('minRandVal', minRandVal => !dtype.startsWith('u') || minRandVal >= 0, 'minRandVal CANNOT be negative when using unsigned integers (UintArray)');
    // eslint-disable-next-line no-undefined
    if (opts.minRandVal !== undefined && opts.maxRandVal !== undefined && opts.minRandVal > opts.maxRandVal) {
      throw new Error('minRandVal CANNOT be greater than `maxRandVal`');
    }

    for (const k of Object.keys(opts)) {
      // eslint-disable-next-line no-undefined
      if (DEFAULTS[k] === undefined) {
        throw new Error(`unrecognized option ${k}`);
      }
    }

    Object.assign(
      this,
      Object.assign(
        Object.assign({}, DEFAULTS),
        opts,
      ),
    );

    if (this.isMultimodal && !this.multimodal) {
      this.multimodal = require('./mulitmodal');
    } else {
      this.multimodal = () => null;
    }

    if (this.score === null) {
      this.score = require('./score')(this.validateFitness);
    }

    // resolve ratio
    if (this.nElite < 1) {
      this.nElite = Math.floor(this.nElite * this.popSize);
    }

    // default to pElite equal to ratio of elites to popSize
    if (this.pElite === null) {
      this.pElite = this.nElite / this.popSize;
    }

    // default to a very small value of maxNGeneMut based on nGenes
    if (this.maxNGeneMut === null) {
      this.maxNGeneMut = this.minNGeneMut + Math.floor(Math.log2(nGenes) / 2);
    }

    // intelligently compute min and max bounds of search space based on `dtype`
    if (this.maxRandVal === null) {
      if (dtype.startsWith('f')) {
        this.maxRandVal = (3.4 * (10 ** 38) - 1) / 1E4;
      } else if (dtype.startsWith('i')) {
        this.maxRandVal = 2 ** (this.nBits - 1) - 1;
      } else if (dtype.startsWith('u')) {
        this.maxRandVal = 2 ** this.nBits - 1;
      }
    }
    if (this.minRandVal === null) {
      if (dtype.startsWith('f')) {
        this.minRandVal = (1.2 * (10 ** -38)) / 1E4;
      } else if (dtype.startsWith('i')) {
        this.minRandVal = -(2 ** (this.nBits - 1)) + 1;
      } else if (dtype.startsWith('u')) {
        this.minRandVal = 0;
      }
    }
  }

  * search() {
    this.emit('init');
    this.emit('generate');

    /** @type {!Env} */
    const env = Object.assign({
      // round number
      rIdx: 0,

      startTm: Date.now(),

      timeTakenMS: null,

      // concatenation of all candidates
      // each candidate with index `cIdx` is a subarray from (cIdx * nGenes) to ((cIdx + 1) * nGenes)
      pop: eval(this.dtype)(this.popSize * this.nGenes),

      // indexes of candidates
      // re-sorted on each round as opposed to resorting `pop`
      candIdxs: u32(this.popSize).map((_, idx) => idx),

      // fitness score for every corresponding candidate
      scores: f64(this.popSize),

      // scores of fittest candidates from last nTrack rounds
      // metric of improvement
      maxScores: f64(this.nTrack),

      maxScoreIdx: null,

      maxScoreIdxPrev: null,

      emit: this.emit,

    }, this);

    env.maxScores[this.nTrack - 1] = Infinity;

    this.emit('randomize');
    this.initPop(env);
    this.emit('start', env.startTm, env);

    // bootstrap elite scores
    this.score(env);
    // sort candidates based on fitness (1st is most fit, last is least fit)
    env.candIdxs.sort((cIdx1, cIdx2) => (env.scores[cIdx1] > env.scores[cIdx2] ? -1 : 1));

    while (true) {
      env.maxScoreIdx = env.rIdx % this.nTrack;
      env.timeTakenMS = Date.now() - env.startTm;

      const maybeDone = this.isFinished(env);
      if (maybeDone !== false) {
        this.emit(maybeDone);
        break;
      }

      this.emit('round', ++env.rIdx, env.timeTakenMS);

      this.score(env);

      // re-sort candidates based on fitness (1st is most fit, last is least fit)
      env.candIdxs.sort((cIdx1, cIdx2) => (env.scores[cIdx1] > env.scores[cIdx2] ? -1 : 1));

      this.multimodal(env);

      // keep track of last nTrack BEST scores
      env.maxScores[env.maxScoreIdx] = env.scores.reduce((s1, s2) => Math.max(s1, s2)); // best fitness

      this.emit('best',
        this.emitFittest
          // fittest candidate
          ? env.pop.subarray(env.candIdxs[0] * this.nGenes, (env.candIdxs[0] + 1) * this.nGenes)
          // can be disabled for better performance which causes it to return the idx of fittest cand
          : env.candIdxs[0],
        // fitness of best candidate
        env.scores[env.candIdxs[0]],
        // improvement (difference between last best score and current fittest candidate score)
        env.maxScores[env.maxScoreIdx] - env.maxScores[env.maxScoreIdxPrev]);

      env.maxScoreIdxPrev = env.maxScoreIdx;

      /* go over non-elite units (elitism - leave best units unaltered)
       *
       * NOTE: order of candIdxs is as follows: [best, second best, third best, ..., worst] */
      for (let ptr = this.nElite; ptr < this.popSize; ptr++) {
        const cfg = Object.assign({
          cIdx: env.candIdxs[ptr],
          offset: env.candIdxs[ptr] * this.nGenes,
          ptr,
        }, env);
        if (this.doMutate(cfg)) {
          this.mutate(cfg);
        } else {
          this.crossover(cfg);
        }
      }
    }

    this.emit('end', env.rIdx, new Date(), env.timeTakenMS);

    for (let ptr = 0; ptr < this.popSize; ptr++) {
      const offset = this.nGenes * env.candIdxs[ptr];
      yield env.pop.subarray(offset, offset + this.nGenes);
    }
  }

  [util.inspect.custom]() {
    return this.toString();
  }

  /**
   * @returns {!String}
   */
  toString() {
    return `GeneticAlgorithm ${util.inspect(this.opts)}`;
  }

  /**
   * @returns {!Opts} opts
   */
  get opts() {
    return {
      dtype: this.dtype,
      isMultimodal: this.isMultimodal,
      maxNGeneMut: this.maxNGeneMut,
      maxRandVal: this.maxRandVal,
      minImp: this.minImp,
      minNGeneMut: this.minNGeneMut,
      minRandVal: this.minRandVal,
      nElite: this.nElite,
      nGenes: this.nGenes,
      nRounds: this.nRounds,
      nTrack: this.nTrack,
      pElite: this.pElite,
      pMutate: this.pMutate,
      popSize: this.popSize,
      timeOutMS: this.timeOutMS,
      validateFitness: this.validateFitness,
    };
  }
}

module.exports = GeneticAlgorithm;
// vim:hlsearch:sw=2:ts=4:expandtab:foldmethod=manual:nu:
