#!/usr/bin/env node
/**
 * This is a trivial example where the task is to maximise the value of each gene.
 */
const GA = require('..');
const SEC = 1000;

const fitnessFunct = xs => xs.reduce((x, y) => x + y, 0);

const dtype = 'u32'; // search space of real numbers (floats) is more challenging (try 'f32')
const nGenes = 500;  // the more genes, the more difficult the task

const opts = {
  timeOutMS: 60 * SEC,
  validateFitness: false,
  emitFittest: false,
};

const ga = new GA(fitnessFunct, nGenes, dtype, opts);

const bestPossible = 2 ** 32 * nGenes; // every gene is max value of 32-bit unsigned int

// [optional] use the EventEmitter API for getting profiling
ga.on('start', (timeMS, cfg) => console.log(`[START] at ${new Date(timeMS).toTimeString()} with opts`, cfg));
ga.on('best', (_, fitness) => console.log('score', (fitness / bestPossible).toFixed(4), '/ 1.0'));
// ga.on('mutate', (nM, pM) => console.log('#mutations', nM, 'pMutate', pM));
ga.on('stuck', () => console.log(`[STUCK]`));
ga.on('timeout', () => console.log(`[TIMEOUT]`));
ga.on('end', (rIdx, _, ms) => console.log(`[DONE] after round #${rIdx} (took ${ms / SEC}sec)`));

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
const best = ga.search().next().value;
console.log(best);

// OR IF YOU WANT ALL
// for (const best of ga.search()) {
//   console.log(best);
// }

