// Symbolic execution — automatically solving the crackmes.
//
// Treat the input as a symbolic variable x and interpret a straight-line
// validator over it, building an expression tree for the accumulator instead of
// a concrete value. At the accept comparison the expression and the target form
// a path constraint; solving it over the input domain recovers the key the
// crackme accepts — the same key you would find by inverting the chain by hand,
// found by a tool instead.
import {Machine, CODE} from './machine.js';

const M32 = (1n << 32n) - 1n;

// Build the symbolic expression of the accumulator at the accept comparison.
export function symbolicConstraint(program, inputReg = 7) {
  const m = new Machine(program);
  const end = CODE + program.code.length;
  const regs = {[inputReg]: {op: 'x'}};
  const val = o => o.kind === 'imm' ? {op: 'k', v: Number(BigInt(o.value) & M32)}
    : (regs[o.id] ?? {op: 'k', v: 0});
  let cmp = null, constraint = null, addr = CODE;
  while (addr < end) {
    m.rip = BigInt(addr);
    let d; try { d = m.decode(); } catch (e) { break; }
    const [dst, src] = d.args || [];
    const w = (op) => { if (dst?.kind === 'reg') regs[dst.id] = {op, a: val(dst), b: val(src)}; };
    switch (d.name) {
      case 'mov': if (dst?.kind === 'reg') regs[dst.id] = val(src); break;
      case 'and': w('&'); break;
      case 'add': w('+'); break;
      case 'sub': w('-'); break;
      case 'shr': w('>>'); break;
      case 'shl': w('<<'); break;
      case 'imul': w('*'); break;
      case 'xor':
        if (dst?.kind === 'reg') regs[dst.id] = (src.kind === 'reg' && src.id === dst.id) ? {op: 'k', v: 0} : {op: '^', a: val(dst), b: val(src)};
        break;
      case 'cmp': cmp = {a: val(dst), b: val(src)}; break;
      case 'jcc': if (cmp && !constraint) constraint = cmp; break;  // accept path = equality of the guard
      case 'ret': addr = end; continue;
    }
    if (addr >= end) break;
    addr = Number(d.next);
  }
  return constraint;
}

export function evalExpr(e, x) {
  switch (e.op) {
    case 'x': return x & M32;
    case 'k': return BigInt(e.v) & M32;
    case '&': return (evalExpr(e.a, x) & evalExpr(e.b, x)) & M32;
    case '^': return (evalExpr(e.a, x) ^ evalExpr(e.b, x)) & M32;
    case '+': return (evalExpr(e.a, x) + evalExpr(e.b, x)) & M32;
    case '-': return (evalExpr(e.a, x) - evalExpr(e.b, x)) & M32;
    case '>>': return (evalExpr(e.a, x) >> evalExpr(e.b, x)) & M32;
    case '<<': return (evalExpr(e.a, x) << evalExpr(e.b, x)) & M32;
    case '*': return (evalExpr(e.a, x) * evalExpr(e.b, x)) & M32;
  }
  return 0n;
}

export function exprToString(e) {
  switch (e.op) {
    case 'x': return 'x';
    case 'k': return '0x' + (e.v >>> 0).toString(16);
    default: return '(' + exprToString(e.a) + ' ' + e.op + ' ' + exprToString(e.b) + ')';
  }
}

// Solve the constraint over an input domain of the given bit width.
export function solve(program, inputBits = 8, inputReg = 7) {
  const c = symbolicConstraint(program, inputReg);
  if (!c) return {constraint: null, solutions: []};
  const solutions = [];
  for (let x = 0; x < (1 << inputBits); x++) {
    if (evalExpr(c.a, BigInt(x)) === evalExpr(c.b, BigInt(x))) {
      solutions.push(x);
      if (solutions.length >= 6) break;
    }
  }
  return {constraint: c, expr: exprToString(c.a), target: exprToString(c.b), solutions};
}
