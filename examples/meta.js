#!/usr/bin/node

/**
 * Sets the meta-parameters of the Genetic Algorithm by running sub-genetic algorithms with different settings.
 *
 * This is a search over the search-space of all parameter configurations for nElite, acc, maxNGeneMut, minNGeneMut, popSize and pMutate.
 */

const GA = require('..');

const SEC = 1000;

const opts = {
  popSize: 10,
  signals: [
    'start',
    'best',
    'stuck',
    'timeout',
    'end',
    'rounds',
  ],
  timeOutMS: 300 * SEC,
};

const nGenes = 8;

/**
 * @param {Uint32Array|Uint16Array|Uint8Array|Float64Array|Float32Array|Int32Array|Int8Array|Int16Array} cand
 * @returns {!Object} opts
 */
function decodeCand(cand) {
  return {
    acc: cand[4] / ((2 ** nGenes) * 10),
    maxNGeneMut: Math.min(nGenes, cand[5]),
    minNGeneMut: Math.min(1, cand[2]),
    nElite: cand[0] / 2 ** nGenes,
    pMutate: cand[3] / 2 ** nGenes,
    popSize: Math.max(10, cand[1]),
    timeOutMS: 12 * SEC,
  };
}

/**
 * @param {Uint32Array|Uint16Array|Uint8Array} cand
 * @returns {!number} fitness score
 */
function fitness(cand) {
  const f = c => c.reduce((g1, g2) => g1 + g2, 0);
  const maximizer = new GA(f, 12, 'f32', decodeCand(cand));
  maximizer.on('start', (time, me) => console.log('sub-algorithm started', me));
  maximizer.on('stuck', () => console.log(`sub-algorithm [STUCK]`));
  maximizer.on('timeout', () => console.log(`sub-algorithm [TIMEOUT]`));
  maximizer.on('rounds', () => console.log(`sub-algorithm [ROUNDS]`));
  maximizer.on('end', (nr, d, ms) => console.log(`sub-algorithm [DONE] after round #${nr} (took ${ms / SEC}sec)`));
  const bestCand = maximizer.search().next().value;
  return f(bestCand);
}

const metaParamSetter = new GA(fitness, nGenes, 'u8', opts);

// use the EventEmitter API for getting profiling
metaParamSetter.on('start', time => console.log(`started at ${new Date(time).toTimeString()}`));
metaParamSetter.on('best', (_, score) => console.log(parseFloat(score.toFixed(4))));
metaParamSetter.on('stuck', () => console.log(`[STUCK]`));
metaParamSetter.on('timeout', () => console.log(`[TIMEOUT]`));
metaParamSetter.on('rounds', () => console.log(`[ROUNDS]`));
metaParamSetter.on('end', (nr, d, ms) => console.log(`[DONE] after round #${nr} (took ${ms / SEC}sec)`));

const bestConfigs = metaParamSetter.search();

for (const bestCfg of bestConfigs) {
  console.log(decodeCand(bestCfg));
}
