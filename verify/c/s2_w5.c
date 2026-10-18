/* 第二回 W5：fd 編號、dup2、read 的回傳值、EOF、deadlock、signal。用法：./s2_w5 <case> */
#include "common.h"
#include <errno.h>

static const char *ename(int e) { return e == EBADF ? "EBADF" : e == EPIPE ? "EPIPE" : e == EINVAL ? "EINVAL" : "OTHER"; }
static void sleep_ms(int ms) { struct timespec t = { ms / 1000, (ms % 1000) * 1000000L }; nanosleep(&t, NULL); }
#define ST(s) (WIFSIGNALED(s) ? 128 + WTERMSIG(s) : WEXITSTATUS(s))

static volatile sig_atomic_t got_term = 0;
static void on_term(int s) { (void)s; got_term = 1; }
static void on_kill(int s) { (void)s; }

int main(int argc, char **argv) {
    const char *k = argc > 1 ? argv[1] : "";
    int fd[2];
    char buf[8192];

    if (!strcmp(k, "fd1")) {
        int saved = dup(2);
        (void)saved;
        close(0);
        close(2);
        pipe(fd);
        printf("%d %d\n", fd[0], fd[1]);
        return 0;
    }
    if (!strcmp(k, "fd2")) {
        int p[2], q[2], r[2];
        pipe(p); pipe(q); close(p[0]); pipe(r);
        printf("%d %d\n", r[0], r[1]);
        return 0;
    }
    if (!strcmp(k, "fd3")) {
        int f = open("log.txt", O_WRONLY | O_CREAT, 0644);
        dup2(f, 1);
        close(f);
        int g = open("other.txt", O_RDONLY | O_CREAT, 0644);
        fprintf(stderr, "%d\n", g);                 /* verify: fd 1 已被改掉，所以印到 stderr */
        return 0;
    }
    if (!strcmp(k, "dup2bad")) {
        struct stat before, after;
        fstat(1, &before);
        int r = dup2(9, 1);
        int e = errno;
        fstat(1, &after);
        int same = before.st_dev == after.st_dev && before.st_ino == after.st_ino;
        fprintf(stderr, "%d %s %s\n", r, ename(e), same ? "unchanged" : "changed");
        return 0;
    }
    if (!strcmp(k, "writeread")) {
        pipe(fd);
        ssize_t n = write(fd[0], "hi", 2);
        printf("%zd %s\n", n, n < 0 ? ename(errno) : "-");
        return 0;
    }
    if (!strcmp(k, "partial")) {
        pipe(fd);
        write(fd[1], "abc", 3);                     /* 同一個 process 仍握著 write end */
        printf("%zd\n", read(fd[0], buf, 100));
        return 0;
    }
    if (!strcmp(k, "count2")) {
        pipe(fd);
        if (fork() == 0) { close(fd[0]); write(fd[1], "hello", 5); exit(0); }
        close(fd[1]);
        sleep_ms(300);
        int count = 0;
        ssize_t n;
        while ((n = read(fd[0], buf, 2)) > 0) count++;
        printf("%d\n", count);
        wait(NULL);
        return 0;
    }
    if (!strcmp(k, "spin")) {                       /* fd 是 −1，迴圈條件寫成 != 0 */
        int bad = -1;
        ssize_t n;
        while ((n = read(bad, buf, 1000)) != 0)
            ;
        return 0;
    }
    if (!strcmp(k, "firstchunk")) {
        pipe(fd);
        if (fork() == 0) {
            close(fd[0]);
            memset(buf, 'x', 3000);
            write(fd[1], buf, 3000);
            sleep(1);
            write(fd[1], buf, 3000);
            exit(0);
        }
        close(fd[1]);
        sleep_ms(300);                              /* 等第一批 3000 bytes 進 pipe */
        printf("%zd\n", read(fd[0], buf, 4096));
        wait(NULL);
        return 0;
    }
    if (!strcmp(k, "parentwriter")) {               /* parent 寫完沒 close 就 wait → 卡住 */
        pipe(fd);
        if (fork() == 0) {
            close(fd[1]);
            while (read(fd[0], buf, sizeof buf) > 0)
                ;
            exit(0);
        }
        memset(buf, 'x', 1000);
        write(fd[1], buf, 1000);
        wait(NULL);
        printf("finished\n");
        return 0;
    }
    if (!strcmp(k, "stuck")) {                      /* 20 塊 4096 bytes，沒人讀：卡住時 pipe 裡有幾個 byte */
        pipe(fd);
        pid_t w = fork();
        if (w == 0) {
            close(fd[0]);
            static char d[4096];
            memset(d, 'x', sizeof d);
            for (int i = 0; i < 20; i++) write(fd[1], d, sizeof d);
            exit(0);
        }
        close(fd[1]);
        sleep(1);                                   /* 題目裡 parent 在 wait()；這裡等 1 秒讓 worker 卡住 */
        kill(w, SIGKILL);                           /* verify: 強制結束 worker，再把 pipe 讀乾、數 byte */
        waitpid(w, NULL, 0);
        long total = 0;
        ssize_t n;
        while ((n = read(fd[0], buf, sizeof buf)) > 0) total += n;
        printf("%ld\n", total);
        return 0;
    }
    if (!strcmp(k, "termhandler")) {
        pid_t c = fork();
        if (c == 0) {
            signal(SIGTERM, on_term);
            while (!got_term) pause();
            /* 「存檔」之後自己結束 */
            exit(0);
        }
        sleep_ms(300);
        kill(c, SIGTERM);
        int st;
        waitpid(c, &st, 0);
        printf("%s %d\n", WIFEXITED(st) ? "exit" : "signal", WIFEXITED(st) ? WEXITSTATUS(st) : WTERMSIG(st));
        return 0;
    }
    if (!strcmp(k, "killhandler")) {
        pid_t c = fork();
        if (c == 0) {
            if (signal(SIGKILL, on_kill) == SIG_ERR) verify_write_file("sig.txt", "SIG_ERR");
            else verify_write_file("sig.txt", "installed");
            for (;;) pause();
        }
        sleep_ms(300);
        kill(c, SIGKILL);
        int st;
        waitpid(c, &st, 0);
        int f = open("sig.txt", O_RDONLY);
        char s[16] = {0};
        read(f, s, sizeof s - 1);
        printf("%s %s %d\n", s, WIFSIGNALED(st) ? "killed" : "exited", WIFSIGNALED(st) ? WTERMSIG(st) : WEXITSTATUS(st));
        return 0;
    }
    if (!strcmp(k, "epipe")) {
        signal(SIGPIPE, SIG_IGN);
        pipe(fd);
        close(fd[0]);                               /* 沒有任何 read end */
        ssize_t n = write(fd[1], "x", 1);
        printf("%zd %s\n", n, n < 0 ? ename(errno) : "-");
        return 0;
    }
    if (!strcmp(k, "killwc")) {                     /* yes | cat | wc -l，kill -TERM wc */
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
        kill(w, SIGTERM);
        int sy, sc, sw;
        waitpid(y, &sy, 0); waitpid(c, &sc, 0); waitpid(w, &sw, 0);
        printf("%d %d %d\n", ST(sy), ST(sc), ST(sw));
        return 0;
    }
    fprintf(stderr, "unknown case %s\n", k);
    return 2;
}
