struct R { short a; long b; int c; char d; };
long probe(struct R *r)
{
    return r->a + r->b + r->c + r->d;
}
