// 第二回 · Week 4：user / kernel mode、root ≠ kernel mode、address space、system call、exception、timer、context switch、PCB、快慢 system call、vDSO
const { code, c, ALL } = require('../lib');
const W = 'W4';
const V = (n) => `變化題（源自 ${n}）`;
const N = (part) => `新題（依講義 W4 ${part}）`;

module.exports = [
  {
    id: 's2-w4-01', week: W, topic: 'Mode bit 什麼時候變 1', src: V('W4-05'), group: 's2-W4-mode', type: 'single',
    q: `<p>Which of these events sets the CPU's mode bit to 1 (kernel mode)?</p>`,
    opts: ['Calling a function in libc', 'A timer interrupt', 'Executing a ret instruction', 'Calling malloc() for a small block'],
    ans: 1,
    exp: `<p>mode bit 只有硬體能改：處理 <b>trap 或 interrupt</b>（包括 timer、system call 的 trap 指令、fault）時設成 1，kernel 執行 return-from-trap 時改回 0。函式呼叫、ret、在 heap 裡配一小塊記憶體都只是 user mode 的普通指令。</p>`,
  },
  {
    id: 's2-w4-02', week: W, topic: '為什麼保護需要硬體', src: N('Part 1'), group: 's2-W4-mode', type: 'single',
    q: `<p>Why can't the OS enforce protection purely in software, for example with a checker program that inspects every instruction before it runs?</p>`,
    opts: [
      'While the user program is running, the checker is not running, so it cannot intercept a privileged instruction before it executes; the CPU itself must refuse it based on a mode bit',
      'Software checkers are illegal in most countries',
      'Checking instructions would need more than 64 KB of memory',
      'Because compilers already remove all privileged instructions',
    ],
    ans: 0,
    exp: `<p>同一顆 CPU 一次只跑一段程式：user 程式在跑的時候，kernel（或任何檢查程式）根本沒有在執行，無法在那條指令執行前攔下它。所以要由<b>硬體</b>根據 mode bit 限制特權指令和受保護的記憶體，違規時直接產生 exception 交給 kernel。</p>`,
  },
  {
    id: 's2-w4-03', week: W, topic: '如果 user mode 能關 interrupt', src: N('Part 2'), group: 's2-W4-mode', type: 'single',
    q: `<p>Suppose a user-mode program were allowed to turn off interrupts. What could it then do?</p>`,
    opts: [
      'Keep the CPU forever, because the timer interrupt could no longer give the kernel a chance to preempt it',
      'Read other processes\' memory directly',
      'Nothing harmful; interrupts only matter for the keyboard',
      'Make its system calls faster, which is why it is allowed',
    ],
    ans: 0,
    exp: `<p>kernel 拿回 CPU 的方法就是 timer interrupt。關掉 interrupt，kernel 就再也跑不到，排程器不能把它換下來——整台機器被一個程式霸佔，和 cooperative scheduling 裡的 ${c('while (1);')} 一樣。所以關 interrupt 是特權指令。</p>`,
  },
  {
    id: 's2-w4-04', week: W, topic: '如果 user mode 能裝 trap table', src: N('Part 4'), group: 's2-W4-mode', type: 'single',
    q: `<p>Suppose a user program could install its own trap table. Why would that effectively give it kernel privileges?</p>`,
    opts: [
      'Its handlers would run in kernel mode on every system call and interrupt from every process, so it could read any memory or bypass permission checks',
      'It would only make that one program\'s system calls slower',
      'The CPU would ignore the new table',
      'It would let the program call kernel functions as ordinary functions in user mode',
    ],
    ans: 0,
    exp: `<p>trap table 決定 trap / interrupt 發生時 CPU 跳去哪裡，而且跳過去時已經是 kernel mode。換成自己的 handler，就能在每一個 process 的 system call 和 interrupt 時以 kernel mode 執行自己的程式碼：讀任意記憶體、從 ps 隱藏 process、記錄按鍵、跳過權限檢查。所以安裝 trap table 是特權指令。</p>`,
  },
  {
    id: 's2-w4-05', week: W, topic: '如果 user mode 能改 page table', src: N('Part 2'), group: 's2-W4-mode', type: 'single',
    q: `<p>Suppose a user program could change its own page table. What could it do?</p>`,
    opts: [
      'Map any physical memory, including other processes\' data and the kernel, into its own address space',
      'Only rearrange its own heap and stack',
      'Speed up its own page faults, which is harmless',
      'Nothing, because page tables only matter in kernel mode',
    ],
    ans: 0,
    exp: `<p>虛擬記憶體的隔離完全靠 page table：每個 process 只能碰到自己的 page table 映射到的 frame。能改 page table 就能把任何實體記憶體（別的 process、kernel）map 進來，隔離就沒了。所以改 page table 是特權操作。</p>`,
  },
  {
    id: 's2-w4-06', week: W, topic: 'time：user 與 sys', src: N('Part 2'), group: 's2-W4-time', type: 'fill',
    q: `<p>You run ${c('time dd if=/dev/zero of=/dev/null bs=1 count=1000000')}, which makes about two million system calls that each move one byte. Which of the two CPU-time lines, ${c('user')} or ${c('sys')}, is larger? Type the word.</p>`,
    ans: ['sys'],
    exp: `<p>每次只搬 1 byte，幾乎所有時間都花在 trap 進 kernel、執行 read / write、再回來 → 這些都算 <b>sys</b>（kernel mode 的 CPU 時間）。純計算的程式（例如 ${c('sum(range(10**7))')}）則是 user 大；${c('sleep 1')} 兩個都幾乎是 0，只有 real 是 1 秒。</p>`,
  },
  {
    id: 's2-w4-07', week: W, topic: 'sleep 不用 CPU', src: N('Part 2'), group: 's2-W4-time', type: 'single',
    q: `<p>${c('time sleep 1')} reports ${c('real 1.00s')} but ${c('user')} and ${c('sys')} close to 0. Why?</p>`,
    opts: [
      'The process sleeps on a wait queue for a second and uses no CPU; real is wall-clock time',
      'sleep runs on a separate hidden CPU',
      'time cannot measure programs shorter than 2 seconds',
      'The kernel charges sleeping time to the init process',
    ],
    ans: 0,
    exp: `<p>real 是牆上時鐘的時間；user / sys 是真的在 CPU 上跑的時間。sleep 一開始就請 kernel 讓它睡一秒，睡覺的 process 不在 CPU 上，所以幾乎沒有 user 也沒有 sys。</p>`,
  },
  {
    id: 's2-w4-08', week: W, topic: 'Illegal instruction 的 exit status', src: V('W4-03'), group: 's2-W4-exc', type: 'fill',
    q: `<p>A program executes an instruction that the CPU does not recognize. The kernel sends it SIGILL (signal 4), and the shell prints ${c('Illegal instruction')}. What is ${c('$?')} right afterwards?</p>`,
    ans: ['132'],
    exp: `<p>這是 fault（指令出錯，修不好）→ kernel 送 SIGILL。被 signal 終止的 process，shell 回報 128 + signal 編號 = 128 + 4 = <b>132</b>。對照：SIGFPE（8）→ 136、SIGSEGV（11）→ 139。已實測。</p>`,
    cprog: 's2_w4 ill',
  },
  {
    id: 's2-w4-09', week: W, topic: 'TCB：anti-cheat 跑在 kernel mode', src: N('Part 2'), group: 's2-W4-mode', type: 'single',
    q: `<p>Riot's Vanguard anti-cheat is installed as a kernel-mode driver so that it can detect cheats that also run in kernel mode. What is the cost of this design?</p>`,
    opts: [
      'The driver can read every process\'s memory, and a bug in it can crash the whole machine; it enlarges the trusted computing base',
      'The game runs in kernel mode too and becomes faster',
      'Nothing, because drivers are checked by the CPU',
      'It only affects the game\'s own process',
    ],
    ans: 0,
    exp: `<p>user mode 的程式只看得到 kernel 讓它看的東西，偵測不到 kernel mode 的外掛，所以 anti-cheat 也得進 kernel。代價：它有權讀所有 process 的記憶體，而且它的 bug 會拖垮整台電腦。kernel 裡的程式碼屬於 <b>trusted computing base（TCB）</b>：TCB 越大，越多地方出錯就能毀掉整個系統，所以安全設計要盡量縮小 TCB。</p>`,
  },
  {
    id: 's2-w4-10', week: W, topic: 'Chrome 分頁 crash vs driver crash', src: N('Part 2'), group: 's2-W4-mode', type: 'single',
    q: `<p>When a Chrome tab crashes, the other tabs keep running; when a buggy graphics driver crashes, Windows shows a blue screen. Both bugs may be in C++ code. Why are the outcomes different?</p>`,
    opts: [
      'The tab is a user-mode process in its own address space that the kernel can safely terminate; the driver runs in kernel mode inside the kernel\'s address space, so its bug can corrupt kernel state',
      'C++ code in Chrome is compiled with more checks',
      'Drivers run as root, and root crashes are fatal',
      'Chrome catches all exceptions, drivers do not',
    ],
    ans: 0,
    exp: `<p>分頁是 user mode、獨立 address space 的 process：記憶體錯誤碰不到別人，kernel 可以把它終止並回收資源。driver 跑在 kernel mode、在 kernel 的 address space 裡：它可能弄壞 kernel 的表格，沒有更高權限的東西能隔離它，只好重開機保護自己。跟 root 無關。</p>`,
  },
  {
    id: 's2-w4-11', week: W, topic: 'ASLR', src: N('Part 3'), group: 's2-W4-as', type: 'single',
    q: `<p>You run the lecture's ${c('va.c')} twice. Both runs show code &lt; heap &lt; stack, but all three addresses are different in the second run, although the program did not change. Why?</p>`,
    opts: [
      'Address-space layout randomization (ASLR) places the regions at random virtual addresses on every run, which makes memory attacks harder',
      'The program was loaded into a different amount of physical memory',
      'printf rounds addresses randomly',
      'Another process was using the old addresses',
    ],
    ans: 0,
    exp: `<p>程式看到的位址全是<b>虛擬位址</b>。ASLR 每次執行都隨機擺放 code、heap、stack 的位置，讓攻擊者猜不到要跳去哪裡。每個 process 有自己的 address space，別的 process 用什麼位址都不衝突。</p>`,
  },
  {
    id: 's2-w4-12', week: W, topic: '每個 process 都要自己的 kernel stack', src: N('Part 3'), group: 's2-W4-as', type: 'single',
    q: `<p>All processes share the kernel's code and data, yet each process has its own private kernel stack. Why can't the kernel use a single stack for everyone?</p>`,
    opts: [
      'The kernel is often in the middle of work for several processes at once (for example A asleep inside read() while the timer interrupts B); each needs saved state that must survive until it runs again',
      'Kernel stacks hold user passwords',
      'A single stack would be larger than physical memory',
      'Each process uses a different kernel version',
    ],
    ans: 0,
    exp: `<p>A 睡在 read() 裡時，它在 kernel 裡做到一半的狀態存在 kernel stack 上；這時 timer 打斷 B，B 也要在 kernel 裡存狀態。共用一個 stack，B 的狀態就會蓋掉 A 的。所以每個 process 一個 kernel stack，切換 process 時也要換 kernel stack。</p>`,
  },
  {
    id: 's2-w4-13', week: W, topic: '三個 printf 變成幾次 write', src: N('Part 4'), group: 's2-W4-sc', type: 'fill',
    q: `<p>The program below runs in a terminal under strace. How many ${c('write')} system calls does strace show for these lines?</p>${code(`
      printf("meow");
      printf("meow");
      printf("meow\\n");`)}`,
    ans: ['1'],
    exp: `<p>終端機是 line-buffered：前兩個 printf 只是把字放進 libc buffer，第三個遇到換行才 flush → strace 只看到一個 ${c('write(1, "meowmeowmeow\\n", 13)')}，共 <b>1</b> 次。三次函式呼叫變成一次 system call，省下兩次 user / kernel 切換——這就是 libc 要 buffer 的原因。（講義 Part 9 的實驗。）</p>`,
  },
  {
    id: 's2-w4-14', week: W, topic: '每行都有換行時', src: N('Part 4'), group: 's2-W4-sc', type: 'fill',
    q: `<p>This time each printf ends with a newline, and the program again runs in a <b>terminal</b> under strace. How many ${c('write')} system calls are made for these lines?</p>${code(`
      printf("a\\n");
      printf("b\\n");
      printf("c\\n");`)}`,
    ans: ['3'],
    exp: `<p>line-buffered：每遇到一個換行就 flush 一次 → <b>3</b> 次 write。如果改成導向檔案（${c('> out.txt')}，fully buffered），三行都留在 buffer，結束時才一次寫出 → 1 次。</p>`,
  },
  {
    id: 's2-w4-15', week: W, topic: 'System call 的錯誤怎麼傳回來', src: V('W4-05'), group: 's2-W4-sc', type: 'single',
    q: `<p>A program calls ${c('write(99, "x", 1)')} although fd 99 is not open. The libc wrapper returns −1 and sets errno to EBADF. What value did the kernel leave in R1 (the result register) on return from the trap?</p>`,
    opts: [
      'A negative error code (−EBADF), which the wrapper turned into −1 and errno',
      '0, meaning nothing was written',
      'The number 99',
      'Nothing; the kernel sets errno directly in user memory',
    ],
    ans: 0,
    exp: `<p>講義的五步驟最後一步：return-from-trap 時結果放在 R1，負值代表錯誤。libc 的 wrapper 檢查 R1：負的就把它（取絕對值）存進 errno，並回傳 −1 給你的程式。所以程式要檢查 −1、再看 errno（或用 perror）。</p>`,
  },
  {
    id: 's2-w4-16', week: W, topic: 'wait4 後門', src: N('Part 4'), group: 's2-W4-sc', type: 'single',
    q: `${code(`
      if ((options == (__WCLONE|__WALL)) && (current->uid = 0))
          retval = -EINVAL;`)}<p>This change was slipped into the argument check of the wait4 system call in 2003. What would it have done?</p>`,
    opts: [
      'Any process calling wait4 with that flag combination would have had its user ID set to 0, i.e. become root',
      'It would have crashed every caller with EINVAL',
      'Nothing, because the compiler removes the second condition',
      'It would have made wait4 slower for root',
    ],
    ans: 0,
    exp: `<p>關鍵是單一個 ${c('=')}：${c('current->uid = 0')} 不是比較，而是<b>把 UID 設成 0</b>。藏在「參數檢查」裡看起來像正常的驗證程式碼，卻讓任何人用特定旗標呼叫 wait4 就變成 root。這說明參數驗證碼在 kernel 權限下處理不可信的輸入，是安全關鍵的程式碼。</p>`,
  },
  {
    id: 's2-w4-17', week: W, topic: 'errno：用了 −1 當 fd', src: N('Part 8'), group: 's2-W4-errno', type: 'fill',
    q: `${code(`
      int fd = open("config.txt", O_RDONLY);   // config.txt does not exist
      read(fd, buf, 100);`)}<p>The program does not check open's result. What errno does the read() call set? Type the errno name.</p>`,
    ans: ['EBADF'],
    exp: `<p>open 失敗回傳 −1（errno = ENOENT），程式沒檢查，接著用 −1 當 fd 呼叫 read → read 失敗、回傳 −1、errno = <b>EBADF</b>（Bad file descriptor），buf 沒被改。之後若照樣 printf buf，就會印出未初始化的內容，使用者完全看不出是「檔案不存在」造成的。habit 2：每個 system call 都要檢查。</p>`,
  },
  {
    id: 's2-w4-18', week: W, topic: 'errno：沒有權限', src: N('Part 8'), group: 's2-W4-errno', type: 'fill',
    q: `<p>A normal user calls ${c('open("/etc/shadow", O_RDONLY)')}; only root may read that file. open() returns −1. What is errno? Type the errno name.</p>`,
    ans: ['EACCES'],
    exp: `<p>權限不足 → <b>EACCES</b>，perror 印出 Permission denied。其他常見的：ENOENT（No such file or directory）、EFAULT（傳了無效的指標給 kernel）、ENOMEM（記憶體不夠）。</p>`,
  },
  {
    id: 's2-w4-19', week: W, topic: 'Exception 分類：磁碟讀完了', src: V('W4-01'), group: 's2-W4-exc', type: 'fill',
    q: `<p>A process is sleeping in ${c('read()')} on a disk block that is not cached. The disk controller signals that the block has arrived. Which of the four kinds of exception is this signal: trap, fault, interrupt or abort? Type one word.</p>`,
    ans: ['interrupt', 'an interrupt'],
    exp: `<p>由外部裝置（磁碟控制器）引起、跟當時正在跑的程式無關 → <b>interrupt</b>。handler 把資料交給 kernel、把等待的 process 改成 ready，然後回到原本在跑的程式的下一個指令。</p>`,
  },
  {
    id: 's2-w4-20', week: W, topic: 'Exception 分類：硬體損壞', src: N('Part 5'), group: 's2-W4-exc', type: 'fill',
    q: `<p>The CPU reports an uncorrectable error in a memory chip (a machine check). Which of the four kinds of exception is this: trap, fault, interrupt or abort? Type one word.</p>`,
    ans: ['abort', 'an abort'],
    exp: `<p>硬體回報 kernel 無法信任自己還能安全處理的損壞 → <b>abort</b>，通常是 kernel panic（伺服器硬體支援時可能只終止用到那塊記憶體的 process）。trap 是程式故意的、fault 是指令意外出錯、interrupt 是外部裝置。</p>`,
  },
  {
    id: 's2-w4-21', week: W, topic: '哪些是 trap', src: N('Part 5'), group: 's2-W4-exc', type: 'multi',
    q: `<p>Which of the following are <b>traps</b>?${ALL}</p>`,
    opts: [
      `${c('write(1, "hi", 2)')} entering the kernel`,
      'The program reaches an int3 breakpoint that gdb inserted',
      'The first write to a freshly allocated page',
      'A timer tick',
      'A key press',
      'An integer division by zero',
    ],
    ans: [0, 1],
    exp: `<p>trap = 程式<b>故意</b>用一條指令進 kernel：system call、gdb 插入的 int3。做完後從下一個指令繼續。第一次寫新頁、除以 0 是 fault（意外）；timer、按鍵是 interrupt（外部）。</p>`,
  },
  {
    id: 's2-w4-22', week: W, topic: 'Page fault 什麼時候變 segfault', src: V('W4-04'), group: 's2-W4-exc', type: 'single',
    q: `<p>Page faults happen all the time in healthy programs. When does a page fault end with "Segmentation fault"?</p>`,
    opts: [
      'When the faulting address is outside any valid region of the process, so the kernel cannot fix it',
      'Whenever a program touches a page for the first time',
      'When the page fault happens during a system call',
      'When the program has more than 1000 page faults',
    ],
    ans: 0,
    exp: `<p>第一次碰到 malloc 的頁、寫 zero page、copy-on-write 都會 fault，但位址合法，kernel 配好 frame 後重試，程式毫無感覺。只有位址不屬於任何合法區域（例如 NULL、已經 unmap 的記憶體），kernel 修不好，才送 SIGSEGV（$? = 139）。</p>`,
  },
  {
    id: 's2-w4-23', week: W, topic: 'Timer interrupt 的成本', src: N('Part 6'), group: 's2-W4-timer', type: 'fill',
    q: `<p>A kernel takes 1000 timer ticks per second, and handling one tick (saving registers, running the handler, returning) takes 2 µs. What percentage of the CPU's time goes to handling ticks? Type just the number.</p>`,
    ans: ['0.2', '0.2%'],
    exp: `<p>每秒 1000 × 2 µs = 2000 µs = 2 ms → 2 ms / 1000 ms = <b>0.2%</b>。timer interrupt 很便宜，卻保證 kernel 至少每 1 ms 拿回一次 CPU。</p>`,
    calc: { fn: 'tickCost', hz: 1000, us: 2 },
  },
  {
    id: 's2-w4-24', week: W, topic: '鍵盤 interrupt 的間隔', src: N('Part 6'), group: 's2-W4-timer', type: 'fill',
    q: `<p>A gamer presses 10 keys per second on a 3 GHz CPU. On average, how many clock cycles pass between two keyboard interrupts?</p>`,
    ans: ['300000000', '300,000,000', '300 million'],
    exp: `<p>兩次按鍵間隔 0.1 s，3 × 10⁹ × 0.1 = <b>300,000,000</b> cycles。從 CPU 的角度看，就算是打字最快的人，鍵盤 interrupt 也非常稀少（講義：每秒 18 鍵，約每 55 ms 一次）。</p>`,
    calc: { fn: 'cycles', ghz: 3, hz: 10 },
  },
  {
    id: 's2-w4-25', week: W, topic: '在 Linux 上殺掉 while(1)', src: N('Part 6'), group: 's2-W4-timer', type: 'single',
    q: `<p>On Linux, a program runs ${c('while (1);')}, which never makes a system call. Why can you still kill it with Ctrl-C or from another terminal?</p>`,
    opts: [
      'The hardware timer interrupts it within about a millisecond, so the kernel regains the CPU and can run other processes and deliver signals',
      'The compiler inserts a hidden yield() into every loop',
      'Linux runs every program in kernel mode',
      'The loop eventually overflows and crashes',
    ],
    ans: 0,
    exp: `<p>preemptive scheduling：timer interrupt 不需要程式配合，每個 tick 都把 CPU 交回 kernel。kernel 可以讓其他 process（你的 shell、另一個終端機）執行，也能送 signal 給這個迴圈。在 cooperative 系統上它會讓整台機器卡住。</p>`,
  },
  {
    id: 's2-w4-26', week: W, topic: 'Mode switch 一定有、context switch 不一定', src: N('Part 6'), group: 's2-W4-cs', type: 'single',
    q: `<p>Which statement about system calls is correct?</p>`,
    opts: [
      'Every system call involves a mode switch (user → kernel → user); a context switch happens only if the process blocks or the scheduler picks another process',
      'Every system call involves a context switch',
      'System calls never involve a mode switch',
      'Only slow system calls involve a mode switch',
    ],
    ans: 0,
    exp: `<p>system call 一定要 trap 進 kernel 再回來 → 一定有 mode switch。context switch 是「換另一個 process 上 CPU」：只在 process 要等待（slow system call 睡著）或 scheduler 決定換人時才發生。getpid() 只有 mode switch。</p>`,
  },
  {
    id: 's2-w4-27', week: W, topic: '哪些情況會 context switch', src: N('Part 6'), group: 's2-W4-cs', type: 'multi',
    q: `<p>On a single CPU where other processes are ready to run, which of these events cause a context switch away from process A?${ALL}</p>`,
    opts: [
      'A calls read() on the keyboard and no key has been pressed',
      'A calls read() on the keyboard and a typed character is already waiting in the kernel buffer',
      "A timer tick arrives and A's time slice is used up",
      'A timer tick arrives but A is the only ready process',
      'A calls getpid()',
    ],
    ans: [0, 2],
    exp: `<p>沒有按鍵 → read 要等 → A 睡覺、換人 ✓。字元已經在 kernel buffer 裡 → read 立刻回傳，不用睡，不換人。slice 用完而且有別人 ready → scheduler 換人 ✓。只有 A 一個能跑 → tick 處理完回到 A。getpid 是 fast system call，只有 mode switch。</p>`,
  },
  {
    id: 's2-w4-28', week: W, topic: '睡著的 process 怎麼被叫醒', src: V('W4-01'), group: 's2-W4-cs', type: 'single',
    q: `<p>Process A sleeps on a wait queue inside ${c('read()')} on the keyboard. What makes A ready again?</p>`,
    opts: [
      "The keyboard interrupt handler stores the character and moves A from the wait queue to the ready state",
      'A checks the keyboard again every millisecond',
      'The next timer tick always wakes every sleeping process',
      'A wakes up after a fixed timeout of one second',
    ],
    ans: 0,
    exp: `<p>睡著的 process 完全不用 CPU，也不會自己輪詢。按鍵產生 interrupt，kernel 的 handler 把字元存起來、把 A 標成 ready；之後 scheduler 選到 A，A 才從 read() 回來、拿到那個字元。</p>`,
  },
  {
    id: 's2-w4-29', week: W, topic: '為什麼需要 vDSO：算算成本', src: N('Part 7'), group: 's2-W4-vdso', type: 'fill',
    q: `<p>A busy server calls ${c('gettimeofday()')} 2 million times per second. If every call were a real system call costing 300 ns, how many milliseconds of CPU time per second would these calls consume?</p>`,
    ans: ['600', '600 ms'],
    exp: `<p>2 × 10⁶ × 300 ns = 6 × 10⁸ ns = 0.6 s = <b>600 ms</b>，每秒有六成 CPU 時間花在讀時鐘的 trap 上。vDSO 把時間放在每個 process 都 map 了的唯讀頁，gettimeofday 變成普通函式呼叫，不 trap、不切 mode。</p>`,
    calc: { fn: 'syscallCost', calls: 2e6, ns: 300 },
  },
  {
    id: 's2-w4-30', week: W, topic: '/proc/self/maps 裡的 vvar 與 vdso', src: N('Part 7'), group: 's2-W4-vdso', type: 'single',
    q: `${code(`
      7ffd1a5f2000-7ffd1a5f6000 r--p 00000000 00:00 0   [vvar]
      7ffd1a5f6000-7ffd1a5f8000 r-xp 00000000 00:00 0   [vdso]`)}<p>What are these two regions in every process's memory map?</p>`,
    opts: [
      "[vvar] is a read-only page of kernel-maintained data such as the current time; [vdso] is a small read-only, executable library that reads it without a trap",
      'Two copies of the kernel stack',
      'The process\'s heap and stack',
      'Swap space reserved for the process',
    ],
    ans: 0,
    exp: `<p>權限欄位就是線索：vvar 是 r--（只能讀的資料頁，kernel 會更新裡面的時間），vdso 是 r-x（可執行的小程式庫）。libc 的 gettimeofday 直接呼叫 vdso 裡的函式讀 vvar，所以 strace 看不到它。</p>`,
  },
  {
    id: 's2-w4-31', week: W, topic: 'EC2 上 vDSO 失效', src: N('Part 7 optional'), group: 's2-W4-vdso', type: 'single',
    q: `<p>In 2017, a loop of gettimeofday() calls ran 77% slower on certain Amazon EC2 virtual machines than on the engineers' own hardware, with the same program, libc and kernel version. strace showed the calls on EC2 but not on their laptops. What happened?</p>`,
    opts: [
      'The vDSO could not read the Xen hypervisor\'s clock from user mode, so every call fell back to a real system call (a trap)',
      'EC2 CPUs have a slower clock speed',
      'strace itself slowed the program down only on EC2',
      'The EC2 kernel disabled timer interrupts',
    ],
    ans: 0,
    exp: `<p>那些 EC2 機器用 Xen 的時鐘來源，vDSO 在 user mode 讀不到，只好退回真正的 system call。每次讀時間都要付 mode switch 的成本，strace 也就看得到了。量到的差距正好就是 user / kernel 切換的成本。</p>`,
  },
  {
    id: 's2-w4-32', week: W, topic: 'Meltdown 與 KPTI', src: N('Part 7 optional'), group: 's2-W4-vdso', type: 'single',
    q: `<p>After Meltdown (2018), Linux adopted KPTI, which removes almost all kernel mappings from the user page table. Why did this slow down programs that make many system calls?</p>`,
    opts: [
      'Every trap now has to switch page tables, so the "kernel mapped in every address space" shortcut is lost',
      'KPTI disables the page cache',
      'KPTI makes every system call run twice',
      'KPTI turns off the vDSO for all programs',
    ],
    ans: 0,
    exp: `<p>原本 kernel 就 map 在每個 address space 的上半部，trap 進來不用換 page table，所以 system call 只要幾百 ns。Meltdown 讓 user 程式能透過 speculative execution 偷讀那些 kernel 頁，KPTI 只好把它們拿掉，每次 trap 都切換 page table → system call 多的程式慢了不少。這是「效能 vs 硬體能否正確執行權限」的取捨。</p>`,
  },
  {
    id: 's2-w4-33', week: W, topic: 'glibc 為什麼不再快取 PID', src: N('Part 7'), group: 's2-W4-vdso', type: 'single',
    q: `<p>In principle getpid() could avoid the trap, because the PID is public and never changes within a process. glibc once cached the PID in user space. Why did it stop?</p>`,
    opts: [
      'The cached value could become wrong after fork in some unusual cases, because the child has a new PID',
      'Caching the PID was a security hole that let other users read it',
      'getpid() became a slow system call',
      'The kernel forbids user programs from storing their PID',
    ],
    ans: 0,
    exp: `<p>fork 之後 child 有新的 PID，但記憶體是從 parent 複製來的——快取裡還是 parent 的 PID。某些特殊情況下快取沒有被正確更新，getpid() 就回傳錯的值，所以 glibc 放棄了。read() 則原則上就不可能用 vDSO（要碰裝置、可能要睡、依賴 fd table）。</p>`,
  },
  {
    id: 's2-w4-34', week: W, topic: 'Trap 指令不帶位址', src: N('Part 4'), group: 's2-W4-sc', type: 'single',
    q: `<p>The trap instruction never takes a target address; the CPU always jumps to the one entry point the kernel set up at boot, and the program only passes a service number. Why?</p>`,
    opts: [
      'If the program could choose where to land, it could jump past the kernel\'s permission checks',
      'Addresses do not fit in a register',
      'The kernel has only one function',
      'To make system calls faster than function calls',
    ],
    ans: 0,
    exp: `<p>程式只能選「要什麼服務」（編號），不能選「跳到 kernel 的哪裡」。否則它可以直接跳到權限檢查之後的那一行，用 kernel mode 做任何事。這就是 system call 和 function call 的根本差別之一。</p>`,
  },
  {
    id: 's2-w4-35', week: W, topic: 'Kernel 先複製並檢查 user buffer', src: V('W4-05'), group: 's2-W4-sc', type: 'single',
    q: `<p>For ${c('write(1, buf, 64)')}, the kernel does not simply use ${c('buf')} as a pointer while it works. It first checks that the whole 64-byte range lies in user space and copies the bytes into kernel memory. What does the check prevent?</p>`,
    opts: [
      'A malicious program passing a pointer into kernel memory and making the kernel, which runs in kernel mode, print kernel data',
      'Programs writing more than 64 bytes at a time',
      'The page cache filling up',
      'Two processes writing to the same terminal',
    ],
    ans: 0,
    exp: `<p>handler 跑在 kernel mode，它「能」讀任何位址。如果直接相信使用者給的指標，傳一個 kernel 位址就能讓 write 把 kernel 記憶體（可能有別的 process 的資料）印出來。所以 sys_write 先確認整段都在 user space（否則回傳 EFAULT），再複製進 kernel 使用；read 則把結果複製回使用者的 buffer。</p>`,
  },
];
