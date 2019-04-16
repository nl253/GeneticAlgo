# Genetic Algorithm

- built on typed arrays (uint)

## API

```js
const GA = require('genetic-algo')
const fitnessFunction = arr => arr.reduce((x, y) => x + y, 0)

const opts = {
  nBits: 32, // 8 | 16 | 32
  minImprove: 1E-4,
  minNGeneMut: 1,
  nElite: 10, // 0.1 is 10%, 10 is 10
  nGenes: 10, // each candidate is a Uint<nBits>Array of length nGenes
  nRounds: 1e6, // stop condition
  nTrack: 50, // keep track of improvements in last 50 rounds to detect local minima
  pMutate: 0.01,
  popSize: 100,
  timeOutMS: 30 * 1000, // 30sec
}

const ga = new GA(fitnessFunction, opts)

// Array<TypedArrays>
const bestCandidates = ga.search()

for (let i = 0; i < bestCandidates.length; i++) {
  const candidate = bestCandidates[i]
  let info = `#${i} with genes [`
  for (const gene of candidate) {
    info += `${gene}, `
  }
  info += ']'
  console.log(info)
}
```

## Downsides

- single-threaded
