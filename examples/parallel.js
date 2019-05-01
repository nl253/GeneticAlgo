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

const fitness = xs => xs.reduce((x, y) => x + y, 0);
const dtype = 'u32';
const nGenes = 500;

// randomness will ensure different config for every worker
const opts = {
  maxNMutations: 4 + Math.floor(Math.random() * 5),
  minNMutations: 1 + Math.floor(Math.random() * 3),
  nElite: 0.01 + (Math.random() * 0.4),
  minPElite: 0.01 + (Math.random() * 0.1),
  maxPElite: 0.11 + (Math.random() * 0.1),
  minTournamentSize: 2 + Math.floor(Math.random() * 2),
  maxTournamentSize: 4 + Math.floor(Math.random() * 12),
  popSize: 50 + Math.floor(Math.random() * 1500),
  timeOutMS: 45 * SEC,
};

const ga = new GA(fitness, nGenes, dtype, opts);

// [optional] use the EventEmitter API for profiling
ga.on('start', opts => console.log(`[START] with opts`, opts));
ga.on('stuck', () => console.log(`[END] stuck`));
ga.on('timeout', () => console.log(`[END] timeout`));
ga.on('end', (rIdx, ms) => console.log(`[END] after round #${rIdx} (took ${ms / SEC}sec)`));

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
const fittest = ga.search().next().value;
const bestPossible = 2**32 * nGenes;
const bestActual = fitness(fittest);
console.log('score', bestActual / bestPossible, '/ 1.0');
