#!/usr/bin/env node

const GA = require('..');
const SEC = 1000;

const f = xs => xs.reduce((x, y) => x + y, 0);

const dtype = 'u32'; // search space of real numbers (floats) is more challanging (try 'f32')
const nGenes = 1500; // the more genes, the more difficult the task

const opts = { timeOutMS: 15 * SEC };

const ga = new GA(f, nGenes, dtype, opts);

const bestPossible = 2**32 * nGenes; // every gene is max value of 32-bit unsigned int

// use the EventEmitter API for getting profiling
ga.on('start', (time, cfg) => console.log(`[START] at ${new Date(time).toTimeString()} with cfg`, cfg));
ga.on('best', (_bestCand, bestFitness) => console.log((bestFitness / bestPossible).toFixed(4)));
ga.on('stuck', () => console.log(`[STUCK]`));
ga.on('timeout', () => console.log(`[TIMEOUT]`));
ga.on('end', (rIdx, _date, ms) => console.log(`[DONE] after round #${rIdx} (took ${ms / SEC}sec)`));

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
const best = ga.search().next().value;
console.log(best);

// OR IF YOU WANT ALL
// for (const best of ga.search()) {
//   console.log(best);
// }

