// Symbolic execution is checked by solving the crackmes the way a tool would:
// recover the path constraint over the input and solve it over the domain,
// landing on the same keys the hand solutions reach.
import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../src/machine.js';
import {solve} from '../src/symbolic.js';
import {lessons} from '../src/lessons.js';

const starter = id => lessons.find(l => l.id === id).starter;

test('recovers and solves the XOR chain', () => {
  const r = solve(assemble(starter('xor-key')), 8);
  assert.ok(r.solutions.includes(114), 'finds the accepting byte 114');
  assert.match(r.expr, /\^/, 'the constraint shows the XOR operations');
});

test('inverts the multiply-and-mask hash', () => {
  const r = solve(assemble(starter('rolling-hash')), 8);
  assert.deepEqual(r.solutions, [173]);
  assert.match(r.expr, /\*/, 'the constraint shows the multiply');
});

test('finds the whole checksum family, not one key', () => {
  const r = solve(assemble(starter('checksum-gate')), 16);
  assert.ok(r.solutions.length >= 2, 'a checksum has many keys');
  for (const x of r.solutions) assert.equal((x & 0xff) + ((x >> 8) & 0xff), 0x40, 'each solution satisfies the sum');
});
