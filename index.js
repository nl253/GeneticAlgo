/**
 * Implements:
 *
 * - elitism
 * - local-minimum detection
 * - truncation selection
 * - timeout finish
 * - nRound finish
 */
const { EventEmitter } = require('events');

const SEC = 1000;
const bitRegex = /8|16|32|64/;
const DTYPES = new Set(['f64', 'f32', 'i32', 'i16', 'i8', 'u32', 'u16', 'u8']);
const MIN_POPSIZE = 5;
const MIN_NTRACK = 2;
// when Int
const MIN_NELITE = 2;
const DEFAULTS = {
  minImp: 1E-6,
  minNGeneMut: 1,
  nElite: 0.2,
  nRounds: 1E6,
  nTrack: 100,
  pElite: 0.1,
  pMutate: null,
  popSize: 300,
  timeOutMS: 30 * SEC,
};

/**
 * Get typed array constructor from string dtype.
 *
 * @param {'f64'|'f32'|'i32'|'i16'|'i8'|'u32'|'u16'|'u8'} dtype
 * @returns {Float32ArrayConstructor|Float64ArrayConstructor|Int8ArrayConstructor|Int16ArrayConstructor|Int32ArrayConstructor|Uint8ArrayConstructor|Uint16ArrayConstructor|Uint32ArrayConstructor|never} constructor
 * @private
 */
function getConst(dtype) {
  if (dtype.toLowerCase() !== dtype) {
    return getConst(dtype.toLowerCase());
  }
  const nBits = bitRegex.exec(dtype)[0];
  if (dtype.startsWith('f')) {
    return eval(`Float${nBits}Array`);
  } else if (dtype.startsWith('i')) {
    return eval(`Int${nBits}Array`);
  } else if (dtype.startsWith('u')) {
    return eval(`Uint${nBits}Array`);
  } else {
    throw new Error(`unrecognised dtype "${dtype}"`);
  }
}

class GeneticAlgorithm extends EventEmitter {
  /**
   * @param {!function((Uint8Array|Uint16Array|Uint32Array|Int32Array|Int16Array|Int8Array|Float64Array|Float32Array)): !Number} f
   * @param {!Number} nGenes
   * @param {'f64'|'f32'|'i32'|'i16'|'i8'|'u32'|'u16'|'u8'} dtype
   * @param {{pElite: !Number, maxRandVal: !Number, minRandVal: !Number, nElite: !Number, minImp: !Number, maxNGeneMut: !Number, minNGeneMut: !Number, pMutate: ?Number, popSize: !Number, timeOutMS: !Number, nTrack: !Number}} [opts]
   */
  constructor(f, nGenes, dtype, opts = {}) {
    super();

    // validation
    for (const v of ['f', 'dtype', 'nGenes']) {
      if (eval(v) === undefined) {
        throw new Error(`you MUST set ${v}`);
      }
    }

    if (nGenes < 1) {
      throw new Error('nGenes MUST be at least 1');
    }
    if (!DTYPES.has(dtype)) {
      throw new Error(`unrecognised dtype "${dtype}", choose from: ${Array.from(DTYPES).join(', ')}`);
    }

    const checkOpt = (v, p, msg) => {
      if (opts[v] !== undefined && p(opts[v])) {
        throw new Error(msg);
      }
    };

    for (const vName of ['pElite', 'nRounds', 'nElite', 'pMutate', 'minNGeneMut', 'maxNGeneMut', 'nTrack', 'popSize', 'timeOutMS', 'minImp']) {
      checkOpt(vName, val => val < 0, `${vName} CANNOT be negative`);
    }

    for (const vName of ['nRounds', 'minNGeneMut', 'maxNGeneMut', 'nTrack', 'popSize', 'timeOutMS']) {
      checkOpt(vName, val => !Number.isInteger(val), `${vName} MUST be an Int`);
    }

    checkOpt('popSize', popSize => popSize < MIN_POPSIZE, `popSize MUST be at least ${MIN_POPSIZE}`);

    for (const vName of ['pMutate', 'pElite']) {
      checkOpt(vName, v => v > 1, `${vName} is a probability so it MUST be BETWEEN 0 AND 1`);
    }

    if (opts.nElite !== undefined && opts.popSize !== undefined && opts.nElite > opts.popSize) {
      throw new Error('nElite CANNOT be greater than popSize');
    }
    checkOpt('nElite', nElite => !Number.isInteger(nElite) && nElite > 1, 'nElite must be EITHER an Int specifying the number of elite candidate OR a ratio, a Float between 0 and 1');
    checkOpt('nElite', nElite => Number.isInteger(nElite) && nElite < MIN_NELITE, `nElite MUST be a ratio 0..1 OR an in greater than or equal to ${MIN_NELITE}`);

    checkOpt('nTrack', nTrack => nTrack < MIN_NTRACK, `nTrack MUST BE greater than or equal to ${MIN_NTRACK}`);

    checkOpt('minNGeneMut', minNGeneMut => minNGeneMut > nGenes, 'minNGeneMut CANNOT be greater than nGenes');
    checkOpt('minNGeneMut', minNGeneMut => minNGeneMut < 1, 'minNGeneMut MUST be at least 1, you have to mutate SOMETHING');
    if (opts.minNGeneMut !== undefined && opts.maxNGeneMut !== undefined && opts.minNGeneMut > opts.maxNGeneMut) {
      throw new Error('minNGeneMut CANNOT be greater than maxNGeneMut');
    }
    checkOpt('maxNGeneMut', maxNGeneMut => maxNGeneMut > nGenes, 'maxNGeneMut CANNOT be greater than nGenes');

    checkOpt('minRandVal', minRandVal => minRandVal < 0 && dtype.startsWith('u'), 'minRandVal CANNOT be negative when using unsigned integers (UintArray)');
    if (opts.minRandVal !== undefined && opts.maxRandVal !== undefined && opts.minRandVal > opts.maxRandVal) {
      throw new Error('minRandVal CANNOT be greater than `maxRandVal`');
    }

    const DERIVED_OPTS = {
      f,
      dtype,
      maxNGeneMut: (opts.minNGeneMut === undefined ? DEFAULTS.minNGeneMut : opts.minNGeneMut) + Math.floor(Math.log2(nGenes) / 2),
      nBits: parseInt(bitRegex.exec(dtype)[0]),
      nGenes,
    };

    for (const k of Object.keys(opts)) {
      if (DEFAULTS[k] === undefined && DERIVED_OPTS[k] === undefined) {
        throw new Error(`unrecognized option ${k}`);
      }
    }

    Object.assign(
      this,
      Object.assign(
        DERIVED_OPTS,
        Object.assign(
          Object.assign({}, DEFAULTS),
          opts)));

    if (this.nElite < 1) {
      this.nElite = Math.floor(this.nElite * this.popSize);
    }

    if (this.maxRandVal === undefined) {
      if (dtype.startsWith('f')) {
        this.maxRandVal = (3.4 * (10 ** 38) - 1) / 1E4;
      } else if (dtype.startsWith('i')) {
        this.maxRandVal = 2 ** (this.nBits - 1) - 1;
      } else if (dtype.startsWith('u')) {
        this.maxRandVal = 2 ** this.nBits - 1;
      }
    }
    if (this.minRandVal === undefined) {
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

    // scores of fittest candidates from last nTrack rounds
    // this is a metric of how close you are to the solution
    const maxScores = new Float32Array(new ArrayBuffer(4 * this.nTrack));

    // fitness score for every corresponding candidate
    const scores = new Float32Array(new ArrayBuffer(this.popSize * 4));

    // indexes of candidates
    const candIdxs = new Uint32Array(new ArrayBuffer(this.popSize * 4)).map((_, idx) => idx);

    this.emit('generate');

    // make an array for new population
    const typedArr = getConst(this.dtype);
    const pop = new typedArr(new ArrayBuffer(this.popSize * this.nGenes * (this.nBits / 8)));

    this.emit('randomize');

    // initialise to pop to rand values
    for (let cIdx = 0; cIdx < this.popSize * this.nGenes; cIdx += this.nGenes) {
      for (let geneIdx = 0; geneIdx < this.nGenes; geneIdx++) {
        pop[cIdx + geneIdx] = Math.floor(Math.random() * (Math.random() < 0.5 ? this.maxRandVal : this.minRandVal));
      }
    }

    let rIdx = 0;
    const startTm = Date.now();

    // computed parameter info
    this.emit('start', startTm, {
      dtype: this.dtype,
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
    });

    let timeTaken;

    while (true) {
      timeTaken = Date.now() - startTm;

      // stop conditions
      if (timeTaken >= this.timeOutMS) {
        this.emit('timeout');
        break;
      } else if (rIdx > maxScores.length && maxScores.subarray(1).map((f, idx) => f - maxScores[idx]).reduce((diff1, diff2) => diff1 + diff2, 0) < this.minImp) {
        this.emit('stuck');
        break;
      } else if (rIdx >= this.nRounds) {
        console.log(rIdx, this.nRounds);
        this.emit('rounds');
        break;
      } else {
        this.emit('round', rIdx = rIdx + 1);
      }

      // shift scores left
      // [31, 9, 4] => [9, 4, 0]
      maxScores.set(maxScores.subarray(1));

      for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
        scores[cIdx] = this.f(pop.subarray(cIdx * this.nGenes, (cIdx + 1) * this.nGenes));
        // protect against fitness function returning NaN or Infinity
        if (Object.is(NaN, scores[cIdx])) {
          console.warn('[WARN] fitness function returned NaN');
          scores[cIdx] = -Infinity;
        } else {
          scores[cIdx] = Math.min(Number.MAX_VALUE, Math.max(-Number.MAX_VALUE, scores[cIdx]));
        }
      }

      // keep track of last nTrack BEST scores
      maxScores[maxScores.length - 1] =
        scores.reduce((s1, s2) => Math.max(s1, s2), 0); // best fitness

      // re-sort candidates based on fitness (1st is most fit, last is least fit)
      candIdxs.sort((cIdx1, cIdx2) => scores[cIdx1] > scores[cIdx2] ? -1 : 1);

      this.emit('best',
        // fitness of the fittest candidate
        maxScores[maxScores.length - 1],
        // improvement (difference between last best score and current fittest candidate score)
        maxScores[maxScores.length - 1] - maxScores[maxScores.length - 2],
        // index of the fittest candidate
        candIdxs[0]);

      /* go over non-elite units (elitism - leave best units unaltered)
       *
       * NOTE: order of candIdxs is as follows: [best, second best, third best, ..., worst] */

      for (let ptr = this.nElite; ptr < this.popSize; ptr++) {

        const cIdx = candIdxs[ptr];
        const offset = cIdx * this.nGenes;

        /* You want to apply mutation to the fittest BUT crossover to the least fit.
         * To do that, make the probability a function of the position in the array.
         *
         * You also want to increase the p of mutation as you approach the end of running the algorithm
         * meaning as timeTaken approaches timeOutMS, pMutate approaches 1.0. */

        const pMutate = this.pMutate === null ? (1 - ((ptr - this.nElite) / (this.popSize - this.nElite))) * (timeTaken / this.timeOutMS) : this.pMutate;

        if (Math.random() < pMutate) {
          // UNIQUE mutations (on different genes)
          const nMutations = this.minNGeneMut + Math.floor(Math.random() * (this.maxNGeneMut - this.minNGeneMut));

          this.emit('mutate', nMutations, pMutate);

          // make sure that you don't mutate the same gene twice
          const mutated = new Set();

          for (let i = 0; i < nMutations; i++) {
            let geneIdx;
            // choose unique
            do { geneIdx = Math.floor(Math.random() * this.nGenes); } while (mutated.has(geneIdx));
            mutated.add(geneIdx);
            pop[offset + geneIdx] = this.minRandVal + Math.floor(Math.random() * (this.maxRandVal - this.minRandVal));
          }
        } else {
          let pIdx1; // parent 1
          let pIdx2; // parent 2

          // choose from elite (this way, you can maintain a small population of elites and still make rapid progress.)
          if (Math.random() < this.pElite) {
            do { pIdx1 = candIdxs[Math.floor(Math.random() * this.nElite)]; } while (pIdx1 === cIdx);
            do { pIdx2 = candIdxs[Math.floor(Math.random() * this.nElite)]; } while (pIdx2 === cIdx || pIdx2 === pIdx1);
            this.emit('crossover', 1 - pMutate, pIdx1, pIdx2, true);
          // choose from normal
          } else {
            do { pIdx1 = candIdxs[this.nElite + Math.floor(Math.random() * (this.popSize - this.nElite))]; } while (pIdx1 === cIdx);
            do { pIdx2 = candIdxs[this.nElite + Math.floor(Math.random() * (this.popSize - this.nElite))]; } while (pIdx2 === cIdx || pIdx2 === pIdx1);
            this.emit('crossover', 1 - pMutate, pIdx1, pIdx2, false);
          }

          // avoid positional bias
          // don't use cross-over point, otherwise genes CLOSE to each other will be more likely to be inherited
          const offset1 = pIdx1 * this.nGenes;
          const offset2 = pIdx2 * this.nGenes;
          for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
            pop[offset + gIdx] = pop[(Math.random() < 0.5 ? offset1 : offset2) + gIdx];
          }
        }
      }
    }

    this.emit('end', rIdx, timeTaken /* milliseconds */, new Date());

    for (let ptr = 0; ptr < this.popSize; ptr++) {
      const cIdx = candIdxs[ptr];
      const offset = this.nGenes * cIdx;
      yield pop.subarray(offset, offset + this.nGenes);
    }
  }
}

module.exports = GeneticAlgorithm;
// vim:hlsearch:sw=2:ts=4:expandtab:
