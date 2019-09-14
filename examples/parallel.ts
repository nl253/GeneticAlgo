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
  // process.exit(0);
}

// this is the worker code
import {
  Duration,
  GeneticAlgorithm as GA,
  LogLvl,
  NMutations,
  PopSize,
} from '..';

// @ts-ignore
const fitness = xs => xs.reduce((x, y) => x + y, 0);
const dtype   = 'u32';
const nGenes  = 500;

// randomness will ensure different config for every worker
const opts = {
  logLvl: LogLvl.NORMAL,
  // you don't need to use NMutations or PopSize, you can just specify a number
  nMutations: [NMutations.TINY + Math.floor(Math.random() * NMutations.MEDIUM), NMutations.TINY],
  nElite:     [0.01, 0.01 + Math.random() * 0.4],
  popSize:    PopSize.TINY + Math.floor(Math.random() * PopSize.HUGE),
  timeOutMS:  Duration.seconds(20),
};

// @ts-ignore
const ga = new GA(fitness, nGenes, dtype, opts);

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
const fittest      = ga.search().next().value;
const bestPossible = 2 ** 32 * nGenes;
const bestActual   = fitness(fittest);
console.log('score', bestActual / bestPossible, '/ 1.0');
