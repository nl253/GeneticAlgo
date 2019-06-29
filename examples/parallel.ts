#!/usr/bin/node
/**
 * This example shows that many GeneticAlgorithms can be run in parallel.
 */
import * as cluster from 'cluster';
import { cpus }     from 'os';

const numCPUs = cpus().length;

// main thread dispatches
if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    console.log(`worker #${i} started`);
    cluster.fork();
  }
  process.exit(0);
}

// this is the worker code
import { GeneticAlgorithm as GA } from '../index';

const SEC = 1000;

// @ts-ignore
const fitness = xs => xs.reduce((x, y) => x + y, 0);
const dtype   = 'u32';
const nGenes  = 500;

// randomness will ensure different config for every worker
const opts = {
  logLvl: 1,
  nMutations: [1 + Math.floor(Math.random() * 5), 1],
  nElite:     [0.01, 0.01 + Math.random() * 0.4],
  popSize:    50 + Math.floor(Math.random() * 1500),
  timeOutMS:  45 * SEC,
};

// @ts-ignore
const ga = new GA(fitness, nGenes, dtype, opts);

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
const fittest      = ga.search().next().value;
const bestPossible = 2 ** 32 * nGenes;
const bestActual   = fitness(fittest);
console.log('score', bestActual / bestPossible, '/ 1.0');
