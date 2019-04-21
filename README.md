# Genetic Algorithm

- use when search space is too large to use brute-force search
  - e.g. solving equations, automating the process of design and solving **combinatorial problems** (timetable scheduling)
  - many **problems can be reformulated as exploring an n-dimensional search space**
- **adaptive** probability of mutation
- **elitism** (preserves top candidates)
- detects when the algorithm is stuck in a local minimum and returns
- allows for profiling and debugging (see **EventEmitter API**)
- **efficient** (built on typed arrays)

For an **alternative heuristic** search that may work better when your
problem uses continuous (real) values see my [particle swarm optimization algorithm](https://www.npmjs.com/package/particle-swarm-optimization)
that follows a similar API.

## Installation

```sh
$ npm install genetic-algo
```

[NPM link](https://www.npmjs.com/package/genetic-algo).

## API

Example:

```js
const GA = require('genetic-algo')

// silly fitness function, maximises values of all genes (see below for a better example)
const fitnessFunction = arr => arr.reduce((x, y) => x + y, 0)

// you may also supply an object with options  see below DEFAULT OPTS)
const ga = new GA(fitnessFunction, 12 /* nGenes */, 'u32' /* dtype */)

// Array<TypedArray>
const bestCandidates = Array.from(ga.search() /* generator */)
```

In a nutshell:

1. Specify `nGenes` (**Int** &gt; 0, see **NGENES** section below)
2. Declare a fitness function that accepts a candidate (typed array) and
   returns a number. Each candidate is of length `nGenes`. The candidates
   that score the highest will be favoured in the
   selection and will make it to the next gene pool. (see **FITNESS FUNCTION** section below)
3. Choose `dtype`, one of: `"f64" | "f32" | "i32" | "i16" | "i8" | "u32" | "u16" | "u8"` (see **DTYPE** section below)
4. [EXTRA] You probably want a `decode` function as well (see **DECODE FUNCTION** section below).

## Fitness Function

### Signature

`function(TypedArray): Number` <br>

The number it returns may be positive or negative. It may be an integer
or a real number.

### Example

The previous example maximised the value of every gene. This example
computes the negative of the distance from roots of an equation:

```js
const expr = (x1, x2, x3, x4, x5, x6) => (Math.log2(x1) * x2 ** x3 / x4) + x5 ** (Math.log2(x6))
const fitness = xs => {
  const val = -(Math.abs(expr(...xs)))
  if (Object.is(NaN, val) || Object.is(Infinity, val)) {
    return -Infinity
  } else {
    return val
  }
}
```

Fittest candidates score 0 (distance from the root is 0 meaning root has
been found), least fit candidates have a negative value.

### [OPTIONAL] Decode Function

It sometimes makes sense to have a `decode(cand)` function.

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

More examples [here](https://github.com/nl253/GeneticAlgo-JS/tree/master/examples).

## NGenes

This is how many numbers each array will have. Each gene (number)
corresponds to a dimension in the search space you are exploring. E.g.

<table>
  <tr>
    <th>#</th>
    <th>meaning</th>
    <th>domain</th>
  </tr>
  <tr>
    <td>gene #1</td>
    <td>time</td>
    <td>00:00 - 24:00</td>
  </tr>
  <tr>
    <td>gene #2</td>
    <td>day</td>
    <td>0 - 365</td>
  </tr>
  <tr>
    <td>gene #3</td>
    <td>room number</td>
    <td>1 - 128</td>
  </tr>
  <tr>
    <td>...</td>
    <td>...</td>
    <td>...</td>
  </tr>
  <tr>
    <td>gene #1000</td>
    <td>building</td>
    <td>A - Z</td>
  </tr>
</table>

For combinatorial problems, it makes sense to store an array of choices
and let genes be indices.

```js
const deparatment = [
  "biology",
  "mathematics",
  "electical-engineering",
  ...
]

const room = [
  "k21",
  "k12",
  "w4",
  ...
]

// etc.
```

then each candidate can be a Uint array.

A different approach you could take is devote 2 genes to `room` and let
the first be the ASCII code of the room (`a`..`z`) and the second room
number (`1..100` or something).

## Dtype

You need to set `dtype` yourself depending on the problem domain.

<table>
  <tr>
    <th>data type</th>
    <th>typed array</th>
    <th>min value</th>
    <th>max value</th>
  </tr>
  <tr>
    <td><code>"u8"</code></td>
    <td><code>UInt8Array</code></td>
    <td>0</td>
    <td>2<sup>8</sup></td>
  </tr>
  <tr>
    <td><code>"u16"</code></td>
    <td><code>UInt16Array</code></td>
    <td>0</td>
    <td>2<sup>16</sup></td>
  </tr>
  <tr>
    <td><code>"u32"</code></td>
    <td><code>UInt32Array</code></td>
    <td>0</td>
    <td>2<sup>32</sup></td>
  </tr>
  <tr>
    <td><code>"i8"</code></td>
    <td><code>Int8Array</code></td>
    <td>-2<sup>8 - 1</sup></td>
    <td>2<sup>8 - 1</sup></td>
  </tr>
  <tr>
    <td><code>"i16"</code></td>
    <td><code>Int16Array</code></td>
    <td>-2<sup>16 - 1</sup></td>
    <td>2<sup>16 - 1</sup></td>
  </tr>
  <tr>
    <td><code>"i32"</code></td>
    <td><code>Int32Array</code></td>
    <td>-2<sup>32 - 1</sup></td>
    <td>2<sup>32 - 1</sup></td>
  </tr>
  <tr>
    <td><code>"f32"</code></td>
    <td><code>Float32Array</code></td>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td><code>"f64"</code></td>
    <td><code>Float64Array</code></td>
    <td></td>
    <td></td>
  </tr>
</table>

You benefit **a lot** from restricting the search space by choosing e.g. `i8` as opposed to `i16`.

## [OPTIONAL] Default `opts`

In addition to required parameters (`fitnessFunction`, `nGenes`,
`dtype`), you can also supply an object with configuration. I encourage
to begin with defaults and then tweak if necessary. Here are the
defaults:

```js
const SEC = 1000

const opts = {

  // stop condition
  // (if you find that the algorithm gets stuck too quickly, increase it)
  timeOutMS: 30 * SEC,

  // stop condition
  nRounds: 1E6,

  // if you *don't* set it, it will grow with time based on
  // how close timeTaken is to timeOutMS and how fit the candidate is
  // more fit => more likely to use mutation
  // you should not need to modify it,
  // if you do, you should set it to a small value e.g. 0.05
  pMutate: null,

  // it makes sense for it to be 100 - 1500 ish
  // (if you find that the algorithm gets stuck too quickly, increase it)
  popSize: 300,

  // 0.2 is 20%, 10 is 10
  // (if you find that the algorithm gets stuck too quickly, decrease it)
  nElite: 0.2,

  // probability of choosing elites for selection
  // this way you can have a small population of elites but sample frequently
  // e.g. when nElite is small and pElite is high
  // (if you find that the algorithm gets stuck too quickly, decrease it)
  pElite: 0.2,

  // when mutating, target at least 1 gene
  minNGeneMut: 1,

  // by default it's set to a small value based on
  // minNGeneMut and nGenes (the more genes, the higer it is)
  // (it should not be too high because the point of
  // mutations it to introduce novelty in a controlled way)
  maxNGeneMut: null,

  // keep track of improvements in previous rounds to detect local minima
  // (if you find that the algorithm gets stuck too quickly, increase it)
  nTrack: 100,
  // this is used to detect being stuck local minima (no improvement),
  // you should not need to change it
  minImprove: 1E-6,

  // when mutating, the value of a gene is replaced with a random value
  // this is set intelligently based on dtype
  maxRandVal: undefined,
  minRandVal: undefined,
}
```

E.g.:

```js
const opts = {
  timeOutMS: 30 * SEC,
  nElite: 0.1,
  pElite: 0.2,
}
const nGenes = 1000
const dtype = 'u32'

const ga = new GA(someFitnessFunct, nGenes, dtype, opts)
```


## Theory Behind Genetic Algorithms

Genetic algorithms **simulate the process of evolution**. You are the
one specifying what each candidate should be good at to survive (fitness
function).

This algorithm uses a nature-inspired **heuristic** and has the
potential to achieve excellent results but it *might not* find the
optimal (ideal) solution. That said, for many applications the best
solution is not needed. By sacrificing a bit of quality you drastically
reduce the time needed to find a solution. Without such heuristics some
problems cannot be solved at all. These would NP complete problems to
which we do not have an algorithm which would run in polynomial time.

### Candidate

This is your "DNA" which represents a **complete solution to the
problem** you are trying to solve. The algorithm keeps track of a
population of those DNA strings. Candidates are modified in such a way
that the population approaches a solution. In this implementation
candidate solutions (chromosomes) are typed arrays. Depending on what
type of problem you are trying to solve you will use a different
`dtype`. Each candidate corresponds to a point in the search space that
you are exploring.

### Fitness Function

Measures the value of a candidate solution. The algorithm will perform well *if* your fitness function is good.

### Crossover

One of the two ways candidate solutions are modified. Crossover is all
about **recombination**. It is a **binary operation** that takes two
candidates and selects half genes from one parent and the other half
from the other.

In an ideal scenario, you would inherit genes from fit individuals.
However, if you do that too often, you will loose novelty and you the
algorithm will get stuck very quickly. You can change how often fittest
candidates (elite) are chosen by changing `pElite`. `pElite = 1` always
chooses elite units, `pElite = 0` never chooses them.

**NOTE** `nElites` needs to be non-zero for this to work.

### Mutations

One of the two ways candidate solutions are modified. This is a **unary
operation**. It takes a single candidate and **randomly alters a single
gene.** Mutations introduce **novelty**. If your algorithm gets stuck too
quickly it's because there was not enough novelty. In an ideal scenario,
fittest candidates would undergo mutation whereas the least fit would use
crossover. Furthermore, ideally, the algorithm would prevent premature
convergence by increasing the probability of mutation with time. This
implementation does both for you automatically.

### Population

Population is a collection of candidate solutions. E.g. an initial population with `popSize = 5`, `nGenes = 2`, `dtype = 'u8'` will look something like this:

```js
// gene1 gene2
   [23,     0] // candidate 1
   [ 1,    41] // candidate 2
   [10,     1] // candidate 3
   [ 1,   100] // candidate 4
   [ 0,   222] // candidate 5
```


## Profiling with EventEmitter API

The `GeneticAlgorithm` emits signals along with some information
which can be used for profiling.

**NOTE** data emitted is in sub-bullets.

**Emitted Once** <br>

1. `"init"` right after `.search()` is called, just *before* initialisation
2. `"generate"` when generating initial population.
3. `"randomize"` when setting random genes in the initial population.
4. `"start"` after `.search()` and all initialisation is complete, before the 1st round
    - **Int** `startTime` in milliseconds
    - **Object** `opts` the algorithm is run with (you can use it to see if you configured it properly)

**Emitted on Stop Condition Met** <br>

1. `"timeout"` when `timeOutMS` limit is reached.
2. `"stuck"` when stuck in a local minimum.
3. `"rounds"` when `nRounds` limit reached.
4. `"end"` when finished.
    - **Int** `roundNumber`
    - **Date** `dateFinished`
    - **Int** `msTaken`

**Emitted Every Round** <br>

1. `"round"` on every round start (**not** the same as `"rounds"`).
2. `"best"` after all candidates have been evaluated and the best candidate is selected.
    - **Int** `indexOfBestCandidate`
    - **Float** `scoreOfBestCandidate`
    - **Float** `improvementSinceLastRound`
3. `"mutate"` on choosing mutation as opposed to crossover.
    - **Int** `nMutations` number of genes to mutate.
    - **Float** `pMutate` computed probability of mutation (this makes sense when `pMutate = null` which makes it adaptive, you can use it to see how it grows with time).
4. `"crossover"` on choosing crossover as opposed to mutation.
    - **Float** `pCrossover` computed probability of crossover (this makes sense when `pMutate = null` which makes it adaptive, it's basically `1 - pMuate`).
    - **Int** `parent1Idx`
    - **Int** `parent2Idx`
    - **Bool** `didChooseElite`

Example of extracting data from signals:

```js
ga.on('start', time => console.log(`[START] at ${new Date(time).toTimeString()}`))
ga.on('best', fitness => console.log(fitness))
ga.on('stuck', () => console.log(`[END] stuck`))
ga.on('timeout', () => console.log(`[END] timeout`))
ga.on('end', (rIdx, ms) => console.log(`[END] after round #${rIdx} (took ${ms / SEC}sec)`))
```

More examples [here](https://github.com/nl253/GeneticAlgo-JS/tree/master/examples).

## Downsides

- single-threaded (but see [parallel example](https://github.com/nl253/GeneticAlgo-JS/blob/master/examples/parallel.js) that uses the cluster module from node stdlib).
- this is a node.js library so it won't work in a browser

## License

MIT
