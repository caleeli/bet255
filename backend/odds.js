export function impliedProbability(decimalOdd) {
  if (typeof decimalOdd !== 'number' || !Number.isFinite(decimalOdd)) {
    throw new TypeError('decimalOdd must be a finite number');
  }

  if (decimalOdd <= 1) {
    throw new RangeError('decimalOdd must be greater than 1');
  }

  return Number((1 / decimalOdd).toFixed(4));
}
