/**
 * This is a trivial example where the task is to maximise the value of each gene.
 */
import {
  Dtype, Duration,
  FitnessFunct,
  GeneticAlgorithm as GA, LogLvl,
  UserOpts,
} from '..';

const fitness: FitnessFunct = candidate => {
  // @ts-ignore
  return candidate.reduce((x, y) => x + y, 0);
};

// search space of real numbers (floats) is more challenging (try 'f32')
// the more genes, the more difficult the task
const nBits          = 32;
const dtype: Dtype   = `u${nBits}` as Dtype;
const nGenes         = 500;
const opts: UserOpts = {
  timeOutMS: Duration.seconds(30),
  logLvl: LogLvl.NORMAL,
};

const bestPossible = 2 ** nBits * nGenes;

const ga = new GA(fitness, nGenes, dtype, opts);

ga.on('score', () => {
  console.log(`accuracy ${(ga.bestScore[0] / bestPossible * 100).toFixed(0)}%`)
});

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
const best = ga.search().next().value;

console.log(best);
