# Genetic Algorithm (ALPHA STAGE)

- use when search space is too large to use brute-force
  - e.g. solving equations, automating the process of design and solving
    combinatorial problems (e.g. timetable scheduling)
- candidates are typed arrays (`Float32 | Float64 | Int32 | Int16 | Int8 | Uint32 | Uint16 | Uint8`)
- adaptive probability of mutation
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
   returns a number. The candidates that score the highest will be favoured in the
   selection and will make it to the next gene pool.
2. Provide `nGenes` (**Int** &gt; 0)
3. Provide `dtype`, one of: `"f64" | "f32" | "i32" | "i16" | "i8" | "u32" | "u16" | "u8"`
4. [EXTRA] You probably want a decode function as well (see **TIPS** section below).

```js
const GA = require('genetic-algo')

// silly fitness function, maximises values of all genes (see below for a better example)
const fitnessFunction = arr => arr.reduce((x, y) => x + y, 0) 

// fitnessFunction [NEEDED]   function(TypedArray): Number
// nGenes          [NEEDED]   Int (each candidate is a typed array of length equal to nGenes)
// dtype           [NEEDED]   'u32' | 'u16' | 'u8' | 'i32' | 'i16' | 'i8' | 'f32' | 'f64' 
// opts            [OPTIONAL] Object (see `opts` below)
const ga = new GA(fitnessFunction, 12, 'u32')

// Array<TypedArray>
const bestCandidates = Array.from(ga.search()) // this is a GENERATOR
```

E.g. an initial population with `popSize = 5`, `nGenes = 2`, `dtype = 'u8'` will look something like this:

```js
//  gene1 gene2 
    [23,     0] // candidate 1
    [ 1,    41] // candidate 2
    [10,     1] // candidate 3
    [ 1,   100] // candidate 4
    [ 0,   222] // candidate 5
```

## Default `opts`

```js
const SEC = 1000;

const opts = {

  // stop condition 
  timeOutMS: 30 * SEC, 

  // stop condition
  nRounds: 1E6,      

  // if you *don't* set it, it will grow with time (based on how close timeTaken is to timeOutMS)
  // and based on how fit the candidate is (more fit => more likely to use mutation)
  pMutate: null,       

  // it makes sense for it to be 100 - 1500 ish
  // (if you find that the algorithm gets stuck too quickly, increase it)
  popSize: 300,        

  // 0.2 is 20%, 10 is 10
  // (if you find that the algorithm gets stuck too quickly, decrease it)
  nElite: 0.2,         

  // when mutating, target at least 1 gene
  minNGeneMut: 1,      

  // by default it's set to a small value based on minNGeneMut and nGenes (the more genes, the higer it is)
  // (it should not be too high because the point of mutations it to introduce novelty in a controlled way)
  maxNGeneMut: null,     

  // keep track of improvements in previous rounds to detect local minima
  // (if you find that the algorithm gets stuck too quickly, increase it)
  nTrack: 100,          
  // this is used to detect being stuck local minima (no improvement), you should not need to change it
  minImprove: 1E-s6,    

  // when mutating, the value of a gene is replaced with a random value
  // this is set intelligently based on dtype
  maxRandVal: undefined,
  minRandVal: undefined,
}
```

## Tips

It makes sense to have a `decode(cand)` function (see [examples](https://github.com/nl253/GeneticAlgo-JS/tree/master/examples)).  E.g.:

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
- `"rounds"` when `nRounds` limit reached.
- `"stuck"` when stuck in a local minimum.
- `"end"` when finished.
  - **Int** `roundNumber`
  - **Date** `dateFinished`
  - **Int** `msTook`
- `"round"` on every round start (**not** the same as `"rounds"`).
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

Example of extracting data from signals:

```js
ga.on('start', time => console.log(`[START] at ${new Date(time).toTimeString()}`));
ga.on('best', (_bestCand, fitness, _) => console.log(fitness));
ga.on('stuck', () => console.log(`[END] stuck`));
ga.on('timeout', () => console.log(`[END] timeout`));
ga.on('end', (rIdx, _date, ms) => console.log(`[END] after round #${rIdx} (took ${ms / SEC}sec)`));
```

To see more examples see [examples](https://github.com/nl253/GeneticAlgo-JS/tree/master/examples).

## Downsides

- single-threaded (but see [parallel example](https://github.com/nl253/GeneticAlgo-JS/blob/master/examples/parallel.js) that uses the cluster module from node stdlib).
