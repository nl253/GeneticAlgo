#!/usr/bin/env node

const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

// dispatch
if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    console.log(`worker #${i} started`);
    cluster.fork();
  }
  process.exit(0);

} else {

  // this is the worker code

  const GA = require('..');
  const SEC = 1000;

  const f = xs => xs.reduce((x, y) => x + y, 0);
  const opts = {
    minNGeneMut: 1 + Math.floor(Math.random() * 3),
    maxNGeneMut: 4 + Math.floor(Math.random() * 80),
    minImprove: 0.000001,
    dtype: 'u32',
    nElite: Math.random(),
    nGenes: 800,
    nRounds: 1E7,
    pMutate: Math.random(),
    popSize: 50 + Math.floor(Math.random() * 150),
    timeOutMS: 60 * SEC,
    nTrack: 50,
  };

  const ga = new GA(f, opts);

  // use the EventEmitter API for getting profiling
  ga.on('start', time => console.log(`started at ${new Date(time).toTimeString()}`));
  // ga.on('best', (_bestCand, fitness, _) => console.log((fitness / (100 * 2 ** 32)).toPrecision(4)));
  ga.on('stuck', () => console.log(`[STUCK]`));
  ga.on('timeout', () => console.log(`[TIMEOUT]`));
  ga.on('rounds', () => console.log(`[ROUNDS]`));
  ga.on('end', (nr, d, ms) => console.log(`[DONE] after round #${nr} (took ${ms / SEC}sec)`));

  // ga.search() will create a generator that iterates over the best population
  // if you want the best candidate, just request the very first:
  const best = ga.search().next().value;
  console.log(best);
}
