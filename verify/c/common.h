/* 驗證程式共用的 include 與小工具。
   標 verify 的程式碼是為了量測而加的，不改變題目要問的行為。 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <signal.h>
#include <time.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <stdio_ext.h>

/* verify: 計算「總共有幾個 process」——每個 process 正常結束（exit / return）時各寫 1 byte。
   atexit 在 fork 前註冊，child 會繼承。 */
static int verify_cnt_fd = -1;
static void verify_cnt_exit(void) { if (verify_cnt_fd >= 0) write(verify_cnt_fd, "P", 1); }
static void verify_count_processes(const char *path) {
    verify_cnt_fd = open(path, O_WRONLY | O_CREAT | O_APPEND, 0644);
    atexit(verify_cnt_exit);
}
static double verify_now(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec / 1e9;
}
static void verify_write_file(const char *path, const char *s) {
    int f = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    write(f, s, strlen(s));
    close(f);
}
