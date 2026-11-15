long pick(long i)
{
    long t[4] = {10, 20, 30, 40};
    if ((unsigned long)i > 3)
        return -1;
    return t[i];
}
