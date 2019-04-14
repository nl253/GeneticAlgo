// vim:hlsearch:sw=2:ts=4:expandtab:
const { EventEmitter } = require('events');

class GA extends EventEmitter {
  /**
   * @param {!Function(Uint8Array|Uint16Array|Uint32Array): !Number} f
   * @param {!Number} [nBits]
   * @param {!Number} [popSize]
   * @param {!Number} [candSize]
   * @param {!Number} [timeOut]
   * @param {!Number} [nRounds]
   * @param {!Number} [growth]
   */
  constructor(f, nBits = 8, popSize = 100, candSize = 10, pMutate = 0.1, timeOut = 30, nRounds = 100, growth = 2, track = 50, minImprove = 0.0001) {
    super();
    this.f = f;
    const nBytes = nBits / 8;
    this.nBits = nBits;
    this.timeOut = timeOut;
    this.pMutate = pMutate;
    this.nRounds = nRounds;
    this.candSize = candSize;
    this.popSize = popSize;
    this.growth = growth;
    this.nBytes = nBytes;
    this.minImprove = minImprove;
    const producer = eval(`Uint${nBits}Array`);
    this.pop = new producer(new ArrayBuffer(popSize * candSize * nBytes * growth));
    if (this.minImprove !== null && this.track !== null) {
      this.prevFitness = new Float64Array(new ArrayBuffer((64/8) * track));
    }
    this.emit('generated');
    for (let candIdx = 0; candIdx < this.popSize * this.candSize; candIdx += this.candSize) {
      for (let geneIdx = 0; geneIdx < this.candSize; geneIdx++) {
        this.pop[candIdx + geneIdx] = this.randNum;
      }
    }
    this.emit('randomized');
  }

  /**
  * @returns {Uint8Array|Uint16Array|Uint32Array} parent
   */
  get randParent() {
    const idxStart = Math.floor(Math.random() * this.popSize) * this.candSize;
    const idxEnd = idxStart + this.candSize;
    return this.pop.subarray(idxStart, idxEnd);
  }

  /**
   * @returns {!Number} rand num
   */
  get randNum() {
    const n = Math.floor(Math.random() * 2**this.nBits);
    return n < 0 ? 0 : n;
  }

  *search() {
    const startTm = Date.now();
    this.emit('start', startTm);
    let roundIdx = 0;
    while (true) {

      if (roundIdx >= this.nRounds) {
        this.emit('rounds', roundIdx);
        break;
      } else {
        roundIdx++;
      }

      if (((Date.now() - startTm) / 1000) >= this.timeOut) {
        this.emit('timeout', roundIdx);
        break;
      }

      if (roundIdx > this.prevFitness.length && this.minImprove !== null) {
        // 1st order discrete difference
        const diffFstOrd = this.prevFitness.subarray(1).map((f, idx) => f - this.prevFitness[idx]);
        const improvement = diffFstOrd.reduce((diff1, diff2) => diff1 + diff2);
        this.emit('imp', improvement);
        if (improvement < this.minImprove) {
          this.emit('stuck', improvement);
          break;
        }
      }

      for (let candIdx = this.popSize * this.candSize; candIdx < this.pop.length; candIdx += this.candSize) {
        if (Math.random() < this.pMutate) {
          const parent = this.randParent
          this.pop.set(parent, candIdx);
          const geneIdx = Math.floor(Math.random() * this.candSize);
          this.pop[candIdx + geneIdx] = this.randNum;
          this.emit('mutation', parent, geneIdx, this.pop.subarray(candIdx, candIdx + this.candSize));
        } else {
          const coPoint = Math.floor(Math.random() * this.candSize);
          const parent1_ = this.randParent;
          const parent2_ = this.randParent;
          const parent1 = parent1_.subarray(0, coPoint);
          const parent2 = parent2_.subarray(coPoint);
          this.pop.set(parent1, candIdx);
          this.pop.set(parent2, candIdx + parent1.length);
          this.emit('crossover', parent1_, parent2_, coPoint, this.pop.subarray(candIdx, candIdx + this.candSize));
        }
      }

      this.emit('round', roundIdx);
      let candidates = [];
      for (let candIdx = 0; candIdx < this.pop.length; candIdx += this.candSize) {
        candidates.push(this.pop.subarray(candIdx, candIdx + this.candSize));
      }

      this.emit('sorting');

      candidates = candidates.map(cand => ({ cand, fitness: this.f(cand) }));

      if (this.minImprove !== null) {

        // shift left
        this.prevFitness.set(this.prevFitness.slice(1));

        const totalF = candidates.slice(0, this.popSize).map(({ fitness }) => fitness).reduce((f1, f2) => f1 + f2, 0);

        // 'append'
        this.prevFitness[this.prevFitness.length - 1] = totalF; 

        this.emit('recording', totalF);
      }

      candidates = candidates
        .sort((c1, c2) => c1.fitness > c2.fitness ? -1 : 1)
        .map(({cand}) => cand);

      const newPop = eval(`new Uint${this.nBits}Array(new ArrayBuffer(${this.popSize * this.candSize * this.growth * this.nBytes}))`);
      
      for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
        newPop.set(candidates[cIdx], cIdx * this.candSize);
      }

      this.pop = newPop;
    }
    this.emit('end', roundIdx, Date.now() - startTm);
    for (let cIdx = 0; cIdx < this.popSize * this.candSize; cIdx += this.candSize) {
      this.emit('yield', cIdx);
      yield this.pop.subarray(cIdx, cIdx + this.candSize);
    }
  }
}

module.exports = GA;
