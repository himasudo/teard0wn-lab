// An operational model of x86-TSO, the memory ordering a single x86 core pair
// actually gives you. Each thread writes stores into a private FIFO store
// buffer; a buffered store becomes visible to other threads only when it drains
// to memory, and a thread's own loads see its buffered stores first. The one
// reordering this allows -- a later load passing an earlier store to a different
// address -- is exactly what the SB litmus test exposes. MFENCE drains the
// buffer, which is why it restores the stronger ordering.
//
// explore() enumerates every interleaving and every drain order and returns the
// set of final register tuples that are reachable. That set is the ground truth
// the lab shows: a result is "allowed" iff it is reachable here. The known
// outcomes of the classic tests are checked in tests/tso.test.js.

function parse(line){
  const p=line.trim().split(/\s+/);
  if(p[0]==='st')return {op:'st',addr:p[1],val:+p[2]};
  if(p[0]==='ld')return {op:'ld',reg:p[1],addr:p[2]};
  if(p[0]==='mfence')return {op:'mfence'};
  throw new Error('bad litmus op: '+line);
}

export function explore(test){
  const T=test.threads.map(t=>t.map(parse));
  const addrs=[...new Set(T.flat().filter(o=>o.addr).map(o=>o.addr))];
  const start={M:Object.fromEntries(addrs.map(a=>[a,0])),B:T.map(()=>[]),R:{},pc:T.map(()=>0)};
  const key=s=>JSON.stringify([s.M,s.B,s.R,s.pc]);
  const seen=new Set(),reachable=new Set(),stack=[start];
  while(stack.length){
    const s=stack.pop(),k=key(s);
    if(seen.has(k))continue;seen.add(k);
    const succ=[];
    for(let t=0;t<T.length;t++){
      const op=T[t][s.pc[t]];
      if(op){
        if(op.op==='st'){const n=clone(s);n.B[t]=[...n.B[t],[op.addr,op.val]];n.pc[t]++;succ.push(n);}
        else if(op.op==='ld'){const n=clone(s);const buf=[...n.B[t]].reverse().find(e=>e[0]===op.addr);n.R={...n.R,[op.reg]:buf?buf[1]:n.M[op.addr]};n.pc[t]++;succ.push(n);}
        else if(op.op==='mfence'&&s.B[t].length===0){const n=clone(s);n.pc[t]++;succ.push(n);}
      }
      if(s.B[t].length){const n=clone(s);const[a,v]=n.B[t][0];n.B[t]=n.B[t].slice(1);n.M={...n.M,[a]:v};succ.push(n);}
    }
    if(succ.length===0)reachable.add(test.regs.map(r=>s.R[r]??0).join(','));
    else for(const n of succ)stack.push(n);
  }
  return reachable;
}
function clone(s){return {M:{...s.M},B:s.B.map(b=>b.slice()),R:{...s.R},pc:s.pc.slice()};}

// Is the outcome the test asks about reachable under TSO?
export function questionReachable(test){
  return explore(test).has(test.regs.map(r=>test.question[r]).join(','));
}

export const litmus=[
  {id:'sb',name:'Store Buffering (SB)',
   threads:[['st x 1','ld r0 y'],['st y 1','ld r1 x']],
   regs:['r0','r1'],question:{r0:0,r1:0},tso:'allowed',
   blurb:'Each core writes one flag and reads the other. TSO lets both reads return 0: each store is still sitting in its store buffer when the other core reads. This is the one non-sequential outcome x86 permits, and the reason lock-free code needs fences.'},
  {id:'sb-fence',name:'SB with MFENCE',
   threads:[['st x 1','mfence','ld r0 y'],['st y 1','mfence','ld r1 x']],
   regs:['r0','r1'],question:{r0:0,r1:0},tso:'forbidden',
   blurb:'The same test with an MFENCE between each store and load. The fence drains the store buffer before the load, so a core cannot read the other flag as 0 unless its own store is already visible. The (0,0) outcome disappears.'},
  {id:'mp',name:'Message Passing (MP)',
   threads:[['st data 1','st flag 1'],['ld r0 flag','ld r1 data']],
   regs:['r0','r1'],question:{r0:1,r1:0},tso:'forbidden',
   blurb:'One core writes data then a flag; the other waits on the flag then reads data. TSO keeps both the writer’s stores and the reader’s loads in order, so seeing flag=1 guarantees data=1. The (flag=1, data=0) tear cannot happen on x86 — no fence needed.'},
  {id:'lb',name:'Load Buffering (LB)',
   threads:[['ld r0 x','st y 1'],['ld r1 y','st x 1']],
   regs:['r0','r1'],question:{r0:1,r1:1},tso:'forbidden',
   blurb:'Each core reads one location then writes the other. For both to read 1, each store would have to be seen before the load that precedes it in program order — a load-store reorder TSO never does. Weaker models (ARM, Power) do allow it, which is why portable lock-free code cannot assume this stays forbidden.'},
];
