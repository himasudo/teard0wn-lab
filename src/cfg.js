// Control-flow-graph recovery.
//
// Given a function's machine-code bytes, recover its basic blocks and the
// edges between them the way a disassembler does: decode linearly, find the
// block leaders (the entry, every branch target, and every instruction that
// follows a branch or return), cut the instruction stream at those leaders,
// and connect each block to its successors. This is the structure every
// decompiler and RE tool builds before it can reason about a function.
import {Machine, programFromImage} from './machine.js';

export function buildCFG({codeHex, dataHex = '', entry, base, textByAddr = {}}) {
  const m = new Machine(programFromImage({codeHex, dataHex, entry}));
  const end = base + codeHex.length / 2;
  const insns = [];
  let addr = base;
  while (addr < end) {
    m.rip = BigInt(addr);
    let d;
    try { d = m.decode(); } catch (e) { break; }
    const next = Number(d.next);
    let kind = 'normal', target = null, cond = null;
    if (d.name === 'jmp') { kind = 'jmp'; target = Number(d.args[0].value); }
    else if (d.name === 'jcc') { kind = 'jcc'; target = Number(d.args[0].value); cond = d.args[1] && d.args[1].condition; }
    else if (d.name === 'ret') { kind = 'ret'; }
    else if (d.name === 'call') { kind = 'call'; if (d.args[0] && d.args[0].value !== undefined) target = Number(d.args[0].value); }
    insns.push({addr, next, kind, target, cond, text: textByAddr[addr] || d.name});
    if (next <= addr) break;
    addr = next;
  }
  if (!insns.length) return {blocks: [], edges: []};

  const present = new Set(insns.map(i => i.addr));
  const leaders = new Set([insns[0].addr]);
  for (const i of insns) {
    if (i.kind === 'jmp' || i.kind === 'jcc') {
      if (present.has(i.target)) leaders.add(i.target);
      if (present.has(i.next)) leaders.add(i.next);
    } else if (i.kind === 'ret') {
      if (present.has(i.next)) leaders.add(i.next);
    }
  }
  const leaderList = [...leaders].sort((a, b) => a - b);

  const blocks = leaderList.map((la, bi) => {
    const lb = leaderList[bi + 1] ?? end;
    const bins = insns.filter(i => i.addr >= la && i.addr < lb);
    return {id: bi, addr: la, insns: bins, last: bins[bins.length - 1]};
  });
  const blockAt = a => blocks.findIndex(b => b.addr === a);

  const edges = [];
  for (const b of blocks) {
    const last = b.last;
    if (!last || last.kind === 'ret') continue;
    if (last.kind === 'jmp') {
      const t = blockAt(last.target);
      if (t >= 0) edges.push({from: b.id, to: t, kind: 'jump'});
    } else if (last.kind === 'jcc') {
      const t = blockAt(last.target);
      if (t >= 0) edges.push({from: b.id, to: t, kind: 'taken', label: last.cond});
      const f = blockAt(last.next);
      if (f >= 0) edges.push({from: b.id, to: f, kind: 'fall'});
    } else {
      const f = blockAt(last.next);
      if (f >= 0) edges.push({from: b.id, to: f, kind: 'fall'});
    }
  }
  // A back-edge points to a block at a lower address: the mark of a loop.
  for (const e of edges) e.back = blocks[e.to].addr < blocks[e.from].addr;
  return {blocks, edges};
}
