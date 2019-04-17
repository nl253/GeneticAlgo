#!/usr/bin/env node

const GA = require('..');
const SEC = 1000;

const f = xs => xs.map(x => Math.abs(x)).reduce((x, y) => x + y, 0);

const dtype = 'f32';
const nGenes = 1000;

const opts = {
  acc: 0.0000001,
  nElite: 10,
  pMutate: 0.02,
  popSize: 120,
  signals: [
    'best',
    'start',
    'stuck',
    'end',
    'rounds',
  ],
  timeOutMS: 120 * SEC,
};

const ga = new GA(f, nGenes, dtype, opts);

// use the EventEmitter API for getting profiling
ga.on('start', (time, cfg) => console.log(`started at ${new Date(time).toTimeString()} with cfg`, cfg));
ga.on('best', (_bestCand, fitness) => console.log(fitness));
ga.on('stuck', () => console.log(`[STUCK]`));
ga.on('timeout', () => console.log(`[TIMEOUT]`));
ga.on('rounds', () => console.log(`[ROUNDS]`));
ga.on('end', (nr, d, ms) => console.log(`[DONE] after round #${nr} (took ${ms / SEC}sec)`));

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
const best = ga.search().next().value;

console.log(best);
