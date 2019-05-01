/**
 * Tournament selection (selection pressure depends on tournamentSize).
 *
 * @param {!EnvLoop} env
 * @returns {!Number} index of selected candidate
 */
function tournament({ tournamentSize, pElite, candIdxs, scores, popSize, nElite }) {
  const idxs = new Uint32Array(new ArrayBuffer(4 * tournamentSize));
  if (Math.random() < pElite) {
    for (let i = 0; i < tournamentSize; i++) {
      idxs[i] = candIdxs[Math.floor(Math.random() * nElite)];
    }
  } else {
    for (let i = 0; i < tournamentSize; i++) {
      idxs[i] = candIdxs[nElite + Math.floor(Math.random() * (popSize - nElite))];
    }
  }
  let bestIdx = idxs[0];
  let bestScore = scores[bestIdx];
  for (let i = 1; i < tournamentSize; i++) {
    const idx = idxs[i];
    if (scores[idx] > bestScore) {
      bestIdx = idx;
      bestScore = scores[idx];
    }
  }
  return bestIdx;
}

module.exports = tournament;
