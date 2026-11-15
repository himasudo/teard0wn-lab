// CFG recovery is checked against real gcc functions: the branch structure of
// a classifier (multiple blocks, a diamond) and a loop (a back-edge).
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCFG} from '../src/cfg.js';
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

test('every edge references real blocks', () => {
  for (const id of ['c-classify', 'c-sum-to', 'c-fib']) {
    const {blocks, edges} = cfgOf(id);
    for (const e of edges) {
      assert.ok(e.from >= 0 && e.from < blocks.length, `${id}: edge.from in range`);
      assert.ok(e.to >= 0 && e.to < blocks.length, `${id}: edge.to in range`);
    }
  }
});
