/* W3 的 fork / exec / wait 題目。用法：./w3_fork <case> [args...]
   每個 case 的函式內容與題目程式碼一致；main 只負責分派。標 verify 的是量測用。 */
#include "common.h"

static int w3_08(void) {
    int x = 1;
    if (fork() == 0) {
        x = x + 1;
        printf("child %d\n", x);
    } else {
        wait(NULL);
        printf("parent %d\n", x);
    }
    return 0;
}

static int w3_14(void) {
    verify_count_processes("count.txt");   /* verify */
    pid_t pid1 = fork();
    pid_t pid2 = fork();
    if (pid1 == 0) { exit(0); } else { fork(); }
    if (pid2 == 0) { printf("Hi\n"); }
    return 0;
}

static int w3_15(void) {
    pid_t a = fork();
    pid_t b = fork();
    if (a == 0 || b == 0) printf("X\n");
    if (a != 0 && b == 0) printf("Y\n");
    return 0;
}

static int w3_16(void) {
    verify_count_processes("count.txt");   /* verify */
    for (int i = 0; i < 3; i++) {
        fork();
        printf("Hi\n");
    }
    return 0;
}

static int w3_21(char *argv1) {
    printf("A\n");
    pid_t pid = fork();
    if (pid == 0) {
        char *args[] = {argv1, "B", NULL};
        execv(argv1, args);
        printf("C\n");
        return 1;
    }
    printf("D\n");
    wait(NULL);
    printf("E\n");
    return 0;
}

static int w3_22(void) {
    int fd = open("log.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fork() == 0) {
        write(fd, "A", 1);
    } else {
        wait(NULL);
        write(fd, "B", 1);
    }
    return 0;
}

/* 變化：fork 之後各自 open */
static int v22a(void) {
    if (fork() == 0) {
        int fd = open("log.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
        write(fd, "AAA", 3);
        return 0;
    }
    wait(NULL);
    int fd = open("log.txt", O_WRONLY | O_CREAT, 0644);   /* 沒有 O_TRUNC */
    write(fd, "B", 1);
    return 0;
}

/* 變化：fork 前 open 的檔案，讀取 offset 共用 */
static int v22b(void) {
    verify_write_file("data.txt", "ABCDEF");   /* verify: 準備檔案 */
    char buf[2], ch;
    int fd = open("data.txt", O_RDONLY);
    if (fork() == 0) {
        read(fd, buf, 2);
        exit(0);
    }
    wait(NULL);
    read(fd, &ch, 1);
    printf("%c\n", ch);
    return 0;
}

/* 變化：printf 在 fork 前，之後 fork 兩次 */
static int v21c(void) {
    printf("hi\n");
    fork();
    fork();
    return 0;
}

static int f1(void) {
    for (int i = 0; i < 4; i++) {
        if (fork() == 0)
            printf("Hi\n");
    }
    return 0;
}

static int f2(void) {
    fork() && fork();
    printf("X\n");
    return 0;
}

/* 講義 loop.c */
static int f5(void) {
    char *letters = "ABC";
    for (int i = 0; i < 3; i++) {
        printf("%d prints %c\n", getpid(), letters[i]);
        fork();
    }
    printf("%d finished\n", getpid());
    return 0;
}

static int f8(void) {
    for (int i = 0; i < 3; i++) {
        if (fork() == 0) {
            execlp("echo", "echo", "hi", (char *)NULL);
            exit(1);                 /* 只有 exec 失敗才會到這裡 */
        }
    }
    while (wait(NULL) > 0)
        ;
    return 0;
}

static int p2(void) {
    verify_count_processes("count.txt");   /* verify */
    pid_t p1 = fork();
    pid_t p2 = fork();
    (void)p1;
    if (p2 == 0) exit(0);
    fork();
    printf("Hi\n");
    return 0;
}

/* W3-17 變化：fork 4 個立刻結束的 child，只 wait 一次，數 zombie。
   verify: MSYS2 的 ps 不列出 zombie，所以改在 parent 裡數：
   「已經 exit 但還沒被 wait」的 child 有幾個 = 用 WNOHANG 能立刻收掉幾個。 */
static int z4(void) {
    for (int i = 0; i < 4; i++)
        if (fork() == 0) exit(0);
    sleep(1);          /* verify: 確保 4 個 child 都已經 exit */
    wait(NULL);
    sleep(1);          /* 題目裡是 sleep(30)；這段時間內存在的 zombie 數就是下面數到的 */
    int zombies = 0;   /* verify */
    while (waitpid(-1, NULL, WNOHANG) > 0) zombies++;
    fprintf(stderr, "%d\n", zombies);
    return 0;
}

/* W3-19：double fork 之後 G 的 PPID */
static int w3_19(void) {
    if (fork() == 0) {                   // C
        setsid();
        if (fork() == 0) {               // G
            sleep(2);                    /* verify: 等 C 結束、P reap C */
            char s[32]; snprintf(s, sizeof s, "%d", (int)getppid());
            verify_write_file("ppid.txt", s);
            exit(0);
        }
        exit(0);
    }
    wait(NULL);                          // P
    return 0;
}

int main(int argc, char **argv) {
    const char *k = argc > 1 ? argv[1] : "";
    if (!strcmp(k, "w3-08")) return w3_08();
    if (!strcmp(k, "w3-14")) return w3_14();
    if (!strcmp(k, "w3-15")) return w3_15();
    if (!strcmp(k, "w3-16")) return w3_16();
    if (!strcmp(k, "w3-21")) return w3_21(argv[2]);
    if (!strcmp(k, "w3-22")) return w3_22();
    if (!strcmp(k, "v22a")) return v22a();
    if (!strcmp(k, "v22b")) return v22b();
    if (!strcmp(k, "v21c")) return v21c();
    if (!strcmp(k, "f1")) return f1();
    if (!strcmp(k, "f2")) return f2();
    if (!strcmp(k, "f5")) return f5();
    if (!strcmp(k, "f8")) return f8();
    if (!strcmp(k, "p2")) return p2();
    if (!strcmp(k, "z4")) return z4();
    if (!strcmp(k, "w3-19")) return w3_19();
    fprintf(stderr, "unknown case %s\n", k);
    return 2;
}
