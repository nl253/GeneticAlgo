/**
 * Compute probability of choosing elites for selection size.
 *
 * @param {!EnvLoop} env
 * @returns {!Number} tournament size
 */
function pElite({ timeOutMS, timeTakenMS, minPElite, maxPElite }) {
  return minPElite + (timeTakenMS / timeOutMS) * (maxPElite - minPElite);
}

module.exports = pElite;
