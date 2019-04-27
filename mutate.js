/**
 * Default mutate function.
 *
 * @param {!Env} env
 */
function mutate({ ptr, offset, pop, nGenes, minNGeneMut, maxNGeneMut, maxRandVal, minRandVal }) {
  // UNIQUE mutations (on different genes)
  const nMutations = minNGeneMut + Math.floor(Math.random() * (maxNGeneMut - minNGeneMut));

  // make sure that you don't mutate the same gene twice
  const mutated = new Set();

  const randValUpper = maxRandVal - minRandVal;

  for (let i = 0; i < nMutations; i++) {
    let geneIdx;
    // choose unique
    do { geneIdx = Math.floor(Math.random() * nGenes); } while (mutated.has(geneIdx));
    mutated.add(geneIdx);
    pop[offset + geneIdx] = minRandVal + Math.floor(Math.random() * randValUpper);
  }
}

module.exports = mutate;
