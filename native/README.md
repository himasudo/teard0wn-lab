# Native companion investigations

These three small C programs complement the browser lessons. They are not a
native execution service and are never launched by the website. Run them in
your own Linux development environment when you want to compare real compiler
output and GDB state.

```sh
gcc -std=c11 -Og -g3 -fno-omit-frame-pointer -Wall -Wextra -Werror signedness.c -o /tmp/teard0wn-signedness
/tmp/teard0wn-signedness
gdb /tmp/teard0wn-signedness
```

In GDB, break at `wrong`, run, use `disassemble /m wrong`, and compare the
conditional branches with `repaired`. At higher optimization levels, inlining
and constant propagation may remove the functions; that is another observation
to explain, not a debugger failure.

`layout.c` prints offsets, alignment, and object bytes. Its padding bytes have
unspecified values. Record compiler, flags, architecture, and ABI before treating
one observed layout as portable. `bounds.c` demonstrates a checked unsigned
index and defined error result without intentionally executing undefined access.

Browser fixture addresses such as 0x2000 are not native process addresses.
Downloaded assembly is useful for inspection/assembly, but native loading,
relocations, entry conventions, and modeled syscall differences must be handled
explicitly. Do not simply run arbitrary browser snippets as host programs.
