// The sanitizer must accept in-bounds accesses and flag the ones that leave the
// allocation — including the one-past read that lands in mapped memory and that
// the CPU would never fault on.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildShadow, checkAccess} from '../src/asan.js';

const shadow = buildShadow({redzone: 16, alloc: 20});

test('an in-bounds access is clean', () => {
  assert.equal(checkAccess(shadow, 0, 8).kind, 'ok');
  assert.equal(checkAccess(shadow, 12, 8).kind, 'ok');   // bytes 12..19, last valid
});

test('one past the end is a heap overflow into the redzone', () => {
  const r = checkAccess(shadow, 16, 4);                  // bytes 16..19 valid? alloc=20 so 16..19 ok
  assert.equal(r.kind, 'ok');
  const r2 = checkAccess(shadow, 17, 4);                 // 17..20, byte 20 is redzone
  assert.equal(r2.kind, 'overflow');
  assert.equal(checkAccess(shadow, 20, 1).kind, 'overflow'); // fully past the end
});

test('reading before the allocation is a heap underflow', () => {
  assert.equal(checkAccess(shadow, -1, 1).kind, 'underflow');
  assert.equal(checkAccess(shadow, -8, 8).kind, 'underflow');
});

test('the shadow frames the allocation in redzones', () => {
  assert.equal(shadow.allocBase, 16);
  assert.equal(shadow.bytes.filter(b => b.zone === 'alloc').length, 20);
  assert.equal(shadow.bytes[15].zone, 'redzone');
  assert.equal(shadow.bytes[16].zone, 'alloc');
});
