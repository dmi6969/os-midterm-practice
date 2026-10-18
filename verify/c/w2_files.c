/* W2 的 read / open / dup / offset 題目。用法：./w2_files <case> */
#include "common.h"

int main(int argc, char **argv) {
    const char *k = argc > 1 ? argv[1] : "";
    char buf[256], c;

    /* W2-07：ABCDEF，read 1、2、1 */
    if (!strcmp(k, "w2-07")) {
        verify_write_file("data.txt", "ABCDEF");
        char x, y, a[2];
        int fd = open("data.txt", O_RDONLY);
        read(fd, &x, 1);
        read(fd, a, 2);
        read(fd, &y, 1);
        printf("%c%c\n", x, y);
        return 0;
    }
    /* W2-14：close 後重新 open */
    if (!strcmp(k, "w2-14")) {
        int dummy = open("notes.txt", O_RDONLY);  /* verify: 先占用 3 號，讓下一個 open 回傳 4（與題目一致） */
        (void)dummy;
        int fd = open("notes.txt", O_RDONLY);     // returns 4
        read(fd, buf, 200);
        close(fd);
        int again = open("notes.txt", O_RDONLY);
        off_t start = lseek(again, 0, SEEK_CUR);  /* verify: 下一個 read 從哪裡開始 */
        read(again, &c, 1);
        printf("%d %ld\n", again, (long)start);
        return 0;
    }
    /* W2-14 變化：dup 共用 offset */
    if (!strcmp(k, "v14")) {
        int fd = open("notes.txt", O_RDONLY);     // returns 3
        int fd2 = dup(fd);                         // returns 4
        read(fd, buf, 200);
        off_t start = lseek(fd2, 0, SEEK_CUR);    /* verify */
        read(fd2, &c, 1);
        printf("%d %d %ld\n", fd, fd2, (long)start);
        return 0;
    }
    /* W2-16：fish is tasty\n（14 bytes），read 4、4、8 */
    if (!strcmp(k, "w2-16")) {
        verify_write_file("fish.txt", "fish is tasty\n");
        int fd = open("fish.txt", O_RDONLY);
        read(fd, buf, 4);
        read(fd, buf, 4);
        ssize_t n = read(fd, buf, 8);
        printf("%zd\n", n);
        return 0;
    }
    /* W2-16 變化：hello, world\n（13 bytes），read 5、5、5 */
    if (!strcmp(k, "v16")) {
        verify_write_file("hello.txt", "hello, world\n");
        int fd = open("hello.txt", O_RDONLY);
        read(fd, buf, 5);
        read(fd, buf, 5);
        ssize_t n = read(fd, buf, 5);
        printf("%zd\n", n);
        return 0;
    }
    /* W5 變化：一般檔案讀到底回傳 0（14 bytes，read 10、10、10） */
    if (!strcmp(k, "r3")) {
        verify_write_file("fish.txt", "fish is tasty\n");
        int fd = open("fish.txt", O_RDONLY);
        ssize_t a = read(fd, buf, 10);
        ssize_t b = read(fd, buf, 10);
        ssize_t n = read(fd, buf, 10);
        printf("%zd %zd %zd\n", a, b, n);
        return 0;
    }
    fprintf(stderr, "unknown case %s\n", k);
    return 2;
}
