#!/usr/bin/env node
import {
  Duration, FitnessFunct,
  GeneticAlgorithm as GA,
  LogLvl,
} from '..';

const fitness: FitnessFunct[] = [
  // @ts-ignore
  (xs) => xs.reduce((x, y) => x - y, 0), // ensure all max
  // @ts-ignore
  (xs) => xs.map((x) => x % 2 === 0 ? 1 : 0).reduce((x1, x2) => x1 + x2, 0), // ensure all even
  // @ts-ignore
  (xs) => xs.map((x) => x % 3 === 0 ? 1 : 0).reduce((x1, x2) => x1 + x2, 0), // ensure all multiples of 3
];

const dtype = 'u8'; // search space of real numbers (floats) is more challenging (try 'f32')
const nGenes = 300; // the more genes, the more difficult the task

const opts = {
  timeOutMS: Duration.seconds(30),
  logLvl: LogLvl.NORMAL,
};

const ga = new GA(fitness, nGenes, dtype, opts);

/*
 * ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first:
 */
console.log(ga.search().next().value);
