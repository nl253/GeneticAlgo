# Genetic Algorithm

- use when search space is too large to use brute-force
- built on typed arrays (uint)
- adaptive pMutate
- detects when the algorithm is stuck in a local minimum and returns
- candidates are UintArrays (you choose if 32 | 16 | 8 bit, and you choose number of genes)

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

const opts = {
  nBits: 32, // 8 | 16 | 32
  minImprove: 1E-4,
  minNGeneMut: 1,
  nElite: 10, // 0.1 is 10%, 10 is 10
  nGenes: 3, // each candidate is a Uint<nBits>Array of length nGenes
  nRounds: 1e6, // stop condition
  nTrack: 50, // keep track of improvements in last 50 rounds to detect local minima
  pMutate: 0.01,
  popSize: 100,
  timeOutMS: 30 * 1000, // 30sec
}

const ga = new GA(fitnessFunction, opts)

// Array<TypedArrays>
const bestCandidates = Array.from(ga.search()) // this is a GENERATOR

for (let i = 0; i < bestCandidates.length; i++) {
  const candidate = bestCandidates[i]
  console.log(`[#${i}] with genes [${candidate.reduce((g1, g2) => g1 + ', ' + g2)}]`)
}
```

## Downsides

- single-threaded
