#!/usr/bin/node
/**
 * This example shows that many GeneticAlgorithms can be run in parallel.
 */
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

// main thread dispatches
if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    console.log(`worker #${i} started`);
    cluster.fork();
  }
  process.exit(0);
}

// this is the worker code
const GA = require('..');
const SEC = 1000;

const f = xs => xs.reduce((x, y) => x + y, 0);
const dtype = 'u32';
const nGenes = 500;

// randomness will ensure different config for every worker
const opts = {
  maxNGeneMut: 4 + Math.floor(Math.random() * 5),
  minNGeneMut: 1 + Math.floor(Math.random() * 3),
  nElite: 0.01 + (Math.random() * 0.4),
  pElite: 0.1 + (Math.random() * 0.4),
  popSize: 50 + Math.floor(Math.random() * 1500),
  timeOutMS: 45 * SEC,
};

const ga = new GA(f, nGenes, dtype, opts);

// use the EventEmitter API for profiling
ga.on('start', (time, opts) => console.log(`[START] at ${new Date(time).toTimeString()} with opts`, opts));
ga.on('stuck', () => console.log(`[END] stuck`));
ga.on('timeout', () => console.log(`[END] timeout`));
ga.on('end', (nr, d, ms) => console.log(`[END] after round #${nr} (took ${ms / SEC}sec)`));

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
const fittest = ga.search().next().value;
const bestPossible = 2**32 * nGenes;
const bestActual = f(fittest);
console.log('score', bestActual / bestPossible, '/ 1.0');
