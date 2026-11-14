#include <stdint.h>
#include <inttypes.h>
#include <stdio.h>

static uint64_t lookup(uint64_t index) {
    static const uint64_t values[] = {3, 7, 11, 19};
    if (index >= sizeof values / sizeof values[0]) return UINT64_MAX;
    return values[index];
}
int main(void) {
    const uint64_t cases[] = {0, 3, 4, UINT64_MAX};
    for (unsigned i = 0; i < sizeof cases / sizeof cases[0]; ++i)
        printf("index=%20" PRIu64 " result=%20" PRIu64 "\n", cases[i], lookup(cases[i]));
    return 0;
}
