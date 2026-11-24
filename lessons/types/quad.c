struct Q { int a; int b; int c; int d; };
long probe(struct Q *q)
{
    return q->a + q->b + q->c + q->d;
}
