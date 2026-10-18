/* 第二回 W2：fd 編號、offset、printf / write 緩衝。用法：./s2_w2 <case> */
#include "common.h"

static long size_of(const char *p) { struct stat st; if (stat(p, &st) < 0) return -1; return (long)st.st_size; }

int main(int argc, char **argv) {
    const char *k = argc > 1 ? argv[1] : "";
    char buf[64], ch;

    if (!strcmp(k, "fdnum")) {             /* s2-w2-12 */
        int a = open("a.txt", O_RDONLY | O_CREAT, 0644);
        int b = open("b.txt", O_RDONLY | O_CREAT, 0644);
        int c = open("c.txt", O_RDONLY | O_CREAT, 0644);
        (void)c;
        close(b);
        close(a);
        int d = open("d.txt", O_RDONLY | O_CREAT, 0644);
        int e = open("e.txt", O_RDONLY | O_CREAT, 0644);
        (void)d;
        printf("%d\n", e);
        return 0;
    }
    if (!strcmp(k, "twoopen")) {           /* s2-w2-13 */
        int fd1 = open("notes.txt", O_RDONLY);
        int fd2 = open("notes.txt", O_RDONLY);
        read(fd1, buf, 10);
        read(fd2, buf, 3);
        read(fd1, buf, 5);
        printf("%ld\n", (long)lseek(fd2, 0, SEEK_CUR));   /* verify: fd2 下一次 read 的起點 */
        return 0;
    }
    if (!strcmp(k, "rdwr")) {              /* s2-w2-17 */
        verify_write_file("data.txt", "ABCDEF");
        int fd = open("data.txt", O_RDWR);
        write(fd, "xy", 2);
        read(fd, &ch, 1);
        printf("%c\n", ch);
        return 0;
    }
    if (!strcmp(k, "overwrite")) {         /* s2-w2-18 */
        verify_write_file("log.txt", "hello world");
        int fd = open("log.txt", O_WRONLY);
        write(fd, "HEY", 3);
        close(fd);
        int r = open("log.txt", O_RDONLY);  /* verify: 讀回檔案內容 */
        ssize_t n = read(r, buf, sizeof buf - 1);
        buf[n] = 0;
        printf("%s\n", buf);
        return 0;
    }
    if (!strcmp(k, "mix")) {               /* s2-w2-33，./s2_w2 mix > out.txt */
        printf("A");
        write(1, "B", 1);
        printf("C");
        fflush(stdout);
        write(1, "D", 1);
        printf("E");
        _exit(0);
    }
    if (!strcmp(k, "ttycrash")) {          /* s2-w2-34，在終端機執行 */
        printf("one\n");
        printf("two ");
        write(1, "three\n", 6);
        *(int *)0 = 1;
        return 0;
    }
    if (!strcmp(k, "full")) {              /* s2-w2-35，./s2_w2 full > out.txt */
        setvbuf(stdout, NULL, _IOFBF, 4096);
        for (int i = 0; i < 5000; i++)
            printf("x");
        *(int *)0 = 1;
        return 0;
    }
    (void)size_of;
    fprintf(stderr, "unknown case %s\n", k);
    return 2;
}
