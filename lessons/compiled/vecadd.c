// SSE packed integers: one instruction adds four lanes at once.
// Build two int-by-4 vectors, add them with a single paddd, then sum
// the result lanes back into a scalar return value.
typedef int int4 __attribute__((vector_size(16)));

int vecsum(int x)
{
    int4 a = { x, x + 1, x + 2, x + 3 };
    int4 b = { 10, 20, 30, 40 };
    int4 c = a + b;                  // paddd: four adds in one instruction
    return c[0] + c[1] + c[2] + c[3];
}
