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

In a nutshell:

1. Provide a fitness function that accepts a candidate (typed array) and
   returns a number. The candidates that score highest will be favoured in the
   selection.
2. Provide `nGenes` (**INT** &gt; 0)
3. Provide `dtype` ("f64", "f32", "i32", "i16", "i8", "u32", "u16", "u8")
4. You probably want a decode function as well (see TIPS section below).

```js
const GA = require('genetic-algo')

// silly fitness function (see below for a better example)
const fitnessFunction = arr => arr.reduce((x, y) => x + y, 0) 

// fitnessFunction [NEEDED]   function(TypedArray): number
// nGenes          [NEEDED]   int (each candidate is a typed array of length equal to nGenes)
// dtype           [NEEDED]   'u32' | 'u16' | 'u8' | 'i32' | 'i16' | 'i8' | 'f32' | 'f64' 
// opts            [OPTIONAL] object (see `opts` below)
const ga = new GA(fitnessFunction, 12, 'u32')

// Array<TypedArrays>
const bestCandidates = Array.from(ga.search()) // this is a GENERATOR

for (let i = 0; i < bestCandidates.length; i++) {
  const candidate = bestCandidates[i]
  console.log(`[#${i}] with genes [${candidate.reduce((g1, g2) => g1 + ', ' + g2)}]`)
}
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
  pMutate: 0.01,       

  // it makes sense for it to be 50 - 500 ish (default: 100, works well)
  popSize: 100,        

  // how quickly pMutate grows (this needs to be < 1)
  acc: 1E-5,           

  // when mutating, the value of a gene is replaced with a random value
  maxRandVal: 10000,   
  minRandVal: 0,       

  // enable emitting signals (GA implements EventEmitter, see below)
  signals: [           
    'best',
    'start',
    'stuck',
    'end',
    'rounds',
  ],
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

The `GeneticAlgorithm` will emit several signals along with some information
which can be used for profiling.

**NOTE** data emitted is in sub-bullets.

By default these are emitted:

- `"start"` when `.search()` is called
  - **INT** `startTime`
  - **OBJECT** `opts`
- `"timeout"` when `timeOutMS` limit reached.
- `"stuck"` when stuck in a local minimum.
- `"end"` when finished.
  - **INT** `roundNumber`
  - **DATE** `dateFinished`
  - **INT** `msTook`

You can also enable these (see `signals` in `opts` in the constructor):

- `"round"` on every round start.
- `"rounds"` when `nRounds` limit reached.
- `"best"` after all candidates have been evaluated and the best candidate is selected.
  - **TYPED ARRAY** `bestCandidate`
  - **FLOAT** `scoreOfBestCandidate`
  - **FLOAT** `improvementSinceLastRound`
- `"generate"` when generating initial population.
- `"randomize"` when setting random genes in the initial population.
- `"adapt"` when `pMutate` is adjusted (done every round).
  - **FLOAT** `newProbMutate`
- `"score"` when scoring candidate solutions.

To see how you can extract the data from these signals (emitted) see examples in `./examples/`.

## Downsides

- single-threaded (but see `./examples/parallel.js`)
