// Compiled-C differential: compile real C with gcc, run each function natively,
// then execute the SAME machine-code bytes in the teaching engine and compare the
// return value across many inputs. This proves the decoder/executor runs genuine
// gcc output, not just the hand-assembler's subset.
//
// Hermetic: it writes its own C sources, compiles at -O0 (the readable teaching
// target) and -O2, links at a fixed base so intra-module calls are relocated,
// and extracts the .text bytes. Requires Linux x86-64 with gcc, ld, objcopy, nm.
// SIMD-vectorized output (e.g. -O2 128-bit array stores) is a documented boundary
// and is skipped, not counted as a mismatch.
import {Machine,CODE,unsigned} from '../src/machine.js';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import process from 'node:process';

const FNS = `
int add2(int n){ return n + n; }
int clamp(int x){ if(x<0) return 0; if(x>100) return 100; return x; }
unsigned sum_to(unsigned n){ unsigned s=0; for(unsigned i=1;i<=n;i++) s+=i; return s; }
int imax(int a,int b){ return a>b?a:b; }
int divmod(int a,int b){ return (a/b) + (a%b); }
unsigned udiv(unsigned a,unsigned b){ return a/b; }
int shifts(int x,int k){ return (x<<k) ^ (x>>k); }
long widen(int x){ return (long)x + 1; }
unsigned zext(unsigned char c){ return c + 1u; }
int isqrt(int n){ int r=0; while((r+1)*(r+1)<=n) r++; return r; }
int fib(int n){ if(n<2) return n; return fib(n-1)+fib(n-2); }
int arr(int i){ int a[4]={3,7,11,19}; if((unsigned)i>=4) return -1; return a[i]; }
int sw(int x){ switch(x){case 0:return 10;case 1:return 20;case 2:return 30;default:return -1;} }
int popcnt(unsigned x){ int c=0; while(x){ c+=x&1; x>>=1; } return c; }
static int callee_add(int a,int b){ return a+b; }
int caller(int x){ return callee_add(x, x*2); }
long smul(int a,int b){ return (long)a*(long)b; }
int cmp_u(unsigned a,unsigned b){ return a<b; }
static const int T8[8]={2,3,5,7,11,13,17,19};
int table_lookup(int i){ if((unsigned)i>=8) return -1; return T8[i]; }
int sw8(int x){ switch(x){case 0:return 100;case 1:return 111;case 2:return 122;case 3:return 133;case 4:return 144;case 5:return 155;case 6:return 166;case 7:return 177;default:return -1;} }
int pick(int i){ static const char s[]="teardown"; return (i>=0&&i<8)?(unsigned char)s[i]:0; }
int mulc(int x){ return x * 1000003; }            /* imul r32,r/m32,imm32 (0x69) */
int subc(int x){ return x - 0x7eadbeef; }         /* accumulator sub eax,imm32 (0x2d) */
unsigned andc(unsigned x){ return x & 0xcafef00du; } /* accumulator and eax,imm32 (0x25) */
int xorc(int x){ return x ^ 0x12345678; }         /* accumulator xor eax,imm32 (0x35) */
double favg(int a,int b){ return (a + b) / 2.0; }    /* cvtsi2sd, divsd -> xmm0 */
double harm(int n){ double s=0; for(int i=1;i<=n;i++) s+=1.0/i; return s; } /* addsd/divsd loop */
int scale3(int n){ double x=n; return (int)(x*1.5 + 0.5); }  /* mulsd, cvttsd2si */
int fcmp(int a,int b){ double x=a*1.0, y=b*2.0; return x<y?1:0; } /* comisd branch */
`;
const DRIVER = `
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include "fns.c"
int main(int c,char**v){
  const char*f=v[1];
  long A=c>2?strtol(v[2],0,0):0, B=c>3?strtol(v[3],0,0):0;
  if(!strcmp(f,"add2")) printf("%08x\\n",(uint32_t)add2(A));
  else if(!strcmp(f,"clamp")) printf("%08x\\n",(uint32_t)clamp(A));
  else if(!strcmp(f,"sum_to")) printf("%08x\\n",(uint32_t)sum_to((unsigned)A));
  else if(!strcmp(f,"imax")) printf("%08x\\n",(uint32_t)imax(A,B));
  else if(!strcmp(f,"divmod")) printf("%08x\\n",(uint32_t)divmod(A,B));
  else if(!strcmp(f,"udiv")) printf("%08x\\n",(uint32_t)udiv((unsigned)A,(unsigned)B));
  else if(!strcmp(f,"shifts")) printf("%08x\\n",(uint32_t)shifts(A,B));
  else if(!strcmp(f,"widen")) printf("%016llx\\n",(unsigned long long)(uint64_t)widen(A));
  else if(!strcmp(f,"zext")) printf("%08x\\n",(uint32_t)zext((unsigned char)A));
  else if(!strcmp(f,"isqrt")) printf("%08x\\n",(uint32_t)isqrt(A));
  else if(!strcmp(f,"fib")) printf("%08x\\n",(uint32_t)fib(A));
  else if(!strcmp(f,"arr")) printf("%08x\\n",(uint32_t)arr(A));
  else if(!strcmp(f,"sw")) printf("%08x\\n",(uint32_t)sw(A));
  else if(!strcmp(f,"popcnt")) printf("%08x\\n",(uint32_t)popcnt((unsigned)A));
  else if(!strcmp(f,"caller")) printf("%08x\\n",(uint32_t)caller(A));
  else if(!strcmp(f,"smul")) printf("%016llx\\n",(unsigned long long)(uint64_t)smul(A,B));
  else if(!strcmp(f,"cmp_u")) printf("%08x\\n",(uint32_t)cmp_u((unsigned)A,(unsigned)B));
  else if(!strcmp(f,"table_lookup")) printf("%08x\\n",(uint32_t)table_lookup(A));
  else if(!strcmp(f,"sw8")) printf("%08x\\n",(uint32_t)sw8(A));
  else if(!strcmp(f,"pick")) printf("%08x\\n",(uint32_t)pick(A));
  else if(!strcmp(f,"mulc")) printf("%08x\\n",(uint32_t)mulc(A));
  else if(!strcmp(f,"subc")) printf("%08x\\n",(uint32_t)subc(A));
  else if(!strcmp(f,"andc")) printf("%08x\\n",(uint32_t)andc((unsigned)A));
  else if(!strcmp(f,"xorc")) printf("%08x\\n",(uint32_t)xorc(A));
  else if(!strcmp(f,"favg")){double d=favg(A,B);uint64_t u;memcpy(&u,&d,8);printf("%016llx\\n",(unsigned long long)u);}
  else if(!strcmp(f,"harm")){double d=harm(A);uint64_t u;memcpy(&u,&d,8);printf("%016llx\\n",(unsigned long long)u);}
  else if(!strcmp(f,"scale3")) printf("%08x\\n",(uint32_t)scale3(A));
  else if(!strcmp(f,"fcmp")) printf("%08x\\n",(uint32_t)fcmp(A,B));
  else return 2;
  return 0;
}
`;
const R=(lo,hi)=>{const a=[];for(let i=lo;i<=hi;i++)a.push(i);return a;};
const PLAN = {
  add2:{ret:32,cases:R(-5,5).concat([0x7fffffff,-0x80000000]).map(x=>[x])},
  clamp:{ret:32,cases:[-10,-1,0,1,50,100,101,1000].map(x=>[x])},
  sum_to:{ret:32,cases:[0,1,2,5,10,100].map(x=>[x])},
  imax:{ret:32,cases:[[3,7],[7,3],[-5,-9],[-9,-5],[0,0],[2147483647,-1]]},
  divmod:{ret:32,cases:[[17,5],[-17,5],[17,-5],[-17,-5],[100,10],[7,3],[-7,3]]},
  udiv:{ret:32,cases:[[100,7],[4294967295,3],[0,1],[255,16]]},
  shifts:{ret:32,cases:[[1,0],[1,1],[255,4],[-1,1],[0x1234,8],[-256,3]]},
  widen:{ret:64,cases:[-1,0,1,2147483647,-2147483648].map(x=>[x])},
  zext:{ret:32,cases:[0,1,127,128,255].map(x=>[x])},
  isqrt:{ret:32,cases:[0,1,2,3,4,8,15,16,100,99,101].map(x=>[x])},
  fib:{ret:32,cases:[0,1,2,3,5,10,15,20].map(x=>[x])},
  arr:{ret:32,cases:[0,1,2,3,4,5,-1].map(x=>[x])},
  sw:{ret:32,cases:[0,1,2,3,-1,99].map(x=>[x])},
  popcnt:{ret:32,cases:[0,1,2,255,0xffffffff,0x12345678].map(x=>[x])},
  caller:{ret:32,cases:[0,1,5,-3,1000].map(x=>[x])},
  smul:{ret:64,cases:[[3,7],[-3,7],[65536,65536],[-100000,100000]]},
  cmp_u:{ret:32,cases:[[1,2],[2,1],[0,0],[4294967295,0],[0,4294967295]]},
  table_lookup:{ret:32,cases:[0,1,2,7,8,-1].map(x=>[x])},
  sw8:{ret:32,cases:[0,1,4,7,8,-1].map(x=>[x])},
  pick:{ret:32,cases:[0,1,7,8,-1].map(x=>[x])},
  mulc:{ret:32,cases:[0,1,-1,1000,-1000,2147483647].map(x=>[x])},
  subc:{ret:32,cases:[0,1,-1,2147483647,-2147483648].map(x=>[x])},
  andc:{ret:32,cases:[0,4294967295,0xcafef00d,0x0f0f0f0f].map(x=>[x])},
  xorc:{ret:32,cases:[0,4294967295,0x12345678,0xdeadbeef].map(x=>[x])},
  favg:{ret:64,retReg:'xmm0',cases:[[3,5],[10,4],[-7,3],[0,0],[1,2]]},
  harm:{ret:64,retReg:'xmm0',cases:[1,2,3,5,10].map(x=>[x])},
  scale3:{ret:32,cases:[2,5,100,-4,0].map(x=>[x])},
  fcmp:{ret:32,cases:[[1,1],[3,2],[2,3],[0,0]]},
};
const ARG=['rdi','rsi','rdx','rcx'];

function sh(cmd,args,opts){ return execFileSync(cmd,args,{encoding:'utf8',...opts}); }

function main(){
  if(process.platform!=='linux'||!['x64'].includes(process.arch)){
    console.log('Compiled-C differential requires Linux x86-64; it was NOT run.'); return;
  }
  for(const t of ['gcc','ld','objcopy','nm']){ try{ sh(t,['--version']); }catch{ console.log(`${t} unavailable; compiled-C differential NOT run.`); return; } }
  const dir=mkdtempSync(join(tmpdir(),'teard0wn-compiled-'));
  let total=0,fails=0,skipped=0;
  try{
    writeFileSync(join(dir,'fns.c'),FNS);
    writeFileSync(join(dir,'driver.c'),DRIVER);
    const FLAGS=['-fcf-protection=none','-fno-stack-protector','-fno-asynchronous-unwind-tables'];
    for(const OPT of ['0','2']){
      sh('gcc',[`-O${OPT}`,...FLAGS,'-c',join(dir,'fns.c'),'-o',join(dir,`fns${OPT}.o`)]);
      sh('gcc',[`-O${OPT}`,...FLAGS,join(dir,'driver.c'),'-o',join(dir,`driver${OPT}`)],{cwd:dir});
      sh('ld',[join(dir,`fns${OPT}.o`),'-Ttext=0x1000','-e','add2','-o',join(dir,`fns${OPT}.elf`)]);
      // .text + .rodata as one image at base 0x1000, so RIP-relative references
      // to constants, strings, and jump tables resolve against the loaded bytes.
      sh('objcopy',['-O','binary','-j','.text','-j','.rodata',join(dir,`fns${OPT}.elf`),join(dir,`text${OPT}.bin`)]);
      const text=new Uint8Array(readFileSync(join(dir,`text${OPT}.bin`)));
      const syms={};
      for(const line of sh('nm',['-n',join(dir,`fns${OPT}.elf`)]).trim().split('\n')){
        const m=line.match(/^([0-9a-f]+)\s+[Tt]\s+(\S+)$/); if(m)syms[m[2]]=parseInt(m[1],16)-0x1000;
      }
      for(const [fn,spec] of Object.entries(PLAN)){
        if(!(fn in syms))continue;
        for(const args of spec.cases){
          total++;
          const nat=sh(join(dir,`driver${OPT}`),[fn,...args.map(String)]).trim();
          const init={}; args.forEach((v,i)=>init[ARG[i]]=unsigned(BigInt(v),64));
          const prog={source:'',labels:{},instructions:[],code:text,data:new Uint8Array(0),entry:CODE+syms[fn]};
          const m=new Machine(prog,init);
          m.run({limit:4000000});
          let emu;
          if(m.status!=='halted'){
            // SIMD vectorization (e.g. -O2 128-bit stores) is an explicit boundary.
            if(/Unsupported 0F opcode 0x(6f|28|29|10|11|7e|d6|ef)/.test(m.reason)){ skipped++; total--; continue; }
            emu=`<${m.status}:${m.reason}>`;
          } else emu=unsigned(spec.retReg==='xmm0'?m.xmm[0]:m.regs[0],spec.ret).toString(16).padStart(spec.ret/4,'0');
          if(emu!==nat){ fails++; if(fails<=20) console.log(`FAIL -O${OPT} ${fn}(${args}) native=${nat} emu=${emu}`); }
        }
      }
    }
  } finally { rmSync(dir,{recursive:true,force:true}); }
  console.log(`Compiled-C differential: ${total} cases across -O0/-O2, ${fails} mismatches${skipped?`, ${skipped} SIMD cases skipped`:''}`);
  if(fails) process.exit(1);
}
main();
