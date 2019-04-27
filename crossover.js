/**
 * Default crossover function.
 *
 * @param {!Env} env
 */
function crossover({ emit, candIdxs, ptr, offset, cIdx, pop, nGenes, nElite, popSize, pElite }) {
  let pIdx1; // parent 1
  let pIdx2; // parent 2

  // choose from elite (this way, you can maintain a small population of elites and still make rapid progress.)
  if (Math.random() < pElite) {
    do { pIdx1 = candIdxs[Math.floor(Math.random() * nElite)]; } while (pIdx1 === cIdx);
    do { pIdx2 = candIdxs[Math.floor(Math.random() * nElite)]; } while (pIdx2 === cIdx || pIdx2 === pIdx1);
    // emit('crossover', undefined, pIdx1, pIdx2, true);
    // choose from normal
  } else {
    do { pIdx1 = candIdxs[nElite + Math.floor(Math.random() * (popSize - nElite))]; } while (pIdx1 === cIdx);
    do { pIdx2 = candIdxs[nElite + Math.floor(Math.random() * (popSize - nElite))]; } while (pIdx2 === cIdx || pIdx2 === pIdx1);
    // emit('crossover', undefined, pIdx1, pIdx2, false);
  }

  // avoid positional bias
  // don't use cross-over point, otherwise genes CLOSE to each other will be more likely to be inherited
  const offset1 = pIdx1 * nGenes;
  const offset2 = pIdx2 * nGenes;
  for (let gIdx = 0; gIdx < nGenes; gIdx++) {
    pop[offset + gIdx] = pop[(Math.random() < 0.5 ? offset1 : offset2) + gIdx];
  }
}

module.exports = crossover;
