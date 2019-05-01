#!/usr/bin/env node
/**
 * This is a trivial example where the task is to maximise the value of each gene.
 *
 * Additionally, it demonstrates how to use metrics for profiling of the algorithm.
 */
const GA = require('..');
const SEC = 1000;

const fitness = xs => xs.reduce((x, y) => x + y, 0);

const dtype = 'u32';  // search space of real numbers (floats) is more challenging (try 'f32')
const nGenes = 1000;  // the more genes, the more difficult the task

const opts = { timeOutMS: 30 * SEC };

const ga = new GA(fitness, nGenes, dtype, opts);

const bestPossible = 2 ** 32 * nGenes; // every gene is max value of 32-bit unsigned int

// [OPTIONAL] use the EventEmitter API for getting profiling
ga.on('start', cfg => console.log(`[START] with opts`, cfg));
ga.on('best', (_, fitness) => console.log('score', (fitness / bestPossible).toFixed(4), '/ 1.0'));
// METRICS see what is going on
// (uncomment out only one at a time otherwise too much logging)
// ga.on('pMutate', p => console.log('pMutate', p));
// ga.on('nMutations', n => console.log('nMutations', n));
// ga.on('tournamentSize', k => console.log('tournamentSize', k));
// ga.on('pElite', p => console.log('pElite', p));
ga.on('stuck', () => console.log(`[STUCK]`));
ga.on('timeout', () => console.log(`[TIMEOUT]`));
ga.on('end', (rIdx, ms) => console.log(`[DONE] after round #${rIdx} (took ${ms / SEC}sec)`));

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
const best = ga.search().next().value;
console.log(best);

// OR IF YOU WANT ALL
// for (const best of ga.search()) {
//   console.log(best);
// }
