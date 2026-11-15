struct N { long *next; int id; int flags; char tag; };
long probe(struct N *n)
{
    return (long)n->next + n->id + n->flags + n->tag;
}
