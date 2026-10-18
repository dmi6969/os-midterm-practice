/* W4 的 exception 題目。用法：./w4_exc <case> */
#include "common.h"
#include <sys/mman.h>
#include <sys/resource.h>

static long minflt(void) { struct rusage r; getrusage(RUSAGE_SELF, &r); return r.ru_minflt; }

int main(int argc, char **argv) {
    const char *k = argc > 1 ? argv[1] : "";

    /* 除以 0 → fault → SIGFPE，shell 的 $? = 128 + 8 */
    if (!strcmp(k, "fpe")) {
        int x = 0;
        printf("%d", 10 / x);
        return 0;
    }
    /* 寫 address 0 → page fault（無效位址）→ SIGSEGV，$? = 128 + 11 */
    if (!strcmp(k, "segv")) {
        *(int *)0 = 1;
        return 0;
    }
    /* 一段沒碰過的 32 KiB 區域，在 offset 4095、4096、8191、12288 各寫 1 byte，數 minor page fault。
       注意：Linux 的 ru_minflt 會反映這個數字；Windows 上的 MSYS2 不一定提供，此時只當參考。 */
    if (!strcmp(k, "pf")) {
        long pg = sysconf(_SC_PAGESIZE);
        char *p = mmap(NULL, 32 * 1024, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
        long offs[] = {4095, 4096, 8191, 12288};
        long before = minflt();
        for (int i = 0; i < 4; i++) p[offs[i]] = 1;
        long after = minflt();
        printf("pagesize=%ld faults=%ld\n", pg, after - before);
        return 0;
    }
    fprintf(stderr, "unknown case %s\n", k);
    return 2;
}
