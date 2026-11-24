// Address translation is checked against hand-computed walks: the index split,
// a successful translation to a physical address, and page faults at each
// level where the walk hits a not-present entry.
import test from 'node:test';
import assert from 'node:assert/strict';
import {split, translate, sampleHierarchy} from '../src/paging.js';

test('a virtual address splits into four indices and an offset', () => {
  const s = split(0x401678);
  assert.deepEqual(s.indices, [0, 0, 2, 1]);
  assert.equal(s.offset, 0x678);
});

test('a mapped address translates to its physical address', () => {
  const r = translate(0x401678, sampleHierarchy);
  assert.ok(r.ok);
  assert.equal(r.frame, 0x1a3);
  assert.equal(r.phys, 0x1a3678n, 'frame << 12 | offset');
  assert.equal(r.steps.length, 4, 'all four levels walked');
  // the sibling page shares the first three levels, differs in the PT entry
  assert.equal(translate(0x402abc, sampleHierarchy).phys, 0x1a4abcn);
});

test('a not-present entry faults at the right level', () => {
  assert.equal(translate(0x405000, sampleHierarchy).faultLevel, 'PT');   // PT index 5 absent
  assert.equal(translate(0x600000, sampleHierarchy).faultLevel, 'PD');   // PD index 3 absent
  assert.equal(translate(0x8000000000, sampleHierarchy).faultLevel, 'PML4'); // PML4 index 1 absent
  assert.equal(translate(0x405000, sampleHierarchy).ok, false);
});
