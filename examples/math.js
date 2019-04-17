#!/usr/bin/node
const GA = require('..');
const SEC = 1000;

const expr = (x1, x2, x3, x4, x5, x6) => (Math.log2(x1) * x2 ** x3 / x4) + x5 ** (Math.log2(x6));
const f = xs => -(Math.abs(expr(...xs)));

const opts = {
  nGenes: 6,
  maxRandVal: 255,
  minRandVal: 0,
  dtype: 'u8',
  maxRandVal: 10,
  nElite: 6,
  nTrack: 1000,
  popSize: 40,
  pMutate: 0.8,
  signals: ['stuck', 'end', 'timeout', 'rounds'],
  timeOutMS: 30 * SEC,
};

const ga = new GA(f, opts);
ga.on('stuck', () => console.log(`[STUCK]`));
ga.on('rounds', () => console.log(`[ROUNDS]`));
ga.on('timeout', () => console.log(`[TIMEOUT]`));
ga.on('end', (nr, t) => console.log(`[DONE] after round #${nr} (took ${t / SEC}sec)`));

console.log('TASK: find x1, x2, x3, x4, x5, x6 such that log2(x1) * x2^x3 / x4 + x5^log2(x6) = 0');
const results = ga.search();
for (const best of results) {
  const y = f(best);
  if (y !== 0) continue;
  console.log(Array.from(best).map((x, idx) => `x${idx + 1} = ${x}`).reduce((s1, s2) => `${s1}, ${s2}`));
  console.log(`log2(${best[0]}) * ${best[1]}^${best[2]} / ${best[3]} + ${best[4]}^log2(${best[5]}) = ${y}`);
}
