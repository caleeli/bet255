import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { impliedProbability } from '../../backend/odds.js';

describe('impliedProbability', () => {
  it('converts decimal odds to a rounded probability', () => {
    assert.equal(impliedProbability(2.5), 0.4);
    assert.equal(impliedProbability(3), 0.3333);
  });

  it('rejects invalid odds', () => {
    assert.throws(() => impliedProbability(1), RangeError);
    assert.throws(() => impliedProbability(Number.NaN), TypeError);
  });
});
