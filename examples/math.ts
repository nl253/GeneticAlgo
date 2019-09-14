/**
 * This example finds roots of an equation.
 */
import {
  GeneticAlgorithm as GA,
  TypedArray,
  Duration,
  NMutations,
  LogLvl,
} from '..';

const expr = (x1: number, x2: number, x3: number, x4: number, x5: number, x6: number) => (Math.log2(x1) * x2 ** x3 / x4) + x5 ** (Math.log2(x6));

const fitness = (xs: TypedArray) => {
  // @ts-ignore
  const val = -(Math.abs(expr(...xs)));
  // some math functions will return Infinity or NaN (e.g. division by 0)
  // if they do, make sure that they have the lowest fitness possible (-Infinity)
  if (Object.is(NaN, val) || Object.is(Infinity, val)) {
    return -Infinity;
  } else {
    return val;
  }
};

const dtype = 'u8';
const nGenes = 6;

const ga = new GA(fitness, nGenes, dtype, {
  nMutations: NMutations.SMALL,
  logLvl: LogLvl.NORMAL,
  timeOutMS: Duration.seconds(30),
});

console.log('TASK: find x1, x2, x3, x4, x5, x6 such that log2(x1) * x2^x3 / x4 + x5^log2(x6) = 0');

// make sure solutions are unique
const seen = new Set();

// pretty print
for (const best of ga.search()) {
  const s: string = best.join(',');
  if (!seen.has(s)) {
    seen.add(s);
    const y: number = fitness(best);
    if (y === 0) {
      console.log(`log2(${best[0].toString().padStart(3)}) * ${best[1].toString().padStart(3)}^${best[2].toString().padStart(3)} / ${best[3].toString().padStart(3)} + ${best[4].toString().padStart(3)}^log2(${best[5].toString().padStart(3)}) = ${y}`);
    }
  }
}
