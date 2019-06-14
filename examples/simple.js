/**
 * This is a trivial example where the task is to maximise the value of each gene.
 */
const GA = require('..');

const SEC = 1000;

const fitness = xs => xs.reduce((x, y) => x + y, 0);

// search space of real numbers (floats) is more challenging (try 'f32')
// the more genes, the more difficult the task
const ga = new GA(fitness, 5000 /* nGenes */, 'u32' /* dtype */, { timeOutMS: 30 * SEC, logLvl: 2 });

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
const best = ga.search().next().value;
console.log(best);
