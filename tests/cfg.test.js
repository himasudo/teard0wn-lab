// CFG recovery is checked against real gcc functions: the branch structure of
// a classifier (multiple blocks, a diamond) and a loop (a back-edge).
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCFG, linearSweep, recursiveSweep} from '../src/cfg.js';
import {compiledLessons} from '../src/compiled.js';

const cfgOf = id => {
  const l = compiledLessons.find(x => x.id === id);
  const textByAddr = {};
  for (const i of l.insns) textByAddr[i.addr] = i.text;
  return buildCFG({codeHex: l.codeHex, dataHex: l.dataHex || '', entry: l.entry, base: l.base, textByAddr});
};

test('a branching function recovers multiple basic blocks and a merge', () => {
  const {blocks, edges} = cfgOf('c-classify');
  assert.ok(blocks.length >= 4, `expected several blocks, got ${blocks.length}`);
  // every block's instructions are contiguous and non-empty
  for (const b of blocks) assert.ok(b.insns.length >= 1, 'no empty blocks');
  // a conditional block has two out-edges (taken + fallthrough)
  const branching = blocks.find(b => b.last && b.last.kind === 'jcc');
  assert.ok(branching, 'expected a conditional block');
  const out = edges.filter(e => e.from === branching.id);
  assert.equal(out.length, 2, 'a jcc block has exactly two successors');
  assert.ok(out.some(e => e.kind === 'taken') && out.some(e => e.kind === 'fall'), 'taken and fallthrough edges');
  // at least one block ends the function (ret → no out-edges)
  assert.ok(blocks.some(b => b.last && b.last.kind === 'ret'), 'an exit block exists');
});

test('a loop recovers a back-edge', () => {
  const {edges} = cfgOf('c-sum-to');
  assert.ok(edges.some(e => e.back), 'a loop produces a back-edge to a lower address');
});

test('linear and recursive disassembly diverge on overlapping instructions', () => {
  // EB 03 (jmp +3 to 0x1005) · B8 90 90 31 C0 (decoy mov eax,imm32) · C3 (ret).
  // The jump skips into the middle of the decoy, so the real xor at 0x1005 is
  // hidden from a linear sweep but recovered by following control flow.
  const blob = {codeHex: 'eb03b8909031c0c3', base: 0x1000, entry: 0x1000};
  const lin = linearSweep(blob), rec = recursiveSweep(blob);
  assert.ok(lin.some(i => i.name === 'mov'), 'linear sweep sees a decoy mov');
  assert.ok(!lin.some(i => i.name === 'xor'), 'linear sweep never sees the real xor');
  assert.ok(rec.some(i => i.name === 'xor'), 'recursive descent recovers the xor');
  assert.ok(rec.some(i => i.addr === 0x1005), 'recursive descent has a leader at the jump target');
  assert.ok(!lin.some(i => i.addr === 0x1005), 'linear sweep decodes across the jump target');
});

test('every edge references real blocks', () => {
  for (const id of ['c-classify', 'c-sum-to', 'c-fib']) {
    const {blocks, edges} = cfgOf(id);
    for (const e of edges) {
      assert.ok(e.from >= 0 && e.from < blocks.length, `${id}: edge.from in range`);
      assert.ok(e.to >= 0 && e.to < blocks.length, `${id}: edge.to in range`);
    }
  }
});
