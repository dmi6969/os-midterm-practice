/* 第二回 W3：fork 計數、緩衝與 fork、exec、wait、zombie、orphan。用法：./s2_w3 <case> */
#include "common.h"

static int q1(void) { if (fork() == 0) fork(); printf("X\n"); return 0; }
static int q2(void) { if (fork() > 0) fork(); fork(); printf("Y\n"); return 0; }
static int q3(void) { (fork() && fork()) || fork(); printf("Z\n"); return 0; }
static int q4(void) {
    int i;
    for (i = 0; i < 3; i++)
        if (fork() == 0)
            break;
    printf("%d\n", i);
    return 0;
}
static int q5(void) {
    verify_count_processes("count.txt");   /* verify */
    for (int i = 0; i < 3; i++)
        if (fork() > 0)
            break;
    return 0;
}
static int q6(void) {
    printf("start\n");
    for (int i = 0; i < 2; i++)
        fork();
    printf("end\n");
    return 0;
}
static int q7(void) { printf("hi"); fork(); printf("\n"); return 0; }
static int q8(void) { printf("A\n"); fflush(stdout); fork(); printf("B\n"); return 0; }
static int q9(void) {
    if (fork() == 0) {
        int fd = open("out.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
        dup2(fd, 1);
        close(fd);
        execlp("echo", "echo", "hello", (char *)NULL);
        exit(1);
    }
    wait(NULL);
    printf("done\n");
    return 0;
}
static int q10(void) {
    printf("x\n");
    if (fork() == 0)
        _exit(0);
    wait(NULL);
    return 0;
}
static int q11(void) {
    pid_t c1 = fork();
    if (c1 == 0) exit(0);
    pid_t c2 = fork();
    if (c2 == 0) { sleep(100); exit(0); }
    sleep(1);
    pid_t r = wait(NULL);
    int z = 0;                                          /* verify: 還剩幾個 zombie */
    while (waitpid(-1, NULL, WNOHANG) > 0) z++;
    printf("%s %d\n", r == c1 ? "c1" : "other", z);
    kill(c2, SIGKILL);
    waitpid(c2, NULL, 0);
    return 0;
}
static int q16(void) {
    if (fork() == 0) {
        execlp("nosuchcmd", "nosuchcmd", (char *)NULL);
        perror("exec");
        exit(127);
    }
    int st;
    wait(&st);
    printf("%d\n", WEXITSTATUS(st));                   /* verify */
    return 0;
}
static void sleep_ms(int ms) { struct timespec t = { ms / 1000, (ms % 1000) * 1000000L }; nanosleep(&t, NULL); }
static void record_ppid(void) {                         /* verify: 把自己的 PPID 記到檔案 */
    char s[32];
    int n = snprintf(s, sizeof s, "%d\n", (int)getppid());
    int f = open("ppids.txt", O_WRONLY | O_CREAT | O_APPEND, 0644);
    write(f, s, n);
    close(f);
}
static int q36(void) {
    for (int i = 0; i < 3; i++) {
        if (fork() == 0) {                              /* C1, C2, C3 */
            if (i == 0 && fork() == 0) {                /* G1：C1 的 child */
                sleep_ms(1000);
                record_ppid();
                exit(0);
            }
            sleep_ms(1000);
            record_ppid();
            sleep_ms(1000);                             /* C1 活得比 G1 記錄的時間久 */
            exit(0);
        }
    }
    return 0;                                           /* P 立刻結束 */
}
static int q43(void) {
    pid_t kid[3];
    for (int i = 0; i < 3; i++) {
        kid[i] = fork();
        if (kid[i] == 0) exit(0);
    }
    sleep(1);
    waitpid(kid[1], NULL, 0);
    int z = 0;                                          /* verify：sleep(30) 期間的 zombie 數 */
    while (waitpid(-1, NULL, WNOHANG) > 0) z++;
    printf("%d\n", z);
    return 0;
}

int main(int argc, char **argv) {
    const char *k = argc > 1 ? argv[1] : "";
    if (!strcmp(k, "q1")) return q1();
    if (!strcmp(k, "q2")) return q2();
    if (!strcmp(k, "q3")) return q3();
    if (!strcmp(k, "q4")) return q4();
    if (!strcmp(k, "q5")) return q5();
    if (!strcmp(k, "q6")) return q6();
    if (!strcmp(k, "q7")) return q7();
    if (!strcmp(k, "q8")) return q8();
    if (!strcmp(k, "q9")) return q9();
    if (!strcmp(k, "q10")) return q10();
    if (!strcmp(k, "q11")) return q11();
    if (!strcmp(k, "q16")) return q16();
    if (!strcmp(k, "q36")) return q36();
    if (!strcmp(k, "q43")) return q43();
    fprintf(stderr, "unknown case %s\n", k);
    return 2;
}
