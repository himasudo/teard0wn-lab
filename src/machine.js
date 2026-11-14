// teard0wn x86-64 teaching engine. Encodes and decodes real instruction bytes.
// This deliberately bounded architecture is documented in docs/ENGINE.md.
export const REG64 = ['rax','rcx','rdx','rbx','rsp','rbp','rsi','rdi',...Array.from({length:8},(_,i)=>`r${i+8}`)];
const NAMES = {
  64: REG64,
  32: ['eax','ecx','edx','ebx','esp','ebp','esi','edi',...Array.from({length:8},(_,i)=>`r${i+8}d`)],
  16: ['ax','cx','dx','bx','sp','bp','si','di',...Array.from({length:8},(_,i)=>`r${i+8}w`)],
  8: ['al','cl','dl','bl','spl','bpl','sil','dil',...Array.from({length:8},(_,i)=>`r${i+8}b`)]
};
const REGS = Object.fromEntries(Object.entries(NAMES).flatMap(([w,n])=>n.map((name,id)=>[name,{kind:'reg',id,width:+w}])));
export const CODE=0x1000, DATA=0x2000, STACK=0x7ff8, RETURN=0xfff0;
export const mask = w => (1n<<BigInt(w))-1n;
export const unsigned = (x,w=64)=>BigInt.asUintN(w,BigInt(x));
export const signed = (x,w=64)=>BigInt.asIntN(w,BigInt(x));
export const hex = (x,digits=16)=>unsigned(x,digits*4).toString(16).padStart(digits,'0');
const le = (v,n)=>Array.from({length:n},(_,i)=>Number((BigInt(v)>>BigInt(8*i))&255n));
const groups={add:0,or:1,and:4,sub:5,xor:6,cmp:7};
const binBase={add:0x00,or:0x08,and:0x20,sub:0x28,xor:0x30,cmp:0x38};
const conditions={jo:0,jno:1,jb:2,jc:2,jnae:2,jae:3,jnc:3,jnb:3,je:4,jz:4,jne:5,jnz:5,jbe:6,jna:6,ja:7,jnbe:7,js:8,jns:9,jp:10,jpe:10,jnp:11,jpo:11,jl:12,jnge:12,jge:13,jnl:13,jle:14,jng:14,jg:15,jnle:15};
const fail = m=>{throw new Error(m);};
const fits = (v,b)=>v>=-(1n<<BigInt(b-1)) && v<=(1n<<BigInt(b))-1n;

function number(s,labels,pass=2){
  s=s.trim();
  if(Object.hasOwn(labels,s.toLowerCase()))return BigInt(labels[s.toLowerCase()]);
  if(/^[-+]?(?:0x[\da-f]+|0b[01]+|\d+)$/i.test(s)){
    if(s.startsWith('-'))return -BigInt(s.slice(1));
    return BigInt(s.replace(/^\+/,''));
  }
  if(/^'.'$/.test(s))return BigInt(s.codePointAt(1));
  if(pass===1 && /^[a-zA-Z_]\w*$/.test(s))return 0n;
  fail(`Unknown value or label “${s}”. Use a decimal/hex integer or a defined label.`);
}
function operand(s,labels,pass){
  const original=s.trim();
  s=s.trim().toLowerCase();
  if(REGS[s])return {...REGS[s]};
  const m=s.match(/^(?:(byte|word|dword|qword)\s+(?:ptr\s+)?)?\[([^\]]+)\]$/);
  if(m){
    const terms=m[2].replace(/\s/g,'').replace(/-/g,'+-').split('+').filter(Boolean);
    const out={kind:'mem',width:({byte:8,word:16,dword:32,qword:64})[m[1]],base:null,index:null,scale:1,disp:0n};
    for(const t of terms){
      if(t.includes('*')){
        const [a,b]=t.split('*');const reg=REGS[a];
        if(!reg || reg.width!==64 || reg.id===4 || ![1,2,4,8].includes(+b)||out.index!==null)fail('Index must be a 64-bit register other than rsp, scaled by 1, 2, 4, or 8.');
        out.index=reg.id;out.scale=+b;
      }else if(REGS[t]){
        const r=REGS[t];if(r.width!==64)fail('Address registers must be 64-bit in this engine.');
        if(out.base===null)out.base=r.id;
        else if(out.index===null && r.id!==4)out.index=r.id;
        else fail('Address has too many registers or uses rsp as an index.');
      }else out.disp+=number(t,labels,pass);
    }
    if(out.disp<-(1n<<31n)||out.disp>=(1n<<31n))fail('Address displacement must fit a signed 32-bit value.');
    return out;
  }
  return {kind:'imm',value:number(original,labels,pass)};
}
function prefix(width,R=0,X=0,B=0,force=false){
  const rex=0x40|(width===64?8:0)|(R?4:0)|(X?2:0)|(B?1:0);
  return [...(width===16?[0x66]:[]),...(rex!==0x40||force?[rex]:[])];
}
function modrm(opcode,width,field,rm,group=false){
  const R=group?0:field>>3, low=field&7;
  if(rm.kind==='reg')return [...prefix(width,R,0,rm.id>>3,width===8 && (rm.id>=4||(!group&&field>=4))),...opcode,0xc0|(low<<3)|(rm.id&7)];
  if(rm.kind!=='mem')fail('Expected a register or a memory operand.');
  const X=(rm.index??0)>>3, B=(rm.base??0)>>3;
  const sib=rm.index!==null||rm.base===null||((rm.base&7)===4);
  const mode=rm.base===null?0:2;
  const out=[...prefix(width,R,X,B,width===8&&!group&&field>=4),...opcode,(mode<<6)|(low<<3)|(sib?4:rm.base&7)];
  if(sib)out.push(([1,2,4,8].indexOf(rm.scale)<<6)|((rm.index===null?4:rm.index&7)<<3)|(rm.base===null?5:rm.base&7));
  out.push(...le(rm.disp,4));
  return out;
}
function widthOf(a,b){
  const w=a.width||b?.width;if(!w)fail('Specify a memory size: byte, word, dword, or qword ptr.');
  if(a.width && b?.width && a.width!==b.width)fail('Operand sizes do not match.');
  return w;
}
function encode(op,parts,labels,addr,pass){
  const a=parts.map(s=>operand(s,labels,pass));
  const count=n=>{if(a.length!==n)fail(`${op} expects ${n} operand${n===1?'':'s'}.`);};
  if(['ret','nop','int3','syscall'].includes(op)){count(0);return {ret:[0xc3],nop:[0x90],int3:[0xcc],syscall:[0x0f,0x05]}[op];}
  if(op==='jmp'||op==='call'||Object.hasOwn(conditions,op)){
    count(1);if(a[0].kind!=='imm')fail('Only direct label/relative branches are supported.');
    const pre=op==='jmp'?[0xe9]:op==='call'?[0xe8]:[0x0f,0x80+conditions[op]];
    const d=a[0].value-BigInt(addr+pre.length+4);
    if(pass===2&&(d<-(1n<<31n)||d>=(1n<<31n)))fail('Branch target is out of range.');
    return [...pre,...le(d,4)];
  }
  if(op==='push'||op==='pop'){
    count(1);if(a[0].kind==='reg'&&a[0].width===64)return [...prefix(32,0,0,a[0].id>>3), (op==='push'?0x50:0x58)+(a[0].id&7)];
    if(op==='push'&&a[0].kind==='imm'&&a[0].value>=-(1n<<31n)&&a[0].value<(1n<<31n))return [0x68,...le(a[0].value,4)];
    fail(`${op} supports 64-bit registers${op==='push'?' or signed 32-bit immediates':''}.`);
  }
  if(['inc','dec','not','neg'].includes(op)){
    count(1);const w=widthOf(a[0]);
    return modrm([(['inc','dec'].includes(op)?0xfe:0xf6)+(w===8?0:1)],w,({inc:0,dec:1,not:2,neg:3})[op],a[0],true);
  }
  if(['shl','shr','sar'].includes(op)){
    count(2);const w=widthOf(a[0]);if(a[1].kind!=='imm'||a[1].value<0n||a[1].value>255n)fail('Shift count must be an immediate byte.');
    return [...modrm([w===8?0xc0:0xc1],w,({shl:4,shr:5,sar:7})[op],a[0],true),Number(a[1].value)];
  }
  if(op==='lea'){
    count(2);if(a[0].kind!=='reg'||a[0].width===8||a[1].kind!=='mem')fail('lea needs a 16/32/64-bit destination register and a memory-address expression.');
    return modrm([0x8d],a[0].width,a[0].id,a[1]);
  }
  if(op==='imul'){
    count(2);const w=widthOf(a[0],a[1]);if(a[0].kind!=='reg'||w===8||a[1].kind==='imm')fail('imul supports two 16/32/64-bit register/memory operands.');
    return modrm([0x0f,0xaf],w,a[0].id,a[1]);
  }
  if(op==='mov'){
    count(2);const [d,s]=a,w=widthOf(d,s);
    if(d.kind==='reg'&&s.kind==='imm'){
      if(!fits(s.value,w))fail(`Immediate does not fit ${w} bits.`);
      return [...prefix(w,0,0,d.id>>3,w===8&&d.id>=4),(w===8?0xb0:0xb8)+(d.id&7),...le(s.value,w/8)];
    }
    if(d.kind==='mem'&&s.kind==='imm'){
      if(w===64?(s.value<-(1n<<31n)||s.value>=(1n<<31n)):!fits(s.value,w))fail('Memory immediate is too large; load it into a register first.');
      return [...modrm([w===8?0xc6:0xc7],w,0,d,true),...le(s.value,Math.min(w,32)/8)];
    }
    if(d.kind==='reg'&&s.kind==='mem')return modrm([w===8?0x8a:0x8b],w,d.id,s);
    if(s.kind==='reg'&&['mem','reg'].includes(d.kind))return modrm([w===8?0x88:0x89],w,s.id,d);
    fail('mov cannot copy memory to memory.');
  }
  if(Object.hasOwn(groups,op)||op==='test'){
    count(2);const [d,s]=a,w=widthOf(d,s);
    if(s.kind==='imm'){
      if(w===64?(s.value<-(1n<<31n)||s.value>=(1n<<31n)):!fits(s.value,w))fail('Arithmetic immediate does not fit its encoded operand.');
      return [...modrm([op==='test'?(w===8?0xf6:0xf7):(w===8?0x80:0x81)],w,op==='test'?0:groups[op],d,true),...le(s.value,Math.min(w,32)/8)];
    }
    if(op==='test'){
      if(s.kind!=='reg')fail('test requires a register or immediate second operand.');
      return modrm([w===8?0x84:0x85],w,s.id,d);
    }
    if(s.kind==='reg')return modrm([binBase[op]+(w===8?0:1)],w,s.id,d);
    if(d.kind==='reg'&&s.kind==='mem')return modrm([binBase[op]+(w===8?2:3)],w,d.id,s);
    fail('Arithmetic cannot operate on two memory operands.');
  }
  fail(`Unsupported instruction “${op}”. Open Engine reference for the supported subset.`);
}
function stripComment(s){
  let quote=null,escape=false;
  for(let i=0;i<s.length;i++){
    const c=s[i];if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}
    if(quote){if(c===quote)quote=null;}else if(c==='"'||c==="'")quote=c;else if(c===';'||c==='#')return s.slice(0,i);
  }return s;
}
export function assemble(source){
  if(typeof source!=='string'||source.length>64000)fail('Source is limited to 64,000 characters.');
  const lines=source.split('\n');let labels={};let instructions=[],data=[],code=[];
  for(let pass=1;pass<=2;pass++){
    let section='text',pc=CODE,dp=DATA;instructions=[];data=[];code=[];
    for(let line=0;line<lines.length;line++){
      let s=stripComment(lines[line]).trim();if(!s)continue;
      try{
        const m=s.match(/^([a-zA-Z_]\w*):/);if(m){const name=m[1].toLowerCase();if(pass===1){if(Object.hasOwn(labels,name))fail(`Duplicate label ${name}.`);labels[name]=section==='text'?pc:dp;}s=s.slice(m[0].length).trim();if(!s)continue;}
        if(s==='.text'||s==='.data'){section=s.slice(1);continue;}
        const match=s.match(/^(\S+)(?:\s+(.*))?$/),op=match[1].toLowerCase(),tail=match[2]||'';
        let bytes;
        if(['.byte','.quad','.zero','.ascii','.asciz'].includes(op)){
          if(section!=='data')fail('Data directives belong after .data.');
          if(op==='.ascii'||op==='.asciz'){
            let value;try{value=JSON.parse(tail);}catch{fail('String must be a JSON-compatible double-quoted literal.');}
            if(typeof value!=='string')fail('Expected a string.');
            bytes=[...new TextEncoder().encode(value),...(op==='.asciz'?[0]:[])];
          }else if(op==='.zero'){
            const n=number(tail,labels,pass);if(n<0n||n>1024n)fail('.zero accepts 0–1024 bytes.');bytes=Array(Number(n)).fill(0);
          }else{
            bytes=tail.split(',').flatMap(v=>{const n=number(v,labels,pass),bits=op==='.byte'?8:64;if(!fits(n,bits))fail(`Data value does not fit ${bits} bits.`);return le(n,bits/8);});
          }
          dp+=bytes.length;data.push(...bytes);if(dp>0x4000)fail('Data exceeds the 8 KiB data region.');
        }else{
          if(section!=='text')fail('Instructions belong in .text.');
          bytes=encode(op,tail?tail.split(/,(?![^\[]*\])/):[],labels,pc,pass);
          instructions.push({address:pc,line:line+1,text:s,bytes});code.push(...bytes);pc+=bytes.length;
          if(pc>0x2000)fail('Code exceeds the 4 KiB code region.');
        }
      }catch(e){throw new Error(`Line ${line+1}: ${e.message}`);}
    }
  }
  if(!code.length)fail('Write at least one instruction.');
  return {source,labels,instructions,code:Uint8Array.from(code),data:Uint8Array.from(data),entry:labels.entry??CODE};
}

export class Machine {
  constructor(program,initial={}){
    this.program=program;this.regs=Array(16).fill(0n);this.regs[4]=BigInt(STACK);
    this.flags={CF:false,PF:false,AF:false,ZF:false,SF:false,OF:false};
    this.memory=new Uint8Array(0x10000);this.memory.set(program.code,CODE);this.memory.set(program.data,DATA);
    this.rip=BigInt(program.entry);this.status='ready';this.reason='Ready at entry';this.steps=0;this.history=[];this.calls=[];this.output='';this.writes=[];
    for(const [name,value] of Object.entries(initial)){
      const r=REGS[name];if(!r)fail(`Unknown initial register ${name}.`);this.setReg(r.id,r.width,BigInt(value));
    }
    this.writeMem(STACK,64,BigInt(RETURN));this.writes=[];
  }
  getReg(id,width=64){return unsigned(this.regs[id],width);}
  setReg(id,width,value){value=unsigned(value,width);this.regs[id]=width>=32?value:(this.regs[id]&~mask(width))|value;}
  range(address,n,mode='read'){
    const a=Number(address);if(!Number.isSafeInteger(a)||a<0||a+n>0x10000)fail(`Unmapped ${mode} at 0x${BigInt(address).toString(16)}.`);
    const code=a>=CODE&&a+n<=CODE+this.program.code.length;
    const data=a>=DATA&&a+n<=0x4000,stack=a>=0x7000&&a+n<=0x8000;
    if(mode==='execute'?!code:mode==='write'?!(data||stack):!(code||data||stack))fail(`${mode==='write'&&code?'Read-only code':mode==='execute'?'Non-executable or unmapped memory':'Unmapped memory'}: ${mode} at 0x${a.toString(16)}.`);
    return a;
  }
  readMem(address,width){const a=this.range(address,width/8);let v=0n;for(let i=0;i<width/8;i++)v|=BigInt(this.memory[a+i])<<BigInt(i*8);return v;}
  writeMem(address,width,value){const a=this.range(address,width/8,'write');for(let i=0;i<width/8;i++){const old=this.memory[a+i],next=Number((BigInt(value)>>BigInt(i*8))&255n);this.memory[a+i]=next;this.writes.push({address:a+i,old,value:next});}}
  read(o){return o.kind==='reg'?this.getReg(o.id,o.width):o.kind==='mem'?this.readMem(o.address,o.width):unsigned(o.value,o.width);}
  write(o,v){if(o.kind==='reg')this.setReg(o.id,o.width,v);else if(o.kind==='mem')this.writeMem(o.address,o.width,v);else fail('Invalid write destination.');}
  decode(){
    let p=Number(this.rip),rex=0,w16=false;
    const take=()=>{this.range(p,1,'execute');return this.memory[p++];};
    const imm=(n,sign=false)=>{let v=0n;for(let i=0;i<n;i++)v|=BigInt(take())<<BigInt(8*i);return sign?signed(v,n*8):v;};
    let op=take();
    while(op===0x66||op===0x2e||op===0x3e||op===0x26||op===0x36||op===0x64||op===0x65||op===0xf0||op===0xf2||op===0xf3){if(op===0x66)w16=true;op=take();}
    if(op>=0x40&&op<=0x4f){rex=op;op=take();}
    const wide=rex&8?64:w16?16:32;
    const reg=(id,width)=>{if(width===8&&!rex&&id>=4&&id<=7)fail('High-byte registers ah/ch/dh/bh are outside this engine subset.');return {kind:'reg',id,width};};
    const rm=(width)=>{
      const b=take(),mode=b>>6,field=((b>>3)&7)|((rex&4)?8:0),low=b&7;
      if(mode===3)return {field,operand:reg(low|((rex&1)?8:0),width)};
      let base=low|((rex&1)?8:0),index=null,scale=1,disp=0n,ripRelative=false;
      if(low===4){const sib=take();scale=1<<(sib>>6);const ix=(sib>>3)&7;if(ix!==4||(rex&2))index=ix|((rex&2)?8:0);base=(sib&7)|((rex&1)?8:0);if(mode===0&&(sib&7)===5){base=null;disp=imm(4,true);}}
      else if(mode===0&&low===5){base=null;disp=imm(4,true);ripRelative=true;}
      if(mode===1)disp=imm(1,true);if(mode===2)disp=imm(4,true);
      // RIP-relative: the base is the address of the NEXT instruction, which is
      // only known once any trailing immediate has been read. Defer resolution.
      if(ripRelative)return {field,operand:{kind:'mem',width,ripRelative:true,disp}};
      const address=unsigned((base===null?0n:this.regs[base])+(index===null?0n:this.regs[index]*BigInt(scale))+disp);
      return {field,operand:{kind:'mem',width,address}};
    };
    let name,args=[];
    if(op===0x90)name='nop';else if(op===0xc3)name='ret';else if(op===0xcc)name='int3';
    else if(op===0xc9)name='leave';
    else if(op===0x98){name='cdqe';args=[{width:wide}];}
    else if(op===0x99){name='cdq';args=[{width:wide}];}
    else if(op===0xeb){const d=imm(1,true);name='jmp';args=[{kind:'imm',width:64,value:BigInt(p)+d}];}
    else if(op>=0x70&&op<=0x7f){name='jcc';const d=imm(1,true);args=[{kind:'imm',width:64,value:BigInt(p)+d},{condition:op&15}];}
    else if(op===0x63){const x=rm(32);name='movsxd';args=[reg(x.field,64),x.operand];}
    else if(op===0x87){const x=rm(wide);name='xchg';args=[x.operand,reg(x.field,wide)];}
    else if(op===0xd0||op===0xd1||op===0xd2||op===0xd3){const w=op&1?wide:8,x=rm(w);name=({4:'shl',5:'shr',7:'sar'})[x.field];if(!name)fail('Unsupported shift group.');args=[x.operand,op<=0xd1?{kind:'imm',width:8,value:1n}:{kind:'reg',id:1,width:8}];}
    else if(op===0xe8||op===0xe9){name=op===0xe8?'call':'jmp';const d=imm(4,true);args=[{kind:'imm',width:64,value:BigInt(p)+d}];}
    else if(op>=0x50&&op<=0x5f){name=op<0x58?'push':'pop';args=[reg((op&7)|((rex&1)?8:0),64)];}
    else if(op===0x68){name='push';args=[{kind:'imm',width:64,value:imm(4,true)}];}
    else if(op>=0xb0&&op<=0xbf){const w=op<0xb8?8:wide;name='mov';args=[reg((op&7)|((rex&1)?8:0),w),{kind:'imm',width:w,value:imm(w/8)}];}
    else if(op===0x0f){
      const op2=take();
      if(op2===0x05)name='syscall';
      else if(op2>=0x80&&op2<=0x8f){name='jcc';const d=imm(4,true);args=[{kind:'imm',width:64,value:BigInt(p)+d},{condition:op2&15}];}
      else if(op2===0xaf){name='imul';const x=rm(wide);args=[reg(x.field,wide),x.operand];}
      else if(op2===0x1e){take();name='nop';}
      else if(op2===0x1f){rm(wide);name='nop';}
      else if(op2===0xb6||op2===0xb7){const x=rm(op2===0xb6?8:16);name='movzx';args=[reg(x.field,wide),x.operand];}
      else if(op2===0xbe||op2===0xbf){const x=rm(op2===0xbe?8:16);name='movsx';args=[reg(x.field,wide),x.operand];}
      else if(op2>=0x40&&op2<=0x4f){const x=rm(wide);name='cmov';args=[reg(x.field,wide),x.operand,{condition:op2&15}];}
      else if(op2>=0x90&&op2<=0x9f){const x=rm(8);name='setcc';args=[x.operand,{condition:op2&15}];}
      else fail(`Unsupported 0F opcode 0x${op2.toString(16)}.`);
    }else if([0x88,0x89,0x8a,0x8b,0x8d].includes(op)){
      const w=[0x88,0x8a].includes(op)?8:wide,x=rm(w);name=op===0x8d?'lea':'mov';
      args=op===0x88||op===0x89?[x.operand,reg(x.field,w)]:[reg(x.field,w),x.operand];
    }else if(op===0xc6||op===0xc7){const w=op===0xc6?8:wide,x=rm(w);if(x.field!==0)fail('Invalid MOV encoding.');name='mov';args=[x.operand,{kind:'imm',width:w,value:imm(Math.min(w,32)/8,w===64)}];}
    else if(op===0x80||op===0x81||op===0x83){const w=op===0x80?8:wide,x=rm(w);name=Object.keys(groups).find(k=>groups[k]===x.field);if(!name)fail('Unsupported arithmetic group.');const value=op===0x83?imm(1,true):imm(Math.min(w,32)/8,w===64);args=[x.operand,{kind:'imm',width:w,value}];}
    else if(op===0x84||op===0x85){const w=op===0x84?8:wide,x=rm(w);name='test';args=[x.operand,reg(x.field,w)];}
    else if(op===0xf6||op===0xf7){
      const w=op===0xf6?8:wide,x=rm(w);name=({0:'test',2:'not',3:'neg',4:'mul',5:'imul1',6:'div',7:'idiv'})[x.field];
      if(!name)fail('Unsupported F6/F7 group.');args=[x.operand];if(name==='test')args.push({kind:'imm',width:w,value:imm(Math.min(w,32)/8,w===64)});
    }else if(op===0xfe||op===0xff){
      const field3=(this.memory[p]>>3)&7,w=op===0xff&&[2,4,6].includes(field3)?64:(op===0xfe?8:wide),x=rm(w);
      name=(op===0xfe?{0:'inc',1:'dec'}:{0:'inc',1:'dec',2:'callind',4:'jmpind',6:'pushind'})[x.field];
      if(!name)fail('Unsupported FE/FF group.');args=[x.operand];
    }else if(op===0xc0||op===0xc1){const w=op===0xc0?8:wide,x=rm(w);name=({4:'shl',5:'shr',7:'sar'})[x.field];if(!name)fail('Unsupported shift.');args=[x.operand,{kind:'imm',width:8,value:imm(1)}];}
    else{
      const group=Object.keys(binBase).find(k=>op>=binBase[k]&&op<=binBase[k]+3);
      if(!group)fail(`Unsupported opcode 0x${op.toString(16)} at 0x${Number(this.rip).toString(16)}.`);
      name=group;const direction=(op-binBase[group])>>1,w=op&1?wide:8,x=rm(w);args=direction?[reg(x.field,w),x.operand]:[x.operand,reg(x.field,w)];
    }
    const next=BigInt(p);
    for(const a of args)if(a&&a.kind==='mem'&&a.ripRelative){a.address=unsigned(next+a.disp);delete a.ripRelative;delete a.disp;}
    return {name,args,next,address:this.rip};
  }
  zsp(result,width){this.flags.ZF=result===0n;this.flags.SF=!!(result&(1n<<BigInt(width-1)));let parity=0;for(let i=0;i<8;i++)parity^=Number((result>>BigInt(i))&1n);this.flags.PF=parity===0;}
  arithmetic(op,a,b,w){
    const sub=op==='sub'||op==='cmp',raw=sub?a-b:a+b,r=unsigned(raw,w),signBit=1n<<BigInt(w-1);
    this.flags.CF=sub?a<b:raw>mask(w);this.flags.OF=!!((sub?(a^b)&(a^r):~(a^b)&(a^r))&signBit);
    this.flags.AF=!!((a^b^r)&16n);this.zsp(r,w);return r;
  }
  condition(c){
    const need=(...names)=>{for(const n of names)if(this.flags[n]===null)fail(`Branch uses undefined ${n}; the preceding instruction does not define this flag.`);};
    const f=this.flags;
    switch(c>>1){case 0:need('OF');break;case 1:need('CF');break;case 2:need('ZF');break;case 3:need('CF','ZF');break;case 4:need('SF');break;case 5:need('PF');break;case 6:need('SF','OF');break;case 7:need('ZF','SF','OF');}
    const v=[f.OF,f.CF,f.ZF,f.CF||f.ZF,f.SF,f.PF,f.SF!==f.OF,f.ZF||(f.SF!==f.OF)][c>>1];return c&1?!v:v;
  }
  snapshot(){return {regs:[...this.regs],flags:{...this.flags},rip:this.rip,status:this.status,reason:this.reason,steps:this.steps,calls:this.calls.map(x=>({...x})),output:this.output};}
  restore(s){Object.assign(this,{...s,regs:[...s.regs],flags:{...s.flags},calls:s.calls.map(x=>({...x}))});}
  rewind(){const h=this.history.pop();if(!h)return false;for(const w of [...h.writes].reverse())this.memory[w.address]=w.old;this.restore(h.before);this.writes=[];return true;}
  step(){
    if(['halted','fault'].includes(this.status))return false;
    const before=this.snapshot();this.writes=[];
    try{
      const d=this.decode(),[dst,src]=d.args,w=dst?.width;this.rip=d.next;this.status='paused';this.reason='Single instruction';
      const read=()=>this.read(dst),rhs=()=>this.read(src);
      switch(d.name){
        case 'mov':this.write(dst,rhs());break;
        case 'lea':if(src.kind!=='mem')fail('Invalid LEA encoding.');this.write(dst,src.address);break;
        case 'add':case 'sub':case 'cmp':{const result=this.arithmetic(d.name,read(),rhs(),w);if(d.name!=='cmp')this.write(dst,result);break;}
        case 'and':case 'or':case 'xor':case 'test':{const a=read(),b=rhs(),r=d.name==='or'?a|b:d.name==='xor'?a^b:a&b;this.flags.CF=false;this.flags.OF=false;this.flags.AF=null;this.zsp(r,w);if(d.name!=='test')this.write(dst,r);break;}
        case 'inc':case 'dec':{const cf=this.flags.CF,r=this.arithmetic(d.name==='inc'?'add':'sub',read(),1n,w);this.flags.CF=cf;this.write(dst,r);break;}
        case 'not':this.write(dst,~read());break;
        case 'neg':this.write(dst,this.arithmetic('sub',0n,read(),w));break;
        case 'imul':{const r=signed(read(),w)*signed(rhs(),w);this.write(dst,r);this.flags.CF=this.flags.OF=signed(r,w)!==r;for(const f of ['SF','ZF','AF','PF'])this.flags[f]=null;break;}
        case 'movzx':this.write(dst,rhs());break;
        case 'movsx':this.write(dst,unsigned(signed(rhs(),src.width),w));break;
        case 'movsxd':this.write(dst,unsigned(signed(rhs(),32),w));break;
        case 'cmov':if(this.condition(d.args[2].condition))this.write(dst,rhs());break;
        case 'setcc':this.write(dst,this.condition(src.condition)?1n:0n);break;
        case 'cdqe':{const half=w/2;this.setReg(0,w,unsigned(signed(this.getReg(0,half),half),w));break;}
        case 'cdq':{const neg=signed(this.getReg(0,w),w)<0n;this.setReg(2,w,neg?mask(w):0n);break;}
        case 'leave':{this.regs[4]=this.regs[5];const v=this.readMem(this.regs[4],64);this.regs[4]=unsigned(this.regs[4]+8n);this.regs[5]=v;break;}
        case 'xchg':{const a=read(),b=rhs();this.write(dst,b);this.write(src,a);break;}
        case 'mul':{const a=this.getReg(0,w),b=read(),prod=a*b;if(w===8)this.setReg(0,16,prod&0xffffn);else{this.setReg(0,w,prod&mask(w));this.setReg(2,w,(prod>>BigInt(w))&mask(w));}this.flags.CF=this.flags.OF=(prod>>BigInt(w))!==0n;for(const f of['SF','ZF','AF','PF'])this.flags[f]=null;break;}
        case 'imul1':{const prod=signed(this.getReg(0,w),w)*signed(read(),w),lo=unsigned(prod,w);if(w===8)this.setReg(0,16,unsigned(prod,16));else{this.setReg(0,w,lo);this.setReg(2,w,unsigned(prod>>BigInt(w),w));}this.flags.CF=this.flags.OF=signed(lo,w)!==prod;for(const f of['SF','ZF','AF','PF'])this.flags[f]=null;break;}
        case 'div':{const b=read();if(b===0n)fail('Integer divide by zero.');const dividend=w===8?this.getReg(0,16):(this.getReg(2,w)<<BigInt(w))|this.getReg(0,w),q=dividend/b,r=dividend%b;if(q>mask(w))fail('Divide overflow (quotient too large).');if(w===8)this.setReg(0,16,(r<<8n)|q);else{this.setReg(0,w,q);this.setReg(2,w,r);}for(const f of['CF','OF','SF','ZF','AF','PF'])this.flags[f]=null;break;}
        case 'idiv':{const b=signed(read(),w);if(b===0n)fail('Integer divide by zero.');const dividend=w===8?signed(this.getReg(0,16),16):signed((this.getReg(2,w)<<BigInt(w))|this.getReg(0,w),w*2),q=dividend/b,r=dividend%b;if(q<-(1n<<BigInt(w-1))||q>(1n<<BigInt(w-1))-1n)fail('Divide overflow (signed quotient out of range).');if(w===8)this.setReg(0,16,(unsigned(r,8)<<8n)|unsigned(q,8));else{this.setReg(0,w,unsigned(q,w));this.setReg(2,w,unsigned(r,w));}for(const f of['CF','OF','SF','ZF','AF','PF'])this.flags[f]=null;break;}
        case 'callind':{const target=read();this.regs[4]=unsigned(this.regs[4]-8n);this.writeMem(this.regs[4],64,d.next);this.calls.push({target,returnTo:d.next,sp:this.regs[4]});this.rip=target;break;}
        case 'jmpind':this.rip=read();break;
        case 'pushind':{const v=read();this.regs[4]=unsigned(this.regs[4]-8n);this.writeMem(this.regs[4],64,v);break;}
        case 'shl':case 'shr':case 'sar':{
          const n=Number(rhs())&(w===64?63:31);if(!n)break;
          const a=read(),nn=BigInt(n),r=unsigned(d.name==='shl'?a<<nn:d.name==='shr'?a>>nn:signed(a,w)>>nn,w);
          this.flags.CF=d.name==='sar'?!!((a>>BigInt(Math.min(n,w)-1))&1n):n>=w?null:!!(d.name==='shl'?(a>>BigInt(w-n))&1n:(a>>BigInt(n-1))&1n);
          this.flags.OF=n===1?(d.name==='sar'?false:d.name==='shr'?!!(a&(1n<<BigInt(w-1))):!!(r&(1n<<BigInt(w-1)))!==this.flags.CF):null;
          this.flags.AF=null;this.zsp(r,w);this.write(dst,r);break;
        }
        case 'push':{const value=read();this.regs[4]=unsigned(this.regs[4]-8n);this.writeMem(this.regs[4],64,value);break;}
        case 'pop':{const v=this.readMem(this.regs[4],64);this.regs[4]=unsigned(this.regs[4]+8n);this.write(dst,v);break;}
        case 'call':this.regs[4]=unsigned(this.regs[4]-8n);this.writeMem(this.regs[4],64,d.next);this.calls.push({target:dst.value,returnTo:d.next,sp:this.regs[4]});this.rip=dst.value;break;
        case 'ret':{const target=this.readMem(this.regs[4],64);this.regs[4]=unsigned(this.regs[4]+8n);this.rip=target;this.calls.pop();if(target===BigInt(RETURN)){this.status='halted';this.reason='Returned to the lab harness';}break;}
        case 'jmp':this.rip=dst.value;break;
        case 'jcc':if(this.condition(src.condition))this.rip=dst.value;break;
        case 'int3':this.reason='INT3 breakpoint';break;
        case 'nop':break;
        case 'syscall':{
          const nr=this.regs[0];this.regs[1]=d.next;let flags=2n;for(const [f,bit] of Object.entries({CF:0,PF:2,AF:4,ZF:6,SF:7,OF:11}))if(this.flags[f])flags|=1n<<BigInt(bit);this.regs[11]=flags;
          if(nr===60n){this.status='halted';this.reason=`Modeled exit(${Number(this.regs[7]&255n)})`;}
          else if(nr===1n){const count=this.regs[2];if(count>4096n)fail('Modeled write is limited to 4096 bytes.');if(this.regs[7]!==1n&&this.regs[7]!==2n)fail('Modeled write supports stdout/stderr only.');const a=this.range(this.regs[6],Number(count));this.output+=new TextDecoder().decode(this.memory.slice(a,a+Number(count)));this.regs[0]=count;}
          else fail(`System call ${nr} is not modeled. Only write(1) and exit(60) are supported; nothing runs on the host.`);
          break;
        }
        default:fail('Unimplemented instruction.');
      }
      this.steps++;
      this.history.push({before,writes:[...this.writes],instruction:d.name});if(this.history.length>512)this.history.shift();
      return true;
    }catch(e){
      for(const x of [...this.writes].reverse())this.memory[x.address]=x.old;this.restore(before);this.writes=[];
      this.status='fault';this.reason=e.message;this.history.push({before,writes:[],instruction:'fault'});if(this.history.length>512)this.history.shift();return false;
    }
  }
  run({limit=10000,breakpoints=new Set(),watchpoints=new Set(),skipCurrent=true,until=null}={}){
    let n=0;
    while(n<limit&&!['halted','fault'].includes(this.status)){
      if(breakpoints.has(Number(this.rip))&&(!skipCurrent||n>0)){this.status='paused';this.reason='Address breakpoint';break;}
      if(!this.step())break;n++;
      if(this.reason==='INT3 breakpoint')break;
      if(this.writes.some(x=>watchpoints.has(x.address))){this.reason='Memory write watchpoint';break;}
      if(until&&until(this)){this.status='paused';break;}
    }
    if(n===limit&&!['halted','fault'].includes(this.status)){this.status='paused';this.reason=`Instruction budget (${limit}) reached`;}
    return n;
  }
  // A caller-set stop (step over / finish) should not clobber a breakpoint,
  // watchpoint, INT3, or budget pause that interrupted the run first.
  interrupted(){return ['Address breakpoint','Memory write watchpoint','INT3 breakpoint'].includes(this.reason)||this.reason.startsWith('Instruction budget');}
  // Step over: execute one instruction; if it entered a call, run until the
  // matching return brings the call depth back to where it started. A breakpoint
  // or watchpoint inside the skipped region still stops execution.
  stepOver({breakpoints=new Set(),watchpoints=new Set()}={}){
    if(['halted','fault'].includes(this.status))return false;
    const depth=this.calls.length;
    if(!this.step())return false;
    if(this.calls.length>depth&&!['halted','fault'].includes(this.status)){
      this.run({breakpoints,watchpoints,skipCurrent:false,until:m=>m.calls.length<=depth});
      if(!this.interrupted()&&!['halted','fault'].includes(this.status))this.reason='Stepped over call';
    }
    return true;
  }
  // Finish: run until the current function returns to its caller (call depth
  // drops below the current frame). At the top frame this runs to completion.
  finish({breakpoints=new Set(),watchpoints=new Set()}={}){
    if(['halted','fault'].includes(this.status))return false;
    const depth=this.calls.length;
    this.run({breakpoints,watchpoints,skipCurrent:false,until:depth===0?null:m=>m.calls.length<depth});
    if(depth>0&&!this.interrupted()&&!['halted','fault'].includes(this.status))this.reason='Returned to caller';
    return true;
  }
  rowAt(){return this.program.instructions.find(x=>BigInt(x.address)===this.rip);}
}

export function exportGNU(source){
  return '.intel_syntax noprefix\n.global entry\n'+source.split('\n').map(s=>stripComment(s)).join('\n')+'\n.section .note.GNU-stack,"",@progbits\n';
}
