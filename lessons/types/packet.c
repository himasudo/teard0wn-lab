struct P { char type; int len; short port; long id; };
long probe(struct P *p)
{
    return p->type + p->len + p->port + p->id;
}
