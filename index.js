/**
 * Implements:
 *
 * - elitism
 * - local-minimum detection
 * - rank-based selection
 * - timeout finish
 * - nRound finish
 * - adaptive probability
 */
const { EventEmitter } = require('events');

const SEC = 1000;
const bitRegex = /8|16|32|64/;
const DTYPES = new Set(['f64', 'f32', 'i32', 'i16', 'i8', 'u32', 'u16', 'u8']);
const MIN_POPSIZE = 5;
const DEFAULTS = {
  minImprove: 1E-4,
  pMutate: null,
  minNGeneMut: 1,
  nElite: 0.1,
  nRounds: 1E6,
  nTrack: 50,
  popSize: 100,
  timeOutMS: 30 * SEC,
};

/**
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
   * @param {{maxRandVal: !Number, minRandVal: !Number, nGenes: !Number, nElite: !Number, minImprove: !Number, maxNGeneMut: !Number, minNGeneMut: !Number, nRounds: !Number, pMutate: ?Number, popSize: !Number, timeOutMS: !Number, nTrack: !Number}} [opts]
   */
  constructor(f, nGenes, dtype, opts = {}) {
    super();

    // validation
    if (dtype === undefined) {
      throw new Error('you MUST set `dtype`');
    }
    if (nGenes === undefined) {
      throw new Error('you MUST set `nGenes`');
    }
    if (opts.popSize !== undefined && opts.popSize < MIN_POPSIZE) {
      throw new Error(`population size too small, min ${MIN_POPSIZE}`);
    }
    if (!DTYPES.has(dtype)) {
      throw new Error(`unrecognised dtype "${dtype}", choose from: ${Array.from(DTYPES).join(', ')}`);
    }
    if (opts.nElite !== undefined && opts.popSize !== undefined && opts.nElite > opts.popSize) {
      throw new Error('`nElite` CANNOT be greater than `popSize`');
    }
    if (opts.nElite !== undefined && opts.nElite < 0) {
      throw new Error('`nElite` CANNOT be negative');
    }
    if (opts.nTrack !== undefined && opts.nTrack < 0) {
      throw new Error('`nTrack` CANNOT be negative');
    }
    if (opts.nTrack !== undefined && opts.nTrack < 2) {
      throw new Error('`nTrack` MUSTBE greater than or equal to 2');
    }
    if (opts.nElite !== undefined && !Number.isInteger(opts.nElite) && opts.nElite > 1) {
      throw new Error('`nElite` must be EITHER an int specifying the number of elite candidate OR a ratio, a float between 0 and 1');
    }
    if (opts.minNGeneMut !== undefined && opts.minNGeneMut > nGenes) {
      throw new Error('`minNGeneMut` CANNOT be greater than `nGenes`');
    }
    if (opts.minNGeneMut !== undefined && opts.minNGeneMut < 1) {
      throw new Error('`minNGeneMut` must be at least 1, you have to mutate SOMETHING');
    }
    if (opts.minNGeneMut !== undefined && opts.maxNGeneMut !== undefined && opts.minNGeneMut > opts.maxNGeneMut) {
      throw new Error('`minNGeneMut` cannot be greater than `maxNGeneMut`');
    }
    if (opts.minRandVal !== undefined && opts.minRandVal < 0 && dtype.startsWith('u')) {
      throw new Error('`minRandVal` cannot be negative when using unsigned integers (uint array)');
    }
    if (opts.minRandVal !== undefined && opts.maxRandVal !== undefined && opts.minRandVal > opts.maxRandVal) {
      throw new Error('`minRandVal` cannot be greater than `maxRandVal`');
    }
    if (opts.maxNGeneMut !== undefined && opts.maxNGeneMut > nGenes) {
      throw new Error('`maxNGeneMut` cannot be greater than `nGenes`');
    }
    if (opts.pMutate !== undefined && opts.pMutate > 1) {
      throw new Error('`pMutate` is a probability so it must be BETWEEN 0 AND 1');
    }

    const DERIVED_OPTS = {
      f,
      dtype,
      maxNGeneMut: Math.max(1, Math.floor(Math.log2(nGenes))),
      nBits: parseInt(bitRegex.exec(dtype)[0]),
      nGenes,
    };

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
    const bufSize = this.popSize * this.nGenes * (this.nBits / 8);
    const typedArr = getConst(this.dtype);
    const makePop = () => new typedArr(new ArrayBuffer(bufSize));

    this.emit('generate');

    let pop = makePop();

    this.emit('randomize');

    // initialise to pop to rand values
    for (let cIdx = 0; cIdx < this.popSize * this.nGenes; cIdx += this.nGenes) {
      for (let geneIdx = 0; geneIdx < this.nGenes; geneIdx++) {
        pop[cIdx + geneIdx] = Math.floor(Math.random() * this.maxRandVal);
      }
    }

    // scores of candidates from last nTrack rounds
    const maxScores = this.minImprove !== null && this.nTrack !== null
      ? new Float32Array(new ArrayBuffer(4 * this.nTrack))
      : null;

    // fitness score for every corresponding candidate
    const scores = new Float32Array(new ArrayBuffer(this.popSize * 4));

    // indexes of candidates
    let candIdxs = new Uint32Array(new ArrayBuffer(this.popSize * 4)).map((_, idx) => idx);

    const startTm = Date.now();

    this.emit('start', startTm, {
      dtype: this.dtype,
      nBits: this.nBits,
      maxNGeneMut: this.maxNGeneMut,
      maxRandVal: this.maxRandVal,
      minImprove: this.minImprove,
      minNGeneMut: this.minNGeneMut,
      minRandVal: this.minRandVal,
      nElite: this.nElite,
      nGenes: this.nGenes,
      nRounds: this.nRounds,
      nTrack: this.nTrack,
      pMutate: this.pMutate,
      popSize: this.popSize,
      timeOutMS: this.timeOutMS,
    });

    let rIdx = 0;

    while (true) {
      if (rIdx >= this.nRounds) {
        this.emit('rounds');
        break;
      } else if ((Date.now() - startTm) >= this.timeOutMS) {
        this.emit('timeout');
        break;
      } else if (maxScores !== null && rIdx > maxScores.length && maxScores.subarray(1).map((f, idx) => f - maxScores[idx]).reduce((diff1, diff2) => diff1 + diff2) < this.minImprove) { 
        this.emit('stuck');
        break;
      } else {
        rIdx++;
      }

      this.emit('score');

      // main thread handles the last quarter
      for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
        scores[cIdx] = this.f(pop.subarray(cIdx * this.nGenes, (cIdx + 1) * this.nGenes));
      }

      const newPop = makePop();

      let improve;
      let bestF;

      if (this.minImprove !== null) {
        // shift left
        maxScores.set(maxScores.subarray(1));
        bestF = scores.filter(s => !Object.is(NaN, s) && !Object.is(Infinity, s)).reduce((s1, s2) => Math.max(s1, s2), 0);
        maxScores[maxScores.length - 1] = bestF;
        improve = bestF - maxScores[maxScores.length - 2];
      }

      candIdxs = candIdxs.sort((idx1, idx2) => (scores[idx1] > scores[idx2] ? -1 : 1));

      this.emit('best', pop.subarray(candIdxs[0] * this.nGenes, (candIdxs[0] + 1) * this.nGenes), bestF, improve);

      for (let ptr = 0; ptr < this.popSize; ptr++) {
        const cIdx = candIdxs[ptr];
        newPop.set(pop.subarray(cIdx * this.nGenes, (cIdx + 1) * this.nGenes), ptr * this.nGenes);
      }

      pop = newPop;

      // go over non-elite units (elitism - leave best units unaltered)
      //
      // NOTE: order is as follows: [best, second best, third best, ..., worst]
      // so you want to apply mutation to best BUT crossover to worst
      // to do that, make the probability a funciton of the position in the array
      //
      // You also want to increase the p of mutation as you approach the end of running the algorithm
      // meaning as rIdx approaches nRounds, pMutate approaches 0.8 (or something similar).
      //
      for (let cIdx = this.nElite * this.nGenes; cIdx < pop.length; cIdx += this.nGenes) {

        const pMutate = this.pMutate === null ? (1 - ((cIdx / this.nGenes) / this.popSize)) * (rIdx / this.nRounds) : this.pMutate;

        if (Math.random() < pMutate) {

          // UNIQUE mutations (on different genes)
          const nMutations = this.minNGeneMut + Math.floor(Math.random() * (this.maxNGeneMut - this.minNGeneMut));

          this.emit('mutate', nMutations, pMutate);

          // make sure that you don't mutate the same gene twice
          const mutated = new Set();

          for (let i = 0; i < nMutations; i++) {
            let geneIdx;
            do { geneIdx = Math.floor(Math.random() * this.nGenes); } while (mutated.has(geneIdx));
            mutated.add(geneIdx);
            pop[cIdx + geneIdx] = this.minRandVal + Math.floor(Math.random() * (this.maxRandVal - this.minRandVal));
          }
        } else {
          this.emit('crossover', 1 - pMutate);
          let pIdx1;
          let pIdx2;
          // 1/10 of the time, choose elites, this way, you can maintain a small population of elites
          // and still make rapid progress
          if (this.nElite > 5 && Math.random() < 0.1) {
            do { pIdx1 = Math.floor(Math.random() * this.nElite); } while (pIdx1 === cIdx);
            do { pIdx2 = Math.floor(Math.random() * this.nElite); } while (pIdx2 === cIdx || pIdx2 === pIdx1);
          } else {
            const maxIdx = cIdx / this.nGenes;
            do { pIdx1 = Math.floor(Math.random() * maxIdx); } while (pIdx1 === cIdx);
            do { pIdx2 = Math.floor(Math.random() * maxIdx); } while (pIdx2 === cIdx || pIdx2 === pIdx1);
          }
          const coPoint = Math.floor(Math.random() * (this.nGenes + 1));
          pop.set(pop.subarray(pIdx1 * this.nGenes, pIdx1 * this.nGenes + coPoint), cIdx);
          pop.set(pop.subarray(pIdx2 * this.nGenes + coPoint, (pIdx2 + 1) * this.nGenes), cIdx + coPoint);
        }
      }
    }

    this.emit('end', rIdx, new Date(), Date.now() - startTm);

    for (let cIdx = 0; cIdx < this.popSize * this.nGenes; cIdx += this.nGenes) {
      yield pop.subarray(cIdx, cIdx + this.nGenes);
    }
  }
}

module.exports = GeneticAlgorithm;
// vim:hlsearch:sw=2:ts=4:expandtab:
