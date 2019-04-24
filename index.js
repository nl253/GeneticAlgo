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
const { EventEmitter } = require('events');

const SEC = 1000;
const bitRegex = /8|16|32|64/;
const TARRAY = {
  f32: n => new Float32Array(new ArrayBuffer(4 * n)),
  f64: n => new Float64Array(new ArrayBuffer(8 * n)),
  i32: n => new Int32Array(new ArrayBuffer(4 * n)),
  u32: n => new Uint32Array(new ArrayBuffer(4 * n)),
  i16: n => new Int16Array(new ArrayBuffer(4 * n)),
  u16: n => new Uint16Array(new ArrayBuffer(4 * n)),
  i8: n => new Int8Array(new ArrayBuffer(4 * n)),
  u8: n => new Uint8Array(new ArrayBuffer(4 * n)),
};
const DTYPES = new Set(Object.keys(TARRAY));
const MIN_POPSIZE = 5;
const MIN_NTRACK = 2;
const MIN_NELITE = 2;
const DEFAULTS = {
  emitFittest: true,
  isMultimodal: false,
  minImp: 1E-6,
  minNGeneMut: 1,
  nElite: 0.2,
  nRounds: 1E6,
  nTrack: 100,
  pElite: 0.1,
  pMutate: null,
  popSize: 300,
  timeOutMS: 30 * SEC,
  validateFitness: true,
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

    this.randValUpper = this.maxRandVal - this.minRandVal;
    this.randMutUpper = this.maxNGeneMut - this.minNGeneMut;
  }

  * search() {
    this.emit('init');

    // scores of fittest candidates from last nTrack rounds
    // this is a metric of how close you are to the solution
    const maxScores = TARRAY.f64(this.nTrack);

    // fitness score for every corresponding candidate
    const scores = TARRAY.f64(this.popSize);

    // indexes of candidates
    const candIdxs = TARRAY.u32(this.popSize);
    for (let i = 0; i < this.popSize; i++) {
      candIdxs[i] = i;
    }

    // cumulative distance from elite units (for all genes)
    const distances = TARRAY.f64(this.popSize);

    this.emit('generate');

    // pop is a concatenation of all candidates
    // each candidate with index `cIdx` is a subarray from (cIdx * nGenes) to ((cIdx + 1) * nGenes)
    const pop = TARRAY[this.dtype](this.popSize * this.nGenes);

    this.emit('randomize');

    // initialise to pop to rand values
    if (this.dtype.startsWith('u')) {
      // special treatment for unsigned (minRandVal is 0) to prevent too many zeroes
      for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
        const offset = cIdx * this.nGenes;
        for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
          pop[offset + gIdx] = Math.floor(Math.random() * this.maxRandVal);
        }
      }
    } else {
      for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
        const offset = cIdx * this.nGenes;
        for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
          pop[offset + gIdx] = Math.floor(Math.random() * (Math.random() < 0.5 ? this.maxRandVal : this.minRandVal));
        }
      }
    }

    const startTm = Date.now();
    let rIdx = 0;
    let timeTaken;
    let maxScoreIdxPrev;

    // computed parameter info
    this.emit('start', startTm, {
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
    });

    while (true) {
      timeTaken = Date.now() - startTm;

      // stop conditions
      if (timeTaken >= this.timeOutMS) {
        this.emit('timeout');
        break;
      } 
      
      const maxScoreIdx = rIdx % this.nTrack;

      if (rIdx > this.nTrack) {
        let finiteDiff = 0; 
        for (let i = 1; i < maxScoreIdx; i++) {
          finiteDiff += maxScores[i] - maxScores[i - 1];
        }
        for (let i = maxScoreIdx + 2; i < this.nTrack; i++) {
          finiteDiff += maxScores[i] - maxScores[i - 1];
        }
        finiteDiff += maxScores[this.nTrack - 1] - maxScores[0];
        if (finiteDiff < this.minImp)  {
          this.emit('stuck');
          break;
        }
      } 
      
      if (rIdx >= this.nRounds) {
        this.emit('rounds');
        break;
      } 

      this.emit('round', rIdx = rIdx + 1);

      if (this.validateFitness) {
        for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
          // unfortunately, for the purpose of evaulating fitness each candidate must be extracted from pop into a subarray
          scores[cIdx] = this.f(pop.subarray(cIdx * this.nGenes, (cIdx + 1) * this.nGenes));
          // protect against fitness function returning NaN or Infinity
          if (Object.is(NaN, scores[cIdx])) {
            console.warn('[WARN] fitness function returned NaN');
            scores[cIdx] = -Infinity;
          } else {
            scores[cIdx] = Math.min(Number.MAX_VALUE, Math.max(-Number.MAX_VALUE, scores[cIdx]));
          }
        }
      } else {
        for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
          // unfortunately, for the purpose of evaulating fitness each candidate must be extracted from pop into a subarray
          scores[cIdx] = this.f(pop.subarray(cIdx * this.nGenes, (cIdx + 1) * this.nGenes))
        }
      }

      // keep track of last nTrack BEST scores
      maxScores[maxScoreIdx] =
        scores.reduce((s1, s2) => Math.max(s1, s2), 0); // best fitness

      // re-sort candidates based on fitness (1st is most fit, last is least fit)
      candIdxs.sort((cIdx1, cIdx2) => scores[cIdx1] > scores[cIdx2] ? -1 : 1);

      // this will slow it down quite a bit but it may give some more diversity to solutions
      if (this.isMultimodal) {
        let maxDist = -Infinity;
        let minDist = Infinity;
        // for each candidate, measure *cumulative* distance from *all* elites for *all* genes
        for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
          const offsetCand = cIdx * this.nGenes;
          let d = 0;
          for (let eIdx = 0; eIdx < this.nElite; eIdx++) {
            // when cIdx == eIdx, distance == 0 (see compensation step below)
            const offsetElite = candIdxs[eIdx] * this.nGenes;
            // manhattan distance because it's quickest
            for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
              d += Math.abs(pop[offsetCand + gIdx] - pop[offsetElite + gIdx]);
            }
          }
          if (d > maxDist) {
            maxDist = d;
          } else if (d < minDist) {
            minDist = d;
          }
          // division by 2**nBits necassary otherwise float64 overflows
          distances[cIdx] = d / 2**this.nBits;
        }
        // Elites are at a loss because their distance to itself is 0.
        // You still wanna keep them because they are good solutions.
        // To do that, artificially add distance to them and make them seem diverse.
        // Distance of 0 is replaced with maxDist.
        for (let cIdx = 0; cIdx < this.nElite; cIdx++) {
          distances[candIdxs[cIdx]] += maxDist / 2**this.nBits;
        }
        // normalize using min-max rule
        // the further away you are from the fittest, the better
        for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
          scores[cIdx] *= (distances[cIdx] - minDist) / (maxDist - minDist);
        }
        // re-sort after changing fitness
        candIdxs.sort((cIdx1, cIdx2) => scores[cIdx1] > scores[cIdx2] ? -1 : 1);
      }

      this.emit('best',
        // fittest candidate
        this.emitFittest ? pop.subarray(candIdxs[0] * this.nGenes, (candIdxs[0] + 1) * this.nGenes) : candIdxs[0],
        // fitness of best candidate
        scores[candIdxs[0]],
        // improvement (difference between last best score and current fittest candidate score)
        maxScores[maxScoreIdx] - maxScores[maxScoreIdxPrev],
      );

      maxScoreIdxPrev = maxScoreIdx;

      // v2
      // this.emit('best',
        // // fitness of the fittest candidate
        // maxScores[maxScores.length - 1],
        // // improvement (difference between last best score and current fittest candidate score)
        // maxScores[maxScores.length - 1] - maxScores[maxScores.length - 2],
        // // index of the fittest candidate
        // candIdxs[0]);

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
          const nMutations = this.minNGeneMut + Math.floor(Math.random() * this.randMutUpper);

          this.emit('mutate', nMutations, pMutate);

          // make sure that you don't mutate the same gene twice
          const mutated = new Set();

          for (let i = 0; i < nMutations; i++) {
            let geneIdx;
            // choose unique
            do { geneIdx = Math.floor(Math.random() * this.nGenes); } while (mutated.has(geneIdx));
            mutated.add(geneIdx);
            pop[offset + geneIdx] = this.minRandVal + Math.floor(Math.random() * this.randValUpper);
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

    // v2
    // this.emit('end', rIdx, timeTaken /* milliseconds */, new Date());
    this.emit('end', rIdx, new Date(), timeTaken /* milliseconds */);

    for (let ptr = 0; ptr < this.popSize; ptr++) {
      const cIdx = candIdxs[ptr];
      const offset = this.nGenes * cIdx;
      yield pop.subarray(offset, offset + this.nGenes);
    }
  }
}

module.exports = GeneticAlgorithm;
// vim:hlsearch:sw=2:ts=4:expandtab:
