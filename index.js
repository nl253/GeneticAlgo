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

/**
 * @param {!String} dtype
 * @return {Float32ArrayConstructor|Float64ArrayConstructor|Int8ArrayConstructor|Int16ArrayConstructor|Int32ArrayConstructor|Uint8ArrayConstructor|Uint16ArrayConstructor|Uint32ArrayConstructor|never} constructor
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
   * @param {!function((Uint8Array|Uint16Array|Uint32Array)): !Number} f
   * @param {{maxRandVal: !Number, minRandVal: !Number, acc: !Number, nGenes: !Number, nElite: !Number, minImprove: !Number, dtype: !String, maxNGeneMut: !Number, minNGeneMut: !Number, nRounds: !Number, pMutate: !Number, popSize: !Number, timeOutMS: !Number, nTrack: !Number}} [opts]
   */
  constructor(f, opts = {}) {
    super();
    Object.assign(this, Object.assign({
      f,
      minImprove: 1E-4,
      minNGeneMut: 1,
      nElite: 10,
      nGenes: 10,
      nRounds: 1e6,
      nTrack: 50,
      signals: ['start', 'end', 'timeout', 'stuck'],
      pMutate: 0.01,
      dtype: 'u8',
      popSize: 100,
      timeOutMS: 30 * SEC,
    }, opts));
    this.nBits = parseInt(bitRegex.exec(this.dtype)[0]);
    this.signals = new Set(this.signals);
    this.acc = this.acc || 1 / (this.nRounds * 1000) || 1E-5;
    if (this.maxNGeneMut === undefined) {
      this.maxNGeneMut = Math.floor(Math.log2(this.nGenes));
    }
    if (this.nElite < 1) {
      this.nElite = Math.floor(this.nElite * this.popSize);
    } 
    if (this.maxRandVal === undefined) {
      if (this.dtype.startsWith('f')) {
        if (this.nBits === 32) {
          this.maxRandVal = (3.4 * (10 ** 38) - 1) / 1E4;
        } else if (this.nBits === 64) {
          this.maxRandVal = (1.8 * (10 ** 308)) / 1E4;
        }
      } else if (this.dtype.startsWith('i')) {
        this.maxRandVal = 2 ** (this.nBits - 1) - 1;
      } else if (this.dtype.startsWith('u')) {
        this.maxRandVal = 2 ** this.nBits - 1;
      }
    }
    if (this.minRandVal === undefined) {
      if (this.dtype.startsWith('f')) {
        if (this.nBits === 32) {
          this.minRandVal = (1.2 * (10 ** -38)) / 1E4;
        } else if (this.nBits === 64) {
          this.minRandVal = (5 * (10 ** -324)) / 1E4;
        }
      } else if (this.dtype.startsWith('i')) {
        this.minRandVal = -(2 ** (this.nBits - 1)) + 1;
      } else if (this.dtype.startsWith('u')) {
        this.minRandVal = 0;
      }
    }
    // validation
    if (this.popSize < 10) {
      throw new Error('pop size too small, min 10');
    }
    if (this.nBits !== 8 && this.nBits !== 16 && this.nBits !== 32 && this.nBits !== 64) {
      throw new Error('nBits must be EITHER 8 OR 16 OR 32');
    }
    if (this.nElite > this.popSize) {
      throw new Error('nElite CANNOT be greater than popSize');
    }
    if (this.minNGeneMut > this.nGenes) {
      throw new Error('minNGeneMut CANNOT be greater than nGenes');
    }
    if (this.pMutate > 1) {
      throw new Error('pMutate is a probability so it must be between 0 and 1');
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

    if (this.signals.has('round') && this.signals.has('adapt')) {
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
