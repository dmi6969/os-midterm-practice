/* W2 的 printf / write / buffer 題目。用法：./w2_buffers <case> （case 見下方），stdout 依題目導向檔案或終端機。
   每個 case 的程式碼與題目一致；標 verify 的是量測用。 */
#include "common.h"

static long size_of(const char *p) { struct stat st; if (stat(p, &st) < 0) return -1; return (long)st.st_size; }

int main(int argc, char **argv) {
    const char *k = argc > 1 ? argv[1] : "";

    /* W2-08：./test > out.txt，尚未結束時 ls -l 的大小與 libc buffer 內的 bytes */
    if (!strcmp(k, "w2-08")) {
        printf("hello ");
        printf("world");
        fprintf(stderr, "%ld %zu\n", size_of("out.txt"), __fpending(stdout));   /* verify */
        return 0;
    }
    /* W2-08 變化：在終端機執行（line-buffered） */
    if (!strcmp(k, "v08a")) {
        printf("hello\n");
        printf("world");
        char s[32]; snprintf(s, sizeof s, "%zu", __fpending(stdout));          /* verify */
        verify_write_file("pending.txt", s);                                   /* verify */
        return 0;
    }
    /* W2-08 變化：printf + fflush + printf，尚未結束時的檔案大小 */
    if (!strcmp(k, "v08b")) {
        printf("hello ");
        fflush(stdout);
        printf("world");
        fprintf(stderr, "%ld\n", size_of("out.txt"));                           /* verify */
        return 0;
    }
    /* W2-17 P1–P4 */
    if (!strcmp(k, "p1")) { printf("one "); write(1, "two ", 4); return 0; }
    if (!strcmp(k, "p2")) { printf("one "); fflush(stdout); write(1, "two ", 4); return 0; }
    if (!strcmp(k, "p3")) { printf("one "); write(1, "two ", 4); *(int *)0 = 1; return 0; }
    if (!strcmp(k, "p4")) { write(1, "one ", 4); printf("two "); *(int *)0 = 1; return 0; }
    /* W2-17 變化 */
    if (!strcmp(k, "v17a")) { write(1, "one ", 4); printf("two "); write(1, "three ", 6); return 0; }
    if (!strcmp(k, "v17b")) { fprintf(stderr, "one "); printf("two "); write(1, "three ", 6); *(int *)0 = 1; return 0; }

    /* W2-22：哪些事件會把 11 bytes 交給 kernel */
    if (!strncmp(k, "w2-22-", 6)) {
        const char *m = k + 6;
        printf("hello world");
        if (!strcmp(m, "crash"))  { *(int *)0 = 1; }
        if (!strcmp(m, "fflush")) { fflush(stdout); fprintf(stderr, "%ld", size_of("out.txt")); _exit(0); }
        if (!strcmp(m, "full"))   { for (int i = 0; i < 20000; i++) printf("0123456789"); fprintf(stderr, "%ld", size_of("out.txt")); _exit(0); }
        if (!strcmp(m, "idle"))   { sleep(3); fprintf(stderr, "%ld", size_of("out.txt")); _exit(0); }
        if (!strcmp(m, "return")) { return 0; }
        if (!strcmp(m, "exit"))   { exit(0); }
        if (!strcmp(m, "_exit"))  { _exit(0); }
        return 0;
    }
    fprintf(stderr, "unknown case %s\n", k);
    return 2;
}
