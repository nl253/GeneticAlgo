// const distances = f64(this.popSize);

// this will slow it down quite a bit but it may give some more diversity to solutions
/**
 * @param {!Env} env
 */
function mulitmodal({ scores, candIdxs, popSize, nElite, nGenes, pop, nBits }) {
  let maxDist = -Infinity;
  let minDist = Infinity;
  // for each candidate, measure *cumulative* distance from *all* elites for *all* genes
  for (let cIdx = 0; cIdx < popSize; cIdx++) {
    const offsetCand = cIdx * nGenes;
    let d = 0;
    for (let eIdx = 0; eIdx < nElite; eIdx++) {
      // when cIdx == eIdx, distance == 0 (see compensation step below)
      const offsetElite = candIdxs[eIdx] * nGenes;
      // manhattan distance because it's quickest
      for (let gIdx = 0; gIdx < nGenes; gIdx++) {
        d += Math.abs(pop[offsetCand + gIdx] - pop[offsetElite + gIdx]);
      }
    }
    if (d > maxDist) {
      maxDist = d;
    } else if (d < minDist) {
      minDist = d;
    }
    // division by 2**nBits necassary otherwise float64 overflows
    distances[cIdx] = d / 2 ** nBits;
  }
  minDist /= 2 ** nBits;
  maxDist /= 2 ** nBits;
  // elites are at a loss because their distance to itself is 0.
  // you still wanna keep them because they are good solutions.
  // to do that, artificially add distance to them and make them seem diverse.
  // distance of 0 is replaced with maxDist.
  for (let cIdx = 0; cIdx < nElite; cIdx++) {
    distances[candIdxs[cIdx]] += maxDist / nElite;
  }
  // normalize using min-max rule
  // the further away you are from the fittest, the better
  for (let cIdx = 0; cIdx < popSize; cIdx++) {
    const old = scores[cIdx];
    const factor = (distances[cIdx] - minDist) / (maxDist - minDist);
    scores[cIdx] *= factor;
  }
  // re-sort after changing fitness
  candIdxs.sort((cIdx1, cIdx2) => (scores[cIdx1] > scores[cIdx2] ? -1 : 1));
}

module.exports = mulitmodal;
