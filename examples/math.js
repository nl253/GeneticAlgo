#!/usr/bin/node
const GA = require('..');

const expr = (x1, x2, x3, x4, x5, x6) => (Math.log2(x1) * x2 ** x3 / x4) + x5 ** (Math.log2(x6));
const f = xs => -(expr(...xs) ** 2);

const opts = {
  nGenes: 6,
  maxRandVal: 10,
  nTrack: 100,
  pMutate: 0.2,
  timeOutMS: 30 * 1000,
};

const ga = new GA(f, opts);

ga.on('fitness', maxF => console.log(`best fitness = ${maxF}`));
ga.on('round', r => console.log(`round #${r}`));
ga.on('stuck', () => console.log(`[STUCK]`));
ga.on('end', (nr, t) => console.log(`[DONE] after round #${nr} (took ${t / 1000}sec)`));

console.log('TASK: find x1, x2, x3, x4, x5, x6 such that log2(x1) * x2^x3 / x4 + x5^log2(x6) = 0');
const results = ga.search();
for (const best of results) {
  console.log(Array.from(best).map((x, idx) => `x${idx + 1} = ${x}`).reduce((s1, s2) => `${s1}, ${s2}`));
  console.log(`log2(${best[0]}) * ${best[1]}^${best[2]} / ${best[3]} + ${best[4]}^log2(${best[5]}) = ${f(best)}`);
}
