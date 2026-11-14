/* A shallow bug: one scramble, then a divide whose divisor is zero for a
   single scrambled byte value. No gates, so even undirected fuzzing finds it
   quickly -- a contrast with the byte-gated crackme. */
int modhash(unsigned x)
{
    unsigned a = (x * 2654435761u) >> 24;   /* scramble to a byte */
    int d = (int)a - 0x5a;
    return 1000 / d;                         /* divide by zero when a == 0x5a */
}
