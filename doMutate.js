/**
 * You want to apply mutation to the fittest BUT crossover to the least fit.
 * To do that, make the probability a function of the position in the array.
 *
 * You also want to increase the p of mutation as you approach the end of running the algorithm
 * meaning as timeTakenMS approaches timeOutMS, pMutate approaches 1.0.
 *
 * @param {!Env} env
 */
function doMutate({ nElite, popSize, ptr, timeTakenMS, timeOutMS }) {
  return Math.random() < (1 - ((ptr - nElite) / (popSize - nElite))) * (timeTakenMS / timeOutMS);
}

module.exports = doMutate;
