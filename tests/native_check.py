"""Compare generated instruction bytes against native x86-64 execution.

Only repository-authored, bounded arithmetic/control-flow fixtures run here.
No imported learner programs are executed. Requires Linux x86-64, Node and GCC.
"""
import json
import pathlib
import platform
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
C = r'''
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>
extern void probe(void*, uint64_t, uint64_t, uint64_t*);
int main(int argc, char** argv) {
  if (argc != 4 || strlen(argv[1]) > 4096 || strlen(argv[1]) % 2) return 2;
  unsigned char* code = mmap(NULL, 4096, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0);
  if (code == MAP_FAILED) return 3;
  for (size_t i=0; i<strlen(argv[1])/2; ++i) { unsigned b; if(sscanf(argv[1]+2*i,"%2x",&b)!=1)return 4; code[i]=(unsigned char)b; }
  if(mprotect(code,4096,PROT_READ|PROT_EXEC))return 5;
  uint64_t out[15]={0};
  probe(code,strtoull(argv[2],NULL,10),strtoull(argv[3],NULL,10),out);
  for(int i=0;i<15;++i)printf("%llu%s",(unsigned long long)out[i],i==14?"\n":" ");
  munmap(code,4096); return 0;
}
'''
ASM = r'''
.intel_syntax noprefix
.text
.global probe
.type probe,@function
probe:
push rbp
push rbx
push r12
push r13
push r14
push r15
sub rsp,40
mov [rsp],rdi
mov [rsp+8],rcx
mov [rsp+16],rsi
mov [rsp+24],rdx
mov rbx,0
mov rcx,0
mov rdx,0
mov rsi,0
mov rbp,0
mov r8,0
mov r9,0
mov r10,0
mov r11,0
mov r12,0
mov r13,0
mov r14,0
mov r15,0
mov rdi,[rsp+16]
mov rax,[rsp+24]
push 2
popfq
call qword ptr [rsp]
pushfq
push r10
push r11
mov r11,[rsp+32]
mov [r11],rax
mov [r11+8],rcx
mov [r11+16],rdx
mov [r11+24],rbx
mov [r11+32],rsi
mov [r11+40],rdi
mov [r11+48],r8
mov [r11+56],r9
mov rax,[rsp+8]
mov [r11+64],rax
mov rax,[rsp]
mov [r11+72],rax
mov [r11+80],r12
mov [r11+88],r13
mov [r11+96],r14
mov [r11+104],r15
mov rax,[rsp+16]
mov [r11+112],rax
add rsp,24
add rsp,40
pop r15
pop r14
pop r13
pop r12
pop rbx
pop rbp
ret
.section .note.GNU-stack,"",@progbits
'''

def main():
    if platform.system() != 'Linux' or platform.machine() not in ('x86_64', 'amd64'):
        raise SystemExit('Native comparison requires Linux x86-64; it was NOT run.')
    fixtures = json.loads(subprocess.check_output(['node', str(ROOT/'tests/native-fixtures.js')], text=True))
    failed = []
    with tempfile.TemporaryDirectory(prefix='teard0wn-native-') as tmp:
        p = pathlib.Path(tmp)
        (p/'probe.c').write_text(C)
        (p/'probe.S').write_text(ASM)
        subprocess.run(['gcc','-O2','-Wall','-Wextra','-Werror',str(p/'probe.c'),str(p/'probe.S'),'-o',str(p/'probe')],check=True)
        for f in fixtures:
            try:
                values = list(map(int,subprocess.check_output([str(p/'probe'),f['bytes'],f['input'],f['initial']],text=True,timeout=2).split()))
                expected = list(map(int,f['registers']))
                if values[:14] != expected:
                    failed.append((f['name'],'registers',values[:14],expected))
                for flag,bit in {'CF':0,'PF':2,'AF':4,'ZF':6,'SF':7,'OF':11}.items():
                    wanted=f['flags'][flag]
                    if wanted is not None and bool(values[14] & (1<<bit)) != wanted:
                        failed.append((f['name'],flag,bool(values[14] & (1<<bit)),wanted))
            except (subprocess.SubprocessError,ValueError) as e:
                failed.append((f['name'],'native execution',str(e)))
    for failure in failed[:30]: print('FAIL',failure)
    print(f'Native x86-64 comparison: {len(fixtures)} fixtures; {len(failed)} mismatches')
    if failed: raise SystemExit(1)

if __name__ == '__main__': main()
