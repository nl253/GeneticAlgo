#!/usr/bin/node

/**
 * Sets the meta-parameters of the Genetic Algorithm by running sub-genetic algorithms with different settings.
 *
 * This is a search over the search-space of all parameter configurations for nElite, maxNGeneMut, popSize and pMutate.
 */

const GA = require('..');

const SEC = 1000;
const opts = { popSize: 20, timeOutMS: 300 * SEC };
const nGenes = 4;

/**
 * @param {Uint32Array|Uint16Array|Uint8Array|Float64Array|Float32Array|Int32Array|Int8Array|Int16Array} cand
 * @returns {{popSize: !Number, timeOutMS: !Number, pMutate: !Number, maxNGeneMut: !Number}} opts
 */
function decodeCand(cand) {
  return {
    maxNGeneMut: 2 + (cand[0] % nGenes),
    nElite: cand[1] / 2 ** 8,
    pMutate: cand[2] / 2 ** 8,
    popSize: 80 + (Math.floor(cand[3]) % 500),
    timeOutMS: 12 * SEC,
  };
}

/**
 * @param {Uint32Array|Uint16Array|Uint8Array} cand
 * @returns {!Number} fitness score
 */
function fitness(cand) {
  const f = c => c.reduce((g1, g2) => g1 + g2, 0);
  const maximizer = new GA(f, 100, 'i32', decodeCand(cand));
  maximizer.on('start', (time, me) => console.log('sub-algorithm started', me));
  maximizer.on('stuck', () => console.log('sub-algorithm [STUCK]'));
  maximizer.on('timeout', () => console.log('sub-algorithm [TIMEOUT]'));
  maximizer.on('rounds', () => console.log('sub-algorithm [ROUNDS]'));
  maximizer.on('end', (nr, d, ms) => console.log(`sub-algorithm [DONE] after round #${nr} (took ${ms / SEC}sec)`));
  const bestCand = maximizer.search().next().value;
  return f(bestCand);
}

const metaParamSetter = new GA(fitness, nGenes, 'u8', opts);

// use the EventEmitter API for getting profiling
metaParamSetter.on('start', time => console.log(`started at ${new Date(time).toTimeString()}`));
metaParamSetter.on('best', (_, score) => console.log(score));
metaParamSetter.on('stuck', () => console.log('[STUCK]'));
metaParamSetter.on('timeout', () => console.log('[TIMEOUT]'));
metaParamSetter.on('rounds', () => console.log('[ROUNDS]'));
metaParamSetter.on('end', (nr, d, ms) => console.log(`[DONE] after round #${nr} (took ${ms / SEC}sec)`));

const bestConfigs = metaParamSetter.search();

for (const bestCfg of bestConfigs) {
  console.log(decodeCand(bestCfg));
}
