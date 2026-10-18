// Week 3 · Quiz 2：fork / exec / wait、zombie / orphan / daemon、環境變數、PATH、built-in、靜態 / 動態連結
const { code, c, ALL } = require('./lib');
const W = 'W3';
const O = (n, warn) => `原題 ${n}${warn ? ' ⚠️' : ''}`;
const V = (n, warn) => `變化題（源自 ${n}${warn ? ' ⚠️' : ''}）`;

const PROG_W3_14 = code(`
  pid_t pid1 = fork();
  pid_t pid2 = fork();
  if (pid1 == 0) { exit(0); } else { fork(); }
  if (pid2 == 0) { printf("Hi\\n"); }
  return 0;`);

const PROG_W3_15 = code(`
  pid_t a = fork();
  pid_t b = fork();
  if (a == 0 || b == 0) printf("X\\n");
  if (a != 0 && b == 0) printf("Y\\n");
  return 0;`);

const PROG_W3_16 = code(`
  for (int i = 0; i < 3; i++) {
      fork();
      printf("Hi\\n");
  }
  return 0;`);

const PROG_W3_21 = code(`
  int main(int argc, char *argv[]) {
      printf("A\\n");
      pid_t pid = fork();
      if (pid == 0) {
          char *args[] = {argv[1], "B", NULL};
          execv(argv[1], args);
          printf("C\\n");
          return 1;
      }
      printf("D\\n");
      wait(NULL);
      printf("E\\n");
      return 0;
  }`);

const W3_17_SETUP = `<p>Process P forks three children. C1 and C2 call ${c('exit(0)')} immediately; C3 runs ${c('sleep(60)')}. P itself calls ${c('sleep(10)')}, never calls ${c('wait()')}, and then exits.</p>`;

module.exports = [
  // ===================== 原題 =====================
  {
    id: 'w3-01', week: W, topic: 'exec 成功後保留什麼', src: O('W3-01'), group: 'W3-01', type: 'multi',
    q: `<p>A child process calls exec successfully. Which of the following stay the same after exec?${ALL}</p>`,
    opts: ['the values of global variables', 'the program code', 'the current position in the program', 'the PPID', 'the open files (the fd table)', 'the PID'],
    ans: [3, 4, 5],
    exp: `<p>exec 換掉整個程式映像：code、全域變數、heap、stack、執行位置全部換成新程式的（從新程式的開頭開始跑）。</p><p>保留的是 process 本身和 kernel 端的狀態：<b>PID、PPID、fd table</b>（標記 close-on-exec 的除外）、cwd、使用者身分、環境變數（execve 可另外指定）。這也是 shell 能在 fork 後、exec 前先做好 redirection 的原因。</p>`,
  },
  {
    id: 'w3-02', week: W, topic: '兩個靜態連結執行檔的 libX', src: O('W3-02'), group: 'W3-02', type: 'single',
    q: `<p>A and B are two different executables, each statically linked with libX. Both are running at the same time. How many copies of libX's code are in DRAM, and why?</p>`,
    opts: [
      '1 copy, because the kernel compares page contents and shares pages that are equal',
      '2 copies, because the kernel shares pages only when they come from the same file',
      '2 copies, because statically linked code can never be shared',
      '1 copy, because the same library is loaded only once',
    ],
    ans: 1,
    exp: `<p>靜態連結把 libX 複製進 A、B 兩個<b>不同的</b>執行檔。kernel 只共享「同一個檔案」被多個 process map 的頁，不會比對不同檔案的內容 → <b>2</b> 份。</p><p>(c) 錯：同一個靜態執行檔同時跑兩個 process 時，code 來自同一個檔案，還是可以共享。</p>`,
  },
  {
    id: 'w3-03', week: W, topic: '為什麼 cd 必須是 built-in', src: O('W3-03'), group: 'W3-03', type: 'single',
    q: `<p>Why must ${c('cd')} be a shell built-in instead of a separate program like ${c('ls')}?</p>`,
    opts: [
      'The working directory is stored in the PWD environment variable, which only the shell can change.',
      'exec resets the working directory of every new program.',
      'Changing directories requires root privileges, which only the shell has.',
      "The working directory belongs to each process. A child would change its own and then exit, leaving the shell's unchanged.",
    ],
    ans: 3,
    exp: `<p>cwd 是每個 process 的狀態，存在 kernel 的 process table（不是存在 PWD 環境變數）。若 cd 是獨立程式，bash 會 fork 出 child，child 改了自己的 cwd 就 exit，bash 的 cwd 完全沒變。exec 也不會重設 cwd（它是 exec 保留的狀態之一）。所以 cd、export、exit 都是 built-in，在 shell 自己的 process 裡執行、不 fork。</p>`,
  },
  {
    id: 'w3-04', week: W, topic: 'Everything is a file', src: O('W3-04'), group: 'W3-04', type: 'single',
    q: `<p>${c('cat /sys/class/thermal/thermal_zone0/temp')} prints the CPU temperature. Which Unix idea does this show best?</p>`,
    opts: ['Text streams are a universal interface.', 'cat is a shell built-in, so it can read hardware.', 'Everything is a file.', 'Each program does one thing well.'],
    ans: 2,
    exp: `<p>溫度感測器被表示成一個（不存任何資料的）虛擬檔案，所以一般的 cat 就能讀它。/proc 代表 process、/dev 代表磁碟等裝置，都是 everything is a file。(a)(d) 也是 Unix 哲學，但這個例子展示的是「感測器被當成檔案」。cat 不是 built-in。</p>`,
  },
  {
    id: 'w3-05a', week: W, topic: '靜態 / 動態連結：DRAM 用量', src: O('W3-05'), group: 'W3-05', type: 'single',
    q: `<p>libY contains 4 MB of code. 20 different programs each have 2 MB of their own code, and all of them use libY. One process of each program is running. How much DRAM does <b>libY's code</b> use if every program is statically linked, and if every program is dynamically linked?</p>`,
    opts: ['Static: 80 MB; dynamic: 4 MB', 'Static: 4 MB; dynamic: 80 MB', 'Static: 80 MB; dynamic: 80 MB', 'Static: 120 MB; dynamic: 44 MB'],
    ans: 0,
    exp: `<p>靜態：每個執行檔各自帶一份 libY，而且是 20 個不同的檔案，kernel 不會共享 → 20 × 4 = <b>80 MB</b>。</p><p>動態：libY.so 只有一個檔案，DRAM 裡只有一份 <b>4 MB</b>，被 20 個 process 的 page table 共同 map（library code 是唯讀的，可以共享）。</p>`,
    calc: { fn: 'linkMem', lib: 4, own: 2, n: 20, expect: [80, 4] },
  },
  {
    id: 'w3-05b', week: W, topic: '靜態 / 動態連結：磁碟用量', src: O('W3-05'), group: 'W3-05', type: 'fill',
    q: `<p>libY contains 4 MB of code. 20 different programs each have 2 MB of their own code and all use libY. With <b>dynamic</b> linking, how much disk space do the 20 executables plus libY.so take in total, in MB?</p>`,
    ans: ['44', '44 MB', '44MB'],
    exp: `<p>動態連結的執行檔只帶自己的 2 MB code，加上一個「NEEDED libY.so」的註記：20 × 2 + 4 = <b>44 MB</b>。（若全部靜態：20 × (2 + 4) = 120 MB。）</p>`,
    calc: { fn: 'linkDisk', lib: 4, own: 2, n: 20, mode: 'dynamic' },
  },
  {
    id: 'w3-06', week: W, topic: '什麼時候該用靜態連結', src: O('W3-06', 1), group: 'W3-06', type: 'single',
    q: `<p>In which situation is static linking the better choice?</p>`,
    opts: [
      'A library that often needs security fixes',
      'libc, used by almost every desktop program',
      'A command-line tool shipped to many users on many different Linux versions',
      '200 programs on one server that call the same crypto library',
    ],
    ans: 2,
    exp: `<p>要散布到各種不同機器的工具（fzf、ripgrep、Docker 這類 Go / Rust 單一執行檔）用靜態連結，避免對方機器缺 .so 或出現 ${c("version 'GLIBC_2.34' not found")}。</p><p>其他三個都是「很多程式共用、需要一次修補」→ 動態連結：換一個 .so 檔、程式重啟就全部修好（Heartbleed 的教訓）。</p>`,
  },
  {
    id: 'w3-07', week: W, topic: 'fork 的回傳值', src: O('W3-07'), group: 'W3-07', type: 'single',
    q: `<p>${c('pid_t p = fork();')} Assuming fork succeeds, what is ${c('p')} in the parent and in the child?</p>`,
    opts: ["In the parent: the child's PID; in the child: 0", "In the parent: 0; in the child: the parent's PID", 'In each process: its own PID', 'In the parent: 1; in the child: 0'],
    ans: 0,
    exp: `<p>fork 回傳給 parent 的是 child 的 PID，回傳給 child 的是 0；失敗時 parent 得到 −1、不會產生 child。回傳值是兩個 process 唯一能分辨「我是誰」的資訊。child 要知道 parent 的 PID 用 ${c('getppid()')}。</p>`,
  },
  {
    id: 'w3-08', week: W, topic: 'fork 後變數各自獨立', src: O('W3-08'), group: 'W3-08', type: 'single',
    q: `${code(`
      int x = 1;
      if (fork() == 0) {
          x = x + 1;
          printf("child %d\\n", x);
      } else {
          wait(NULL);
          printf("parent %d\\n", x);
      }`)}<p>What is printed?</p>`,
    opts: ['child 2, then parent 2', 'child 2, then parent 1', 'parent 1, then child 2', 'child 1, then parent 1'],
    ans: 1,
    exp: `<p>fork 之後兩個 process 各有一份記憶體（copy-on-write：有人寫的時候才真的複製那一頁）。child 把<b>自己的</b> x 改成 2，parent 的 x 仍是 1。parent 先 wait(NULL)，等 child 結束才印，所以順序固定：child 2 → parent 1。</p>`,
    cprog: 'w3_fork w3-08', cexpect: 'child 2|parent 1',
  },
  {
    id: 'w3-09', week: W, topic: 'export 的可見範圍', src: O('W3-09'), group: 'W3-09', type: 'single',
    q: `<p>In bash you run ${c('export KEY=abc')}. Which processes can see KEY?</p>`,
    opts: [
      'Only this shell',
      'Every process on the machine owned by the same user',
      'Only the next command this shell runs',
      'This shell, the children it forks from now on, their children, and so on',
    ],
    ans: 3,
    exp: `<p>環境變數存在每個 process 自己的記憶體裡，fork / exec 時由 parent 傳給 child。export 之後，這個 shell 從現在起 fork 出的 child、孫子……都會繼承到 KEY。已經在跑的其他 process（parent shell、其他終端機）看不到。</p>`,
  },
  {
    id: 'w3-10', week: W, topic: '大量 zombie', src: O('W3-10'), group: 'W3-10', type: 'single',
    q: `<p>A web server forks one child per request. After a few days, ${c('fork()')} starts returning −1, and ${c('ps')} shows tens of thousands of processes in state Z. Which call is missing?</p>`,
    opts: ['The child never calls exit().', 'The parent never calls wait() for its children.', 'The parent never calls exec().', 'The child never closes its file descriptors.'],
    ans: 1,
    exp: `<p>Z = zombie：child 已經 exit，記憶體和檔案都釋放了，但 kernel 還留著 process table 的那一列（PID + exit code）等 parent 用 wait() 來收。parent 從不 wait → 每個 request 留一列 → 表滿了，fork() 對所有人都失敗。</p>`,
  },
  {
    id: 'w3-11', week: W, topic: 'API key 不要放命令列', src: O('W3-11'), group: 'W3-11', type: 'single',
    q: `<p>On a shared workstation, why is running ${c('python3 llama.py --key sk-ABC123')} unsafe?</p>`,
    opts: [
      'Command-line arguments are written to the disk in plain text.',
      'The key can be read by other users with ps or top.',
      'The key is passed on to every child process.',
      'Python stores arguments in a global variable that other programs can read.',
    ],
    ans: 1,
    exp: `<p>同一台機器上的所有使用者都能用 ps / top 看到每個 process 的命令列參數。放在環境變數裡只有該 process 和它的 child 看得到，是放 secret 的標準做法。(c)「傳給 child」是環境變數的特性，也不是別的使用者看得到的原因。</p>`,
  },
  {
    id: 'w3-12', week: W, topic: 'Orphan', src: O('W3-12'), group: 'W3-12', type: 'single',
    q: `<p>A parent exits before its child. ${c('ps')} shows the child still running, now with PPID 1. What kind of process is the child, and what happens when it exits later?</p>`,
    opts: [
      'A zombie; it stays in the process table until the machine reboots',
      'An orphan; init reaps it, and its row leaves the process table',
      'A daemon; it can never exit',
      'An orphan; it stays a zombie forever because its original parent is gone',
    ],
    ans: 1,
    exp: `<p>parent 先結束、child 還在跑 → <b>orphan</b>。kernel 把它的 PPID 改成 1，由 init（systemd）收養；init 會替它 wait，所以 child 結束時那一列會被收掉，不會永遠留下 zombie。這是正常、有用的機制。</p>`,
  },
  {
    id: 'w3-13', week: W, topic: 'PATH 是誰在搜尋', src: O('W3-13'), group: 'W3-13', type: 'single',
    q: `<p>You type ${c('myapp')} and get ${c('myapp: command not found')}. Which statement is correct?</p>`,
    opts: [
      'The kernel searched every directory on the disk and did not find myapp.',
      'The kernel searched the directories listed in PATH and did not find myapp.',
      'The shell searched the directories listed in PATH and did not find myapp.',
      'The shell searched only the current directory and did not find myapp.',
    ],
    ans: 2,
    exp: `<p>kernel 的 execve() 需要完整路徑。是 <b>shell</b>（或 libc 的 execvp）依序在 PATH 的每個目錄嘗試 execve，strace 會看到一連串 ${c('execve(...) = -1 ENOENT')}。kernel 不會去搜尋 PATH；PATH 裡通常也沒有目前目錄。</p>`,
  },
  {
    id: 'w3-14a', week: W, topic: 'fork 計數：Hi 行數', src: O('W3-14'), group: 'W3-14', type: 'fill',
    q: `<p>How many lines of ${c('Hi')} does this program print? Assume every fork succeeds and stdout is a terminal.</p>${PROG_W3_14}`,
    ans: ['2'],
    exp: `<p>兩次 fork 後有 4 個 process，(pid1, pid2) 分別是 (&gt;0,&gt;0)、(&gt;0,0)、(0,&gt;0)、(0,0)。</p><p>pid1 == 0 的兩個直接 exit。剩下 (&gt;0,&gt;0) 和 (&gt;0,0) 各再 fork 一次，新 child 繼承同樣的 pid2。pid2 == 0 的是 (&gt;0,0) 和它剛 fork 出的 child → 印 <b>2</b> 行。</p>`,
    cprog: 'w3_fork w3-14 (tty)',
  },
  {
    id: 'w3-14b', week: W, topic: 'fork 計數：process 總數', src: O('W3-14'), group: 'W3-14', type: 'fill',
    q: `<p>How many processes are created in total by running this program, counting the original process and the ones that exit early? Assume every fork succeeds.</p>${PROG_W3_14}`,
    ans: ['6'],
    exp: `<p>前兩次 fork：1 → 4 個。pid1 == 0 的 2 個 exit（它們還是算數）。剩下的 2 個各 fork 一次，再多 2 個 → 4 + 2 = <b>6</b>（已實測）。</p>`,
    cprog: 'w3_fork w3-14 (count)',
  },
  {
    id: 'w3-15a', week: W, topic: 'fork 計數：條件 X', src: O('W3-15'), group: 'W3-15', type: 'fill',
    q: `<p>How many times is ${c('X')} printed? Assume every fork succeeds.</p>${PROG_W3_15}`,
    ans: ['3'],
    exp: `<p>4 個 process 的 (a, b)：(&gt;0,&gt;0) 原本的、(&gt;0,0) 第二次 fork 的 child、(0,&gt;0) 第一次 fork 的 child、(0,0) 孫子。</p><p>a == 0 || b == 0：除了原本的 process 以外都成立 → <b>3</b> 次。</p>`,
    cprog: 'w3_fork w3-15 (tty)',
  },
  {
    id: 'w3-15b', week: W, topic: 'fork 計數：條件 Y 由誰印', src: O('W3-15'), group: 'W3-15', type: 'single',
    q: `${PROG_W3_15}<p>Assume every fork succeeds. The four processes are the original one, the child of the first fork, the child that the original process creates in the second fork, and the grandchild. Which of them print ${c('Y')}, and how many Y lines appear in total?</p>`,
    opts: [
      'Only the original process; 1 line',
      'The child of the first fork and the grandchild; 2 lines',
      'Only the child that the original process creates in the second fork; 1 line',
      'Every process except the original one; 3 lines',
    ],
    ans: 2,
    exp: `<p>a != 0 &amp;&amp; b == 0：第一次 fork 時是 parent（a &gt; 0），第二次 fork 時是 child（b == 0）→ 只有「原本 process 在第二次 fork 產生的 child」，(a, b) = (&gt;0, 0) → <b>1</b> 行。</p><p>對照 X 的條件 a == 0 || b == 0：除了原本的 process 以外都成立 → 3 行（那是 (d) 描述的情況）。</p>`,
    cprog: 'w3_fork w3-15 (tty)', cexpect: '1',
  },
  {
    id: 'w3-16a', week: W, topic: '迴圈中 fork：輸出行數（終端機）', src: O('W3-16'), group: 'W3-16', type: 'fill',
    q: `<p>How many lines of ${c('Hi')} are printed? Assume every fork succeeds and stdout is a terminal.</p>${PROG_W3_16}`,
    ans: ['14'],
    exp: `<p>每一輪所有 process 都先 fork（數量加倍）再各印一行：第 1 輪 2 個 process 印 2 行、第 2 輪 4 個印 4 行、第 3 輪 8 個印 8 行 → 2 + 4 + 8 = <b>14</b>。終端機是 line-buffered，每個 "Hi\\n" 在 fork 前就已經 flush，不會被複製。</p>`,
    cprog: 'w3_fork w3-16 (tty)',
  },
  {
    id: 'w3-16b', week: W, topic: '迴圈中 fork：process 總數', src: O('W3-16'), group: 'W3-16', type: 'fill',
    q: `<p>How many processes exist in total (including the original) after this loop has finished? Assume every fork succeeds.</p>${PROG_W3_16}`,
    ans: ['8'],
    exp: `<p>每一輪每個 process 都 fork 一次，數量加倍：1 → 2 → 4 → <b>8</b>。</p>`,
    cprog: 'w3_fork w3-16 (count)',
  },
  {
    id: 'w3-17a', week: W, topic: 'Zombie 計數', src: O('W3-17'), group: 'W3-17', type: 'fill',
    q: `${W3_17_SETUP}<p>At a moment when C1 and C2 have exited but P is still sleeping, how many zombie processes exist?</p>`,
    ans: ['2'],
    exp: `<p>C1、C2 已經 exit，但 parent P 還活著、而且從不呼叫 wait() → 它們的 process table 那一列還留著 → <b>2</b> 個 zombie。C3 還在 sleep，不是 zombie。</p>`,
  },
  {
    id: 'w3-17b', week: W, topic: 'Parent 結束後 zombie 與 orphan 的命運', src: O('W3-17', 1), group: 'W3-17', type: 'single',
    q: `${W3_17_SETUP}<p>After P exits, what happens to C1 and C2, and what is C3 now?</p>`,
    opts: [
      'C1 and C2 stay zombies forever; C3 becomes a zombie too',
      'init adopts and reaps C1 and C2, and their rows leave the process table; C3 is an orphan',
      'C3 reaps C1 and C2; C3 is now a daemon',
      'C1 and C2 stay zombies until the next reboot; C3 is killed together with P',
    ],
    ans: 1,
    exp: `<p>P 結束時，它所有的 child——包括已經是 zombie 的 C1、C2——都改由 init 收養。init 會替它們 wait，於是 zombie 的那一列被收掉（原答錯在以為它們會一直留著）。</p><p>C3 還在跑、原本的 parent 不見了 → <b>orphan</b>，PPID 變成 1，之後結束時也由 init 收。parent 結束不會連帶殺掉 child。</p>`,
  },
  {
    id: 'w3-18', week: W, topic: '更新 libssl.so 後各程式用哪一版', src: O('W3-18', 1), group: 'W3-18', type: 'single',
    q: `<p>A machine replaces ${c('libssl.so')} with a patched version. Which version of libssl does each program use?</p><p>• A: dynamically linked; started before the replacement and still running.<br>• B: dynamically linked; started after the replacement.<br>• C: statically linked; started after the replacement.</p>`,
    opts: ['A old, B new, C new', 'A old, B new, C old', 'A new, B new, C old', 'A new, B new, C new'],
    ans: 1,
    exp: `<p>A：替換前就已經把舊版 .so map 進記憶體了，要重啟才會換 → old。</p><p>B：啟動時 dynamic loader 才去找 libssl.so，拿到新版 → new。</p><p>C：靜態連結在<b>建置時</b>就把 libssl 複製進執行檔，替換 .so 對它完全沒影響，必須重新編譯、重新發布 → old（原答 new 錯）。這就是 Heartbleed 時靜態連結的程式一直沒被修好的原因。</p>`,
  },
  {
    id: 'w3-19', week: W, topic: 'Double fork / daemon', src: O('W3-19'), group: 'W3-19', type: 'single',
    q: `${code(`
      int main(void) {
          if (fork() == 0) {                   // C
              setsid();
              if (fork() == 0) run_server();   // G: runs for a long time
              exit(0);
          }
          wait(NULL);                          // P
          return 0;
      }`)}<p>After C has exited and P has reaped it and returned, who is G's parent, and who will reap G when it finally exits?</p>`,
    opts: ["G's parent is C; C reaps it", "G's parent is P; P reaps it", "G's parent is init; init reaps it", 'G has no parent; the kernel deletes it immediately'],
    ans: 2,
    exp: `<p>這是 double fork：C fork 出 G 後馬上 exit，P 用 wait 收掉 C。G 的 parent（C）不見了 → G 成為刻意製造的 orphan，PPID 變成 1，由 <b>init</b> 收養；G 結束時也由 init reap。</p><p>setsid() 讓它脫離終端機，第二次 fork 讓它不會再取得控制終端機。這是傳統 daemon 的做法（現在多半交給 systemd service）。</p>`,
    cprog: 'w3_fork w3-19', cexpect: '1',
  },
  {
    id: 'w3-20', week: W, topic: "GLIBC_2.34 not found", src: O('W3-20'), group: 'W3-20', type: 'single',
    q: `<p>You copy a program you built on your laptop to an older server. Running it there prints ${c("version 'GLIBC_2.34' not found")}. Which statement explains this?</p>`,
    opts: [
      'The program is statically linked, so it carries the libc from your laptop.',
      'The program is dynamically linked, so at run time it uses the libc installed on the other machine.',
      'The program is dynamically linked, so it carries a copy of the libc from your laptop.',
      'The program is statically linked, so the kernel refuses to run it on another machine.',
    ],
    ans: 1,
    exp: `<p>動態連結的執行檔只記錄「需要 libc.so.6（版本 ≥ GLIBC_2.34）」，執行時由 dynamic loader 在<b>那台機器</b>上找 libc。舊機器的 libc 太舊 → 找不到需要的版本。靜態連結（Go / Rust 的單一執行檔）就不會遇到。</p>`,
  },
  {
    id: 'w3-21a', week: W, topic: 'fork + execv：各行印幾次', src: O('W3-21', 1), group: 'W3-21', type: 'single',
    q: `<p>The program below is run twice <b>from a terminal</b> (stdout is the terminal):<br>Run 1: ${c('./prog /bin/echo')}<br>Run 2: ${c('./prog /bin/_i_dont_exist_just_4_fun')}</p>${PROG_W3_21}<p>How many times are C, D and E printed in each run?</p>`,
    opts: [
      'Run 1: C 0, D 1, E 1 · Run 2: C 1, D 1, E 1',
      'Run 1: C 1, D 2, E 2 · Run 2: C 1, D 1, E 1',
      'Run 1: C 0, D 2, E 2 · Run 2: C 1, D 2, E 2',
      'Run 1: C 0, D 1, E 1 · Run 2: C 0, D 1, E 1',
    ],
    ans: 0,
    exp: `<p>exec 成功就不會回來（舊程式已經不存在了），所以 Run 1 的 child 變成 echo、印出 B，C 不會印。Run 2 exec 失敗，回到下一行印 C，然後 return 1。</p><p>D、E 雖然在 if 外面，但 child 不是被 exec 換掉（Run 1）就是已經 return（Run 2），只有 parent 會印 D、E，各 <b>1</b> 次（原答 C=1、D=2、E=2 錯）。</p><p>A：終端機是 line-buffered，"A\\n" 在 fork 前已經 flush，所以兩次都只印 1 次。B：Run 1 印 1 次、Run 2 印 0 次。</p>`,
    cprog: 'w3_fork w3-21 (tty)', cexpect: 'run1 C0 D1 E1|run2 C1 D1 E1',
  },
  {
    id: 'w3-21b', week: W, topic: 'fork + execv：輸出順序', src: O('W3-21'), group: 'W3-21', type: 'single',
    q: `<p>The program below is run from a terminal as ${c('./prog /bin/echo')}, so the child becomes echo and prints B.</p>${PROG_W3_21}<p>Which statement about the order of the output lines is correct?</p>`,
    opts: [
      'B always appears before D; E is always the last line.',
      'D always appears before B; E may appear before B.',
      'The order of B and D is not determined; E is always the last line.',
      'The order of B and D is not determined, and E may appear before B.',
    ],
    ans: 2,
    exp: `<p>fork 之後 parent（印 D）和 child（exec echo 印 B）是兩個可同時執行的 process，誰先由 scheduler 決定 → B、D 的順序<b>不一定</b>。</p><p>E 在 wait(NULL) 之後：wait 回來代表 child（echo）已經結束、B 一定已經印完，所以 E 一定是最後一行。</p>`,
  },
  {
    id: 'w3-22', week: W, topic: 'fork 共用 file offset', src: O('W3-22', 1), group: 'W3-22', type: 'fill',
    q: `${code(`
      int fd = open("log.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
      if (fork() == 0) {
          write(fd, "A", 1);
      } else {
          wait(NULL);
          write(fd, "B", 1);
      }`)}<p>After both processes finish, what are the exact contents of log.txt?</p>`,
    ans: ['AB'],
    exp: `<p>fork 複製 fd table，但兩邊的 fd 指向<b>同一個</b> open file entry，共用同一個 offset。child 寫 A 後 offset 變 1；parent 等 child 結束後寫 B，從 offset 1 開始 → 檔案內容是 <b>AB</b>，共 2 bytes（原答 16 錯）。</p><p>若改成「fork 之後兩邊各自 open」，就是兩個獨立的 open file entry、各自從 0 開始，會互相覆蓋。</p>`,
    cprog: 'w3_fork w3-22',
  },

  // ===================== 變化題 =====================
  {
    id: 'w3-v06a', week: W, topic: '什麼時候該用動態連結（反過來問）', src: V('W3-06', 1), group: 'W3-06', type: 'single',
    q: `<p>In which situation is <b>dynamic</b> linking the better choice?</p>`,
    opts: [
      'A single command-line tool that users download and run on many different Linux distributions',
      "A rescue tool that must keep working even when the system's /usr/lib is damaged",
      'OpenSSL, used by 150 daemons on one server that must be patched within hours of a new vulnerability',
      'A program shipped in a minimal container image that contains no libc at all',
    ],
    ans: 2,
    exp: `<p>很多程式共用、需要快速一次修補 → 動態連結：換掉一個 libssl.so、重啟服務，150 個 daemon 全部修好（Heartbleed 的教訓）。</p><p>(a)(b)(d) 都是「不能依賴目標機器上的 library」的情境，用靜態連結的單一執行檔比較安全。</p>`,
  },
  {
    id: 'w3-v06b', week: W, topic: '靜態連結的優點', src: V('W3-06', 1), group: 'W3-06', type: 'multi',
    q: `<p>Which of the following are advantages of <b>static</b> linking?${ALL}</p>`,
    opts: [
      `The program runs on an older Linux machine without ${c("version 'GLIBC_x.y' not found")} errors.`,
      'After execve maps the file, main starts directly; no dynamic loader has to find and map libraries first.',
      'A bug in the library is fixed for every program by replacing one file.',
      'Every running program shares one copy of the library code in DRAM.',
      'The executable file on disk is smaller.',
    ],
    ans: [0, 1],
    exp: `<p>靜態連結在建置時把 library 複製進執行檔：自給自足，到哪台 Linux 都能跑（a ✓）；執行時不需要 dynamic loader 先找 .so、map、填位址（b ✓）。</p><p>代價：執行檔比較大（e 是動態的優點）、每個程式在 DRAM 各一份 library（d 是動態的優點）、library 有漏洞時每個程式都要重新建置發布（c 是動態的優點）。</p>`,
  },
  {
    id: 'w3-v17a', week: W, topic: 'Zombie 計數：只 wait 一次', src: V('W3-17', 1), group: 'W3-17', type: 'fill',
    q: `<p>A parent process runs:</p>${code(`
      for (int i = 0; i < 4; i++)
          if (fork() == 0) exit(0);     // each child exits immediately
      sleep(1);
      wait(NULL);
      sleep(30);`)}<p>During the final ${c('sleep(30)')}, how many zombie processes does this parent have?</p>`,
    ans: ['3'],
    exp: `<p>4 個 child 都已經 exit，parent 只呼叫一次 wait()，只收掉其中 1 個 → 剩 <b>3</b> 個 zombie（process table 還留著它們的 PID 和 exit code）。要全部收掉得呼叫 4 次 wait，或寫 ${c('while (wait(NULL) > 0);')}。（已實測。）</p>`,
    cprog: 'w3_fork z4',
  },
  {
    id: 'w3-v17b', week: W, topic: 'Parent 還活著卻不 wait', src: V('W3-17', 1), group: 'W3-17', type: 'single',
    q: `<p>A server process P forks C1 and C2, which exit immediately. P keeps running forever and never calls wait(). What happens to C1 and C2?</p>`,
    opts: [
      'init reaps them right away, because they have exited',
      'They stay zombies for as long as P is alive and does not wait for them',
      'The kernel removes zombie rows automatically after a timeout',
      'They become orphans with PPID 1',
    ],
    ans: 1,
    exp: `<p>只有 parent 自己 wait 才能收掉 zombie。P 還活著，C1、C2 不是 orphan（PPID 仍是 P），init 不會插手；kernel 也沒有逾時清除機制 → 一直是 zombie，直到 P 呼叫 wait 或 P 結束（那時才由 init 收養並 reap）。</p><p>對照原題：P 結束之後，init 才會收養並 reap 它們。</p>`,
  },
  {
    id: 'w3-v18a', week: W, topic: '更新 libssl.so：重啟與重新建置', src: V('W3-18', 1), group: 'W3-18', type: 'single',
    q: `<p>A machine replaces ${c('libssl.so')} with a patched version. Which version of libssl does each program use?</p><p>• D: dynamically linked; was running before the replacement, then restarted after it.<br>• E: statically linked; rebuilt against the patched OpenSSL after the replacement, then started.<br>• F: statically linked with the old OpenSSL; started after the replacement and never rebuilt.</p>`,
    opts: ['D old, E new, F old', 'D new, E new, F old', 'D new, E old, F old', 'D new, E new, F new'],
    ans: 1,
    exp: `<p>D：重啟時 dynamic loader 重新找 libssl.so → 新版。</p><p>E：重新編譯時把新版 OpenSSL 複製進執行檔 → 新版（讓它變新的是「重新建置」，不是系統上的 .so 被換掉）。</p><p>F：執行檔裡帶的還是舊版程式碼，系統的 .so 換了也沒用 → 舊版。</p>`,
  },
  {
    id: 'w3-v18b', week: W, topic: 'Heartbleed：修補後誰還有漏洞', src: V('W3-18', 1), group: 'W3-18', type: 'multi',
    q: `<p>After the Heartbleed fix is installed (a patched libssl.so replaces the old one), which programs are still vulnerable?${ALL}</p>`,
    opts: [
      'nginx, dynamically linked, started last week and not restarted since',
      'curl, dynamically linked, run after the update',
      'A vendor tool statically linked with the vulnerable OpenSSL, started after the update',
      'A dynamically linked mail server restarted after the update',
    ],
    ans: [0, 2],
    exp: `<p>動態連結的程式要「下次啟動」才會載入新版：還沒重啟的 nginx 記憶體裡仍是舊程式碼（a 仍有漏洞）；更新後才執行的 curl、更新後重啟的 mail server 都拿到新版（b、d 安全）。</p><p>靜態連結的工具把舊版 OpenSSL 帶在自己的執行檔裡，必須等廠商重新建置發布（c 仍有漏洞）。</p>`,
  },
  {
    id: 'w3-v21a', week: W, topic: 'fork + exec 成功 + 導向檔案：A 印幾次', src: V('W3-21', 1), group: 'W3-21', type: 'fill',
    q: `<p>The program below is run with its output redirected to a file: ${c('./prog /bin/echo > out.txt')} (exec succeeds).</p>${PROG_W3_21}<p>How many lines of out.txt are exactly ${c('A')}?</p>`,
    ans: ['1'],
    exp: `<p>導向檔案 → fully buffered：fork 時 "A\\n" 還在 buffer，child 也複製了一份。但 child 接著 <b>execv 成功</b>：整個舊程式映像（連同那份 stdio buffer）被丟掉，沒有 flush → child 那份 A 消失。parent 結束時 flush 自己的 A、D、E → A 只出現 <b>1</b> 次。</p><p>實測 out.txt 是 B、A、D、E（echo 立刻寫出 B；parent 的三行等到結束才一起寫出）。常見誤解：「導向檔案時 A 一定印兩次」——只有 child 沒有 exec、而是正常結束時才會（見另一個情況：exec 失敗）。</p>`,
    cprog: 'w3_fork w3-21 (file)',
  },
  {
    id: 'w3-v21b', week: W, topic: 'fork + exec 失敗 + 導向檔案：總行數', src: V('W3-21', 1), group: 'W3-21', type: 'fill',
    q: `<p>The program is run as ${c('./prog /bin/_i_dont_exist_just_4_fun > out.txt')}: exec fails, and the output goes to a file.</p>${PROG_W3_21}<p>How many lines does out.txt have?</p>`,
    ans: ['5'],
    exp: `<p>fork 時 "A\\n" 在 buffer 裡，child 複製一份。exec 失敗 → child 印 C（也進 buffer），return 1 時 flush 出 A、C。parent 結束時 flush 出 A、D、E。共 <b>5</b> 行，A 出現 2 次。</p><p>對照：從終端機執行時 A 在 fork 前就已經 flush，只有 4 行（A、C、D、E）。</p>`,
    cprog: 'w3_fork w3-21 (file)',
  },
  {
    id: 'w3-v21c', week: W, topic: 'printf 在 fork 前、輸出到檔案', src: V('W2-17 / W3-21', 1), group: 'W3-21', type: 'fill',
    q: `<p>The program is run as ${c('./prog > out.txt')}. How many lines does out.txt contain? Assume every fork succeeds.</p>${code(`
      printf("hi\\n");
      fork();
      fork();
      return 0;`)}`,
    ans: ['4'],
    exp: `<p>導向檔案時 "hi\\n" 遇到換行也不會 flush，還在 buffer 裡。兩次 fork 產生 4 個 process，每個都帶著一份含 "hi\\n" 的 buffer，各自在 return 時 flush → <b>4</b> 行。</p><p>輸出到終端機（line-buffered）時，"hi\\n" 在 fork 前就寫出去了，只有 1 行。要避免重複，fork 前先 ${c('fflush(stdout)')}。</p>`,
    cprog: 'w3_fork v21c',
  },
  {
    id: 'w3-v22a', week: W, topic: 'fork 之後各自 open：互相覆蓋', src: V('W3-22', 1), group: 'W3-22', type: 'fill',
    q: `${code(`
      if (fork() == 0) {
          int fd = open("log.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
          write(fd, "AAA", 3);
          return 0;
      }
      wait(NULL);
      int fd = open("log.txt", O_WRONLY | O_CREAT, 0644);   // no O_TRUNC
      write(fd, "B", 1);`)}<p>After both processes finish, what are the exact contents of log.txt?</p>`,
    ans: ['BAA'],
    exp: `<p>這次是 fork <b>之後</b>各自 open：兩次 open 建立兩個獨立的 open file entry，offset 各自從 0 開始。child 寫 AAA（offset 0–2）。parent 自己 open（沒有 O_TRUNC，不清空），從 offset 0 寫 B → 蓋掉第一個 A → <b>BAA</b>。</p><p>對照原題：fork 前 open 的 fd 共用 offset，結果是 AB。</p>`,
    cprog: 'w3_fork v22a',
  },
  {
    id: 'w3-v22b', week: W, topic: 'fork 共用 offset：讀取', src: V('W3-22 / W2-14', 1), group: 'W3-22', type: 'fill',
    q: `<p>data.txt contains ${c('ABCDEF')}.</p>${code(`
      char buf[2], ch;
      int fd = open("data.txt", O_RDONLY);
      if (fork() == 0) {
          read(fd, buf, 2);
          exit(0);
      }
      wait(NULL);
      read(fd, &ch, 1);
      printf("%c\\n", ch);`)}<p>What character does the parent print?</p>`,
    ans: ['C'],
    exp: `<p>fd 在 fork 前打開，parent 和 child 的 fd 指向同一個 open file entry、共用 offset。child 讀走 AB，offset 變 2；parent 接著從 offset 2 讀 → <b>C</b>。若 parent 自己另外 open 一次，才會從 A 開始。</p>`,
    cprog: 'w3_fork v22b',
  },
  {
    id: 'w3-f1', week: W, topic: 'fork 計數：只有 child 印', src: V('W3-16'), group: 'W3-16', type: 'fill',
    q: `<p>Only a newly created child prints in this loop. Counting every process that reaches the printf, how many times is ${c('Hi')} printed in total? Assume every fork succeeds and stdout is a terminal.</p>${code(`
      for (int i = 0; i < 4; i++) {
          if (fork() == 0)
              printf("Hi\\n");
      }
      return 0;`)}`,
    ans: ['15'],
    exp: `<p>只有「剛被 fork 出來的 child」會印。但 child 印完不會離開迴圈，會繼續下一輪、自己也 fork。process 數 1 → 2 → 4 → 8 → 16，每輪新增的 child 是 1、2、4、8 個 → 共 <b>15</b> 行（= 16 個 process 減掉原本那一個）。</p><p>對照 ${c('fork(); printf("Hi\\n");')} 的版本：每一輪「所有」process 都印，3 輪是 2 + 4 + 8 = 14 行。</p>`,
    cprog: 'w3_fork f1',
  },
  {
    id: 'w3-f2', week: W, topic: 'fork 計數：&& 短路', src: V('W3-15'), group: 'W3-15', type: 'fill',
    q: `<p>How many lines of ${c('X')} are printed? Assume every fork succeeds.</p>${code(`
      fork() && fork();
      printf("X\\n");
      return 0;`)}`,
    ans: ['3'],
    exp: `<p>&amp;&amp; 會短路：左邊是 0 就不算右邊。</p><p>原本的 process：第一個 fork 回傳 child 的 PID（非 0）→ 繼續做第二個 fork，又產生一個 child。第一次 fork 的 child：拿到 0 → 短路，不做第二個 fork。第二次 fork 的 child：&amp;&amp; 已經算完。共 3 個 process，各印一次 → <b>3</b>。</p>`,
    cprog: 'w3_fork f2',
  },
  {
    id: 'w3-f5', week: W, topic: '講義 loop.c 導向檔案', src: V('W3-16'), group: 'W3-16', type: 'fill',
    q: `<p>The lecture's loop.c is run as ${c('./loop > out.txt')}. How many lines does out.txt contain? Assume every fork succeeds.</p>${code(`
      int main(void) {
          char *letters = "ABC";
          for (int i = 0; i < 3; i++) {
              printf("%d prints %c\\n", getpid(), letters[i]);
              fork();
          }
          printf("%d finished\\n", getpid());
          return 0;
      }`)}`,
    ans: ['32'],
    exp: `<p>在終端機上是 1 + 2 + 4 + 8 = 15 行。導向檔案時 stdout 是 fully buffered，每次 fork 都把「還沒 flush 的 buffer」複製一份。最後的 8 個 process，各自的 buffer 都含有一路上印過的 A、B、C 三行，再加上自己的 finished，共 4 行；結束時各自 flush → 8 × 4 = <b>32</b> 行（很多行的 PID 會重複，因為是從 parent 複製來的）。已實測。</p>`,
    cprog: 'w3_fork f5',
  },
  {
    id: 'w3-f6', week: W, topic: '迴圈中 fork：導向檔案', src: V('W3-16'), group: 'W3-16', type: 'fill',
    q: `<p>The program is run as ${c('./prog > out.txt')}. How many lines of ${c('Hi')} does out.txt contain? Assume every fork succeeds.</p>${PROG_W3_16}`,
    ans: ['24'],
    exp: `<p>從終端機執行是 14 行（每個 Hi 都在下一次 fork 前就 flush）。導向檔案時，Hi 一直留在 buffer 裡、隨 fork 被複製。最後 8 個 process，每個的 buffer 裡都有 3 行 Hi（每一輪印一行，或從 parent 繼承），結束時各自 flush → 8 × 3 = <b>24</b>。已實測。</p>`,
    cprog: 'w3_fork w3-16 (file)',
  },
  {
    id: 'w3-f8', week: W, topic: '迴圈中 fork + exec', src: V('W3-16'), group: 'W3-16', type: 'fill',
    q: `<p>How many processes are created in total, counting the original one? Assume every fork and exec succeeds.</p>${code(`
      for (int i = 0; i < 3; i++) {
          if (fork() == 0) {
              execlp("echo", "echo", "hi", (char *)NULL);
              exit(1);
          }
      }
      while (wait(NULL) > 0)
          ;`)}`,
    ans: ['4'],
    exp: `<p>child 一被 fork 出來就 exec 成 echo：原本的程式（包括這個 for 迴圈）被換掉，child 不會繼續跑迴圈，也不會再 fork。只有原本的 process 跑完 3 輪、產生 3 個 child → 共 <b>4</b> 個 process，印 3 行 hi。</p><p>對照沒有 exec 的版本：每個 child 都會繼續迴圈，最後有 8 個 process。</p>`,
    cprog: 'w3_fork f8',
  },
  {
    id: 'w3-p2', week: W, topic: 'fork 計數：換成 p2 == 0 先 exit', src: V('W3-14'), group: 'W3-14', type: 'fill',
    q: `<p>How many lines of ${c('Hi')} does this program print? Assume every fork succeeds and stdout is a terminal.</p>${code(`
      pid_t p1 = fork();
      pid_t p2 = fork();
      if (p2 == 0) exit(0);
      fork();
      printf("Hi\\n");
      return 0;`)}`,
    ans: ['4'],
    exp: `<p>兩次 fork 後 4 個 process：(p1, p2) = (&gt;0,&gt;0)、(0,&gt;0)、(&gt;0,0)、(0,0)。p2 == 0 的兩個直接 exit。剩下 2 個各 fork 一次 → 4 個 process 各印一次 → <b>4</b> 行（process 總數是 6）。</p>`,
    cprog: 'w3_fork p2',
  },
];
