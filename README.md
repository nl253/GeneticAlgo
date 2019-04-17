# Genetic Algorithm

- use when search space is too large to use brute-force
- candidates are typed arrays (`float32 | float64 | uint32 ...`)
- adaptive `pMutate`
- elitism (preserves top candidates)
- uses truncation for selection
- detects when the algorithm is stuck in a local minimum and returns

E.g. an initial pop with `popSize = 4`, `nGenes = 2`, `nBits = 8` will look something like this:

```js
[23,  0] // candidate 1
[1,  41] // candidate 2
[10,  1] // candidate 3
[1, 100] // candidate 4
```

See API below.

## Installation

```sh
$ npm install genetic-algo
```

## API

```js
const GA = require('genetic-algo')
const fitnessFunction = arr => arr.reduce((x, y) => x + y, 0)
const SEC = 1000;

const opts = {
  dtype: 'u32',        // [NEEDED] 'u32' | 'u16' | 'u8' | 'i32' | 'i16' | 'i8' | 'f32' | 'f64' 
  nGenes: 3,           // [NEEDED] each candidate is a typed array of length equal to nGenes
  nElite: 10,          // 0.1 is 10%, 10 is 10 (default: 10%)
  timeOutMS: 30 * SEC, // stop condition 
  minNGeneMut: 1,      // when mutating, target at least 1 gene
  maxNGeneMut: 10,     // feel free to target 1..10 genes
  minImprove: 1E-4, 
  nRounds: 1e6,        // stop condition
  nTrack: 50,          // keep track of improvements in last 50 rounds to detect local minima
  pMutate: 0.01,       // it's adaptive so it will go up with 'time'
  popSize: 100,
}

const ga = new GA(fitnessFunction, opts)

// Array<TypedArrays>
const bestCandidates = Array.from(ga.search()) // this is a GENERATOR

for (let i = 0; i < bestCandidates.length; i++) {
  const candidate = bestCandidates[i]
  console.log(`[#${i}] with genes [${candidate.reduce((g1, g2) => g1 + ', ' + g2)}]`)
}
```

## Tips

It makes sense to have a `decode(cand)` function (see `./examples/meta.js`).  E.g.:

```js
function decode(cand) {
  return {
    price: cand[0],
    category: Math.floor(cand[1]),
    area: Math.floor(cand[2]),
    // etc.
  }
}
```

And then it's *much* easier in the fitness function:

```js
function fitnessFunction(cand) {
  const { price, category, area, ... } = decode(cand)
  let fitnessScore = 0
  fitnessScore += 1000 - price
  fitnessScore += getQualOfCat(category)
  fitnessScore -= getCostOfArea(area)
  // other vars ...
  return fitnessScore
}
```

## Downsides

- single-threaded (but see `./examples/parallel.js`)
