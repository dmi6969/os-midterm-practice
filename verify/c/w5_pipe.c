/* W5 的 pipe / dup2 / EOF / deadlock / signal 題目。用法：./w5_pipe <case> [args]
   標 verify 的是量測用（計時、印出結果到 stderr），不改變題目要問的行為。 */
#include "common.h"

/* ---------- fd 編號 ---------- */
static int fdnums(const char *k) {
    int fd[2];
    if (!strcmp(k, "w5-02")) {             /* close(1); open; pipe */
        close(1);
        int f = open("log.txt", O_RDONLY | O_CREAT, 0644);
        (void)f;
        pipe(fd);
    } else if (!strcmp(k, "v02a")) {       /* close(0); pipe */
        close(0);
        pipe(fd);
    } else if (!strcmp(k, "v02b")) {       /* open; dup(1); close(a); pipe */
        int a = open("log.txt", O_RDONLY | O_CREAT, 0644);
        int b = dup(1);
        (void)b;
        close(a);
        pipe(fd);
    } else if (!strcmp(k, "v02c")) {       /* pipe(p); pipe(q); */
        int p[2], q[2];
        pipe(p);
        pipe(q);
        fd[0] = q[0]; fd[1] = q[1];
    } else return 2;
    fprintf(stderr, "%d %d\n", fd[0], fd[1]);   /* verify: 用 stderr，因為 fd 1 可能已被改掉 */
    return 0;
}

/* ---------- W5-07：read 迴圈 ---------- */
static int w5_07(const char *k) {
    int fd[2];
    pipe(fd);
    long amount = !strcmp(k, "v07b") ? 10000 : 5000;
    if (fork() == 0) {                       /* child：寫完立刻 exit */
        close(fd[0]);
        static char data[10000];
        memset(data, 'x', sizeof data);
        write(fd[1], data, amount);
        exit(0);
    }
    if (!strcmp(k, "w5-07") || !strcmp(k, "first")) {
        close(fd[1]);
        sleep(2);
        char buf[1000];
        long total = 0;
        ssize_t n;
        if (!strcmp(k, "first")) {           /* verify: 只看第一次 read 的回傳值 */
            n = read(fd[0], buf, sizeof buf);
            fprintf(stderr, "%zd\n", n);
            return 0;
        }
        while ((n = read(fd[0], buf, sizeof buf)) >= 0)
            total += n;
        printf("got %ld bytes\n", total);
        return 0;
    }
    if (!strcmp(k, "v07a")) {                /* 條件改成 > 0，但 parent 忘了 close(fd[1]) */
        sleep(2);
        char buf[1000];
        long total = 0;
        ssize_t n;
        while ((n = read(fd[0], buf, sizeof buf)) > 0)
            total += n;
        printf("got %ld bytes\n", total);
        return 0;
    }
    if (!strcmp(k, "v07b")) {                /* buf 4096，child 寫 10000 bytes */
        close(fd[1]);
        sleep(2);
        char buf[4096];
        ssize_t r[4];
        for (int i = 0; i < 4; i++) r[i] = read(fd[0], buf, sizeof buf);
        fprintf(stderr, "%zd %zd %zd %zd\n", r[0], r[1], r[2], r[3]);
        return 0;
    }
    return 2;
}

/* ---------- read() 三種結果：有資料 / 空但還有 writer（block）/ 空且沒有 writer（0） ---------- */
static int r1(void) {
    int fd[2];
    pipe(fd);
    if (fork() == 0) {
        close(fd[0]);
        write(fd[1], "0123456789", 10);
        sleep(3);                            /* 握著 write end 不放 */
        exit(0);
    }
    close(fd[1]);
    sleep(1);
    char buf[4];
    ssize_t a = read(fd[0], buf, 4);
    ssize_t b = read(fd[0], buf, 4);
    ssize_t c = read(fd[0], buf, 4);
    double t0 = verify_now();
    ssize_t d = read(fd[0], buf, 4);         /* 第 4 次：pipe 空了、child 還握著 write end */
    double waited = verify_now() - t0;
    fprintf(stderr, "%zd %zd %zd %zd waited=%.1f\n", a, b, c, d, waited);
    return 0;
}

/* ---------- 兩條 pipe：parent → A → child → B → parent ---------- */
static int twopipe(long n_kib, int close_after_read) {
    int A[2], B[2];
    pipe(A); pipe(B);
    if (fork() == 0) {                       /* child：從 A 讀 4 KiB、寫進 B，A 到 EOF 就結束 */
        close(A[1]); close(B[0]);
        char buf[4096];
        ssize_t n;
        while ((n = read(A[0], buf, sizeof buf)) > 0)
            write(B[1], buf, n);
        exit(0);
    }
    close(A[0]); close(B[1]);
    long n = n_kib * 1024;
    char *data = malloc(n);
    memset(data, 'x', n);
    char buf[4096];
    long got = 0;
    ssize_t r;
    if (!close_after_read) {
        write(A[1], data, n);
        close(A[1]);
        while ((r = read(B[0], buf, sizeof buf)) > 0) got += r;
    } else {                                 /* 變化：close(A) 放到讀 B 之後 */
        write(A[1], data, n);
        while ((r = read(B[0], buf, sizeof buf)) > 0) got += r;
        close(A[1]);
    }
    wait(NULL);
    fprintf(stderr, "finished %ld\n", got);
    return 0;
}

/* ---------- 先 wait 再讀：worker 寫 N bytes ---------- */
static int waitfirst(long N) {
    int fd[2];
    pipe(fd);
    if (fork() == 0) {
        close(fd[0]);
        char *d = malloc(N);
        memset(d, 'x', N);
        write(fd[1], d, N);
        exit(0);
    }
    close(fd[1]);
    wait(NULL);
    char buf[4096];
    long got = 0;
    ssize_t r;
    while ((r = read(fd[0], buf, sizeof buf)) > 0) got += r;
    fprintf(stderr, "finished %ld\n", got);
    return 0;
}

/* ---------- sleep 1000 | cat，kill -INT sleep ---------- */
static int kill_sleep(void) {
    int fd[2];
    pipe(fd);
    pid_t s = fork();
    if (s == 0) { dup2(fd[1], 1); close(fd[0]); close(fd[1]); execlp("sleep", "sleep", "1000", (char *)NULL); exit(127); }
    pid_t c = fork();
    if (c == 0) { dup2(fd[0], 0); close(fd[0]); close(fd[1]); execlp("cat", "cat", (char *)NULL); exit(127); }
    close(fd[0]); close(fd[1]);
    sleep(1);
    kill(s, SIGINT);                         /* 只送給 sleep */
    int st_s, st_c;
    waitpid(s, &st_s, 0);
    waitpid(c, &st_c, 0);
    fprintf(stderr, "sleep:%d cat:%d\n",
            WIFSIGNALED(st_s) ? 128 + WTERMSIG(st_s) : WEXITSTATUS(st_s),
            WIFSIGNALED(st_c) ? 128 + WTERMSIG(st_c) : WEXITSTATUS(st_c));
    return 0;
}

/* ---------- yes | cat | wc -l，kill -9 cat，回報三個 exit status（同 bash 的 PIPESTATUS） ---------- */
static int three_stage(void) {
    int p[2], q[2];
    pipe(p); pipe(q);
    pid_t y = fork();
    if (y == 0) { dup2(p[1], 1); close(p[0]); close(p[1]); close(q[0]); close(q[1]); execlp("yes", "yes", (char *)NULL); exit(127); }
    pid_t c = fork();
    if (c == 0) { dup2(p[0], 0); dup2(q[1], 1); close(p[0]); close(p[1]); close(q[0]); close(q[1]); execlp("cat", "cat", (char *)NULL); exit(127); }
    pid_t w = fork();
    if (w == 0) {
        int dn = open("/dev/null", O_WRONLY);
        dup2(q[0], 0); dup2(dn, 1); close(p[0]); close(p[1]); close(q[0]); close(q[1]);
        execlp("wc", "wc", "-l", (char *)NULL); exit(127);
    }
    close(p[0]); close(p[1]); close(q[0]); close(q[1]);
    sleep(1);
    kill(c, SIGKILL);
    int sy, sc, sw;
    waitpid(y, &sy, 0); waitpid(c, &sc, 0); waitpid(w, &sw, 0);
#define ST(s) (WIFSIGNALED(s) ? 128 + WTERMSIG(s) : WEXITSTATUS(s))
    fprintf(stderr, "%d %d %d\n", ST(sy), ST(sc), ST(sw));
    return 0;
}

/* ---------- dup2 之後 close 原 fd，printf 仍進 pipe ---------- */
static int dup2close(void) {
    int fd[2];
    pipe(fd);
    if (fork() == 0) {
        dup2(fd[1], 1);
        close(fd[1]);
        close(fd[0]);
        printf("hi\n");
        fflush(stdout);
        exit(0);
    }
    close(fd[1]);
    char buf[16] = {0};
    ssize_t n = read(fd[0], buf, sizeof buf - 1);
    wait(NULL);
    fprintf(stderr, "%s", n > 0 && !strcmp(buf, "hi\n") ? "pipe\n" : "not-pipe\n");
    return 0;
}

/* ---------- 一個忽略 SIGTERM、會跑 60 秒的程式（給 timeout -k 測試） ---------- */
static int ignterm(void) {
    signal(SIGTERM, SIG_IGN);
    sleep(60);
    return 0;
}

int main(int argc, char **argv) {
    const char *k = argc > 1 ? argv[1] : "";
    if (!strcmp(k, "w5-02") || !strcmp(k, "v02a") || !strcmp(k, "v02b") || !strcmp(k, "v02c")) return fdnums(k);
    if (!strcmp(k, "w5-07") || !strcmp(k, "first") || !strcmp(k, "v07a") || !strcmp(k, "v07b")) return w5_07(k);
    if (!strcmp(k, "r1")) return r1();
    if (!strcmp(k, "twopipe")) return twopipe(atol(argv[2]), 0);
    if (!strcmp(k, "twopipe-late-close")) return twopipe(atol(argv[2]), 1);
    if (!strcmp(k, "waitfirst")) return waitfirst(atol(argv[2]));
    if (!strcmp(k, "kill-sleep")) return kill_sleep();
    if (!strcmp(k, "three-stage")) return three_stage();
    if (!strcmp(k, "dup2close")) return dup2close();
    if (!strcmp(k, "ignterm")) return ignterm();
    fprintf(stderr, "unknown case %s\n", k);
    return 2;
}
