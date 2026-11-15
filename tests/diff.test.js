// Patch-analysis diff is checked against the real vulnerable/patched builds:
// an added bounds check is purely additive; a signedness fix is a changed
// comparison (some removed, some added).
import test from 'node:test';
import assert from 'node:assert/strict';
import {diffInsns, diffStats, normalize} from '../src/diff.js';
import {diffPairs} from '../src/diffpairs.js';

const pair = id => diffPairs.find(p => p.id === id);

test('normalize collapses shifted jump targets and annotations', () => {
  assert.equal(normalize('jmp 1041 <pick+0x41>'), normalize('jmp 1044 <pick+0x44>'));
  assert.notEqual(normalize('jle 1038 <pick+0x38>'), normalize('jbe 103b <pick+0x3b>'));
});

test('an added bounds check is a purely additive diff', () => {
  const p = pair('bounds-patch');
  const s = diffStats(diffInsns(p.a.insns, p.b.insns));
  assert.equal(s.removed, 0, 'nothing removed');
  assert.ok(s.added >= 2, 'the check is added');
  // the added lines include a compare and a conditional branch
  const added = diffInsns(p.a.insns, p.b.insns).filter(r => r.kind === 'add').map(r => r.b.text).join('\n');
  assert.match(added, /\bcmp\b/);
  assert.match(added, /\bj[a-z]+\b/);
});

test('a signedness fix changes the comparison (removed and added)', () => {
  const p = pair('signed-patch');
  const s = diffStats(diffInsns(p.a.insns, p.b.insns));
  assert.ok(s.removed >= 1 && s.added >= 1, 'a branch is swapped, not just inserted');
  const removed = diffInsns(p.a.insns, p.b.insns).filter(r => r.kind === 'del').map(r => r.a.text).join('\n');
  assert.match(removed, /jle|jg/, 'the signed branch is removed');
});

test('both pairs expose the two builds', () => {
  for (const p of diffPairs) {
    assert.ok(p.a.insns.length && p.b.insns.length, `${p.id} has both builds`);
    assert.ok(p.note && p.title, `${p.id} has a note and title`);
  }
});
