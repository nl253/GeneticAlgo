function scoreChecked() {
  // unfortunately, for the purpose of evaluating
  // fitness each candidate must be extracted from pop into a subarray
  //
  // reuse fitness scores for elites from prev round
  // protect against fitness function returning NaN or Infinity
  const { pop, scores, popSize, fitness, nGenes } = this;
  for (let fIdx = 0; fIdx < fitness.length; fIdx++) {
    for (let cIdx = 0; cIdx < popSize; cIdx++) {
      scores[fIdx][cIdx] = fitness[fIdx](pop.subarray(cIdx * nGenes, cIdx * nGenes + nGenes));
      if (Object.is(NaN, scores[cIdx])) {
        console.warn('[WARN] fitness function returned NaN');
        scores[fIdx][cIdx] = -Infinity;
      } else {
        scores[fIdx][cIdx] = Math.min(Number.MAX_VALUE, Math.max(-Number.MAX_VALUE, scores[cIdx]));
      }
    }
  }
}

function score() {
  const { pop, scores, popSize, fitness, nGenes } = this;
  for (let fIdx = 0; fIdx < fitness.length; fIdx++) {
    for (let cIdx = 0; cIdx < popSize; cIdx++) {
      scores[fIdx][cIdx] = fitness[fIdx](pop.subarray(cIdx * nGenes, cIdx * nGenes + nGenes));
    }
  }
}

/**
 * @param {!Boolean} doCheck
 * @returns {!Function}
 */
function wrapper(doCheck = false) {
  if (doCheck) {
    return scoreChecked;
  } else {
    return score;
  }
}

module.exports = wrapper;
