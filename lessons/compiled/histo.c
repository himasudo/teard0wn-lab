static int tbl[8];

int histo(int x)
{
    for (int i = 0; i < 8; i++)
        tbl[i] = 0;
    int n = x;
    while (n) {
        tbl[n & 7]++;
        n >>= 3;
    }
    int mx = 0;
    for (int i = 0; i < 8; i++)
        if (tbl[i] > mx)
            mx = tbl[i];
    return mx;
}
