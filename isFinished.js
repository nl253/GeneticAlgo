/**
 * @param {!Env} env
 * @returns {!Boolean|'stuck'|'rounds'|'timeout'}
 */
function isFinished({ maxScoreIdx, rIdx, maxScores, timeTakenMS, timeOutMS, nTrack, minImprove, nRounds }) {
  let disDiff = 0;
  for (let i = 1; i < maxScoreIdx; i++) {
    disDiff += maxScores[i] - maxScores[i - 1];
  }
  for (let i = maxScoreIdx + 2; i < nTrack; i++) {
    disDiff += maxScores[i] - maxScores[i - 1];
  }
  // diff between lst and fst
  disDiff += maxScores[nTrack - 1] - maxScores[0];

  if (disDiff < minImprove) {
    return 'stuck';
  } else if (rIdx >= nRounds) {
    return 'rounds';
  } else if (timeTakenMS >= timeOutMS) {
    return 'timeout';
  } else {
    return false;
  }
}

module.exports = isFinished;
