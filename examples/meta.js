#!/usr/bin/node

/**
 * Sets the meta-parameters of the Genetic Algorithm by running sub-genetic algorithms with different settings.
 *
 * This is a search over the search-space of all parameter configurations for nElite, acc, maxNGeneMut, minNGeneMut, popSize and pMutate.
 */

const GA = require('..');
const SEC = 1000;

const opts = {
  dtype: 'u8',
  nGenes: 8,
  timeOutMS: 300 * SEC,
  popSize: 10,
};

/**
 * @param {Uint32Array|Uint16Array|Uint8Array} cand
 * @return {{pMutate: number, acc: number, nElite: number, popSize: *, minNGeneMut: number, timeOutMS: number, maxNGeneMut: number, nGenes: number}} opts
 */
function decodeCand(cand) {
  const nGenes = 1000;
  return {
    nGenes,
    timeOutMS: 12 * SEC,
    nElite: cand[0] / 2 ** opts.nGenes,
    popSize: Math.max(10, cand[1]),
    minNGeneMut: Math.min(10, cand[2]),
    pMutate: cand[3] / 2 ** opts.nGenes,
    acc: cand[4] / ((2 ** opts.nGenes) * 10),
    maxNGeneMut: Math.min(nGenes, cand[5]),
  };
}

/**
 * @param {Uint32Array|Uint16Array|Uint8Array} cand
 * @return {!Number} fitness score
 */
function fitness(cand) {
  const cfg = decodeCand(cand);
  const f = c => c.reduce((g1, g2) => g1 + g2, 0);
  const maximizer = new GA(f, cfg);
  maximizer.on('start', (time, me) => console.log('sub-algorithm started',  me));
  maximizer.on('stuck', () => console.log(`sub-algorithm [STUCK]`));
  maximizer.on('timeout', () => console.log(`sub-algorithm [TIMEOUT]`));
  maximizer.on('rounds', () => console.log(`sub-algorithm [ROUNDS]`));
  maximizer.on('end', (nr, d, ms) => console.log(`sub-algorithm [DONE] after round #${nr} (took ${ms / SEC}sec)`));
  const bestCand = maximizer.search().next().value;
  return f(bestCand);
}

const metaParamSetter = new GA(fitness, opts);

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
