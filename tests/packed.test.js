// Hermetic packed-SSE tests: assemble raw instruction bytes, set the XMM inputs
// directly, step once, and check the lanes. No gcc needed, so these run in CI on
// every platform and pin the pure-JS lane arithmetic that the gcc differential
// (compiled_check.mjs) also exercises end-to-end.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Machine,programFromImage,splitLanes,packLanes,f32ToBits,f64ToBits,bitsToF32,bitsToF64,CODE,unsigned} from '../src/machine.js';

const prog=hex=>programFromImage({codeHex:hex,entry:CODE});
const i32=(...v)=>packLanes(v.map(x=>unsigned(BigInt(x),32)),32);
const i16=(...v)=>packLanes(v.map(x=>unsigned(BigInt(x),16)),16);
const f32v=(...v)=>packLanes(v.map(f32ToBits),32);
const f64v=(...v)=>packLanes(v.map(f64ToBits),64);
// one instruction, given XMM0/XMM1 (and RAX), returns XMM0 after a single step
const step1=(hex,{x0=0n,x1=0n,rax=0n}={})=>{const m=new Machine(prog(hex));m.xmm[0]=x0;m.xmm[1]=x1;m.regs[0]=rax;m.step();assert.equal(m.status,'paused',m.reason);return m;};

test('splitLanes/packLanes round-trip at every lane width',()=>{
 for(const w of [8,16,32,64]){const v=0x0f1e2d3c4b5a6978n^(1n<<120n);assert.equal(packLanes(splitLanes(v,w),w),unsigned(v,128));}
});
test('paddd adds four 32-bit lanes with wraparound',()=>{
 const m=step1('660ffec1',{x0:i32(1,2,3,0xffffffff),x1:i32(10,20,30,2)});
 assert.equal(m.xmm[0],i32(11,22,33,1));
});
test('psubw subtracts eight 16-bit lanes independently',()=>{
 const m=step1('660ff9c1',{x0:i16(5,0,100,7,1,2,3,4),x1:i16(1,1,1,1,1,1,1,1)});
 assert.equal(m.xmm[0],i16(4,0xffff,99,6,0,1,2,3));
});
test('paddq adds two 64-bit lanes',()=>{
 const m=step1('660fd4c1',{x0:packLanes([5n,10n],64),x1:packLanes([100n,200n],64)});
 assert.equal(m.xmm[0],packLanes([105n,210n],64));
});
test('pand / por / pxor operate over the full 128 bits',()=>{
 const a=i32(0xff00ff00,0x0f0f0f0f,0xffffffff,0),b=i32(0x0ff00ff0,0xf0f0f0f0,0x12345678,0x9abcdef0);
 assert.equal(step1('660fdbc1',{x0:a,x1:b}).xmm[0],unsigned(a&b,128));
 assert.equal(step1('660febc1',{x0:a,x1:b}).xmm[0],unsigned(a|b,128));
 assert.equal(step1('660fefc1',{x0:a,x1:b}).xmm[0],unsigned(a^b,128));
});
test('addps adds four floats; mulpd multiplies two doubles',()=>{
 assert.equal(step1('0f58c1',{x0:f32v(1,2,3,4),x1:f32v(10,20,30,40)}).xmm[0],f32v(11,22,33,44));
 assert.equal(step1('660f59c1',{x0:f64v(3,4),x1:f64v(1.5,2.5)}).xmm[0],f64v(4.5,10));
});
test('divps rounds per IEEE-754 single precision',()=>{
 const m=step1('0f5ec1',{x0:f32v(1,1,7,10),x1:f32v(3,7,2,4)});
 const got=splitLanes(m.xmm[0],32).map(bitsToF32);
 assert.equal(got[0],Math.fround(1/3));assert.equal(got[2],3.5);
});
test('pshufd selects dwords by the immediate (0x1b reverses)',()=>{
 const m=step1('660f70c11b',{x1:i32(100,200,300,400)});
 assert.equal(m.xmm[0],i32(400,300,200,100));
});
test('punpckldq / unpcklpd interleave low lanes',()=>{
 assert.equal(step1('660f62c1',{x0:i32(1,2,3,4),x1:i32(10,20,30,40)}).xmm[0],i32(1,10,2,20));
 assert.equal(step1('660f14c1',{x0:f64v(1,2),x1:f64v(10,20)}).xmm[0],f64v(1,10));
});
test('movd loads a GPR into the low dword and zeroes the rest',()=>{
 const m=step1('660f6ec0',{x0:i32(9,9,9,9),rax:0xdeadbeefn});
 assert.equal(m.xmm[0],i32(0xdeadbeef,0,0,0));
});
test('cvtdq2ps converts four signed int lanes to floats',()=>{
 const m=step1('0f5bc1',{x1:i32(1,-2,3,-4)});
 assert.equal(m.xmm[0],f32v(1,-2,3,-4));
});
test('cvttps2dq truncates toward zero with the integer-indefinite on overflow',()=>{
 const m=step1('f30f5bc1',{x1:f32v(2.9,-2.9,1e30,0.5)});
 assert.deepEqual(splitLanes(m.xmm[0],32),[2n,unsigned(-2n,32),0x80000000n,0n]);
});
