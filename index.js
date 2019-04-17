/**
 * Implements:
 *
 * - elitism
 * - local-minimum detection
 * - rank-based selection
 * - timeout finish
 * - nRound finish
 * - adaptive probability (increases and accelerates as time increases)
 */
const { EventEmitter } = require('events');

const SEC = 1000;
const bitRegex = /8|16|32|64/;
const DTYPES = new Set(['f64', 'f32', 'i32', 'i16', 'i8', 'u32', 'u16', 'u8']);
const MIN_POPSIZE = 5;
const DEFAULTS = {
  minImprove: 1E-4,
  minNGeneMut: 1,
  nElite: 0.1,
  nRounds: 1e6,
  nTrack: 50,
  signals: ['start', 'end', 'timeout', 'stuck'],
  pMutate: 0.01,
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
   * @param {{maxRandVal: !Number, minRandVal: !Number, acc: ?Number, nGenes: !Number, nElite: !Number, minImprove: !Number, maxNGeneMut: !Number, minNGeneMut: !Number, nRounds: !Number, pMutate: !Number, popSize: !Number, timeOutMS: !Number, nTrack: !Number, signals: !Array<('best'|'score'|'mutate'|'crossover'|'start'|'end'|'adapt'|'timeout'|'rounds'|'round'|'generate'|'randomize')>}} [opts]
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
    if (opts.acc !== undefined && opts.acc > 1) {
      throw new Error('`acc` must be a tiny value BETWEEN 0 AND 1');
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
    
    this.signals = new Set(this.signals);

    if (this.acc === undefined) {
      this.acc = 1 / (this.nRounds * 1000) || 1E-5;
    }

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

    if (this.signals.has('generate')) {
      this.emit('generate');
    }
    let pop = makePop();
    if (this.signals.has('randomize')) {
      this.emit('randomize');
    }

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

    if (this.acc !== null && this.signals.has('round') && this.signals.has('adapt')) {
      this.on('round', (rIdx) => {
        /*
         * adaptive p(mutation)
         * make it a function of time (#round)
         */
        this.emit('adapt', this.pMutate = this.pMutate + this.acc * rIdx);
      });
    }

    const startTm = Date.now();
    if (this.signals.has('start')) {
      this.emit('start', startTm, {
        acc: this.acc,
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
    }

    let rIdx = 0;
    while (true) {
      if (rIdx >= this.nRounds) {
        if (this.signals.has('rounds')) {
          this.emit('rounds');
        }
        break;
      } else if ((Date.now() - startTm) >= this.timeOutMS) {
        if (this.signals.has('timeout')) {
          this.emit('timeout');
        }
        break;
      } else if (maxScores !== null && rIdx > maxScores.length && maxScores.subarray(1)
        .map((f, idx) => f - maxScores[idx])
        .reduce((diff1, diff2) => diff1 + diff2) < this.minImprove) {
        if (this.signals.has('stuck')) {
          this.emit('stuck');
        }
        break;
      } else {
        if (this.signals.has('round')) {
          this.emit('round', rIdx);
        }
        rIdx++;
      }

      if (this.signals.has('score')) {
        this.emit('score');
      }

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

      if (this.signals.has('best')) {
        this.emit('best', pop.subarray(candIdxs[0] * this.nGenes, (candIdxs[0] + 1) * this.nGenes), bestF, improve);
      }

      for (let ptr = 0; ptr < this.popSize; ptr++) {
        const cIdx = candIdxs[ptr];
        newPop.set(pop.subarray(cIdx * this.nGenes, (cIdx + 1) * this.nGenes), ptr * this.nGenes);
      }

      pop = newPop;

      // go over non-elite units and use elite units for operators
      for (let cIdx = this.nElite * this.nGenes; cIdx < pop.length; cIdx += this.nGenes) {
        if (Math.random() < this.pMutate) {
          if (this.signals.has('mutate')) {
            this.emit('mutate');
          }
          let pIdx;
          do {
            pIdx = Math.floor(Math.random() * this.popSize);
          } while (pIdx === cIdx);
          pop.set(pop.subarray(pIdx * this.nGenes, (pIdx + 1) * this.nGenes), cIdx);
          for (let i = 0; i < this.minNGeneMut + Math.floor(Math.random() * this.maxNGeneMut); i++) {
            pop[cIdx + Math.floor(Math.random() * this.nGenes)] = this.minRandVal + Math.floor(Math.random() * (this.maxRandVal - this.minRandVal));
          }
        } else {
          if (this.signals.has('crossover')) {
            this.emit('crossover');
          }
          const maxIdx = cIdx / this.nGenes;
          let pIdx1;
          let
            pIdx2;
          do {
            pIdx1 = Math.floor(Math.random() * maxIdx);
          } while (pIdx1 === cIdx);
          do {
            pIdx2 = Math.floor(Math.random() * maxIdx);
          } while (pIdx2 === cIdx || pIdx2 === pIdx1);
          const coPoint = Math.floor(Math.random() * (this.nGenes + 1));
          pop.set(pop.subarray(pIdx1 * this.nGenes, pIdx1 * this.nGenes + coPoint), cIdx);
          pop.set(pop.subarray(pIdx2 * this.nGenes + coPoint, (pIdx2 + 1) * this.nGenes),
            cIdx + coPoint);
        }
      }
    }

    if (this.signals.has('end')) {
      this.emit('end', rIdx, new Date(), Date.now() - startTm);
    }
    for (let cIdx = 0; cIdx < this.popSize * this.nGenes; cIdx += this.nGenes) {
      yield pop.subarray(cIdx, cIdx + this.nGenes);
    }
  }
}

module.exports = GeneticAlgorithm;
// vim:hlsearch:sw=2:ts=4:expandtab:
