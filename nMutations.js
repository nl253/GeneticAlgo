/**
 * Compute the number of unique mutations (on different genes).
 *
 * @param {!EnvLoop} env
 */
function nMutations({ minNMutations, maxNMutations, timeTakenMS, timeOutMS }) {
  // at first, carry out more mutations (more exploration)
  // later, exploit more and alter only 1 dimension 
  // so that you don't stray too far off the fitness peak
  return minNMutations + Math.floor(Math.random() * (maxNMutations - minNMutations) * (1 - (timeTakenMS / timeOutMS)));
}

module.exports = nMutations;
