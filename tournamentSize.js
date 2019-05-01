/**
 * Compute tournament size.
 *
 * @param {!EnvLoop} env
 * @returns {!Number} tournament size
 */
function tournamentSize({ timeOutMS, timeTakenMS, minTournamentSize, maxTournamentSize }) {
  return minTournamentSize + (timeTakenMS / timeOutMS) * (maxTournamentSize - minTournamentSize);
}

module.exports = tournamentSize;
