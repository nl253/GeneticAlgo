/**
 * @param {!Env} env
 */
function scoreChecked({ pop, scores, popSize, f, nGenes }) {
  // unfortunately, for the purpose of evaluating
  // fitness each candidate must be extracted from pop into a subarray
  //
  // reuse fitness scores for elites from prev round
  // protect against fitness function returning NaN or Infinity
  for (let cIdx = 0; cIdx < popSize; cIdx++) {
    scores[cIdx] = f(pop.subarray(cIdx * nGenes, cIdx * nGenes + nGenes));
    if (Object.is(NaN, scores[cIdx])) {
      console.warn('[WARN] fitness function returned NaN');
      scores[cIdx] = -Infinity;
    } else {
      scores[cIdx] = Math.min(Number.MAX_VALUE, Math.max(-Number.MAX_VALUE, scores[cIdx]));
    }
  }
}

/**
 * @param {!Env} env
 */
function score({ pop, scores, popSize, f, nGenes }) {
  for (let cIdx = 0; cIdx < popSize; cIdx++) {
    scores[cIdx] = f(pop.subarray(cIdx * nGenes, cIdx * nGenes + nGenes));
  }
}

/**
 * @param {!Boolean} doCheck
 * @return {!Function}
 */
function wrapper(doCheck) {
  if (doCheck) {
    return scoreChecked;
  } else {
    return score;
  }
}

module.exports = wrapper;
