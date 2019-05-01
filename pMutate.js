/**
 * You want to apply mutation to the fittest BUT crossover to the least fit.
 * To do that, make the probability a function of the position in the array.
 *
 * You also want to increase the p of mutation as you approach the end of running the algorithm
 * meaning as timeTakenMS approaches timeOutMS, pMutate approaches 1.0.
 *
 * @param {!EnvLoop} env
 */
function pMutate({ nElite, popSize, ptr, timeTakenMS, timeOutMS }) {
  return 0.8 * (1 - ((ptr - nElite) / (popSize - nElite))) * (1 - (timeTakenMS / timeOutMS));
}

module.exports = pMutate;
