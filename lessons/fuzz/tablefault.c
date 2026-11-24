/* Two byte gates, then an out-of-bounds read. Coverage guidance cracks the
   gates a byte at a time, as in the byte-gated crackme; but past them the
   input indexes a four-entry table with no bounds check, so a large index
   reads far out of range and the engine faults. The crash is an out-of-bounds
   read, not a divide-by-zero -- run it, then open triage to see it classified. */
int tablefault(unsigned x)
{
    static const int t[4] = {10, 20, 30, 40};
    unsigned char b0 = x, b1 = x >> 8;
    if (b0 != 0x5a)
        return 0;
    if (b1 != 0x3c)
        return 1;
    unsigned i = (x >> 16) & 0xffff;
    return t[i];
}
