#!/usr/bin/env node
/**
 * This is a trivial example where the task is to maximise the value of each gene.
 */
const GA = require('..');
const SEC = 1000;

const fitness = [
  xs => xs.reduce((x, y) => x - y, 0),             // ensure all max
  xs => xs.map(x => x % 2 === 0 ? 1 : 0).reduce((x1, x2) => x1 + x2, 0), // ensure all even
  xs => xs.map(x => x % 3 === 0 ? 1 : 0).reduce((x1, x2) => x1 + x2, 0), // ensure all multiples of 3
];

const dtype = 'u8';  // search space of real numbers (floats) is more challenging (try 'f32')
const nGenes = 300;  // the more genes, the more difficult the task

const opts = {
  timeOutMS: 30 * SEC,
  // to make it very verbose...
  // log: 2,
  // to make it verbose...
  debug: 1,
  emitFittest: true,
};

const ga = new GA(fitness, nGenes, dtype, opts);

// [OPTIONAL] use the EventEmitter API for getting profiling
ga.on('score', env => console.log('score', env.bestScore));
// when opts.emitFittest = true, you can print best on each round
ga.on('score', env => console.log('[', env.best.join(','), ']'));

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
console.log(ga.search().next().value);
