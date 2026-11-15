// Structure recovery is checked against the layouts gcc actually produced for
// the example structs: the right fields, the right total size, and the padding
// holes alignment forces.
import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverStruct} from '../src/types.js';
import {typeExamples} from '../src/typedata.js';

const ex = id => typeExamples.find(e => e.id === id);

test('a node (pointer, two ints, a char) recovers with trailing padding', () => {
  const {fields, size, align} = recoverStruct(ex('node').accesses);
  assert.equal(size, 24, 'sizeof matches gcc');
  assert.equal(align, 8, 'pointer forces 8-byte alignment');
  const real = fields.filter(f => !f.pad);
  assert.deepEqual(real.map(f => [f.off, f.size]), [[0, 8], [8, 4], [12, 4], [16, 1]]);
  assert.match(real[0].type, /pointer/);
  // a byte at offset 16 leaves 7 bytes of tail padding
  assert.ok(fields.some(f => f.pad && f.off === 17 && f.size === 7), 'tail padding recovered');
});

test('a header declared small-to-large recovers interior padding holes', () => {
  const {fields, size} = recoverStruct(ex('packet').accesses);
  assert.equal(size, 24);
  const pads = fields.filter(f => f.pad);
  assert.ok(pads.some(f => f.off === 1 && f.size === 3), 'padding after the char');
  assert.ok(pads.some(f => f.off === 10 && f.size === 6), 'padding before the 8-byte field');
});

test('every example carries its source for the reveal', () => {
  for (const e of typeExamples) {
    assert.ok(e.accesses.length >= 2, `${e.id} has an access trace`);
    assert.match(e.csource, /struct/, `${e.id} keeps its C source`);
  }
});
