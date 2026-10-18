# OS 期中練習題庫（Quiz 1–4 原題 + 正確答案 + 解析）

課程：NTHU CS3423 Operating System, Fall 2026
期中考：2026/10/19（一）10:00–12:00，範圍 Week 1–6，題目為 Quiz 1–4 的變化題
課程講義：
- W2 https://os26.sys-nthu.tw/weeks/w2.html — OS 目標、隔離、檔案/fd/inode、虛擬記憶體 VSZ/RSS、page cache、printf 緩衝、權限、PATH（Quiz 1）
- W3 https://os26.sys-nthu.tw/weeks/w3.html — fork / exec / wait、zombie / orphan / daemon、環境變數、PATH、靜態/動態連結（Quiz 2）
- W4 https://os26.sys-nthu.tw/weeks/w4.html — user/kernel mode、system call、exception 四分類、timer interrupt、context switch、PCB（Quiz 3）
- W5 https://os26.sys-nthu.tw/weeks/w5.html — pipe、dup2、EOF、pipe deadlock、signals（Quiz 4）
- W6 https://os26.sys-nthu.tw/weeks/w6.html — CPU scheduling：FIFO / SJF / STCF / RR / priority / CFS（沒有小考，但在期中範圍內）

說明：
- 題幹保留英文原文（考試是英文），解析用中文。
- 標 ⚠️ 的是原本作答時答錯或沒拿滿分的題目，答案已更正。
- 標「（選項為推測重建）」的題目，原始 txt 沒有完整列出選項，已依題意補上。
- 部分程式題已實際編譯執行驗證（W3-15、W3-23、W5-07）。

---

## Week 2 · Quiz 1：OS 概觀、檔案、記憶體、緩衝

### W2-01 VSZ / RSS 寫滿陣列 ⚠️
A Python script has just created an 8 GiB array with `np.zeros`. At this moment the process has VSZ 8.2 GiB, RSS 0.2 GiB. The script then writes a value to every element of the array.

- After the loop finishes, VSZ will: (a) Increase significantly (b) Stay about the same (c) Decrease（選項為推測重建）
- And RSS will: (a) Increase significantly (b) Stay about the same (c) Decrease
- At that point, RSS will be about ___ GiB.

**答案**：VSZ (b) 不變；RSS (a) 大幅增加；RSS ≈ **8.2 GiB**（原答 1.6 錯）
**解析**：np.zeros 只配置虛擬頁（VSZ 已含 8 GiB）。每個元素都寫過之後，8 GiB 的每一頁都被 touch，各自拿到一個 DRAM frame，所以 RSS ≈ 原本 0.2 + 8 = 8.2 GiB。VSZ 沒有再配置新記憶體，所以不變。

### W2-02 np.zeros 為什麼快
Nini timed: `np.zeros((1024,1024,128))` 0.00004 s；`np.random.rand(1024,1024,128)` 0.42 s. Nini says “NumPy's zero-filling code must be extremely well optimized.” Which statements are true? (multi)
(a) np.zeros only allocates pages. VSZ grows, but the pages have no DRAM frame yet.
(b) np.zeros is fast because it reuses an identical array created earlier.
(c) The zeros array never uses memory. Zeros are generated when they are read.
(d) A page gets a DRAM frame when the program first touches it. That cost is paid later.
(e) After np.zeros, the process's RSS barely increases.

**答案**：(a)(d)(e)
**解析**：np.zeros 只增加 VSZ；成本延後到第一次 touch 時的 page fault。(c) 錯：寫入後一定會用到真實記憶體（讀的時候映射到共用的 zero page，寫才配 frame）。(b) 錯：沒有重用。rand 必須把每頁都寫入亂數，所以每頁都要配 frame。

### W2-03 User-facing vs Batch（Spotify）
Front end plays a song the moment you tap; back end computes tonight's recommendations. Classify (a = user-facing, b = batch):
S1 “99% of requests are answered within 100 ms.” → **a**
S2 “The whole run finishes within 6 hours.” → **b**
S3 Throughput measured in how much data is processed. → **b**
S4 A user notices immediately when it is slow. → **a**
S5 When the machine runs short of CPU, the scheduler slows down or kills this one first. → **b**
**解析**：User-facing 看 availability / tail latency（SLO 用百分位數）；batch 看資料吞吐量與 end-to-end latency。Borg 資源不夠時只 throttle/kill batch，從不動 user-facing。

### W2-04 Container vs VM
(a) A container shares only the hardware. A VM shares the OS.
(b) Both share only the hardware.
(c) A container shares the operating system. A VM shares only the hardware.
(d) Both share the OS.
**答案**：(c)
**解析**：三層隔離：process（共用 OS 和檔案系統）→ container（共用 OS kernel）→ VM（只共用硬體，靠 hypervisor 切）。

### W2-05 chmod 數字
`-rw-r----- 1 nini manager 812 Sep 22 10:03 salary.csv` Which chmod number? (a) 604 (b) 640 (c) 644 (d) 740
**答案**：(b) 640
**解析**：rw- = 4+2 = 6；r-- = 4；--- = 0。

### W2-06 權限三組
`-rwxr-x---` 第一組 rwx = **owner**；第二組 r-x = **group**；第三組 --- = **others**。

### W2-07 read() 移動 offset
data.txt contains `ABCDEF`. `read(fd,&x,1); read(fd,a,2); read(fd,&y,1);`
**答案**：x = **A**，y = **D**
**解析**：同一個 fd 共用一個 offset：讀 1（A）→ 讀 2（BC）→ 讀 1（D）。

### W2-08 printf 緩衝與檔案大小 ⚠️
Running as `./test > out.txt`, executed `printf("hello ")`（6 bytes）and `printf("world")`（5 bytes）, not exited. Someone runs `ls -l out.txt`.
(a) File size shown? (b) Bytes remaining in the C library's output buffer?
**答案**：(a) **0** bytes (b) **11** bytes（原答 11 / 0 剛好相反）
**解析**：stdout 導向檔案時是 fully buffered（約 4 KB buffer，在程式自己的記憶體裡）。還沒滿、沒 fflush、沒正常結束 → 一個 byte 都還沒經過 write() 進 kernel，檔案大小是 0。

### W2-09 Page table 映射什麼
(a) block number → storage location (b) fd → open-file table entry (c) virtual page → physical frame (d) file name → inode
**答案**：(c)
**解析**：「每個 indirection 都是一張表」：(a) 是 block 層、(b) 是 fd table、(d) 是目錄。

### W2-10 rm 一個 hard link 數為 2 且仍被開啟的檔案
`131074 -rw-r--r-- 2 nini manager 40000000000 ... /data/archive.tar` → `rm /data/archive.tar`. A background program still has it open.
(a) Immediately after rm, how many file names still point to this inode? → **1**
(b) The background program now calls read(): (a) succeeds (b) fails → **(a) succeeds**
(c) When is the 40 GB freed? (a) when the other name is also removed (b) immediately (c) when the program closes the file (d) only when both: the other name is removed AND the program closes the file
**答案**：(c) 小題選 **(d)**
**解析**：inode 只有在「link count = 0」且「沒有任何 open file 參照」時才釋放。rm = unlink，只刪名字、link count 2→1。

### W2-11 PATH ⚠️（第二小題）
`/home/niko/bin/greet` 是 `-rwxr-xr-x`；打 `greet` → command not found；打完整路徑可執行；`PATH=/usr/local/bin:/usr/bin:/bin`
(a) Why? (a) shell only looks in current directory (b) shell only looks in the directories listed in PATH, and /home/niko/bin is not one of them (c) needs sudo (d) no execute permission
**答案**：(b)
(b) Which changes let niko run it by typing only `greet`? (multi)
(a) Add `export PATH="$PATH:/home/niko/bin"` to ~/.bashrc and open a new terminal
(b) `chmod +x`
(c) Copy greet into /usr/bin
(d) `cd /home/niko/bin` first, then type greet
(e) Run it once with sudo so the shell remembers it
(f) Run `export PATH="$PATH:/home/niko/bin"` in the current terminal
**答案**：(a)(c)(f)
**解析**：(b) 已經有 x 權限，沒用；(d) PATH 裡沒有 `.`，shell 不會搜目前目錄；(e) 沒這回事。

### W2-12 路徑解析 ⚠️（第二小題）
None of these paths has been looked up yet: `/`(2) `/home`(100) `/home/nini`(137) `/home/nini/catfood`(198) `/home/nini/catfood/fish`(259). `open("/home/nini/catfood/fish", O_RDONLY)`
(a) How many directory contents must the kernel read to find fish's inode number? → **4**（/、home、nini、catfood）
(b) On how many directories must the kernel check execute (x) permission? → **4**（原答 3 錯）
**解析**：要「穿過」一個目錄就要有該目錄的 x 權限。/、/home、/home/nini、/home/nini/catfood 四個目錄都要穿過才能在 catfood 裡找到 fish。

### W2-13 各種物件讓 RSS 增加多少 ⚠️
Page = 4 KiB. Each object is 32 KiB.
```
a = np.zeros((32, 128))      # then: a[0,0] = 1.0 ; a[0,1] = 2.0
b = [0.0] * 4096             # a Python list of 4096 pointers
c = np.eye(64)               # identity matrix, 98% zeros
d = np.random.rand(32, 128)
```
**答案**：a = **4 KiB**（原答 32 錯）；b = **32 KiB**（原答 0 錯）；c = **32 KiB**；d = **32 KiB**
**解析**：a：np.zeros 不佔 frame，兩次寫入都在第一頁 → 只 fault 1 頁 = 4 KiB。b：list 要把 4096 個指標實際寫進去 → 8 頁全碰。c：對角線每一列都有一個 1，64×64×8 bytes，每頁 8 列，每頁都有對角元素被寫 → 8 頁全碰。d：每個元素都寫亂數。

### W2-14 close 後重新 open ⚠️（第二小題）
`open → 4`，`read(fd, buf, 200)`，然後 `close(fd); again = open(同一檔); read(again, &c, 1);`
(a) again = **4**（最小可用的 fd 編號）
(b) This read starts at byte **0**（原答 199 錯）
**解析**：每次 open() 都建立一個新的 open-file table entry，offset 從 0 開始。offset 屬於 open file entry，不屬於檔案本身。

### W2-15 兩個程式開著時 rm ⚠️
Two programs each have /data/fish open. Someone runs `rm /data/fish`. True right after that? (multi)
(a) While at least one program still has it open, you can copy the contents back out through that program's entry under /proc.
(b) The data blocks stay in use, because the number of programs holding the file open has not reached zero.
(c) The next read() in either program fails, because the path no longer leads anywhere.
(d) Running rm a second time would free the space.
(e) The directory no longer lists the name, so ls cannot show the file.
(f) Both programs can carry on reading. The chain from descriptor to open file entry to inode never uses the name.
**答案**：(a)(b)(e)(f)
**解析**：`cp /proc/PID/fd/N` 可以救回資料。(c) fd → open file → inode 從不經過名字；(d) 名字已經不在了，rm 會失敗。

### W2-16 read 回傳值 ⚠️（第三小題）
File = `fish is tasty\n`（14 bytes）。`read(fd,buf,4); read(fd,buf,4); n = read(fd,buf,8);`
**答案**：第一次 `fish`；第二次 `_is_`；第三次 n = **6**（原答 3 錯）
**解析**：前兩次讀完 offset = 8，剩 14 − 8 = 6 bytes（`tasty\n`），要 8 只給 6。

### W2-17 printf vs write vs crash ⚠️（P1）
Each run as `./test > out.txt`. What does out.txt contain? (write `empty` if nothing)
- P1 `printf("one "); write(1, "two ", 4); return 0;` → **two one**（原答 one two 錯）
- P2 `printf("one "); fflush(stdout); write(1, "two ", 4); return 0;` → **one two**
- P3 `printf("one "); write(1, "two ", 4); *(int*)0 = 1;` → **two**
- P4 `write(1, "one ", 4); printf("two "); *(int*)0 = 1;` → **one**
**解析**：printf 先進 libc buffer；write 立刻進 kernel。P1 的 "one " 在 return 時才 flush，所以排在後面。crash 時 buffer 直接消失。

### W2-18 printf 到磁碟的順序
排序：
1. The C library copies the data into a buffer in the program's own memory.
2. When the buffer is flushed, a system call sends the data to the kernel.
3. The data enters the kernel's page cache, and the affected pages are marked dirty.
4. The operating system later writes the dirty pages to the disk.
Which stage does a direct call to write() skip? → **第 1 步**（libc buffer）

### W2-19 碰觸頁面與 frame 數 ⚠️
Page = 4096 bytes. A program maps 64 KiB (16 pages), untouched. Writes one byte at offsets 0, 100, 20000, 65000.
(a) After the first two writes, frames? → **1**
(b) After all four writes, frames? → **3**
(c) RSS at that point (KiB)? → **12**
(d) Then writes at offset 20400. Frames? → **3**
**解析**：頁號 = offset ÷ 4096 取整數：0→0、100→0、20000→4、65000→15、20400→4。不同頁號才各要一個 frame。（原答 25 / 21275 / 64 / 21276 全錯）

### W2-20 Overcommit（notebook）
16 GiB limit per user，server 512 GiB DRAM，平均 RSS 1 GiB。
(a) 若每個 notebook 真的用滿 16 GiB，最多可跑 **32** 個（512 ÷ 16）
(b) 以平均 1 GiB 計，可以多跑約 **16** 倍（512 vs 32）

### W2-21 VSZ 遠超 DRAM（online judge）
10,000 submissions，總 VSZ 120,000 GiB，DRAM 512 GiB，總 RSS 310 GiB。Why?
(a) OS compresses untouched memory (b) Allocating a page grows VSZ only. A page takes a DRAM frame only when it is touched. (c) Dashboard error (d) 120,000 GiB is total over all servers
**答案**：(b)

### W2-22 什麼事件會 flush stdout buffer
Running as `./test > out.txt`, buffer holds 11 bytes. Which flush them to the kernel? (multi)
(a) Crash from invalid memory access (b) fflush(stdout) (c) Keeps printing until buffer is full (d) Prints nothing for 30 s (e) Returns from main normally (f) Calls exit()
**答案**：(b)(c)(e)(f)
**解析**：crash 不會 flush；沒有「閒置多久自動 flush」這回事。注意 `_exit()` 不會 flush，`exit()` 會。

---

## Week 3 · Quiz 2：Process 建立與結束、連結

### W3-01 exec 成功後保留什麼
A child calls exec successfully. Which stay the same? (multi)
(a) global variable values (b) program code (c) current position in program (d) PPID (e) open files (fd table) (f) PID
**答案**：(d)(e)(f)
**解析**：exec 換掉整個程式（code、data、stack、heap、執行位置），但 PID、PPID、fd table（除了 close-on-exec）、cwd、環境變數保留。

### W3-02 兩個靜態連結執行檔的 libX
A, B are different executables, each statically linked with libX. Both running.
(a) Copies of libX's code in DRAM? → **2**
(b) Why? (a) kernel compares page contents and shares equal pages (b) kernel shares pages only when they come from the same file (c) statically linked code can never be shared (d) same library loaded only once
**答案**：(b)
**解析**：kernel 只共享「同一個檔案」被多個 process map 的頁；不比對內容。注意 (c) 錯：同一個靜態執行檔跑兩個 process 時 code 還是可以共享。

### W3-03 為什麼 cd 必須是 built-in
**答案**：(d) The working directory belongs to each process. The child changes its own and then exits.
其他選項：(a) cwd 存在 PWD 環境變數 ✗（存在 kernel process table）(b) exec 重設 cwd ✗ (c) 需要 root ✗

### W3-04 cat 讀 CPU 溫度
`cat /sys/class/thermal/thermal_zone0/temp` 印出 CPU 溫度。Which Unix idea?
**答案**：(c) Everything is a file.
（干擾：(a) text streams、(b) cat 是 built-in、(d) do one thing well）

### W3-05 靜態/動態連結記憶體與磁碟計算
libY = 4 MB code；20 個不同程式，各有 2 MB 自己的 code，全部同時在跑。
(a) 全靜態：libY 在 DRAM 共 **80 MB**（20 × 4）
(b) 全動態：libY 在 DRAM 共 **4 MB**
(c) 全動態：20 個執行檔 + libY.so 的磁碟空間 = **44 MB**（20 × 2 + 4）

### W3-06 哪種情況適合靜態連結 ⚠️
(a) A library that often needs security fixes
(b) libc, used by almost every desktop program
(c) A command-line tool shipped to many users on many different Linux versions
(d) 200 programs on one server that call the same crypto library
**答案**：(c)
**解析**：散布到各種機器的工具（fzf、ripgrep）用靜態避免 `GLIBC_2.34 not found`。其他三個都是「多程式共用、需要一次修補」→ 動態（Heartbleed）。

### W3-07 fork 回傳值
In the parent, p is **the child's PID**; in the child, p is **0**；失敗時 parent 得到 −1。

### W3-08 fork 後變數獨立
```c
int x = 1;
if (fork() == 0) { x = x + 1; printf("child %d\n", x); }
else { wait(NULL); printf("parent %d\n", x); }
```
**答案**：child **2**，parent **1**（記憶體各自一份，copy-on-write）

### W3-09 export 的可見範圍
`export KEY=abc` → **(d)** This shell, the children it forks from now on, their children, and so on.

### W3-10 大量 zombie
Web server forks a child per request; after days fork() returns −1; ps shows tens of thousands of Z. Missing call?
**答案**：(b) The parent never calls wait() for its children.

### W3-11 API key 放命令列
Why is `python3 llama.py --key sk-ABC123` unsafe on a shared workstation?
**答案**：(b) The key can be read by other users with ps or top.
（(c) 傳給子 process 是環境變數的特性，不是不安全的理由）

### W3-12 Orphan
Parent exits before child; ps shows child running with PPID 1.
(a) What kind? → **(c) orphan**
(b) When the child exits later? → **(a)** init reaps it, and its row leaves the process table.

### W3-13 PATH 由誰搜尋
The **shell** searched **the directories listed in PATH** and did not find myapp there.（不是 kernel 搜）

### W3-14 fork 計數（pid1 / pid2）
```c
pid_t pid1 = fork();
pid_t pid2 = fork();
if (pid1 == 0) { exit(0); } else { fork(); }
if (pid2 == 0) { printf("Hi\n"); }
return 0;
```
(a) Hi 行數 = **2** (b) Process 總數（含提早 exit 的）= **6**（已實測）
**解析**：兩次 fork 後 4 個 process：(>0,>0)、(>0,0)、(0,>0)、(0,0)。pid1==0 的兩個 exit。剩 2 個各再 fork 一次 → 新增 2 個，總數 6。pid2==0 的：(>0,0) 本身和它 fork 出的子 → 2 行 Hi。

### W3-15 fork 計數（a / b）
```c
pid_t a = fork(); pid_t b = fork();
if (a == 0 || b == 0) printf("X\n");
if (a != 0 && b == 0) printf("Y\n");
```
**答案**：X = **3**，Y = **1**

### W3-16 迴圈中 fork
```c
for (int i = 0; i < 3; i++) { fork(); printf("Hi\n"); }
```
(a) Hi = **14**（2 + 4 + 8）(b) Process 總數 = **8**

### W3-17 Zombie 與 orphan 綜合 ⚠️（b）
P forks C1, C2（立刻 exit）、C3（sleep 60）；P sleep(10) 且從不 wait，然後 exit。
(a) Step 1 後（C1、C2 已 exit，P 還在 sleep）zombie 數 → **2**
(b) P exit 後 C1、C2 怎樣？ → **(c)** init adopts and reaps them, and their rows leave the process table.
(c) C3 現在是？ → **(c) orphan**

### W3-18 更新 libssl.so 後各程式用哪版 ⚠️
A：動態連結，替換前就啟動、仍在跑 → **old**
B：動態連結，替換後才啟動 → **new**
C：靜態連結，替換後才啟動 → **old**（原答 new 錯）
**解析**：靜態連結的程式在建置時就把 libssl 複製進執行檔，替換 .so 對它沒影響，必須重新編譯。A 已經把舊版 map 進記憶體，要重啟才換。

### W3-19 Double fork / daemon
```c
if (fork() == 0) {          // C
    setsid();
    if (fork() == 0) run_server();   // G
    exit(0);
}
wait(NULL); return 0;       // P
```
(a) Step 5 時 G 的 PPID → **(c) init**
(b) G 結束時誰 reap 它 → **(d) init**

### W3-20 GLIBC 版本錯誤
`version 'GLIBC_2.34' not found` → The program is **dynamically** linked, so at run time it uses **the libc installed on the other machine**.

### W3-21 fork + execv 輸出字母 ⚠️
```c
printf("A\n");
pid_t pid = fork();
if (pid == 0) {
    char *args[] = {argv[1], "B", NULL};
    execv(argv[1], args);
    printf("C\n");
    return 1;
}
printf("D\n");
wait(NULL);
printf("E\n");
return 0;
```
Run 1：`./prog /bin/echo`；Run 2：`./prog /bin/_i_dont_exist_just_4_fun`（從終端機執行）

| | Run 1 | Run 2 |
|---|---|---|
| A | 1 | 1 |
| B | 1 | 0 |
| C | **0** | 1 |
| D | **1** | 1 |
| E | **1** | 1 |

(b) Run 1 中 B 和 D 誰先？ → **(c)** 不一定
(c) E 在哪？ → **(c)** E is always the last line
**解析**：exec 成功就不會回來，C 不會印；D、E 只有 parent 印，各 1 次（原答 C=1、D=2、E=2 錯）。終端機是 line-buffered，A 在 fork 前已 flush，所以只印 1 次（若導向檔案，A 會印 2 次——好的變化題方向）。E 在 wait 之後，child 一定已結束。

### W3-22 fork 共用 file offset ⚠️
```c
int fd = open("log.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
if (fork() == 0) write(fd, "A", 1);
else { wait(NULL); write(fd, "B", 1); }
```
(a) log.txt bytes → **2**（原答 16 錯）(b) 內容 → **(a)** Both A and B（檔案內容是 `AB`，已實測）
**解析**：fork 複製 fd table，但兩個 entry 指向同一個 open file entry，共用 offset。child 寫 A 後 offset = 1，parent 接著寫 B 在 offset 1。若改成「fork 之後各自 open」就會互相覆蓋（變化題方向）。

---

## Week 4 · Quiz 3：Mode、System call、Exception、Context switch

### W4-01 慢速 system call 的事件順序
Process A：`read(0, &c, 1);`，還沒按鍵，Process B ready。排序：
1. Process A calls read().
2. The read() system call traps into the kernel.
3. The kernel finds that no key is available.
4. Process A is put to sleep.
5. The kernel switches the CPU to Process B.
6. Process B runs.
7. A key is pressed and a keyboard interrupt occurs.
8. Process A becomes ready and later resumes.

### W4-02 PCB 要存什麼
Timer interrupt, switch A → B. What must be saved in A's PCB? (multi)
(a) executable file (b) stack pointer (c) entire physical memory (d) program counter (e) CPU register values (f) entire user stack
**答案**：(b)(d)(e)
**解析**：context = 暫存器、PC、SP。記憶體（含 user stack）本來就留在原地沒被動到，不需要複製。

### W4-03 Buffer overflow 與 return address
(a) Saved return address 被覆寫，最直接影響？ → **(a)** where the program continues execution after ret
(b) 指向同 process 另一個可執行的 user-space 位置？ → **(b)** the program may continue execution from that location
(c) 指向 kernel-only 位址，CPU 仍在 user mode？ → **(b)** the access is blocked and a protection fault occurs
(d) 有 root 權限的程式被這樣攻擊為何危險？ → **(b)** the attacker may redirect the program to an unintended code path while the process still has root permission
**解析**：ret 只改 PC，不改 mode bit；root 是身分（UID 0）不是 kernel mode，root process 一樣跑在 user mode、受虛擬記憶體保護。

### W4-04 共用唯讀 zero page 的讀與寫 ⚠️（第 1 小題）
Virtual page already mapped to a shared read-only zero page. Program reads then writes it; first write takes much longer.
1. 第一次讀會 trap 進 kernel 嗎？ → **(b) No**
2. 為何讀不用 page fault？ → **(b)** the virtual page is already mapped to a readable zero page
3. 第一次寫發生什麼？ → **(a)** a page fault occurs because the shared zero page is read-only
4. 為何寫比較久？ → **(a)** the write causes a page fault and traps into the kernel
**解析**：映射已存在且可讀 → 讀直接走硬體 page table。寫入唯讀頁 → fault → kernel 配一個新的 frame 填 0、改映射、重新執行該指令（這是可修復的 fault）。

### W4-05 System call 流程排序 ⚠️
1. Put the system call number and arguments into CPU registers
2. Execute the trap / system call instruction
3. CPU switches to kernel mode and jumps to a predefined kernel entry point
4. Call the system call handler and check whether the arguments are valid and safe
5. Kernel performs the requested operation
6. Return to user mode and continue the user program

---

## Week 5 · Quiz 4：Pipe、dup2、EOF、deadlock、signal

### W5-01 kill -INT pipeline 中的 sleep
`$ sleep 1000 | cat`（沒人裝 signal handler）。另一個終端機 `kill -INT <PID of sleep>`。cat 怎樣？
(a) killed by the same signal, kernel sends it to every process in a pipeline
(b) killed by a different signal, its input pipe lost its writer
(c) keeps waiting forever until Ctrl-C
(d) its next read() returns 0, because no process holds the write end any more, so it exits normally
**答案**：(d)
**解析**：kill 只送給指定的 PID（Ctrl-C 才會送給整個前景 pipeline）。sleep 死掉 → write end 全部關閉 → cat 讀到 EOF 正常結束。SIGPIPE 是給「寫端」的，不是讀端，所以 (b) 錯。

### W5-02 close(1) 後 pipe 拿到的 fd
只開 0、1、2。`close(1); f = open("log.txt", O_RDONLY); pipe(fd);`
**答案**：fd[0] = **3**，fd[1] = **4**（open 拿走最小的 1）

### W5-03 Debug 訊息印到 stdout 破壞協定
Tool server：client 從 server 的 stdout 讀 JSON（一行一則），stderr 仍是終端機。加了 `printf("debug: ...")` 之後 client 解析錯誤。Best fix?
(a) Print the debug lines with fprintf(stderr, ...) instead of printf.
(b) Print each debug line only after the reply has been written
(c) fprintf(stderr, ...) and call dup2(1, 2) at the start of main()
(d) write(1, ...) instead of printf
(e) Print each debug line as a JSON object
**答案**：(a)
**解析**：stdout 是協定通道（MCP 規範只允許協定訊息）。(c) 的 dup2(1,2) 會讓 stderr 也指到 pipe，問題重現。(d)(e) 仍然寫到 stdout。

### W5-04 Shell 執行 `cat scores.csv | grep niko` 的順序
1. Shell: pipe(fd)
2. Shell: fork() the child that will run cat
3. Child (cat): dup2(fd[1], 1)
4. Child (cat): close(fd[0]) and close(fd[1])
5. Child (cat): execlp("cat", ...)
6. Shell: fork() the child that will run grep
7. Child (grep): dup2(fd[0], 0)
8. Child (grep): close(fd[0]) and close(fd[1])
9. Child (grep): execlp("grep", ...)
10. Shell: close(fd[0]) and close(fd[1])
11. Shell: both wait() calls return, and the next prompt appears
**解析**：關鍵限制：pipe 必須在 fork 之前；每個 child 的 dup2 必須在它自己的 exec 之前；shell 的 close 必須在第二次 fork 之後（否則 grep 繼承不到）；wait 最後。兩個 child 的步驟之間可以交錯。

### W5-05 git 啟動 pager 的 strace ⚠️（a 的 fd 0）
```
# 4100 is git; 4101 is the child that becomes less
4100  pipe2([3, 4], 0)   = 0
4100  clone(...)         = 4101
4101  dup2(3, 0)         = 0
4101  close(3)           = 0
4101  close(4)           = 0
4101  execve("/usr/bin/less", ...) = 0
4100  close(3)           = 0
4100  dup2(4, 1)         = 1
4100  close(4)           = 0
```
(a) 最後一行之後 git 的 fd 各指向？（選項：the terminal / the read end / the write end / not open）
fd 0 → **the terminal**（原答 read end 錯；dup2(3,0) 是 less 做的，不是 git）
fd 1 → **the write end of the pipe**
fd 3 → **not open**
fd 4 → **not open**
(b) close(4) 為何安全？ → **(a)** fd 1 is now also a copy of the write end, so the pipe still has a writer, and git goes on writing through fd 1.
**解析**：dup2 是「複製」不是「移動」，所以 (b) 錯。

### W5-06 兩條 pipe 的 deadlock ⚠️
parent ──(A)──▶ child ──(B)──▶ parent，每條 64 KiB。child 每次從 A 讀 4 KiB 寫進 B。parent：`write(A, data, n); close(A); read B until 0`。
(a) 哪些 n 會跑完？(a) 10 KiB (b) 100 KiB (c) 200 KiB (d) 1 MiB
**答案**：(a)(b)
(b) 卡住時兩者在哪？ → **(a)** Both are blocked in write().
**解析**：parent 開始讀 B 之前，系統最多能吸收 A 64 + B 64 + child 手上 4 = **132 KiB**。100 KiB < 132 → 跑完；200 KiB、1 MiB 超過 → B 滿了 child 卡在 write(B)，A 滿了 parent 卡在 write(A)。

### W5-07 read 迴圈條件寫成 >= 0 ⚠️
```c
close(fd[1]);
sleep(2);
while ((n = read(fd[0], buf, sizeof buf)) >= 0)   // buf 是 1000 bytes
    total += n;
```
child 寫 5000 bytes 後立刻 exit。
(a) 結果？
(a) never finishes, uses no CPU, blocked in read()
(b) prints got 5000 bytes after ~2 s
(c) Nothing is printed, never finishes. After the first 2 s, it keeps one CPU core busy.
(d) prints got 5000, read() returns −1 ends the loop
(e) prints got 0 bytes
**答案**：(c)
(b) 第一次 read() 回傳？ → **1000**（原答 5000 錯；buf 只有 1000，已實測）
**解析**：資料讀完後，write end 全關（child exit、parent 已 close）→ read 回傳 0（EOF），但 0 >= 0 條件成立 → 無限迴圈一直立刻回傳 0 → 吃滿一顆 CPU（不是 block）。

### W5-08 單一 pipe 雙向溝通
parent 寫 "ping" 然後 read；child read 後寫 "pong"。兩邊都持有兩端。
**答案**：(e) It may hang. The parent can read its own ping; then the parent waits in wait() and the child waits in read() forever.
**解析**：parent 可能自己把 ping 讀回去 → 印出 "parent got ping" → wait()。child 的 read 永遠不會拿到資料，也不會 EOF（兩邊都還持有 write end）。(b) 錯在 parent 不是卡在 read。

### W5-09 先 wait 再讀的 capture 程式
pseudocode：建 OUT、ERR 兩條 pipe → 啟動 cmd → **wait** → read OUT until 0。每條 64 KiB。

| 指令 | stdout | stderr |
|---|---|---|
| ls | 2 KiB | 0 |
| cat notes.txt | 300 KiB | 0 |
| cat big.log | 2 MiB | 0 |
| find / | 5 MiB | 200 KiB |

ls 成功，其他三個 300 s 逾時。各修法效果（(a) 全部修好 (b) 部分有效 (c) 完全沒用）：
- F1 時間上限改 3600 s → **(c)**
- F2 OUT 放大到 1 MiB → **(b)**（notes 好了；big.log、find 還是卡）
- F3 先讀 OUT 到 0 再 wait → **(b)**（ls/notes/big.log 好了；find 的 stderr 200 KiB 塞滿 ERR，child 卡在 write(2)）
- F4 換更快的機器 → **(c)**
**解析**：這是 deadlock 不是效能問題。正解是同時讀兩條 pipe（Python `communicate()`）。

### W5-10 自製 shell 的 prompt 不回來 ⚠️（a）
cat 已 exit。
```
/proc/45111/fd (shell):  0,1,2 -> /dev/pts/2   3 -> pipe:[88216611] (lr-x)
/proc/45113/fd (grep):   0 -> pipe:[88216611] (lr-x)   1,2 -> /dev/pts/2   4 -> pipe:[88216611] (l-wx)
```
(a) 哪個 fd 讓 grep 的 read() 無法回傳 0？（選項為推測重建：fd 3 of the shell / fd 4 of the shell / fd 0 of grep / fd 4 of grep）
**答案**：**fd 4 of grep**（原答 fd 4 of the shell 錯——shell 根本沒有 fd 4）
(b) 缺了哪個 close？ → **(b)** The child that runs grep never closes the copy of the write end it inherited.
**解析**：看權限字母：`l-wx` = write end，`lr-x` = read end。唯一的 write end 在 grep 自己手上 → grep 等自己。shell 的 fd 3 是 read end，沒關雖然也是 bug，但不會造成 EOF 問題。

---

## Week 6：CPU Scheduling（無原始小考題）
期中範圍包含，但沒有小考原題。出題重點（依講義 self-check）：
- I/O-bound vs CPU-bound 判別
- 由 timeline 算 turnaround（done − arrive）、response（first run − arrive）、waiting（turnaround − burst）
- response time vs throughput 的取捨、context-switch overhead
- preemptive vs non-preemptive、四個 scheduling point（①自己放棄 ②timer ③I/O 完成喚醒 ④exit）
- FIFO / SJF / STCF 的平均 turnaround 計算；SJF 為何最優；burst 預測 `next = α·last + (1−α)·prev`
- RR：時間片長短對 response / turnaround / overhead 的影響
- Priority、starvation、aging、liveness、互動程式喚醒時提高優先權
- nice：−20（最高優先）到 +19，預設 0，一般使用者只能調高（變 nicer）
- CFS：挑 vruntime 最小者；`Δvruntime = Δruntime × 1024 / weight`；nice 0 = 1024、nice 5 = 335、nice −5 = 3121、nice 10 = 110；CPU 比例 = weight ÷ 總 weight；`slice = latency × weight / total weight`
