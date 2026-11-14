#include <stdint.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>

// In this Linux x86-64 fixture, memcpy makes the signed reinterpretation explicit.
static int wrong(uint32_t length) {
    int32_t signed_length;
    memcpy(&signed_length, &length, sizeof signed_length);
    return signed_length <= 8;
}
static int repaired(uint32_t length) { return length <= UINT32_C(8); }
int main(void) {
    const uint32_t cases[] = {0, 8, 9, UINT32_C(0x80000000), UINT32_MAX};
    for (unsigned i = 0; i < sizeof cases / sizeof cases[0]; ++i)
        printf("length=%10" PRIu32 " wrong=%d repaired=%d\n", cases[i], wrong(cases[i]), repaired(cases[i]));
    return 0;
}
