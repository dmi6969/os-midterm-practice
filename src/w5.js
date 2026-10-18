// Week 5 · Quiz 4：pipe、dup2、pipeline、stderr、read() 三種結果、EOF、pipe 容量與 deadlock、signals、timeout、SIGPIPE
const { code, c, ALL } = require('./lib');
const W = 'W5';
const O = (n, warn) => `原題 ${n}${warn ? ' ⚠️' : ''}`;
const V = (n, warn) => `變化題（源自 ${n}${warn ? ' ⚠️' : ''}）`;

const GIT_TRACE = code(`
  # 4100 is git; 4101 is the child that becomes less
  4100  pipe2([3, 4], 0)   = 0
  4100  clone(...)         = 4101
  4101  dup2(3, 0)         = 0
  4101  close(3)           = 0
  4101  close(4)           = 0
  4101  execve("/usr/bin/less", ...) = 0
  4100  close(3)           = 0
  4100  dup2(4, 1)         = 1
  4100  close(4)           = 0`);

const TWO_PIPE = `<p>parent ──(pipe A)──▶ child ──(pipe B)──▶ parent. Each pipe holds 64 KiB. The child loops: read up to 4 KiB from A, then write those bytes into B (it exits when A reaches EOF). The parent does:</p>${code('write(A, data, n);   close(A);   read B until read() returns 0')}`;

const W5_07_PROG = code(`
  close(fd[1]);
  sleep(2);
  char buf[1000];
  long total = 0;
  ssize_t n;
  while ((n = read(fd[0], buf, sizeof buf)) >= 0)
      total += n;
  printf("got %ld bytes\\n", total);`);

const CAPTURE_TABLE = `<div class="tbl"><table><tr><th>command</th><th>stdout</th><th>stderr</th></tr><tr><td>ls</td><td>2 KiB</td><td>0</td></tr><tr><td>cat notes.txt</td><td>300 KiB</td><td>0</td></tr><tr><td>cat big.log</td><td>2 MiB</td><td>0</td></tr><tr><td>find /</td><td>5 MiB</td><td>200 KiB</td></tr></table></div>`;

const W5_10_FDS = code(`
  /proc/45111/fd (shell):  0,1,2 -> /dev/pts/2    3 -> pipe:[88216611] (lr-x)
  /proc/45113/fd (grep):   0 -> pipe:[88216611] (lr-x)   1,2 -> /dev/pts/2
                           4 -> pipe:[88216611] (l-wx)`);

module.exports = [
  // ===================== 原題 =====================
  {
    id: 'w5-01', week: W, topic: 'kill 一個 pipeline 成員', src: O('W5-01'), group: 'W5-01', type: 'single',
    q: `<p>In a terminal: ${c('$ sleep 1000 | cat')}. No process has installed any signal handler. From another terminal, someone runs ${c('kill -INT <PID of sleep>')}. What happens to cat?</p>`,
    opts: [
      'It is killed by the same signal, because the kernel sends it to every process in a pipeline.',
      'It is killed by a different signal, because its input pipe lost its writer.',
      'It keeps waiting forever until someone presses Ctrl-C.',
      'Its next read() returns 0, because no process holds the write end any more, so it exits normally.',
    ],
    ans: 3,
    exp: `<p>kill 只把 signal 送給指定的那個 PID（Ctrl-C 才會送給整個前景 pipeline）。sleep 被 SIGINT 終止 → 它持有的 write end 跟著關閉 → pipe 已經沒有任何 write end → cat 的下一次 read() 回傳 0（EOF）→ cat 正常結束。</p><p>SIGPIPE 是送給<b>寫端</b>（寫進沒有讀者的 pipe 的 process），不是讀端，所以 (b) 錯。</p>`,
    cprog: 'w5_pipe kill-sleep', cexpect: 'sleep:130 cat:0',
  },
  {
    id: 'w5-02', week: W, topic: 'close(1) 之後 pipe 拿到的 fd', src: O('W5-02'), group: 'W5-02', type: 'fill',
    q: `<p>A process starts with only fds 0, 1 and 2 open. It runs:</p>${code(`
      close(1);
      int f = open("log.txt", O_RDONLY);
      int fd[2];
      pipe(fd);`)}<p>What are fd[0] and fd[1]? Type the two numbers separated by a space (for example ${c('7 8')}).</p>`,
    ans: ['3 4', '3,4'],
    exp: `<p>kernel 每次都配「最小的可用編號」。close(1) 後 1 號空出來，open 拿走 1（f = 1）。pipe 需要兩個：最小可用是 3、接著 4 → fd[0] = <b>3</b>（read end）、fd[1] = <b>4</b>（write end）。</p>`,
    cprog: 'w5_pipe w5-02',
  },
  {
    id: 'w5-03', week: W, topic: 'Debug 訊息不能印到 stdout（協定通道）', src: O('W5-03'), group: 'W5-03', type: 'single',
    q: `<p>A tool server talks to its client over stdin/stdout: the client reads JSON replies, one per line, from the server's stdout. The server's stderr still goes to the terminal. After a developer adds ${c('printf("debug: ...\\n")')} lines, the client starts reporting parse errors. What is the best fix?</p>`,
    opts: [
      `Print the debug lines with ${c('fprintf(stderr, ...)')} instead of printf.`,
      'Print each debug line only after the reply has been written.',
      `Use ${c('fprintf(stderr, ...)')} and also call ${c('dup2(1, 2)')} at the start of main().`,
      `Use ${c('write(1, ...)')} instead of printf.`,
      'Print each debug line as a JSON object.',
    ],
    ans: 0,
    exp: `<p>stdout 是協定通道（MCP 規範規定 stdout 只能寫協定訊息），除錯訊息要寫到 fd 2；stderr 仍連著終端機，開發者照樣看得到。</p><p>(b) 仍然寫進 stdout，只是換了時間。(c) dup2(1, 2) 讓 fd 2 也指向 pipe，問題重現。(d) write(1, …) 一樣是 stdout。(e) client 會把它當成回覆來解析，還是破壞協定。</p>`,
  },
  {
    id: 'w5-04a', week: W, topic: 'Shell 建立 pipeline：parent 的步驟順序', src: O('W5-04'), group: 'W5-04', type: 'single',
    q: `<p>A shell runs ${c('cat scores.csv | grep niko')}. Which sequence of the <b>shell's own</b> (the parent's) calls is correct?</p>`,
    opts: [
      'pipe → fork (cat) → fork (grep) → close both ends → wait, wait',
      'fork (cat) → pipe → fork (grep) → close both ends → wait, wait',
      'pipe → fork (cat) → close both ends → fork (grep) → wait, wait',
      'pipe → fork (cat) → fork (grep) → wait, wait → close both ends',
    ],
    ans: 0,
    exp: `<p>pipe 必須在 fork 之前，child 才能透過 fork 繼承到兩端（(b) ✗）。shell 關閉兩端要在<b>第二次 fork 之後</b>，否則 grep 繼承不到 read end（(c) ✗）。shell 必須在 wait <b>之前</b>關掉 write end，否則 grep 永遠等不到 EOF、不會結束，shell 就卡在 wait（(d) ✗）。兩個 child 內部的步驟可以和 parent 的步驟交錯。</p>`,
  },
  {
    id: 'w5-04b', week: W, topic: 'Shell 建立 pipeline：child 的步驟順序', src: O('W5-04'), group: 'W5-04', type: 'single',
    q: `<p>A shell runs ${c('cat scores.csv | grep niko')}. Inside the child that will run ${c('cat')}, which sequence is correct?</p>`,
    opts: [
      `${c('dup2(fd[1], 1)')} → ${c('close(fd[0]); close(fd[1])')} → ${c('execlp("cat", ...)')}`,
      `${c('execlp("cat", ...)')} → ${c('dup2(fd[1], 1)')} → ${c('close(fd[0]); close(fd[1])')}`,
      `${c('close(fd[0]); close(fd[1])')} → ${c('dup2(fd[1], 1)')} → ${c('execlp("cat", ...)')}`,
      `${c('dup2(1, fd[1])')} → ${c('close(fd[0]); close(fd[1])')} → ${c('execlp("cat", ...)')}`,
    ],
    ans: 0,
    exp: `<p>dup2(fd[1], 1) 讓 1 號也指向 pipe 的 write end（複製，不是移動）；接著關掉原本的 fd[0]、fd[1] 很安全，因為 1 號仍參照著 write end；最後 exec，cat 只要寫 fd 1 就進 pipe（exec 保留 fd table）。</p><p>(b) exec 成功就不會回來，後面不會執行。(c) 先關掉 fd[1]，dup2 的來源已經不存在 → 失敗。(d) 參數反了：${c('dup2(oldfd, newfd)')} 是讓 newfd 指向 oldfd 的物件，這樣是讓 fd[1] 指向終端機。</p>`,
  },
  {
    id: 'w5-05a', week: W, topic: 'git 啟動 pager：git 的 fd 0', src: O('W5-05', 1), group: 'W5-05', type: 'single',
    q: `<p>strace of ${c('git log')} starting its pager:</p>${GIT_TRACE}<p>After the last line, what does <b>git's</b> (4100's) fd 0 refer to?</p>`,
    opts: ['the terminal', 'the read end of the pipe', 'the write end of the pipe', 'not open'],
    ans: 0,
    exp: `<p>先看每一行是哪個 PID 做的。${c('dup2(3, 0)')} 是 <b>4101（less）</b>做的，只改 less 自己的 fd table。git 從頭到尾沒動過自己的 fd 0，所以仍然指向終端機（原答 read end 錯）。</p>`,
  },
  {
    id: 'w5-05b', week: W, topic: 'git 啟動 pager：git 的 fd 1 / 3 / 4', src: O('W5-05'), group: 'W5-05', type: 'single',
    q: `<p>strace of ${c('git log')} starting its pager:</p>${GIT_TRACE}<p>After the last line, what do git's (4100's) fd 1, fd 3 and fd 4 refer to?</p>`,
    opts: [
      'fd 1: the terminal; fd 3: the read end; fd 4: the write end',
      'fd 1: the write end of the pipe; fd 3: not open; fd 4: not open',
      'fd 1: the write end of the pipe; fd 3: the read end; fd 4: not open',
      'fd 1: not open; fd 3: not open; fd 4: the write end',
    ],
    ans: 1,
    exp: `<p>4100 做了：close(3) → 3 不開；dup2(4, 1) → fd 1 改指 write end；close(4) → 4 不開。所以 git 印到 fd 1 的東西全進 pipe，less 從自己的 fd 0 讀出來。</p>`,
  },
  {
    id: 'w5-05c', week: W, topic: 'dup2 之後 close 原本的 fd 為什麼安全', src: O('W5-05'), group: 'W5-05', type: 'single',
    q: `<p>strace of ${c('git log')} starting its pager:</p>${GIT_TRACE}<p>Why is it safe for git to call ${c('close(4)')} right after ${c('dup2(4, 1)')}?</p>`,
    opts: [
      'fd 1 is now also a copy of the write end, so the pipe still has a writer, and git goes on writing through fd 1.',
      'dup2 moved the write end from fd 4 to fd 1, so fd 4 was already empty.',
      'close(4) only takes effect after less exits.',
      'It is not safe: less will see EOF immediately.',
    ],
    ans: 0,
    exp: `<p>dup2 是「<b>複製</b>」不是「移動」：dup2(4, 1) 之後 fd 1 和 fd 4 都指向同一個 write end。close(4) 只移除一個編號，write end 仍被 fd 1 參照，pipe 還有 writer。(b) 的「移動」是常見誤解——正因為 dup2 後 fd 4 還開著，才需要 close。</p>`,
  },
  {
    id: 'w5-06a', week: W, topic: '兩條 pipe 的 deadlock：哪些 n 會跑完', src: O('W5-06', 1), group: 'W5-06', type: 'multi',
    q: `${TWO_PIPE}<p>For which n does the program finish?${ALL}</p>`,
    opts: ['n = 10 KiB', 'n = 100 KiB', 'n = 200 KiB', 'n = 1 MiB'],
    ans: [0, 1],
    exp: `<p>parent 開始讀 B 之前，整個系統最多只能吸收：A 裡 64 KiB + B 裡 64 KiB + child 手上已讀出、還沒寫進 B 的 4 KiB = <b>132 KiB</b>。</p><p>n ≤ 132 KiB：parent 能寫完、關掉 A、開始讀 B → 跑完（10、100 KiB ✓）。200 KiB、1 MiB 超過 → B 滿了 child 卡在 write(B)，A 滿了 parent 卡在 write(A) → deadlock。</p>`,
    calc: { fn: 'twoPipe', a: 64, b: 64, chunk: 4, opts: [10, 100, 200, 1024] },
    cprog: 'w5_pipe twopipe', cexpect: '10,100',
  },
  {
    id: 'w5-06b', week: W, topic: '兩條 pipe 的 deadlock：卡在哪', src: O('W5-06'), group: 'W5-06', type: 'single',
    q: `${TWO_PIPE}<p>With n = 1 MiB the program gets stuck. Where are the two processes?</p>`,
    opts: [
      'Both are blocked in write().',
      'Both are blocked in read().',
      'The parent is blocked in read(B); the child is blocked in write(B).',
      'The parent is blocked in write(A); the child is blocked in read(A).',
    ],
    ans: 0,
    exp: `<p>B 滿了 → child 卡在 write(B)；child 不再從 A 讀 → A 也滿了 → parent 卡在 write(A)，永遠到不了「讀 B」那一步。兩個都睡在 <b>write()</b> 裡，不耗 CPU，也沒有任何錯誤訊息。</p>`,
  },
  {
    id: 'w5-07a', week: W, topic: 'read 迴圈寫成 >= 0', src: O('W5-07', 1), group: 'W5-07', type: 'single',
    q: `<p>The parent creates a pipe and forks. The child writes 5000 bytes into the pipe and exits immediately. The parent runs:</p>${W5_07_PROG}<p>What happens?</p>`,
    opts: [
      'It never finishes, uses no CPU, and stays blocked in read().',
      'It prints "got 5000 bytes" after about 2 seconds.',
      'Nothing is printed and it never finishes. After the first 2 seconds, it keeps one CPU core busy.',
      'It prints "got 5000 bytes", because read() returns −1 at the end and ends the loop.',
      'It prints "got 0 bytes".',
    ],
    ans: 2,
    exp: `<p>前 5 次 read 各拿到 1000 bytes。之後 write end 已經全部關閉（child 已 exit、parent 自己也 close(fd[1]) 了），所以每次 read() 都<b>立刻</b>回傳 0（EOF）。但條件寫成 &gt;= 0，0 也成立 → 迴圈永遠不停；每次都是立刻回傳而不是 block → 吃滿一顆 CPU，printf 永遠執行不到。正確寫法是 &gt; 0。</p>`,
    cprog: 'w5_pipe w5-07', cexpect: 'spin',
  },
  {
    id: 'w5-07b', week: W, topic: 'read() 一次最多讀多少', src: O('W5-07', 1), group: 'W5-07', type: 'fill',
    q: `<p>The parent creates a pipe and forks. The child writes 5000 bytes into the pipe and exits immediately. The parent runs:</p>${W5_07_PROG}<p>What does the <b>first</b> read() return?</p>`,
    ans: ['1000'],
    exp: `<p>read 最多只複製「要求的數量」：sizeof buf = 1000。即使 pipe 裡已經有 5000 bytes，第一次 read 也只回傳 <b>1000</b>（原答 5000 錯，已實測）。</p>`,
    cprog: 'w5_pipe first',
  },
  {
    id: 'w5-08', week: W, topic: '用一條 pipe 雙向溝通', src: O('W5-08') + '（選項為推測重建）', group: 'W5-08', type: 'single',
    q: `<p>A parent and a child try to talk through a <b>single</b> pipe, and both keep both ends open:</p>${code(`
      pipe(fd);
      if (fork() == 0) {                  // child
          read(fd[0], buf, 4);            // expects "ping"
          write(fd[1], "pong", 4);
          exit(0);
      }
      write(fd[1], "ping", 4);            // parent
      read(fd[0], buf, 4);                // expects "pong"
      printf("parent got %.4s\\n", buf);
      wait(NULL);`)}<p>What can happen?</p>`,
    opts: [
      'It always prints "parent got pong", because each byte goes to the other process.',
      'It may hang: the parent reads its own ping, then blocks in read() forever.',
      'It always hangs, because one pipe cannot be used by two processes.',
      'It always prints "parent got pong", because the kernel wakes the child before the parent can read.',
      'It may hang: the parent can read its own ping and print "parent got ping"; then the parent waits in wait() and the child waits in read() forever.',
    ],
    ans: 4,
    exp: `<p>pipe 不知道「這個 byte 是要給誰的」：誰先 read 誰拿走。parent 寫完 ping 馬上 read，可能把自己的 ping 讀回來 → 印出 parent got ping → 進 wait()。child 的 read 永遠拿不到資料，也不會 EOF（兩邊都還握著 write end）→ 永遠卡住。</p><p>(b) 錯在 parent 不是卡在 read（它已經讀到 ping），而是卡在 wait。如果 child 先搶到 ping，程式就能正常印 parent got pong——所以是「可能」卡住。正確做法：兩條 pipe，各管一個方向。</p>`,
  },
  {
    id: 'w5-09a', week: W, topic: '先 wait 再讀：四種修法的效果', src: O('W5-09'), group: 'W5-09', type: 'single',
    q: `<p>A capture program does: create two pipes OUT and ERR → start cmd with stdout → OUT and stderr → ERR → <b>wait()</b> for cmd → read OUT until 0. Each pipe holds 64 KiB, and there is a 300-second time limit.</p>${CAPTURE_TABLE}<p>ls succeeds; the other three hit the 300 s limit. Proposed fixes:<br>F1: raise the time limit to 3600 s.<br>F2: enlarge OUT to 1 MiB.<br>F3: read OUT until 0 first, then wait().<br>F4: buy a faster machine.</p><p>For each fix: does it make all three failing commands succeed, only some of them, or none?</p>`,
    opts: [
      'F1 none, F2 some, F3 some, F4 none',
      'F1 some, F2 some, F3 all, F4 some',
      'F1 none, F2 some, F3 all, F4 none',
      'F1 none, F2 none, F3 some, F4 none',
    ],
    ans: 0,
    exp: `<p>這是 <b>deadlock</b> 不是效能問題：child 輸出超過 64 KiB 就卡在 write()，parent 卡在 wait() → 時間再長、機器再快都沒用（F1、F4：完全沒用）。</p><p>F2：OUT 變 1 MiB，裝得下 notes.txt 的 300 KiB → 它好了；big.log 2 MiB、find 5 MiB 還是超過 → 部分有效。</p><p>F3：先把 OUT 讀到 EOF 再 wait → ls、notes、big.log 都好了；但 find 的 stderr 有 200 KiB，超過 ERR 的 64 KiB 又沒人讀 → 部分有效。正解是同時讀兩條 pipe（Python 的 communicate()）。</p>`,
  },
  {
    id: 'w5-09b', week: W, topic: '只讀 stdout 不讀 stderr 也會卡', src: O('W5-09 (F3)'), group: 'W5-09', type: 'single',
    q: `<p>A capture program creates two pipes OUT and ERR (64 KiB each), starts a command with stdout → OUT and stderr → ERR, then reads OUT until read() returns 0, and only then calls wait(). It runs ${c('find /')}, which writes 5 MiB to stdout and 200 KiB to stderr. Where do the two processes end up?</p>`,
    opts: [
      'find is blocked in write() on the ERR pipe; the parent is blocked in read() on OUT.',
      'find is blocked in write() on OUT; the parent is blocked in wait().',
      'Both finish, because the parent now drains OUT.',
      'find exits, but the parent is blocked in read() on ERR.',
    ],
    ans: 0,
    exp: `<p>parent 一直在讀 OUT，stdout 那邊不會卡；但 ERR 沒人讀，find 寫滿 64 KiB 的錯誤訊息後就卡在 write(2)。find 沒結束 → OUT 的 write end 還開著 → parent 讀完 OUT 現有的資料後在 read() block，等不到 EOF。兩邊互等。</p>`,
  },
  {
    id: 'w5-10a', week: W, topic: '自製 shell 的 prompt 不回來：哪個 fd', src: O('W5-10', 1) + '（選項為推測重建）', group: 'W5-10', type: 'single',
    q: `<p>A homemade shell runs ${c('cat words.txt | grep cat')}. cat has already exited, but the prompt never comes back. The fd tables are:</p>${W5_10_FDS}<p>Which fd keeps grep's read() from ever returning 0?</p>`,
    opts: ['fd 3 of the shell', 'fd 4 of the shell', 'fd 0 of grep', 'fd 4 of grep'],
    ans: 3,
    exp: `<p>看權限字母：${c('l-wx')} = write end、${c('lr-x')} = read end。這條 pipe 唯一的 write end 是 <b>grep 自己的 fd 4</b> → kernel 認為還有 writer，pipe 空了就 block → grep 在等自己（原答 fd 4 of the shell 錯——shell 根本沒有 fd 4）。shell 的 fd 3 是 read end，沒關雖然也是 bug，但 read end 不影響 EOF。</p>`,
  },
  {
    id: 'w5-10b', week: W, topic: '自製 shell 少了哪個 close', src: O('W5-10'), group: 'W5-10', type: 'single',
    q: `<p>A homemade shell runs ${c('cat words.txt | grep cat')}. cat has already exited, but the prompt never comes back. The fd tables are:</p>${W5_10_FDS}<p>Which close() is missing from the homemade shell's code?</p>`,
    opts: [
      'The shell never closes the read end.',
      'The child that runs grep never closes the copy of the write end it inherited.',
      'The child that runs cat never closes its stdout.',
      'grep never closes its stdin.',
    ],
    ans: 1,
    exp: `<p>grep 的 child 在 dup2(fd[0], 0) 之後應該 close(fd[0]) 和 close(fd[1])；它漏了 close(fd[1])，exec 之後 grep 就帶著一個 write end（fd 4）。shell 漏關 fd 3（read end）也是 bug，但不會造成這個症狀。</p>`,
  },

  // ===================== 變化題 =====================
  {
    id: 'w5-v05a', week: W, topic: 'strace 讀 fd：parent 是讀的一方', src: V('W5-05', 1), group: 'W5-05', type: 'single',
    q: `<p>A program starts ${c('ls')} as a child and reads its output. strace shows:</p>${code(`
      # 5200 is the parent; 5201 is the child that becomes ls
      5200  pipe2([3, 4], 0)   = 0
      5200  clone(...)         = 5201
      5201  dup2(4, 1)         = 1
      5201  close(3)           = 0
      5201  close(4)           = 0
      5201  execve("/bin/ls", ...) = 0
      5200  close(4)           = 0
      5200  dup2(3, 0)         = 0
      5200  close(3)           = 0`)}<p>After the last line, what do the <b>parent's</b> (5200's) fd 0 and fd 1 refer to?</p>`,
    opts: [
      'fd 0: the read end of the pipe; fd 1: the terminal',
      'fd 0: the terminal; fd 1: the write end of the pipe',
      'fd 0: the read end; fd 1: the write end',
      'fd 0: not open; fd 1: the terminal',
    ],
    ans: 0,
    exp: `<p>這次 parent 是讀的一方。${c('dup2(4, 1)')} 是 5201（ls）做的，只改 ls 的 fd 1 → parent 的 fd 1 仍是終端機。parent 自己做了 close(4)、dup2(3, 0)、close(3) → fd 0 指向 read end，3、4 都不開。</p>`,
  },
  {
    id: 'w5-v05b', week: W, topic: 'git 啟動 pager：less 的 fd', src: V('W5-05', 1), group: 'W5-05', type: 'single',
    q: `<p>strace of ${c('git log')} starting its pager:</p>${GIT_TRACE}<p>After the last line, what do <b>less's</b> (4101's) fd 0 and fd 1 refer to?</p>`,
    opts: [
      'fd 0: the read end of the pipe; fd 1: the terminal',
      'fd 0: the terminal; fd 1: the write end of the pipe',
      'fd 0: the read end; fd 1: the write end',
      'fd 0: the write end; fd 1: the terminal',
    ],
    ans: 0,
    exp: `<p>4101 做了 dup2(3, 0) → fd 0 指向 read end；接著關掉 3、4，exec less。它從沒動過 fd 1。fd 1 是 fork 當下從 git 複製來的——那時 git 還沒 dup2(4, 1)，所以是終端機。less 從 pipe 讀、畫到終端機上。</p>`,
  },
  {
    id: 'w5-v05c', week: W, topic: 'less 忘了 close(4)', src: V('W5-05 / W5-10', 1), group: 'W5-05', type: 'single',
    q: `<p>strace of ${c('git log')} starting its pager:</p>${GIT_TRACE}<p>Suppose 4101 had skipped ${c('close(4)')} before exec, so less keeps a copy of the write end. git writes all its output and exits. What happens to less?</p>`,
    opts: [
      'less sees EOF as soon as git exits',
      'less never sees EOF: it still holds a write end itself, so once the data is consumed its read() blocks',
      'git receives SIGPIPE when it exits',
      'less is killed by SIGPIPE',
    ],
    ans: 1,
    exp: `<p>read() 回傳 0 的條件是「pipe 空了，而且<b>全部</b> process 都沒有 write end」。git 結束後，write end 只剩 less 自己的 fd 4 → kernel 認為還可能有資料 → less 讀完現有資料後 block，在等它自己（跟 W5-10 的 grep 是同一個 bug）。沒有人寫進沒有讀者的 pipe，所以也沒有 SIGPIPE。</p>`,
  },
  {
    id: 'w5-v06a', week: W, topic: '兩條 pipe 的 deadlock：換容量', src: V('W5-06', 1), group: 'W5-06', type: 'fill',
    q: `<p>parent ──(pipe A)──▶ child ──(pipe B)──▶ parent. Each pipe holds <b>16 KiB</b>, and the child loops: read up to <b>1 KiB</b> from A, then write those bytes into B (it exits when A reaches EOF). The parent does:</p>${code('write(A, data, n);   close(A);   read B until read() returns 0')}<p>What is the largest n, in KiB, for which the program is guaranteed to finish?</p>`,
    ans: ['33', '33 KiB', '33KiB'],
    exp: `<p>parent 開始讀 B 之前，系統最多能吸收：A 16 KiB + B 16 KiB + child 手上已讀出、還沒寫進 B 的 1 KiB = <b>33 KiB</b>。n ≤ 33 KiB 時 parent 能寫完、關掉 A、開始讀 B；超過就兩邊都卡在 write()。（原題：64 + 64 + 4 = 132 KiB。）</p>`,
    calc: { fn: 'twoPipe', a: 16, b: 16, chunk: 1 },
  },
  {
    id: 'w5-v06b', week: W, topic: '兩條 pipe：close(A) 放錯位置', src: V('W5-06', 1), group: 'W5-06', type: 'single',
    q: `<p>parent ──(pipe A)──▶ child ──(pipe B)──▶ parent. Each pipe holds 64 KiB; the child loops: read up to 4 KiB from A, write it into B, and exits when A reaches EOF. The parent's code is changed so that it closes A <b>after</b> reading B:</p>${code('write(A, data, n);   read B until read() returns 0;   close(A);')}<p>What happens with n = 10 KiB?</p>`,
    opts: [
      'It finishes, because 10 KiB fits easily in the pipes',
      'It hangs: the parent is blocked in read(B) and the child is blocked in read(A)',
      'It hangs: both are blocked in write()',
      'The child is killed by SIGPIPE',
    ],
    ans: 1,
    exp: `<p>10 KiB 很小，不會塞滿。parent 寫完就去讀 B，讀到 10 KiB。但 parent 還握著 A 的 write end → child 讀完 A 的資料後，下一次 read(A) 是 block 而不是 EOF → child 不會結束 → B 的 write end 一直開著 → parent 的 read(B) 也等不到 0。兩邊都卡在 <b>read()</b>。</p><p>只是把一個 close 換了位置，跟資料量完全無關就會卡住。（已實測。）</p>`,
    cprog: 'w5_pipe twopipe-late-close', cexpect: 'hang',
  },
  {
    id: 'w5-v07a', week: W, topic: 'read 迴圈：條件對了但忘了 close', src: V('W5-07', 1), group: 'W5-07', type: 'single',
    q: `<p>The parent creates a pipe and forks. The child writes 5000 bytes into the pipe and exits immediately. The parent runs the loop below. The condition is now ${c('> 0')}, but the parent <b>forgot to close</b> its own copy of the write end:</p>${code(`
      sleep(2);
      char buf[1000];
      long total = 0;
      ssize_t n;
      while ((n = read(fd[0], buf, sizeof buf)) > 0)
          total += n;
      printf("got %ld bytes\\n", total);`)}<p>What happens?</p>`,
    opts: [
      'It prints "got 5000 bytes" after about 2 seconds.',
      'Nothing is printed and it never finishes; after 2 seconds it keeps one CPU core busy.',
      'It never finishes, uses no CPU, and stays blocked in read().',
      'It prints "got 5000 bytes", because read() returns −1 at the end.',
    ],
    ans: 2,
    exp: `<p>讀完 5000 bytes 後 pipe 空了；child 已經 exit，但 parent 自己的 fd[1] 還開著 → write end 的數量不是 0 → read() <b>block</b>，不會回傳 0。parent 在等它自己，睡在 read() 裡、不耗 CPU，永遠到不了 printf。</p><p>對照原題：有 close、條件寫成 &gt;= 0 → 每次立刻回傳 0 → 吃滿 CPU。兩題的症狀都是「不會結束」，但一個 block、一個 spin。（已實測：5 秒內 CPU 時間約 0。）</p>`,
    cprog: 'w5_pipe v07a', cexpect: 'block',
  },
  {
    id: 'w5-v07b', week: W, topic: 'read() 回傳值：換 buffer 大小', src: V('W5-07', 1), group: 'W5-07', type: 'fill',
    q: `<p>The parent creates a pipe and forks. The child writes 10000 bytes into the pipe and exits. The parent closes its own write end, sleeps 2 seconds (so all the data is already in the pipe), and then calls ${c('read(fd[0], buf, 4096)')} repeatedly. What does the <b>third</b> read() return?</p>`,
    ans: ['1808'],
    exp: `<p>每次最多拿 4096：第一次 4096、第二次 4096、第三次是剩下的 10000 − 8192 = <b>1808</b>。第四次：pipe 空了而且沒有任何 write end → 回傳 0（EOF）。已實測。</p>`,
    calc: { fn: 'readSeq', size: 10000, reqs: [4096, 4096, 4096], which: 2 },
    cprog: 'w5_pipe v07b',
  },
  {
    id: 'w5-v10a', week: W, topic: 'Prompt 不回來：這次是 shell 的錯', src: V('W5-10', 1), group: 'W5-10', type: 'single',
    q: `<p>Another homemade shell runs ${c('cat words.txt | grep cat')}. cat has exited, but the prompt never comes back. This time the fd tables are:</p>${code(`
      /proc/7001/fd (shell):  0,1,2 -> /dev/pts/1    4 -> pipe:[5120] (l-wx)
      /proc/7003/fd (grep):   0 -> pipe:[5120] (lr-x)   1,2 -> /dev/pts/1`)}<p>Which fd keeps grep's read() from ever returning 0?</p>`,
    opts: ['fd 4 of the shell', 'fd 0 of grep', 'fd 1 of grep', 'None; grep will see EOF soon'],
    ans: 0,
    exp: `<p>這次 grep 很乾淨（只有 fd 0 = read end）。唯一的 write end（l-wx）在 <b>shell 的 fd 4</b> → shell 忘了 close(fd[1])。shell 又卡在 wait() 等 grep → shell 等 grep、grep 等 shell。</p><p>對照原題：同樣的症狀，原題怪 grep 自己的 fd 4，這題怪 shell。判斷方法都一樣：找出所有 l-wx。</p>`,
  },
  {
    id: 'w5-v10b', week: W, topic: '只剩 read end 不影響 EOF', src: V('W5-10', 1), group: 'W5-10', type: 'single',
    q: `<p>A homemade shell runs ${c('cat words.txt | grep cat')}, and cat has exited. The fd tables are:</p>${code(`
      /proc/8001/fd (shell):  0,1,2 -> /dev/pts/3    3 -> pipe:[7012] (lr-x)
      /proc/8003/fd (grep):   0 -> pipe:[7012] (lr-x)   1,2 -> /dev/pts/3`)}<p>Will grep's read() return 0, so that grep exits and the prompt comes back?</p>`,
    opts: [
      'Yes: no process holds the write end any more, so once the pipe is empty grep sees EOF',
      "No: the shell's fd 3 keeps the pipe open, so grep blocks forever",
      "No: grep's own fd 0 counts as a writer",
      'grep is killed by SIGPIPE',
    ],
    ans: 0,
    exp: `<p>EOF 只看 write end：兩邊都只剩 read end（lr-x），沒有任何 l-wx → 讀完剩下的資料後 read() 回傳 0 → grep 結束，prompt 回來。shell 沒關 fd 3 是 fd 洩漏，但不影響 EOF。</p>`,
  },
  {
    id: 'w5-v01a', week: W, topic: 'Ctrl-C 整個前景 pipeline', src: V('W5-01'), group: 'W5-01', type: 'single',
    q: `<p>In a terminal you run ${c('sleep 1000 | cat')} in the foreground and press Ctrl-C. No signal handler is installed. What happens?</p>`,
    opts: [
      'Only sleep receives SIGINT; cat then sees EOF and exits with status 0',
      'The terminal sends SIGINT to every process in the foreground pipeline, so both sleep and cat are terminated; $? is 130',
      'Only cat, the last process in the pipeline, receives SIGINT',
      'sleep receives SIGINT and cat receives SIGPIPE',
    ],
    ans: 1,
    exp: `<p>Ctrl-C 是終端機送的 SIGINT，對象是<b>整個前景 pipeline</b>，不是單一 process → sleep、cat 都被終止，shell 回報 128 + 2 = 130。</p><p>對照原題：${c('kill -INT <PID>')} 只送給那一個 PID，cat 是因為讀到 EOF 才正常結束。</p>`,
  },
  {
    id: 'w5-v01b', week: W, topic: 'kill -9 pipeline 中間那個', src: V('W5-01'), group: 'W5-01', type: 'fill',
    q: `<p>In bash you run ${c('yes | cat | wc -l')} in the foreground. From a second terminal, someone kills the middle process with ${c('kill -9 <PID of cat>')}. Afterwards, ${c('echo "${PIPESTATUS[@]}"')} prints the exit statuses of yes, cat and wc, in that order. What does it print? Type three numbers separated by spaces.</p>`,
    ans: ['141 137 0'],
    exp: `<p>cat 被 SIGKILL（9）→ 128 + 9 = <b>137</b>。</p><p>yes：下一次寫進 pipe 時已經沒有讀者 → kernel 送 SIGPIPE（13）給<b>寫端</b> → <b>141</b>。</p><p>wc：沒有收到任何 signal。上游的 write end 隨 cat 死亡而關閉 → read() 回傳 0（EOF）→ 印出行數、正常結束 → <b>0</b>。（講義用 pkill 送 SIGTERM 時是 141 143 0。已實測。）</p>`,
    cprog: 'w5_pipe three-stage',
  },
  {
    id: 'w5-v01c', week: W, topic: 'SIGPIPE 送給誰', src: V('W5-01'), group: 'W5-01', type: 'single',
    q: `<p>${c('cat huge.log | head -1')} prints one line and returns quickly, even though huge.log is 50 GB. Which process receives SIGPIPE?</p>`,
    opts: [
      'head, because its input still has data',
      'cat, when it writes to the pipe after head has exited',
      'Both cat and head',
      'Neither; cat sees EOF and stops',
    ],
    ans: 1,
    exp: `<p>head 印完一行就結束，pipe 的 read end 全部關閉。cat 下一次 write → 寫進沒有讀者的 pipe → kernel 送 SIGPIPE 給<b>寫端</b> cat → 預設動作是終止。這也是 ${c('yes | head -3')} 會結束的原因。</p><p>SIGPIPE 永遠給「寫的人」；「讀的人」碰到的是 EOF。(d) 錯在 EOF 是讀端的事，cat 在這裡是寫端。</p>`,
  },
  {
    id: 'w5-v02a', week: W, topic: 'close(0) 之後 pipe 拿到的 fd', src: V('W5-02'), group: 'W5-02', type: 'fill',
    q: `<p>A process starts with fds 0, 1 and 2 open. It runs:</p>${code(`
      close(0);
      int fd[2];
      pipe(fd);`)}<p>What are fd[0] and fd[1]? Type the two numbers separated by a space.</p>`,
    ans: ['0 3', '0,3'],
    exp: `<p>永遠配最小的可用編號：0 剛被關掉 → fd[0] = <b>0</b>；下一個可用的是 3 → fd[1] = <b>3</b>。read end 剛好變成了 stdin。已實測。</p>`,
    cprog: 'w5_pipe v02a',
  },
  {
    id: 'w5-v02b', week: W, topic: 'dup 與 close 之後 pipe 拿到的 fd', src: V('W5-02'), group: 'W5-02', type: 'fill',
    q: `<p>A process starts with fds 0, 1 and 2 open. It runs:</p>${code(`
      int a = open("x.txt", O_RDONLY);
      int b = dup(1);
      close(a);
      int fd[2];
      pipe(fd);`)}<p>x.txt exists. What are fd[0] and fd[1]? Type the two numbers separated by a space.</p>`,
    ans: ['3 5', '3,5'],
    exp: `<p>a = 3、b = 4（dup 也是拿最小可用編號）。close(a) 讓 3 空出來。pipe：最小可用是 3 → fd[0] = <b>3</b>；4 被 b 占著，下一個是 5 → fd[1] = <b>5</b>。已實測。</p>`,
    cprog: 'w5_pipe v02b',
  },
  {
    id: 'w5-v03', week: W, topic: '協定通道：哪些除錯輸出是安全的', src: V('W5-03'), group: 'W5-03', type: 'multi',
    q: `<p>A language server talks to an editor over stdin/stdout, so stdout may carry only protocol messages. stderr goes to a log file. Which ways of printing a debug message do NOT break the protocol?${ALL}</p>`,
    opts: [
      c('fprintf(stderr, "debug: %d\\n", x);'),
      c('write(2, "debug\\n", 6);'),
      c('printf("debug: %d\\n", x);'),
      c('write(1, "debug\\n", 6);'),
      c('puts("debug");'),
      `${c('dup2(1, 2);')} at startup, then ${c('fprintf(stderr, ...)')}`,
    ],
    ans: [0, 1],
    exp: `<p>寫到 fd 2 就不會混進協定：fprintf(stderr, …) 和 write(2, …) ✓。printf、puts、write(1, …) 都寫到 stdout ✗。dup2(1, 2) 讓 fd 2 也指向 stdout 那條 pipe，之後寫 stderr 一樣進協定 ✗。</p>`,
  },
  {
    id: 'w5-v04', week: W, topic: 'Pipeline 的兩段是同時跑的', src: V('W5-04'), group: 'W5-04', type: 'single',
    q: `<p>A shell runs ${c('cat scores.csv | grep niko')}. Does cat have to finish before grep starts running?</p>`,
    opts: [
      'Yes: the shell starts grep only after cat exits',
      "No: both run concurrently; if grep reads an empty pipe it blocks until cat writes, and bytes written early wait in the kernel's buffer",
      'Yes, otherwise grep would read a partial line and fail',
      "No, but grep must start first, or cat's output would be lost",
    ],
    ans: 1,
    exp: `<p>兩次 fork 之後 cat 和 grep 是兩個可同時執行的 process，誰先跑由 scheduler 決定（多核心時真的同時跑）。grep 先讀到空 pipe → block，資料一到就被叫醒；cat 先寫 → 資料暫存在 kernel 的 pipe buffer。兩種情況結果一樣，所以 pipeline 的各段是並行的：grep 處理第一行時 cat 可能還在產生最後一行。</p>`,
  },
  {
    id: 'w5-v08', week: W, topic: '雙向溝通的正確做法', src: V('W5-08'), group: 'W5-08', type: 'single',
    q: `<p>A parent and a child want to exchange "ping" and "pong" reliably. The single-pipe version, where both processes keep both ends open, can hang. What is the correct fix?</p>`,
    opts: [
      'Use two pipes, one for each direction, and have each process close the ends it does not use',
      "Add sleep(1) before the parent's read()",
      'Make the pipe bigger',
      'Have the child write "pong" before it reads "ping"',
    ],
    ans: 0,
    exp: `<p>pipe 是單向的，而且不分收件人：誰先 read 誰拿走。用兩條 pipe（parent→child、child→parent），每個 process 關掉自己不用的那端 → parent 不可能讀回自己的 ping，雙方也都能正確等到 EOF。</p><p>(b) 只是降低機率，仍然是 race。(c) 跟容量無關。(d) 兩個訊息還是在同一條 pipe 裡，誰讀到哪一個仍然看運氣。</p>`,
  },
  {
    id: 'w5-v09a', week: W, topic: '先 wait 再讀：哪些會卡', src: V('W5-09'), group: 'W5-09', type: 'multi',
    q: `<p>A capture program creates one pipe (capacity 64 KiB), starts a command with its stdout connected to the pipe, calls <b>wait()</b> for the command, and only then reads the pipe until read() returns 0. Each command below writes only to stdout. Which commands make the program hang?${ALL}</p>`,
    opts: ['a command that prints 10 KiB', 'a command that prints 60 KiB', 'a command that prints 100 KiB', 'a command that prints 3 MiB'],
    ans: [2, 3],
    exp: `<p>先 wait 再讀：child 的輸出必須整個塞得進 64 KiB 的 pipe，child 才能 exit。10、60 KiB 放得下 → child 結束、wait 回來、parent 讀出全部。100 KiB、3 MiB 放不下 → child 卡在 write()（pipe 滿了）、parent 卡在 wait() → deadlock。</p><p>這就是「小測資看起來沒問題」的典型 bug。（已實測。）</p>`,
    calc: { fn: 'waitFirst', cap: 64, opts: [10, 60, 100, 3072] },
    cprog: 'w5_pipe waitfirst', cexpect: '102400,3145728',
  },
  {
    id: 'w5-v09b', week: W, topic: 'Python：communicate()', src: V('W5-09'), group: 'W5-09', type: 'single',
    q: `<p>A Python program runs a command whose stdout and stderr can each be several megabytes, using ${c('p = subprocess.Popen(cmd, stdout=PIPE, stderr=PIPE)')}. Which way of collecting the output cannot deadlock?</p>`,
    opts: [
      `${c('p.wait()')}, then ${c('p.stdout.read()')} and ${c('p.stderr.read()')}`,
      `${c('p.stdout.read()')}, then ${c('p.stderr.read()')}, then ${c('p.wait()')}`,
      c('out, err = p.communicate()'),
      `${c('p.wait(timeout=600)')}, then read both`,
    ],
    ans: 2,
    exp: `<p>(a)(d) 先 wait：輸出超過 64 KiB 就 deadlock（加 timeout 只是把 deadlock 變成「逾時」，誤導人以為指令太慢）。(b) 先把 stdout 讀到 EOF：如果 child 先在 stderr 寫滿 64 KiB，它卡在 write(2)，stdout 永遠等不到 EOF → 一樣卡住。</p><p>communicate() 會<b>同時</b>讀兩條 pipe 直到 EOF，然後才 wait → 不會卡（Python 文件推薦）。</p>`,
  },
  {
    id: 'w5-r1', week: W, topic: 'read() 在 pipe 上：拿到多少就回多少', src: V('W2-16', 1), group: 'W5-read', type: 'fill',
    q: `<p>A child writes the 10 bytes ${c('0123456789')} into a pipe and then sleeps for 100 seconds <b>without closing</b> its write end. The parent has closed its own write end. After the data has arrived, the parent calls ${c('read(fd[0], buf, 4)')} three times. What does the third read() return?</p>`,
    ans: ['2'],
    exp: `<p>前兩次各拿 4 bytes（0123、4567），第三次只剩 89 → 回傳 <b>2</b>。跟讀一般檔案一樣：read 回傳實際拿到的數量，可以比要求的少。已實測。</p>`,
    calc: { fn: 'readSeq', size: 10, reqs: [4, 4, 4], which: 2 },
    cprog: 'w5_pipe r1',
  },
  {
    id: 'w5-r2', week: W, topic: 'read() 在 pipe 上：空的但還有 writer', src: '新題（講義 W5 Part 3）', group: 'W5-read', type: 'single',
    q: `<p>A child writes 10 bytes into a pipe and then sleeps for 100 seconds without closing its write end. The parent has closed its own write end and has already read all 10 bytes. It now calls ${c('read(fd[0], buf, 4)')} again. What happens?</p>`,
    opts: [
      'read() returns 0, because the pipe is empty',
      "read() blocks until the child writes more or the child's write end is closed",
      'read() returns −1 with an error',
      'The parent receives SIGPIPE',
    ],
    ans: 1,
    exp: `<p>read() 在 pipe 上只有三種結果：有資料 → 回傳拿到的數量；空的、但還有人握著 write end → <b>block</b>；空的、而且沒有任何 write end → 回傳 0（EOF）。</p><p>這裡 child 還握著 write end → block（睡覺、不耗 CPU），直到 child 寫入或 exit。SIGPIPE 是給「寫進沒有讀者的 pipe」的寫端。（已實測：第四次 read 等到 child 結束才回傳 0。）</p>`,
    cprog: 'w5_pipe r1', cexpect: 'block',
  },
  {
    id: 'w5-r3', week: W, topic: '一般檔案的 EOF', src: '新題（講義 W5 Part 3）', group: 'W5-read', type: 'fill',
    q: `<p>A regular file contains ${c('fish is tasty\\n')} (14 bytes). A program opens it and runs:</p>${code(`
      read(fd, buf, 10);
      read(fd, buf, 10);
      n = read(fd, buf, 10);`)}<p>What is n?</p>`,
    ans: ['0'],
    exp: `<p>第一次拿 10 bytes、第二次拿剩下的 4 bytes、第三次 offset 已經等於檔案大小 → 回傳 <b>0</b>，代表 EOF。EOF 不是檔案裡的某個字元，也不是錯誤（錯誤才是 −1）。已實測。</p>`,
    calc: { fn: 'readSeq', size: 14, reqs: [10, 10, 10], which: 2 },
    cprog: 'w2_files r3',
  },
  {
    id: 'w5-c1', week: W, topic: 'Pipe 容量：wait 之前能寫多少', src: '新題（講義 W5 Part 3）', group: 'W5-cap', type: 'fill',
    q: `<p>The lecture's 04-capture-broken program creates a pipe, forks a worker whose stdout is the pipe, and calls wait() before reading the pipe. The worker writes N bytes to the pipe with a single write() and then exits. The pipe capacity is 65,536 bytes (the Linux default). What is the largest N, in bytes, for which the program does not deadlock?</p>`,
    ans: ['65536', '64 KiB', '64KiB'],
    exp: `<p>N ≤ 65536：worker 的資料全部放得進 pipe，worker 結束、wait 回來，parent 再讀出來。N = 65537：最後 1 byte 放不進去，worker 卡在 write()，parent 卡在 wait() → deadlock。（已實測：65536 會結束、65537 會卡住。）</p>`,
    cprog: 'w5_pipe waitfirst 65536 / 65537',
  },
  {
    id: 'w5-s2', week: W, topic: 'timeout 的 exit status', src: '新題（講義 W5 Part 4）', group: 'W5-sig', type: 'fill',
    q: `<p>${c('prog')} would normally run for 60 seconds, and it does not handle any signal. You run ${c('timeout 5 ./prog; echo $?')}. What number is printed?</p>`,
    ans: ['124'],
    exp: `<p>時間到時 timeout 送 SIGTERM 給 prog（預設動作：終止），然後 timeout 自己以 <b>124</b> 結束，讓 script 能分辨「逾時」和「被別人用 signal 殺掉」（被 SIGTERM 殺掉本來是 128 + 15 = 143）。已實測。</p>`,
    cprog: 'timeout 2 sleep 60',
  },
  {
    id: 'w5-s3', week: W, topic: 'SIGTERM 被忽略時 timeout -k', src: '新題（講義 W5 Part 4）', group: 'W5-sig', type: 'single',
    q: `<p>${c('prog')} ignores SIGTERM (it calls ${c('signal(SIGTERM, SIG_IGN)')}) and would otherwise run for 60 seconds. You run ${c('timeout -k 3 5 ./prog')}. What happens?</p>`,
    opts: [
      'prog is killed by SIGTERM after 5 seconds',
      "prog runs for the full 60 seconds, because it ignores timeout's signal",
      'At 5 s timeout sends SIGTERM, which prog ignores; at about 8 s timeout sends SIGKILL, which cannot be ignored, and prog dies',
      'timeout sends SIGKILL after 3 s and SIGTERM after 5 s',
    ],
    ans: 2,
    exp: `<p>timeout 先禮後兵：5 秒到送 SIGTERM（可以被 catch 或 ignore，讓程式有機會收尾）；${c('-k 3')} 表示送出 SIGTERM 後再等 3 秒，還沒結束就送 SIGKILL。SIGKILL 不能被 catch 或 ignore，kernel 直接終止 process，不執行它的任何程式碼。</p><p>docker stop（10 秒）、Kubernetes（30 秒）、systemd（90 秒）都是同樣的模式。已實測：約 8 秒結束，$? = 137。</p>`,
    cprog: 'w5_pipe ignterm', cexpect: 'status=137 elapsed≈8s',
  },
  {
    id: 'w5-s5', week: W, topic: 'timeout -s KILL 的 exit status', src: '新題（講義 W5 Part 5 exercise 7）', group: 'W5-sig', type: 'fill',
    q: `<p>You run ${c('timeout -s KILL 2 sleep 10; echo $?')}. What number is printed?</p>`,
    ans: ['137'],
    exp: `<p>${c('-s KILL')} 讓 timeout 逾時時直接送 SIGKILL（9）。因為是被強制殺掉的，timeout 回報 128 + 9 = <b>137</b>，而不是 124。已實測。</p>`,
    cprog: 'timeout -s KILL 2 sleep 10',
  },
  {
    id: 'w5-e1', week: W, topic: '2>&1 讓錯誤訊息進 pipe', src: '新題（講義 W5 Part 2）', group: 'W5-err', type: 'fill',
    q: `<p>a.txt has exactly 10 lines; missing.txt does not exist. What does this command print?</p>${code('cat a.txt missing.txt 2>&1 | wc -l')}`,
    ans: ['11'],
    exp: `<p>${c('2>&1')} 讓 cat 的 fd 2 也指向 fd 1 當時指的東西——也就是 pipe（shell 先接好 pipe，再處理 2&gt;&amp;1）。所以錯誤訊息 ${c('cat: missing.txt: No such file or directory')} 也進了 pipe，wc 數到 10 + 1 = <b>11</b> 行。</p><p>沒有 2&gt;&amp;1 時，錯誤訊息走 fd 2 直接到終端機，wc 只會數到 10。已實測。</p>`,
    cprog: 'cat a.txt missing.txt 2>&1 | wc -l',
  },
  {
    id: 'w5-d1', week: W, topic: 'dup2 之後 close 原本的 fd', src: '新題（講義 W5 Part 1）', group: 'W5-dup', type: 'single',
    q: `<p>In a child, the code runs ${c('dup2(fd[1], 1); close(fd[1]); close(fd[0]);')} and then ${c('printf("hi\\n"); fflush(stdout);')}. Where does "hi" go?</p>`,
    opts: [
      "To the terminal, because close(fd[1]) closed the pipe's write end",
      'Into the pipe, because fd 1 still refers to the write end',
      'Nowhere: write() fails with EBADF because fd[1] was closed',
      'Into the pipe, but only because fd[0] was also closed',
    ],
    ans: 1,
    exp: `<p>dup2(fd[1], 1) 讓 1 號<b>也</b>指向 write end（複製，不是移動）。close(fd[1]) 只移除 fd[1] 這個編號；write end 還被 1 號參照，沒有被關閉。printf 寫到 fd 1 → 進 pipe。這正是 shell 建 pipeline 時每個 child 都做的事。已實測。</p>`,
    cprog: 'w5_pipe dup2close', cexpect: 'pipe',
  },
];
