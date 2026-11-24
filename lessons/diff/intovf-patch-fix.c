long alloc_size(long count, long width)
{
    if (width != 0 && count > 0x7fffffffffffffffL / width)
        return -1;
    return count * width;
}
