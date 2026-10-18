/* 第二回 W4：非法指令 → SIGILL，$? = 128 + 4。用法：./s2_w4 ill */
#include "common.h"

int main(int argc, char **argv) {
    if (argc > 1 && !strcmp(argv[1], "ill")) {
        __builtin_trap();          /* x86-64 上編譯成 ud2：CPU 不認得的指令 */
        return 0;
    }
    fprintf(stderr, "unknown case\n");
    return 2;
}
