/**
 * @typedef {function(any)} Listener
 * @typedef {{on: function(!String, Listener)}} Emitter
 */

/**
 * @param {!Emitter} emitter
 * @private
 */
function loud(emitter) {
  emitter.on('op', env => console.log(env.op.padStart('crossover'.length), `(p = ${(env.op === 'crossover' ? (1 - env.pMutate) : env.pMutate).toFixed(2)})`, env.op === 'crossover' ? `on ${`#${env.pIdx1}`.padStart(4)} & ${`#${env.pIdx2}`.padStart(4)}` : `on ${`#${env.ptr}`.padStart(4)} ${' '.repeat(7)}(${env.nMutations} mutations)`));
}

/**
 * @param {!Emitter} emitter
 * @private
 */
function normal(emitter) {
  emitter.on('score', env => console.log(`[round ${`#${env.rIdx}`.padStart(6)}] best cand = ${`#${env.bestIdx}`.padStart(4)}, best score = ${env.bestScore.toString().padStart(15)}, improvement = ${env.improvement.toString().padStart(12)}`));
}

/**
 * @param {!Emitter} emitter
 * @private
 */
function quiet(emitter) {
  emitter.on('start', env => console.log('started genetic algorithm at', new Date(), 'with opts', env));
  emitter.on('end', env => console.log('finished running genetic algorithm at', new Date(), `took ${env.timeTakenMS / 1000}sec, did ${env.rIdx} rounds`));
  for (const reason of ['stuck', 'rounds', 'timeout']) {
    emitter.on(reason, () => console.log(`[${reason}]`));
  }
}

/**
 * @param {!Number} verbosity
 * @param {!Emitter} emitter
 */
function init(verbosity = 1, emitter) {
  if (verbosity > 0) {
    quiet(emitter);
  }
  if (verbosity > 1) {
    normal(emitter);
  }
  if (verbosity > 2) {
    loud(emitter);
  }
}

export default init;
