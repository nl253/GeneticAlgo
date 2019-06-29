# Genetic Algorithm

- use when search space is too large to use brute-force search
  - e.g. solving equations, automating the process of design and solving **combinatorial problems** (timetable scheduling)
  - many **problems can be reformulated as exploring an n-dimensional search space**
- **adaptive** parameters that change linearly as time approaches end and in response to quality of candidate solution
- **elitism** (preserves top candidates)
- allows for profiling and debugging (see **EventEmitter API**)
- **efficient** (built on typed arrays)
<!--- detects when the algorithm is stuck in a local minimum and returns-->

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
const { GA } = require('genetic-algo')

// silly fitness function, maximises values of all genes (see below for a better example)
const fitnessFunction = arr => arr.reduce((x, y) => x + y, 0)

// you may also supply an object with options  see below DEFAULT OPTS)
const ga = new GA(fitnessFunction, 1000 /* nGenes */, 'u32' /* dtype */)

// Array<TypedArray>
const bestCandidates = Array.from(ga.search() /* generator */)
```

In a nutshell:

1. Specify `nGenes` (**Int** &gt; 0, see **NGENES** section below)
2. Declare a fitness function that accepts a candidate (typed array) and
   returns a number. Each candidate is of length `nGenes`. The candidates
   that score the highest will be favoured in the
   selection and will make it to the next gene pool. (see **FITNESS FUNCTION** section below)
   For multiple objectives (e.g. you want the solution to have more than one property: price, time, quality ...) supply an array of fitness functions.
3. Choose `dtype`, one of: `"f64" | "f32" | "i32" | "i16" | "i8" | "u32" | "u16" | "u8"` (see **DTYPE** section below)
4. [EXTRA] You might want a `decode` function as well (see **DECODE FUNCTION** section below).

## Fitness Function

### Signature

`function(TypedArray): Number` <br>

The number it returns may be positive or negative. It may be an integer
or a real number.

### Example

The previous example maximised the value of every gene. This example
computes the negative of the distance from roots of an equation:

```js
// find root of expr
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

Output from [this example](https://github.com/nl253/GeneticAlgo-JS/blob/master/examples/math.ts) which uses this fitness function:

```
log2( 98) *   0^ 61 / 209 +   0^log2( 76) = 0
log2( 39) *   0^228 / 209 +   0^log2(160) = 0
log2(100) *   0^ 89 / 202 +   0^log2(151) = 0
log2(124) *   0^163 / 247 +   0^log2( 76) = 0
log2( 31) *   0^166 /   9 +   0^log2(166) = 0
log2(221) *   0^100 / 132 +   0^log2(130) = 0
log2(  2) *   0^157 / 211 +   0^log2(150) = 0
log2(  2) *   0^100 / 132 +   0^log2(130) = 0
...   ...   ...   ...   ...   ...   ...   ... 
```

It's crucial that you reward candidate solutions for **approximating** i.e.
getting close to the solution. If they are a bit right -- add some fitness.

### Multiple Objectives

For multiple objectives (e.g. you want the solution to have more than one property: price, time, quality ...) supply an array of fitness functions:

```js
const fitness = [
  (cand) => getSpeed(cand),
  (cand) => getPrice(cand),
  (cand) => getDurability(cand),
  (cand) => getUserFriendliness(cand),
]
```

The functions may return numbers in any scale. E.g. `getSpeed` can return a number in [0, 100], `getPrice` can return a number in [100, 1000000] etc.
You might want to provide weights for each objective (by default each is 1.0 i.e. equally important):

```js
const opts = {
  weights: [0.2, 0.4, 0.1, 0.01] // default [1.0, 1.0, 1.0, 1.0]
}
```

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
corresponds to a dimension in the search space you are exploring. For example:

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

then each candidate can be a Uint array `[depIdx, roomIdx, ...]`.

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
    <td><code>Float32Array</code> (32-bit IEEE float) </td>
    <td>1.2 * 10<sup>-38</sup></td>
    <td>3.4 * 10<sup>38</sup></td>
  </tr>
  <tr>
    <td><code>"f64"</code></td>
    <td><code>Float64Array</code> (64-bit IEEE float)</td>
    <td>5.0 * 10<sup>-324</sup></td>
    <td>1.8 * 10<sup>308</sup></td>
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
  // 
  // if you find that the algorithm gets stuck too quickly, increase it
  timeOutMS: 30 * SEC,

  // stop condition
  nRounds: 1E6,

  // how many candidate solutions to keep track of
  // 
  // it makes sense for it to be 100 - 1500 ish
  // 
  // if you find that the algorithm gets stuck too quickly, increase it
  popSize: 300,

  // number of elite candidates (guaranteed to make it to next gene pool unaltered) 
  // 
  // 0.2 is 20%, 10 is 10
  // 
  // if you find that the algorithm gets stuck too quickly, decrease it
  nElite: { start:  0.05, end: 0.15 },

  pMutate: { start:  0.1, end: 0.01, whenFit: 'increases' },

  // when mutating, target at least ? genes
  nMutations: { start: 10, end: 1, whenFit: 'decreases' },

  // when mutating, the value of a gene is replaced with a random value
  // this specifies the range of the random value
  // 
  // set intelligently based on dtype so not necessary to tweak
  //
  // it might make sense for you to set it manually if you have an idea of
  // where in the search space the solution might be
  // this might cause it to converge faster
  randGeneVal: undefined,
 
  // when using multi-objective optimisation, you can specify relative weights for every objective (measured by each of fitness function from the array), see **FITNESS FUNCTION**
  weights: undefined,

  // keep track of improvements in previous rounds to detect local minima
  //
  // if you find that the algorithm gets stuck too quickly, increase it
  // TODO nTrack: 100,

  // used to detect being stuck local minima (no improvement),
  //
  // you should not need to change it
  // TODO minImprove: 1E-6,
}
```

For example:

```js
const opts = {
  timeOutMS: 30 * SEC,
  nElite: 0.1,
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
candidates and selects a portion of genes from one parent and the rest
from the other.

In an ideal scenario, you would inherit genes from fit individuals.
However, if you do that too often, you will loose novelty and you the
algorithm will get stuck very quickly. You can change how often fittest
candidates (elite) are chosen by changing `minPElite` and `maxPElite`.

**NOTE** `nElite` needs to be non-zero for this to work.

### Mutations

One of the two ways candidate solutions are modified. This is a **unary
operation**. It takes a single candidate and **randomly alters a single
gene.** Mutations introduce **novelty**. If your algorithm gets stuck too
quickly it's because there was not enough novelty. In an ideal scenario,
fittest candidates would undergo mutation whereas the least fit would use
crossover. Furthermore, ideally, the algorithm would explore the fitness
landscape more at the beginning and then exploit the discovered peaks at the
end of running the algorithm.  This implementation does both for you automatically.

### Population

Population is a collection of candidate solutions. An initial population with
`popSize = 5`, `nGenes = 2`, `dtype = 'u8'` might look something like this:

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

1. `"start"` after `.search()` and all initialisation is complete, before the 1st round
    - **Object** `opts` the algorithm is run with (you can use it to see if you configured it properly)

**Emitted on Stop Condition Met** <br>

1. `"timeout"` when `timeOutMS` limit is reached.
2. `"stuck"` when stuck in a local minimum.
3. `"rounds"` when `nRounds` limit reached.
4. `"end"` when finished.
    - **Object** `env`

**Emitted Every Round** <br>

1. `"round"` on every round start (**not** the same as `"rounds"`).
    - **Object** `env`
2. `"op"` on every selection and mutation / crossover operation application
    - **Object** `env`

Example of extracting data from signals:

```js
ga.on('start', opts => console.log('[START] with opts', opts))
ga.on('stuck', () => console.log(`[END] stuck`))
ga.on('timeout', () => console.log(`[END] timeout`))
ga.on('end', env => console.log(`[END] after round #${env.rIdx} (took ${env.timeTakenMS / SEC}sec)`))
```

More examples [here](https://github.com/nl253/GeneticAlgo-JS/tree/master/examples).

## Performance

- The bottleneck is the fitness function.
- Log less for better performance

## Downsides

- single-threaded (but see [parallel example](https://github.com/nl253/GeneticAlgo-JS/blob/master/examples/parallel.ts) that uses the cluster module from node stdlib).

## License

MIT
