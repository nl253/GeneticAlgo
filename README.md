# Genetic Algorithm (ALPHA STAGE)

- use when search space is too large to use brute-force
- candidates are typed arrays (`Float32 | Float64 | Uint32 ...`)
- adaptive `pMutate`
- elitism (preserves top candidates)
- detects when the algorithm is stuck in a local minimum and returns

See API below.

## Installation

```sh
$ npm install genetic-algo
```

## API

In a nutshell:

1. Provide a fitness function that accepts a candidate (typed array) and
   returns a number. The candidates that score highest will be favoured in the
   selection.
2. Provide `nGenes` (**INT** &gt; 0)
3. Provide `dtype` ("f64", "f32", "i32", "i16", "i8", "u32", "u16", "u8")
4. You probably want a decode function as well (see **TIPS** section below).

```js
const GA = require('genetic-algo')

// silly fitness function (see below for a better example)
const fitnessFunction = arr => arr.reduce((x, y) => x + y, 0) 

// fitnessFunction [NEEDED]   function(TypedArray): Number
// nGenes          [NEEDED]   Int (each candidate is a typed array of length equal to nGenes)
// dtype           [NEEDED]   'u32' | 'u16' | 'u8' | 'i32' | 'i16' | 'i8' | 'f32' | 'f64' 
// opts            [OPTIONAL] Object (see `opts` below)
const ga = new GA(fitnessFunction, 12, 'u32')

// Array<TypedArray>
const bestCandidates = Array.from(ga.search()) // this is a GENERATOR
```

E.g. an initial population with `popSize = 4`, `nGenes = 2`, `dtype = 'u8'` will look something like this:

```js
//  gene1 gene2 
    [23,     0] // candidate 1
    [ 1,    41] // candidate 2
    [10,     1] // candidate 3
    [ 1,   100] // candidate 4
    [ 0,   999] // candidate 5
```

## Default `opts`

```js
const SEC = 1000;

const opts = {

  // 0.1 is 10%, 10 is 10
  nElite: 0.1,         

  // stop condition 
  timeOutMS: 30 * SEC, 

  // when mutating, target at least 1 gene
  minNGeneMut: 1,      

  // (default: max(1, floor(log2(nGenes)))),
  maxNGeneMut: 10,     

  // this is used to detect being stuck local minima (no improvment)
  minImprove: 1E-4,    

  // stop condition
  nRounds: 1E6,        

  // keep track of improvements in last 50 rounds to detect local minima
  nTrack: 50,          

  // it's adaptive so it will go up with 'time'
  // if you *don't* set it, it will grow with time based on nRounds
  // and based on how fit the candidate is (more fit => more likely to use mutation)
  pMutate: null,       

  // it makes sense for it to be 50 - 1500 ish
  popSize: 100,        

  // when mutating, the value of a gene is replaced with a random value
  // this is set intelligently based on dtype
  maxRandVal: 10000,   
  minRandVal: 0,        
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

## Profiling with EventEmitter API

The `GeneticAlgorithm` emits signals along with some information
which can be used for profiling.

**NOTE** data emitted is in sub-bullets.

- `"start"` when `.search()` is called
  - **Int** `startTime` in milliseconds
  - **Object** `opts`
- `"timeout"` when `timeOutMS` limit reached.
- `"stuck"` when stuck in a local minimum.
- `"end"` when finished.
  - **Int** `roundNumber`
  - **Date** `dateFinished`
  - **Int** `msTook`
- `"round"` on every round start.
- `"rounds"` when `nRounds` limit reached.
- `"mutate"` on choosing mutation as opposed to crossover.
  - **Int** `nMutations` number of genes to mutate.
  - **Float** `pMutate` computed probability of mutation (this makes sense when `pMutate = null` which makes it adaptive).
- `"crossover"` on choosing crossover as opposed to mutation.
  - **Float** `pCrossover` computed probability of crossover (this makes sense when `pMutate = null` which makes it adaptive).
- `"best"` after all candidates have been evaluated and the best candidate is selected.
  - **TypedArray** `bestCandidate`
  - **Float** `scoreOfBestCandidate`
  - **Float** `improvementSinceLastRound`
- `"generate"` when generating initial population.
- `"randomize"` when setting random genes in the initial population.
- `"score"` when scoring candidate solutions.

To see how you can extract the data from these signals (emitted) see examples in `./examples/`.

## Downsides

- single-threaded (but see `./examples/parallel.js`)
