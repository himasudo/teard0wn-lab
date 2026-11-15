long get(long *a, long i)
{
    if ((unsigned long)i >= 4)
        return -1;
    return a[i];
}
