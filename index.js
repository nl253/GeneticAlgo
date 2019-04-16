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

class GeneticAlgorithm extends EventEmitter {
  /**
   * @param {!Function(Uint8Array|Uint16Array|Uint32Array): !Number} f
   * @param {{maxRandVal: !Number, acc: !Number, nGenes: !Number, nElite: !Number, minImprove: !Number, nBits: !Number, maxNGeneMut: !Number, minNGeneMut: !Number, nRounds: !Number, pMutate: !Number, popSize: !Number, timeOutMS: !Number, nTrack: !Number}} [opts]
   */
  constructor(f, opts = {}) {
    super();
    Object.assign(this, Object.assign({
      f,
      minImprove: 1E-4,
      minNGeneMut: 1,
      nBits: 8,
      nElite: 10,
      nGenes: 10,
      nRounds: 1e6,
      nTrack: 50,
      pMutate: 0.01,
      popSize: 100,
      timeOutMS: 30 * 1000,
    }, opts));
    this.acc = this.acc || 1 / (this.nRounds * 1E3) || 1E-5;
    this.maxNGeneMut = this.maxNGeneMut || Math.floor(Math.log2(this.nGenes));
    this.nElite = this.nElite < 1 ? Math.floor(this.nElite * this.popSize) : this.nElite;
    this.maxRandVal = this.maxRandVal || 2**this.nBits - 1;
  }

  * search() {
    const bufSize = this.popSize * this.nGenes * (this.nBits / 8);
    const makePop = () => eval(`new Uint${this.nBits}Array(new ArrayBuffer(${bufSize}))`);

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

    this.on('round', rIdx => {
      // adaptive p(mutation)
      // make it a function of time (#round)
      this.emit('adapt', this.pMutate = this.pMutate + this.acc * rIdx);
    });

    const startTm = Date.now();
    this.emit('start', startTm);

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
        this.emit('round', rIdx);
        rIdx++;
      }

      this.emit('score');
      for (let cIdx = 0; cIdx < this.popSize; cIdx++) {
        scores[cIdx] = this.f(pop.subarray(cIdx * this.nGenes, (cIdx + 1) * this.nGenes));
      }

      const newPop = makePop();

      let improve, bestF;

      if (this.minImprove !== null) {
        // shift left
        maxScores.set(maxScores.subarray(1));
        bestF = scores.filter(s => !Object.is(NaN, s) && !Object.is(Infinity, s)).reduce((s1, s2) => Math.max(s1, s2), 0);
        maxScores[maxScores.length - 1] = bestF;
        improve = bestF - maxScores[maxScores.length - 2];
      }

      candIdxs = candIdxs.sort((idx1, idx2) => scores[idx1] > scores[idx2] ? -1 : 1);

      this.emit('best', pop.subarray(candIdxs[0] * this.nGenes, (candIdxs[0] + 1) * this.nGenes), bestF, improve);

      for (let ptr = 0; ptr < this.popSize; ptr++) {
        const cIdx = candIdxs[ptr];
        newPop.set(pop.subarray(cIdx * this.nGenes, (cIdx + 1) * this.nGenes), ptr * this.nGenes);
      }

      pop = newPop;

      // go over non-elite units and use elite units for operators
      for (let cIdx = this.nElite * this.nGenes; cIdx < pop.length; cIdx += this.nGenes) {
        if (Math.random() < this.pMutate) {
          this.emit('mutate');
          let pIdx;
          do { pIdx = Math.floor(Math.random() * this.popSize); } while (pIdx === cIdx);
          pop.set(pop.subarray(pIdx * this.nGenes, (pIdx + 1) * this.nGenes), cIdx);
          for (let i = 0; i < this.minNGeneMut + Math.floor(Math.random() * this.maxNGeneMut); i++) {
            pop[cIdx + Math.floor(Math.random() * this.nGenes)] = Math.floor(Math.random() * this.maxRandVal);
          }
        } else {
          this.emit('crossover');
          const maxIdx = cIdx / this.nGenes;
          let pIdx1, pIdx2;
          do { pIdx1 = Math.floor(Math.random() * maxIdx); } while (pIdx1 === cIdx);
          do { pIdx2 = Math.floor(Math.random() * maxIdx); } while (pIdx2 === cIdx || pIdx2 === pIdx1);
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
