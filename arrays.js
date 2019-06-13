const bitRegex = /8|16|32|64/;

/**
 * Get typed array constructor from string dtype.
 *
 * @param {!DType} dtype
 * @returns {Float32ArrayConstructor|Float64ArrayConstructor|Int8ArrayConstructor|Int16ArrayConstructor|Int32ArrayConstructor|Uint8ArrayConstructor|Uint16ArrayConstructor|Uint32ArrayConstructor|never} constructor
 * @private
 */
function getConst(dtype) {
  if (dtype.toLowerCase() !== dtype) {
    return getConst(dtype.toLowerCase());
  }
  const nBits = bitRegex.exec(dtype)[0];
  if (dtype.startsWith('f')) {
    return eval(`Float${nBits}Array`);
  } else if (dtype.startsWith('i')) {
    return eval(`Int${nBits}Array`);
  } else if (dtype.startsWith('u')) {
    return eval(`Uint${nBits}Array`);
  } else {
    throw new Error(`unrecognised dtype "${dtype}"`);
  }
}

module.exports = {
  getConst,
  DTYPES: new Set(['f64', 'f32', 'u32', 'u16', 'u8', 'i32', 'i16', 'i8']),
  f32: n => new Float32Array(new ArrayBuffer(4 * n)),
  f64: n => new Float64Array(new ArrayBuffer(8 * n)),
  i32: n => new Int32Array(new ArrayBuffer(4 * n)),
  u32: n => new Uint32Array(new ArrayBuffer(4 * n)),
  i16: n => new Int16Array(new ArrayBuffer(4 * n)),
  u16: n => new Uint16Array(new ArrayBuffer(4 * n)),
  i8: n => new Int8Array(new ArrayBuffer(4 * n)),
  u8: n => new Uint8Array(new ArrayBuffer(4 * n)),
};
