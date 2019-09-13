/**
 * The task is to design a network such that there is a path from every node to every other node, the path is as short as possible and there are no cycles.
 * Every gene index is the node number and value at that index is the neighbour. Effectively, each candidate is an adjacancy list.
 */
import {GeneticAlgorithm as GA} from '../index';

const SEC = 1000;

const dtype = 'u8';
const nGenes = 100;

const start = 0;
const end = 99;

function hasPathTo(xs, a, b) {
  const len = 0;
  const focus = a;
  const seen = new Set();
  while (true) {
    if (seen.has(focus)) {
      return false;
    }
  }
  return len;
}

function hasCycles(xs) {
  const seen = new Set();
  let focus = 0;
  while (true) {
    if (seen.has(focus)) {
      return true;
    } else {
      seen.add(focus);
      focus = xs[focus];
    }
  }
  return false;
}

const f = (xs) => {
  const cand = xs.map(x => x % nGenes);
};

const opts = {
  acc: 0.0000001,
  nElite: 10,
  pMutate: 0.02,
  popSize: 120,
  signals: [
    'best',
    'start',
    'stuck',
    'end',
    'rounds',
  ],
  timeOutMS: 120 * SEC,
};

const ga = new GA(f, nGenes, dtype, opts);

// use the EventEmitter API for getting profiling
ga.on('start', (time, cfg) => console.log(
  `started at ${new Date(time).toTimeString()} with cfg`, cfg));
ga.on('best', (_bestCand, fitness) => console.log(fitness));
ga.on('stuck', () => console.log(`[STUCK]`));
ga.on('timeout', () => console.log(`[TIMEOUT]`));
ga.on('rounds', () => console.log(`[ROUNDS]`));
ga.on('end', (nr, d, ms) => console.log(
  `[DONE] after round #${nr} (took ${ms / SEC}sec)`));

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
const best = ga.search().next().value;

console.log(best);
