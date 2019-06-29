#!/usr/bin/env node
/**
 * This example shows how combinatorial timetabling problems may be
 * solved using GAs.
 *
 * The task is to plan the day in the most optimal manner.
 *
 * A good plan will:
 *
 * 1. interleave physically and mentally demanding activities
 * 2. allow for activities that help to recover mental and physical energy
 * 3. not repeat the same activities
 * 4. not allow for high level of tiredness
 * 5. not rest beyond what is needed to recover
 */
import * as util                              from 'util';
import { GeneticAlgorithm as GA, TypedArray } from '../index';

type TaskArgs = { efficacy?: number, name?: string, mental?: number, physical?: number, duration?: number };

class Task {
  public readonly mental: number   = 0;
  public readonly physical: number = 0;
  public readonly duration: number = 30;
  public readonly name: string;

  constructor({ mental, physical, duration, name }: TaskArgs) {
    // @ts-ignore
    this.mental   = mental;
    // @ts-ignore
    this.physical = physical;
    // @ts-ignore
    this.duration = duration;
    // @ts-ignore
    this.name     = name;
  }

  get efficacy(): number {
    return (this.mental + this.physical) / this.duration;
  }

  toString(): string {
    // @ts-ignore
    return `${this.name} ${this.duration}min { mental ${this.mental}, physical ${this.physical}, efficacy ${this.efficacy} }`;
  }

  [util.inspect.custom](): string {
    return this.toString();
  }
}

// meal = eat + cook
const TASKS = [
  new Task({
             name:     'listen to an audiobook1',
             physical: 0.2,
             mental:   0.25,
             duration: 60,
           }),
  new Task({
             name:     'listen to an audiobook2',
             physical: 0.2,
             mental:   0.25,
             duration: 60,
           }),
  new Task({
             name:     'have a meal1',
             physical: -0.2,
             mental:   0.2,
             duration: 60,
           }),
  new Task({
             name:     'grocery shopping',
             physical: -0.6,
             mental:   0.3,
             duration: 120,
           }),
  new Task({
             name:     'take a shower',
             physical: 0.15,
             mental:   -0.1,
             duration: 30,
           }),
  new Task({
             duration: 30,
             physical: -0.25,
             mental:   0.2,
             name:     'tidy up',
           }),
  new Task({
             duration: 60,
             physical: -0.25,
             mental:   0,
             name:     'have a meal3',
           }),
  new Task({
             duration: 60,
             physical: 0.2,
             mental:   -0.6,
             name:     'explore1',
           }),
  new Task({
             duration: 90,
             physical: 0.2,
             mental:   -0.6,
             name:     'explore2',
           }),
  new Task({
             duration: 45,
             physical: -0.1,
             mental:   0,
             name:     'have a meal2',
           }),
  new Task({
             duration: 30,
             physical: 0.15,
             mental:   0.4,
             name:     'medidate1',
           }),
  new Task({
             duration: 30,
             physical: 0.15,
             mental:   0.4,
             name:     'medidate2',
           }),
  new Task({
             duration: 15,
             physical: 0.1,
             mental:   0.1,
             name:     'call mum',
           }),
  new Task({
             duration: 10,
             physical: 0.1,
             mental:   -0.1,
             name:     'check mail',
           }),
  new Task({
             duration: 90,
             physical: 0.2,
             mental:   -0.6,
             name:     'work on personal project',
           }),
  new Task({
             duration: 90,
             physical: 0.2,
             mental:   -0.6,
             name:     'read1',
           }),
  new Task({
             duration: 60,
             physical: 0.2,
             mental:   -0.6,
             name:     'read2',
           }),
  new Task({
             duration: 30,
             physical: 0.2,
             mental:   0.2,
             name:     'socialise',
           }),
  new Task({
             duration: 120,
             physical: -1,
             mental:   0.6,
             name:     'gym',
           }),
  new Task({
             duration: 90,
             physical: -0.15,
             mental:   0.4,
             name:     'go out for a walk',
           }),
];

/**
 * Initialise pop to rand permutations.
 */
function fitness(cand: TypedArray): number {
  // base score
  let score = 10;
  // keep track of energy
  // 1.2 is what you wake up with
  let mentalE   = 1.2;
  let physicalE = 1.2;
  console.log(`wake up, day start with [ph = ${physicalE}, m = ${mentalE}]`);
  for (let i = 0; i < cand.length; i++) {
    const { name, physical, mental } = TASKS[cand[i]];
    mentalE += mental;
    physicalE += physical;
    let msg                          = '';
    if (physicalE > 1) {
      const delta = -(physicalE - 1) * 4;
      score += delta;
      msg += `penalised physical energy by ${delta.toFixed(2)} because >1`;
    } else if (physicalE < 0) {
      const delta = (physicalE - 0.1) * 3;
      score += delta;
      msg += `penalised physical energy by ${delta.toFixed(2)} because <0`;
    } else {
      const delta = Math.abs(mentalE - physicalE) * 2; // when 1 is high, 2 is low
      score += delta;
      msg += `added ${delta.toFixed(2)} for physical energy`;
    }
    if (mentalE > 1) {
      const delta = -(mentalE - 1) * 4;
      score += delta;
      msg += `, penalised mental energy by ${delta.toFixed(2)} because >1`;
    } else if (mentalE < 0) {
      const delta = (mentalE - 0.1) * 3;
      score += delta;
      msg += `, penalised mental energy by ${delta.toFixed(2)} because <0`;
    } else {
      const delta = Math.abs(mentalE - physicalE) * 2; // when 1 is high, 2 is low
      score += delta;
      msg += `, added ${delta.toFixed(2)} score for mental energy`;
    }
    if (i > 0 && TASKS[cand[i - 1]].name.startsWith(name.slice(0, name.length - 1))) {
      const delta = -3;
      score += delta;
      msg += `, penalised by ${delta.toFixed(2)} for repetition of ${name} and ${TASKS[cand[i - 1]].name}`;
    }
    {
      // meals spread thought the day
      const m1Idx = cand.findIndex((idx: number) => TASKS[idx].name === 'have a meal1');
      const m2Idx = cand.findIndex((idx: number) => TASKS[idx].name === 'have a meal2');
      const m3Idx = cand.findIndex((idx: number) => TASKS[idx].name === 'have a meal3');

      const deltaMeal1 = Math.min(Math.abs(m1Idx - m2Idx), Math.abs(m1Idx - m3Idx));

      score += deltaMeal1;
      msg += `, score for spread of meal #1 (${deltaMeal1.toFixed(2)})`;
      const deltaMeal2 = Math.min(Math.abs(m2Idx - m1Idx), Math.abs(m2Idx - m3Idx));
      score += deltaMeal2;
      msg += `, score for spread of meal #2 (${deltaMeal2.toFixed(2)})`;
    }

    console.log(`after ${name.padStart(30)} [ph = ${physicalE.toFixed(2).toString().padStart(5)}, m = ${mentalE.toFixed(2).toString().padStart(5)}] ${msg}`);
  }
  return score;
}

class MyGA extends GA {
  /**
   * Swap two genes. (custom operator)
   */
  protected mutate(nMutations: number): void {
    const offset = this.nGenes * this.cIdx;
    for (let i = 0; i < nMutations; i++) {
      const g1 = Math.floor(Math.random() * this.nGenes);
      let g2;
      do { g2 = Math.floor(Math.random() * this.nGenes); } while (g1 === g2);
      const tmp             = this.pop[offset + g1];
      const tmp2            = this.pop[offset + g2];
      this.pop[offset + g2] = tmp;
      this.pop[offset + g1] = tmp2;
    }
  }

  protected createPop(): TypedArray {
    // const pop = arrays[this.dtype](this.popSize * this.nGenes);
    const arr = Array(this.nGenes).fill(0).map((_, idx) => idx);

    function shuffle() {
      // source: https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
      var j, x, i;
      for (i = arr.length - 1; i > 0; i--) {
        j      = Math.floor(Math.random() * (i + 1));
        x      = arr[i];
        arr[i] = arr[j];
        arr[j] = x;
      }
    }

    for (let i = 0; i < this.nGenes; i++) {
      this.pop[i] = arr[i];
    }
    for (let cIdx = 1; cIdx < this.popSize; cIdx++) {
      const offset = cIdx * this.nGenes;
      shuffle();
      for (let gIdx = 0; gIdx < this.nGenes; gIdx++) {
        this.pop[offset + gIdx] = arr[gIdx];
      }
    }
  }
}

const ga = new GA(fitness, TASKS.length, 'u8', {
  nTrack:     10000,
  nMutations: [2, 1],
  timeOutMS:  30 * 1000,
  pMutate:    1.0,
  logLvl:     1,
});

console.log([...ga.search()].slice(0, 10).map(cfg => {
  return Array.from(cfg).map(gIdx => {
    const { name } = TASKS[gIdx];
    return name;
  });
}));
