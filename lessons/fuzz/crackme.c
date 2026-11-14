/* A byte-gated target: random inputs almost never get past the first check,
   but a coverage-guided fuzzer keeps each input that reaches a new gate and
   mutates from there, cracking it one byte at a time. The final gate divides
   by zero, which the engine reports as a fault the fuzzer can find. */
int crackme(unsigned x)
{
    unsigned char b0 = x, b1 = x >> 8, b2 = x >> 16, b3 = x >> 24;
    if (b0 != 0x37)
        return 0;
    if (b1 != 0x13)
        return 1;
    if (b2 != 0x42)
        return 2;
    if (b3 != 0x42)
        return 3;
    int z = (int)x - 0x42421337;   /* runtime value, zero only for the magic input */
    return 1000000 / z;            /* divide by zero when x == 0x42421337 */
}
