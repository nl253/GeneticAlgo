#!/usr/bin/node
/**
 * This example finds roots of an equation.
 */
const GA = require('..');

const SEC = 1000;

const expr = (x1, x2, x3, x4, x5, x6) => (Math.log2(x1) * x2 ** x3 / x4) + x5 ** (Math.log2(x6));
const f = xs => {
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

const opts = {
  maxNGeneMut: 2,
  nTrack: 200,
  popSize: 1500,
  timeOutMS: 12 * SEC,
};

const ga = new GA(f, nGenes, dtype, opts);

ga.on('stuck', () => console.log(`[END] stuck`));
// ga.on('mutate', (n, p) => console.log(`mutating ${n} genes (pMutate = ${p})`));
ga.on('timeout', () => console.log(`[END] timeout`));
ga.on('end', (nr, d, t) => console.log(`[END] after round #${nr} (took ${t / SEC}sec)`));

console.log('TASK: find x1, x2, x3, x4, x5, x6 such that log2(x1) * x2^x3 / x4 + x5^log2(x6) = 0');

const results = ga.search();

// make sure solutions are unique
const seen = new Set();

for (const best of results) {
  const s = best.join(',');
  if (!seen.has(s)) {
    seen.add(s);
    const y = f(best);
    if (y === 0) {
      console.log(`log2(${best[0].toString().padStart(3)}) * ${best[1].toString().padStart(3)}^${best[2].toString().padStart(3)} / ${best[3].toString().padStart(3)} + ${best[4].toString().padStart(3)}^log2(${best[5].toString().padStart(3)}) = ${y}`);
    }
  }
}
