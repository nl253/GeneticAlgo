/**
 * Default mutate function.
 *
 * @param {!EnvLoop} env
 */
function mutate({ nMutations, offset, pop, nGenes, minRandVal, maxRandVal }) {
  const randValUpper = maxRandVal - minRandVal;
  for (let i = 0; i < nMutations; i++) {
    pop[offset + Math.floor(Math.random() * nGenes)] = minRandVal + Math.floor(Math.random() * randValUpper);
  }
}

module.exports = mutate;
