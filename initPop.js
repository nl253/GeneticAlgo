/**
 * Initialise pop to rand values.
 *
 * @param {{pop: !TypedArray, popSize: !Number, nGenes: !Number, maxRandVal: !Number, minRandVal: !Number}} env
 */
function initPop({ pop, dtype, popSize, nGenes, maxRandVal, minRandVal }) {
  for (let cIdx = 0; cIdx < popSize; cIdx++) {
    const offset = cIdx * nGenes;
    for (let gIdx = 0; gIdx < nGenes; gIdx++) {
      // special treatment for unsigned (minRandVal is 0) to prevent too many zeroes
      if (dtype.startsWith('u')) {
        pop[offset + gIdx] = Math.floor(Math.random() * maxRandVal);
      } else {
        pop[offset + gIdx] = Math.floor(Math.random() * (Math.random() < 0.5 ? maxRandVal : minRandVal));
      }
    }
  }
}

module.exports = initPop;
