#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

struct record { uint8_t kind; uint64_t value; uint16_t count; };
int main(void) {
    struct record r = {1, UINT64_C(0x1122334455667788), 3};
    const unsigned char *bytes = (const unsigned char *)&r;
    printf("size=%zu alignment=%zu kind=%zu value=%zu count=%zu\n",
           sizeof r, _Alignof(struct record), offsetof(struct record, kind),
           offsetof(struct record, value), offsetof(struct record, count));
    for (size_t i = 0; i < sizeof r; ++i) printf("%02x%s", bytes[i], (i+1)%8 ? " " : "\n");
    // Padding bytes have unspecified values. Do not infer semantic fields from them.
    return 0;
}
