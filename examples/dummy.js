#!/usr/bin/env node

const GA = require('..');
const SEC = 1000;

const f = xs => xs.reduce((x, y) => x + y, 0);

const opts = {
  minNGeneMut: 1,
  maxNGeneMut: 10,
  minImprove: 0.00001,
  nBits: 32,
  nElite: 10,
  nGenes: 100,
  nRounds: 1E7,
  pMutate: 0.2,
  popSize: 120,
  timeOutMS: 120 * SEC,
  nTrack: 200,
};

const ga = new GA(f, opts);

// use the EventEmitter API for getting profiling
ga.on('start', time => console.log(`started at ${new Date(time).toTimeString()}`));
ga.on('best', (_bestCand, fitness, _) => console.log((fitness / (10000 * 2 ** 32)).toPrecision(4)));
ga.on('stuck', () => console.log(`[STUCK]`));
ga.on('timeout', () => console.log(`[TIMEOUT]`));
ga.on('rounds', () => console.log(`[ROUNDS]`));
ga.on('end', (nr, d, ms) => console.log(`[DONE] after round #${nr} (took ${ms / SEC}sec)`));

// ga.search() will create a generator that iterates over the best population
// if you want the best candidate, just request the very first:
const best = ga.search().next().value;

console.log(best);
