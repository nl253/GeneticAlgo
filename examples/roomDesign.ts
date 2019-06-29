#!/usr/bin/env node
/**
 * TODO
 * This is an example where the task is to automatically design a room layout.
 */
import { GeneticAlgorithm as GA } from '../index';

const SEC = 1000;

// we have an X by Y room with a:
// - TV        2x1
// - bed       3x2
// - couch     3x1
// - desk      2x1
// - mirror    1x1
// - plant     1x1
// - waredrobe 2x1

// each candidate is a spec for all object including rotation
// couch: [..., startPointX, startPointY, isRotated ,...]

const [roomX, roomY] = [40, 25];

const sizes = [
  [2, 1],
  ...
];
const order = ['tv', 'bed', 'couch', 'desk', 'mirror', 'plant', 'waredrobe'];

function decode(xs) {
  const o = {};
  for (let i = 0; i < order.length; i++) {
    o[order[i]] = {
      x: xs[i * 3],
      y: xs[i * 3 + 1],
      isRot: (xs[i * 3 + 2] % 2) === 0,
    };
  }
  return o;
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2)**2 + (y1 - y2)**2);
}

// factors:
// 1. cannot overlap
// 2. {mirror, waredrobe, bed} close to walls not in the center of the room
// 3. space between everything that is > 1x1
// 4. spread out across the room
// 5. bed far away from the TV
// 6. TV face the couch
// 7. couch away from the desk
const fitness = xs => {
  return 0;
}

const dtype = 'u8';
const nGenes = 7 * 3;

const opts = { timeOutMS: 30 * SEC };

const ga = new GA(fitness, nGenes, dtype, opts);

// [OPTIONAL] use the EventEmitter API for getting profiling
ga.on('best', (bestIdx, fitness) => console.log('score', fitness));

/* ga.search() will create a generator that iterates over the best population
 * if you want the best candidate, just request the very first: */
[...ga.search()].map(pprint);
