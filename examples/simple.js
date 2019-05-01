#!/usr/bin/env node
/**
 * This is a trivial example where the task is to maximise the value of each gene.
 */
const GA = require('..');
const SEC = 1000;

const fitness = xs => xs.reduce((x, y) => x + y, 0);

const dtype = 'u32';  // search space of real numbers (floats) is more challenging (try 'f32')
const nGenes = 1000;  // the more genes, the more difficult the task

const opts = { timeOutMS: 30 * SEC };

const ga = new GA(fitness, nGenes, dtype, opts);

const bestPossible = 2 ** 32 * nGenes; // every gene is max value of 32-bit unsigned int

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
const best = ga.search().next().value;
console.log(best);
