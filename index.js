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
  constructor(f, nBits = 8, popSize = 100, candSize = 10, pMutate = 0.1, timeOut = 30, nRounds = 100, growth = 2) {
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
    const producer = eval(`Uint${nBits}Array`);
    this.pop = new producer(new ArrayBuffer(popSize * candSize * nBytes * growth));
    this.emit('generated');
    for (let candIdx = 0; candIdx < this.popSize * this.candSize; candIdx += this.candSize) {
      for (let geneIdx = 0; geneIdx < this.candSize; geneIdx++) {
        this.pop[candIdx + geneIdx] = this.randNum;
      }
    }
    this.emit('randomised');
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
    this.emit('start');
    const startTm = Date.now();
    for (let roundIdx = 0; roundIdx < this.nRounds; roundIdx++) {
      if (((Date.now() - startTm) / 1000) >= this.timeOut) {
        this.emit('timeout');
        break;
      }
      for (let candIdx = this.popSize * this.candSize; candIdx < this.pop.length; candIdx += this.candSize) {
        if (Math.random() < this.pMutate) {
          this.emit('mutation');
          this.pop.set(this.randParent, candIdx);
          const geneIdx = Math.floor(Math.random() * this.candSize);
          this.pop[candIdx + geneIdx] = this.randNum;
        } else {
          this.emit('crossover');
          const coPoint = Math.floor(Math.random() * this.candSize);
          const parent1 = this.randParent.subarray(0, coPoint);
          const parent2 = this.randParent.subarray(coPoint);
          this.pop.set(parent1, candIdx);
          this.pop.set(parent2, candIdx + parent1.length);
        }
      }

      this.emit('roundstart');
      let candidates = [];
      for (let candIdx = 0; candIdx < this.pop.length; candIdx += this.candSize) {
        candidates.push(this.pop.subarray(candIdx, candIdx + this.candSize));
      }
      this.emit('sorting');
      candidates = candidates
        .map(cand => ({cand, fitness: this.f(cand)}))
        .sort((c1, c2) => c1.fitness > c2.fitness ? -1 : 1)
        .map(({cand}) => cand);
      const newPop = eval(`new Uint${this.nBits}Array(new ArrayBuffer(${this.popSize * this.candSize * this.growth * this.nBytes}))`);
      debugger;
      for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
        newPop.set(candidates[cIdx], cIdx * this.candSize);
      }
      this.pop = newPop;
      this.emit('roundend');
    }
    this.emit('end');
    for (let cIdx = 0; cIdx < this.popSize * this.candSize; cIdx += this.candSize) {
      this.emit('yield');
      yield this.pop.subarray(cIdx, cIdx + this.candSize);
    }
  }
}

module.exports = GA;
