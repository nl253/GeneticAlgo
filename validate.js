const { MIN_POPSIZE, MIN_NTRACK, MIN_NELITE } = require('./defaults');
const { DTYPES }                              = require('./dtype');

/**
 * @param {!Array<FitnessFunct>|!FitnessFunct} fitness
 * @param {!Number} nGenes
 * @param {'f64'|'f32'|'i32'|'i16'|'i8'|'u32'|'u16'|'u8'} dtype
 * @param {!Opts} opts
 */
function validate(fitness, nGenes, dtype, opts) {

  // validation on `f`, `nGenes` and `dtype`
  for (const v of ['fitness', 'dtype', 'nGenes']) {
    if (eval(v) === undefined) {
      throw new Error(`you MUST set ${v}`);
    }
  }

  if (nGenes.constructor.name !== 'Number' || !Number.isInteger(nGenes)) {
    throw new Error('nGenes MUST be an Int');
  }

  if (nGenes < 1) {
    throw new Error('nGenes MUST be at least 1');
  }

  if (!DTYPES.has(dtype)) {
    throw new Error(`unrecognised dtype "${dtype}", choose from: ${Array.from(DTYPES).join(', ')}`);
  }

  // for (const f of fitness) {
  //   if (f.constructor.name !== 'Function') {
  //     throw new Error(`fitness function must be a Function or an Array of Functions`);
  //   }
  // }


  /**
   * @param {*} v value
   * @param {!Function} p predicate
   * @param {!String} msg
   */
  const assert = (v, p, msg) => {
    if (opts[v] !== undefined && !p(opts[v])) {
      throw new Error(msg);
    }
  };

  const assNum = vName => assert(vName, n => n.constructor.name === 'Number', `${vName} must be a Number`);
  // const assProb = vName => assert(vName, p => p >= 0 && p <= 1, `${vName} is a probability so it MUST be BETWEEN 0 AND 1`);
  const assPos = vName => assert(vName, val => val >= 0, `${vName} MUST be positive`);
  const assInt = vName => assert(vName, n => Number.isInteger(n), `${vName} MUST be an integer`);
  // const assFloat = vName => assert(vName, n => !Number.isInteger(n), `${vName} MUST be a float`);
  const assLTE = (vName, n) => assert(vName, val => val <= n, `${vName} MUST be less than or equal to ${n}`);
  // const assLE = (vName, n) => assert(vName, val => val < n, `${vName} MUST be less than ${n}`);
  const assGTE = (vName, n) => assert(vName, val => val >= n, `${vName} MUST be greater than or equal to ${n}`);
  // const assGT = (vName, n) => assert(vName, val => val > n, `${vName} MUST be greater than ${n}`);

  for (const vName of [
    'logging.js',
    'maxNMutations',
    'minImprove',
    'minNMutations',
    'nElite',
    'nRounds',
    'nTrack',
    'popSize',
    'timeOutMS',
  ]) {
    assNum(vName);
    assPos(vName);
  }

  for (const vName of [
    'logging.js',
    'maxNMutations',
    'minNMutations',
    'nRounds',
    'nTrack',
    'popSize',
    'timeOutMS',
  ]) {
    assNum(vName);
    assInt(vName);
  }

  assGTE('popSize', MIN_POPSIZE);
  assGTE('nTrack', MIN_NTRACK);

  if (opts.nElite !== undefined && opts.popSize !== undefined && opts.nElite > opts.popSize) {
    throw new Error('nElite CANNOT be greater than popSize');
  }

  assert('nElite', nElite => Number.isInteger(nElite) || nElite <= 1, 'nElite must be EITHER an Int specifying the number of elite candidate OR a ratio, a Float between 0 and 1');
  assert('nElite', nElite => !Number.isInteger(nElite) || nElite >= MIN_NELITE, `nElite MUST be a ratio 0..1 OR an in greater than or equal to ${MIN_NELITE}`);

  assLTE('minNMutations', nGenes);
  assGTE('minNMutations', 1);

  assert('minRandVal', minRandVal => !dtype.startsWith('u') || minRandVal >= 0, 'minRandVal CANNOT be negative when using unsigned integers (UintArray)');
  if (opts.minRandVal !== undefined && opts.maxRandVal !== undefined && opts.minRandVal > opts.maxRandVal) {
    throw new Error('minRandVal CANNOT be greater than `maxRandVal`');
  }

  // for (const k of Object.keys(opts)) {
  //   if (DEFAULTS[k] === undefined) {
  //     throw new Error(`unrecognized option ${k}`);
  //   }
  // }

}

module.exports = validate;
