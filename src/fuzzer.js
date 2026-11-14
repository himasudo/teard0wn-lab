// A small coverage-guided fuzzer over the engine. It runs a compiled target
// with a 32-bit input in EDI, records the set of instruction addresses the run
// executed as its coverage, and keeps any input that reached a new address.
// Mutating from that growing corpus lets it fall through byte-at-a-time gates
// that blind random search could never pass. A crash is an engine fault
// (out-of-bounds access, divide by zero, ...).
import {Machine,programFromImage,unsigned} from './machine.js';

// Execute one input; return the covered instruction addresses and whether it faulted.
export function coverageRun(program,input){
  const m=new Machine(program,{rdi:unsigned(BigInt(input>>>0),64)});
  const cov=new Set();let budget=100000;
  while(budget-->0&&!['halted','fault'].includes(m.status)){cov.add(Number(m.rip));if(!m.step())break;}
  return {cov,fault:m.status==='fault',reason:m.reason,ret:Number(unsigned(m.regs[0],32))};
}

// Mutate a 32-bit value. Byte substitution dominates, which is what cracks
// byte-compared gates; bit flips and small deltas cover arithmetic conditions.
export function mutate(x,rng=Math.random){
  x=x>>>0;const r=rng();
  if(r<0.5){const sh=(r*8|0)%4*8,val=(rng()*256)|0;return ((x&~(0xff<<sh))|(val<<sh))>>>0;}
  if(r<0.8)return (x^(1<<((rng()*32)|0)))>>>0;
  if(r<0.95)return (x+((rng()*5|0)-2))>>>0;
  return (rng()*0x100000000)>>>0;
}

export class Fuzzer{
  constructor(lesson,{rng=Math.random}={}){
    this.program=programFromImage(lesson);this.rng=rng;
    const seed=(Object.values(lesson.input)[0]|0)>>>0;
    this.corpus=[seed];this.global=new Set();this.execs=0;this.crash=null;this.lastInput=seed;this.lastCov=new Set();this.corpusGrewAt=[];
    const r=coverageRun(this.program,seed);this.execs++;this.lastCov=r.cov;
    for(const a of r.cov)this.global.add(a);
    if(r.fault)this.crash={input:seed,reason:r.reason};
  }
  // Run a batch; returns the crash record once found.
  step(iters=1000){
    for(let i=0;i<iters&&!this.crash;i++){
      const base=this.corpus[(this.rng()*this.corpus.length)|0];
      const input=mutate(base,this.rng);
      const r=coverageRun(this.program,input);this.execs++;this.lastInput=input;this.lastCov=r.cov;
      if(r.fault){this.crash={input,reason:r.reason,cov:[...r.cov]};break;}
      let gained=false;for(const a of r.cov)if(!this.global.has(a)){this.global.add(a);gained=true;}
      if(gained){this.corpus.push(input);this.corpusGrewAt.push(this.execs);}
    }
    return this.crash;
  }
}
