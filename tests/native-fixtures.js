import {Machine,assemble} from '../src/machine.js';
const fixtures=[];
function add(name,source,initial=0n,input=0n){const program=assemble(source+'\nret');const m=new Machine(program,{rax:initial,rdi:input});m.run();if(m.status!=='halted')throw new Error(name+': '+m.reason);fixtures.push({name,bytes:Buffer.from(program.code).toString('hex'),initial:String(initial),input:String(input),registers:[0,1,2,3,6,7,8,9,10,11,12,13,14,15].map(i=>String(m.regs[i])),flags:m.flags});}
for(const w of [8,16,32,64]){
 const reg={8:'al',16:'ax',32:'eax',64:'rax'}[w],max=(1n<<BigInt(w))-1n,sign=1n<<BigInt(w-1);
 for(const op of ['add','sub','cmp','and','or','xor','test'])for(const [a,b] of [[0n,0n],[0n,1n],[max,1n],[sign-1n,1n],[sign,1n],[15n,1n],[123n,45n]])add(`${op}/${w}/${a}/${b}`,`mov ${reg}, ${a}\n${op} ${reg}, ${b}`,0xabcddcba12345678n);
 for(const op of ['inc','dec','neg','not'])for(const a of [0n,1n,max,sign])add(`${op}/${w}/${a}`,`mov ${reg}, ${a}\n${op} ${reg}`,0xabcddcba12345678n);
 for(const op of ['shl','shr','sar'])for(const count of [0,1,2,w-1,w,32,63])add(`${op}/${w}/${count}`,`mov ${reg}, ${sign|3n}\n${op} ${reg}, ${count}`,0xabcddcba12345678n);
}
for(const w of [16,32,64]){
 const a={16:'ax',32:'eax',64:'rax'}[w],b={16:'cx',32:'ecx',64:'rcx'}[w];
 for(const [x,y] of [[3n,7n],[-5n,4n],[(1n<<BigInt(w-1))-1n,2n]])add(`imul/${w}/${x}/${y}`,`mov ${a}, ${x}\nmov ${b}, ${y}\nimul ${a}, ${b}`);
}
for(const branch of ['jo','jno','jb','jae','je','jne','jbe','ja','js','jns','jp','jnp','jl','jge','jle','jg'])for(const input of [0n,8n,9n,0xffffffffn])add(`${branch}/${input}`,`cmp edi, 8\n${branch} yes\nmov eax, 0\njmp end\nyes: mov eax, 1\nend: nop`,0n,input);
add('low-byte REX register','mov r12, -1\nmov r12b, 42\nmov rax, r12\nmov dil, 7');
add('callee saved high registers','mov r15, 0x123456789abcdef0\nmov r8, r15\nmov r9d, r8d\nmov r10w, r9w\nmov r11b, r10b\nmov rax, r15');
// Native RSP and teaching RSP differ. Establish flags from the returned data,
// not from arithmetic on those unrelated stack addresses.
add('stack memory displacement and arithmetic','sub rsp, 16\nmov qword ptr [rsp+8], 42\nadd qword ptr [rsp+8], -1\nmov rax, qword ptr [rsp+8]\nadd rsp, 16\ntest rax, rax');
add('call ret','call f\njmp end\nf: mov eax, 42\nret\nend: nop');
console.log(JSON.stringify(fixtures));
