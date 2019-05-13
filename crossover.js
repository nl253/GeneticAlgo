/**
 * Default crossover function.
 *
 * @param {!EnvLoop} env
 */
function crossover({ pIdx1, pIdx2, offset, pop, nGenes }) {
  // avoid positional bias
  // don't use cross-over point, otherwise genes CLOSE to each other will be more likely to be inherited
  const offset1 = pIdx1 * nGenes;
  const offset2 = pIdx2 * nGenes;
  for (let gIdx = 0; gIdx < nGenes; gIdx++) {
    pop[offset + gIdx] = pop[(Math.random() < 0.5 ? offset1 : offset2) + gIdx];
  }
}

module.exports = crossover;
