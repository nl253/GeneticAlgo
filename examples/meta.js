#!/usr/bin/node
/**
 * Sets the meta-parameters of the Genetic Algorithm by running sub-genetic algorithms with different settings.
 */
const GA = require('..');

const SEC = 1000;
const MIN = 60 * SEC;
const opts = { nElite: 5, popSize: 20, timeOutMS: 30 * MIN };
const nGenes = 7;

function decodeCand(cand) {
  const minNGeneMut = 1 + cand[0];
  const maxNGeneMut = Math.min(300, minNGeneMut + cand[1]);
  const popSize = 80 + cand[2];
  return {
    maxNGeneMut,
    minNGeneMut,
    nElite: 2 + (cand[3] % popSize),
    nTrack: 10 + cand[6],
    pMutate: cand[4] / 2 ** 8,
    popSize,
    timeOutMS: 12 * SEC,
  };
}

function fitnessFunct(cand) {
  const f = c => c.reduce((g1, g2) => g1 + g2, 0);
  const maximizer = new GA(f, 300, 'i32', decodeCand(cand));
  // [optional] use the EventEmitter API for getting profiling
  maximizer.on('start', (time, me) => console.log('sub-algorithm [START]', me));
  maximizer.on('stuck', () => console.log('sub-algorithm [END] stuck'));
  maximizer.on('timeout', () => console.log('sub-algorithm [END] timeout'));
  maximizer.on('end', (rIdx, _date, ms) => console.log(`sub-algorithm [END] after round #${rIdx} (took ${ms / SEC}sec)`));
  const bestCand = maximizer.search().next().value;
  return f(bestCand);
}

const metaParamSetter = new GA(fitnessFunct, nGenes, 'u8', opts);

// [optional] use the EventEmitter API for getting profiling
metaParamSetter.on('start', time => console.log(`[START] at ${new Date(time).toTimeString()}`));
metaParamSetter.on('best', (_fittestCand, score) => console.log(score));
metaParamSetter.on('stuck', () => console.log('[END] stuck'));
metaParamSetter.on('timeout', () => console.log('[END] timeout'));
metaParamSetter.on('end', (rIdx, _date, ms) => console.log(`[END] after round #${rIdx} (took ${ms / SEC}sec)`));

const bestConfigs = metaParamSetter.search();

for (const bestCfg of bestConfigs) {
  console.log(decodeCand(bestCfg));
}
