// 第二回 · Week 5：pipe、dup2、pipeline、stderr、read() 三種結果、EOF、pipe 容量與 deadlock、signals、timeout、SIGPIPE
const { code, c, ALL } = require('../lib');
const W = 'W5';
const V = (n) => `變化題（源自 ${n}）`;
const N = (part) => `新題（依講義 W5 ${part}）`;

const ABC = `<p>A shell runs the three-stage pipeline ${c('a | b | c')} the usual way: it creates pipe 1 (a → b) and pipe 2 (b → c), forks the three children, and each child uses dup2 and close before exec.</p>`;

module.exports = [
  // ---------- fd 編號、dup2 ----------
  {
    id: 's2-w5-01', week: W, topic: '先 dup 再關掉兩個標準 fd', src: V('W5-02'), group: 's2-W5-fd', type: 'fill',
    q: `<p>A process starts with fds 0, 1 and 2 open. It runs:</p>${code(`
      int saved = dup(2);      // keep a copy of stderr
      close(0);
      close(2);
      int fd[2];
      pipe(fd);`)}<p>What are fd[0] and fd[1]? Type the two numbers separated by a space.</p>`,
    ans: ['0 2', '0,2'],
    exp: `<p>dup(2) 拿最小可用的 3（saved = 3）。關掉 0 和 2 之後，可用的是 0、2、4…。pipe 拿兩個最小的 → fd[0] = <b>0</b>、fd[1] = <b>2</b>：這個 process 的 stdin 變成 read end、stderr 變成 write end，原本的 stderr 只剩 saved（3）還連著。已實測。</p>`,
    cprog: 's2_w5 fd1',
  },
  {
    id: 's2-w5-02', week: W, topic: '三次 pipe 與一次 close', src: V('W5-02'), group: 's2-W5-fd', type: 'fill',
    q: `<p>A process starts with fds 0, 1 and 2 open. It runs:</p>${code(`
      int p[2], q[2], r[2];
      pipe(p);
      pipe(q);
      close(p[0]);
      pipe(r);`)}<p>What are r[0] and r[1]? Type the two numbers separated by a space.</p>`,
    ans: ['3 7', '3,7'],
    exp: `<p>p = 3、4；q = 5、6；close(p[0]) 讓 3 空出來。pipe(r) 拿兩個最小的可用編號：3 和 7（4、5、6 都在用）→ r[0] = <b>3</b>、r[1] = <b>7</b>。已實測。</p>`,
    cprog: 's2_w5 fd2',
  },
  {
    id: 's2-w5-03', week: W, topic: 'dup2 + close 之後的下一個 open', src: V('W5-02'), group: 's2-W5-fd', type: 'fill',
    q: `<p>A process starts with fds 0, 1 and 2 open. It runs:</p>${code(`
      int fd = open("log.txt", O_WRONLY | O_CREAT, 0644);
      dup2(fd, 1);
      close(fd);
      int g = open("other.txt", O_RDONLY);`)}<p>other.txt exists. What is the value of ${c('g')}?</p>`,
    ans: ['3'],
    exp: `<p>fd = 3。dup2(3, 1) 讓 1 號也指向 log.txt（1 原本指的終端機被關掉）。close(3) 只移除 3 這個編號，log.txt 仍被 1 號開著。下一個 open 拿最小可用的 → <b>3</b>。已實測。</p>`,
    cprog: 's2_w5 fd3',
  },
  {
    id: 's2-w5-04', week: W, topic: 'dup2 蓋掉已經開著的 newfd', src: N('Part 1'), group: 's2-W5-dup', type: 'single',
    q: `<p>A child has fd 1 connected to the terminal (and fds 0 and 2 also on the terminal). It calls ${c('dup2(fd[1], 1)')}. What happens to the terminal?</p>`,
    opts: [
      "The kernel first closes this process's fd 1, so fd 1 no longer refers to the terminal; the terminal itself stays open through fds 0 and 2",
      'The terminal is closed for every process on the machine',
      'dup2 fails, because fd 1 is already open',
      'fd 1 now refers to both the terminal and the pipe',
    ],
    ans: 0,
    exp: `<p>dup2(oldfd, newfd)：如果 newfd 已經開著，kernel 先把它關掉，再讓它指向 oldfd 的物件。關掉的只是「這個 process 的 1 號」對終端機的那一個參照；終端機本身還被 0 號、2 號（和其他 process）用著。一個 fd 不會同時指向兩個東西。</p>`,
  },
  {
    id: 's2-w5-05', week: W, topic: 'dup2 的 oldfd 沒開', src: N('Part 1'), group: 's2-W5-dup', type: 'single',
    q: `<p>fd 9 is not open. A program calls ${c('dup2(9, 1)')}. What happens?</p>`,
    opts: [
      'dup2 returns −1 with errno EBADF, and fd 1 is left unchanged',
      'fd 1 is closed, and dup2 returns 1',
      'dup2 opens a new file as fd 9',
      'The program is killed with SIGSEGV',
    ],
    ans: 0,
    exp: `<p>講義：dup2 成功回傳 newfd；失敗回傳 −1 並設定 errno，例如 oldfd 不是一個開著的 descriptor（EBADF）。這種情況下 newfd 不會被動到。所以 shell 的程式碼都寫 ${c('if (dup2(...) == -1) die("dup2");')}。已實測。</p>`,
    cprog: 's2_w5 dup2bad', cexpect: '-1 EBADF unchanged',
  },
  {
    id: 's2-w5-06', week: W, topic: '往 read end 寫', src: N('Part 1'), group: 's2-W5-dup', type: 'single',
    q: `<p>A program creates a pipe with ${c('pipe(fd)')} and then, by mistake, calls ${c('write(fd[0], "hi", 2)')}. What happens?</p>`,
    opts: [
      'write fails and returns −1 (EBADF), because fd[0] is the read end and is not open for writing',
      'The bytes go into the pipe anyway',
      'The bytes are written to the terminal',
      'The program receives SIGPIPE',
    ],
    ans: 0,
    exp: `<p>pipe 是單向的：fd[0] 只能讀、fd[1] 只能寫（記法：0 像 stdin、1 像 stdout）。對 read end 寫會失敗、回傳 −1。SIGPIPE 是「對 write end 寫、但已經沒有任何 read end」時才發生。已實測。</p>`,
    cprog: 's2_w5 writeread', cexpect: '-1 EBADF',
  },
  // ---------- 多段 pipeline ----------
  {
    id: 's2-w5-07', week: W, topic: 'Pipeline 要幾個 pipe', src: V('W5-04'), group: 's2-W5-pipeline', type: 'fill',
    q: `<p>How many times does the shell call ${c('pipe()')} to run the four-stage pipeline ${c('a | b | c | d')}?</p>`,
    ans: ['3'],
    exp: `<p>每一個 ${c('|')} 需要一條 pipe：4 段 → <b>3</b> 條 pipe（a→b、b→c、c→d）。shell 還要 fork 4 個 child、最後 wait 4 次。</p>`,
    calc: { fn: 'pipeline', stages: 4, what: 'pipes' },
  },
  {
    id: 's2-w5-08', week: W, topic: '中間那一段的 fd 0 和 fd 1', src: V('W5-05'), group: 's2-W5-pipeline', type: 'single',
    q: `${ABC}<p>When ${c('b')} starts running, what do its fd 0 and fd 1 refer to?</p>`,
    opts: [
      'fd 0: the read end of pipe 1; fd 1: the write end of pipe 2',
      'fd 0: the terminal; fd 1: the write end of pipe 1',
      'fd 0: the read end of pipe 2; fd 1: the write end of pipe 1',
      'fd 0: the read end of pipe 1; fd 1: the terminal',
    ],
    ans: 0,
    exp: `<p>b 在中間：它從 a 讀（pipe 1 的 read end → dup2 成 fd 0），寫給 c（pipe 2 的 write end → dup2 成 fd 1）。fd 2 仍是終端機。b 自己完全不知道前後是誰，連接只存在 fd table 裡。</p>`,
  },
  {
    id: 's2-w5-09', week: W, topic: 'Shell 要關幾個 fd', src: V('W5-04'), group: 's2-W5-pipeline', type: 'fill',
    q: `${ABC}<p>After forking all three children, how many file descriptors must the <b>shell itself</b> close before it calls wait()?</p>`,
    ans: ['4'],
    exp: `<p>shell 自己開了兩條 pipe，每條兩端 → 共 <b>4</b> 個 fd，全部都要關。只要 shell 還握著某條 pipe 的 write end，下游那一段就永遠等不到 EOF，shell 又卡在 wait 等它。</p>`,
    calc: { fn: 'pipeline', stages: 3, what: 'fds' },
  },
  {
    id: 's2-w5-10', week: W, topic: '中間那一段忘了關', src: V('W5-10'), group: 's2-W5-pipeline', type: 'single',
    q: `${ABC}<p>The child that becomes ${c('b')} forgot to close its copy of the <b>write end of pipe 1</b> (the pipe it reads from). a finishes and exits. What happens?</p>`,
    opts: [
      'b never sees EOF on its stdin, because it still holds a write end of that pipe itself; b never finishes, so c and the shell wait forever too',
      'b sees EOF as soon as a exits',
      'a receives SIGPIPE',
      'c sees EOF immediately and exits, but b keeps running',
    ],
    ans: 0,
    exp: `<p>pipe 1 的 read() 只有在「沒有任何 write end」時才回傳 0。a 結束後，write end 只剩 b 自己手上那一個 → b 讀完資料後 block，在等自己。b 不結束 → pipe 2 的 write end 一直在 → c 也等不到 EOF → shell 卡在 wait。跟 W5-10 的 grep 同一個 bug，只是換到中間那一段。</p>`,
  },
  {
    id: 's2-w5-11', week: W, topic: '最後一段握著別人的 write end', src: V('W5-10'), group: 's2-W5-pipeline', type: 'single',
    q: `${ABC}<p>This time b closes everything correctly, but the child that becomes ${c('c')} forgot to close its inherited copy of the <b>write end of pipe 1</b> (a pipe it does not use at all). a finishes and exits. What happens?</p>`,
    opts: [
      "b never sees EOF, because c still holds a write end of pipe 1; b keeps waiting, so c never sees EOF on pipe 2 either",
      'Nothing goes wrong, because c does not use pipe 1',
      'c is killed by SIGPIPE',
      'a cannot exit',
    ],
    ans: 0,
    exp: `<p>kernel 只數「全世界有幾個 write end」，不管握著的人會不會寫。c 繼承來的 pipe 1 write end 沒關 → b 永遠等不到 EOF → b 不結束 → c 自己在 pipe 2 上也等不到 EOF。兩個互相等待。教訓：每個 child 都要關掉所有用不到的 pipe 端，不只是自己那條。</p>`,
  },
  {
    id: 's2-w5-12', week: W, topic: '孫子 process 握著 write end', src: N('Part 3 optional'), group: 's2-W5-eof', type: 'single',
    q: `<p>In a capture program, the child writes its output and exits quickly, and the parent closed its own write end correctly. But before writing, the child had started a grandchild that runs ${c('sleep 100')} without closing the inherited write end. When does the parent's read() return 0?</p>`,
    opts: [
      'About 100 seconds later, when the grandchild exits and the last write end closes',
      'Immediately after the child exits',
      'Never, because sleep never closes files',
      'Immediately, because sleep does not write anything',
    ],
    ans: 0,
    exp: `<p>kernel 只看 write end 有沒有人握著，不知道誰會真的寫。孫子雖然不寫，但它繼承的 write end 還開著 → parent 讀完 child 的資料後 block，直到孫子結束（約 100 秒後）才拿到 EOF。講義：被繼承的 descriptor 是 pipeline 不結束最常見的原因；可以用 ${c('ls -l /proc/*/fd | grep pipe:[<inode>]')} 找出是誰。</p>`,
  },
  {
    id: 's2-w5-13', week: W, topic: '用 /proc 找 pipe 的持有者', src: N('Part 5'), group: 's2-W5-eof', type: 'single',
    q: `<p>A pipeline hangs. You find its pipe's inode number is 48213 and run ${c("ls -l /proc/*/fd | grep 'pipe:\\[48213\\]'")}. What are you looking for?</p>`,
    opts: [
      'Every process that still has a descriptor for that pipe, and whether each link is the read end (lr-x) or the write end (l-wx)',
      'The bytes still stored in the pipe',
      'The pipe\'s capacity',
      'Which process created the pipe',
    ],
    ans: 0,
    exp: `<p>/proc/PID/fd 底下每個 fd 一個連結，指向它參照的物件；同一條 pipe 在每個 process 裡都顯示同一個 ${c('pipe:[inode]')}。找出所有持有者，再看權限字母：還有 ${c('l-wx')} 的人就是讓讀者等不到 EOF 的那個。</p>`,
  },
  // ---------- stderr ----------
  {
    id: 's2-w5-14', week: W, topic: '> 只改 fd 1', src: N('Part 2'), group: 's2-W5-err', type: 'single',
    q: `<p>a.txt exists and missing.txt does not. You run ${c('cat a.txt missing.txt > out.txt')} in a terminal. What happens?</p>`,
    opts: [
      'out.txt gets a.txt\'s contents; the error message about missing.txt appears on the terminal',
      'out.txt gets a.txt\'s contents followed by the error message',
      'out.txt is empty, because cat failed',
      'Nothing is printed anywhere',
    ],
    ans: 0,
    exp: `<p>${c('>')} 只把 cat 的 <b>fd 1</b> 換成 out.txt；fd 2 仍是終端機。cat 把資料寫到 fd 1、錯誤訊息寫到 fd 2 → 檔案裡只有 a.txt 的內容，錯誤訊息出現在畫面上。</p>`,
  },
  {
    id: 's2-w5-15', week: W, topic: '2> 把錯誤訊息導到別處', src: N('Part 2'), group: 's2-W5-err', type: 'fill',
    q: `<p>notes.txt has exactly 10 lines, and nothing named gone.txt exists. In a terminal you run:</p>${code('cat notes.txt gone.txt 2> err.txt | wc -l > count.txt')}<p>Nothing appears on the screen. What number does count.txt contain?</p>`,
    ans: ['10'],
    exp: `<p>pipe 只接 cat 的 fd 1，而 ${c('2> err.txt')} 把 cat 的 fd 2 導到檔案，所以錯誤訊息進了 err.txt，不會進 pipe 也不會出現在畫面上。wc 只收到 notes.txt 的 10 行 → count.txt 裡是 <b>10</b>。若改成 ${c('2>&1')}，錯誤訊息會跟著進 pipe，wc 就會數到 11。已實測。</p>`,
    cprog: 'bash 2> err.txt',
  },
  {
    id: 's2-w5-16', week: W, topic: '2>&1 的順序很重要', src: N('Part 2'), group: 's2-W5-err', type: 'fill',
    q: `<p>${c('cmd')} prints one line to stdout and one line to stderr. You run it in a terminal as:</p>${code('cmd 2>&1 > out.txt')}<p>How many lines end up in out.txt?</p>`,
    ans: ['1'],
    exp: `<p>shell 由左到右處理：${c('2>&1')} 是 dup2(1, 2)——讓 fd 2 指向 fd 1 <b>此刻</b>指的東西，也就是終端機；接著 ${c('> out.txt')} 才把 fd 1 換成檔案。所以 stdout 進檔案、stderr 仍在終端機 → <b>1</b> 行。寫成 ${c('cmd > out.txt 2>&1')} 才會兩行都進檔案。dup2 是「複製當下的參照」，不是「綁定」。已實測。</p>`,
    cprog: 'bash 2>&1 order',
  },
  {
    id: 's2-w5-17', week: W, topic: '啟動方式把 stderr 接進協定通道', src: V('W5-03'), group: 's2-W5-err', type: 'single',
    q: `<p>A tool server correctly prints its debug messages with ${c('fprintf(stderr, ...)')} and only JSON replies to stdout. But the client still gets parse errors, because the launcher starts the server with ${c('./server 2>&1')} and connects the server's stdout to its pipe. What is wrong?</p>`,
    opts: [
      '2>&1 makes the server\'s fd 2 refer to the same pipe as fd 1, so the debug messages enter the protocol stream again',
      'fprintf(stderr) is buffered, so the messages arrive late',
      'JSON replies must be written to stderr',
      'The client must read stderr instead of stdout',
    ],
    ans: 0,
    exp: `<p>程式寫得對（除錯訊息走 fd 2），但啟動時的 ${c('2>&1')} 讓 fd 2 也指向 stdout 那條 pipe——效果跟在程式裡 dup2(1, 2) 一樣，除錯訊息又混進協定了。stdout 當協定通道時，fd 2 必須接到別的地方（終端機或 log 檔）。</p>`,
  },
  // ---------- read() 的三種結果 ----------
  {
    id: 's2-w5-18', week: W, topic: 'read 不會等湊滿', src: N('Part 3'), group: 's2-W5-read', type: 'fill',
    q: `<p>A pipe currently holds 3 bytes, and the writer still has its write end open. A reader calls ${c('read(fd[0], buf, 100)')}. What does read() return?</p>`,
    ans: ['3'],
    exp: `<p>buffer 裡有資料時，read 不管有沒有 writer、也不等湊滿 100，就把現有的複製出來並回傳數量 → <b>3</b>。只有 buffer 是空的時候才會 block（有 writer）或回傳 0（沒有 writer）。已實測。</p>`,
    cprog: 's2_w5 partial',
  },
  {
    id: 's2-w5-19', week: W, topic: '一次讀 2 bytes 要讀幾次', src: V('W2-16'), group: 's2-W5-read', type: 'fill',
    q: `<p>A child writes the 5 bytes ${c('hello')} into a pipe and exits. The parent has closed its own write end. It then runs ${c('while ((n = read(fd[0], buf, 2)) > 0) count++;')}. What is ${c('count')} when the loop ends?</p>`,
    ans: ['3'],
    exp: `<p>依序讀到 he（2）、ll（2）、o（1），第四次 pipe 空了、沒有 write end → 回傳 0，迴圈結束。回傳正數的有 <b>3</b> 次。已實測。</p>`,
    calc: { fn: 'readCount', size: 5, req: 2 },
    cprog: 's2_w5 count2',
  },
  {
    id: 's2-w5-20', week: W, topic: 'read 回傳 0 的意義', src: N('Part 3'), group: 's2-W5-read', type: 'single',
    q: `<p>On a pipe, what exactly does a return value of 0 from ${c('read()')} mean?</p>`,
    opts: [
      'The buffer is empty and no process anywhere holds the write end, so nothing can ever arrive',
      'The buffer is empty right now, but more data may come later',
      'The writer wrote a zero byte',
      'An error occurred',
    ],
    ans: 0,
    exp: `<p>EOF 不是一個儲存在 pipe 裡的字元。pipe 沒有檔案大小，所以 kernel 用「buffer 空 + write end 數量為 0」來判斷 EOF。buffer 空但還有 writer → block（不是回傳 0）；錯誤 → −1。</p>`,
  },
  {
    id: 's2-w5-21', week: W, topic: '迴圈條件寫成 != 0 遇上錯誤', src: V('W5-07'), group: 's2-W5-read', type: 'single',
    q: `<p>Because of an earlier bug, ${c('fd')} is −1. The program then runs:</p>${code(`
      char buf[1000];
      ssize_t n;
      while ((n = read(fd, buf, sizeof buf)) != 0)
          ;   // process n bytes`)}<p>What happens?</p>`,
    opts: [
      'read() returns −1 every time, which is not 0, so the loop never ends and keeps a CPU core busy',
      'read() blocks forever, using no CPU',
      'The loop ends immediately, because read() returns 0 on error',
      'The program is killed by SIGPIPE',
    ],
    ans: 0,
    exp: `<p>錯誤時 read 立刻回傳 −1（errno = EBADF），−1 != 0 成立 → 迴圈不停，而且每次都是立刻回傳 → 吃滿一顆 CPU。正確寫法是 ${c('> 0')}，然後在迴圈後檢查 ${c('n == -1')}。對照 W5-07 的 ${c('>= 0')}：那是 EOF 時一直回傳 0 而停不下來。已實測（5 秒內 CPU 時間約 5 秒）。</p>`,
    cprog: 's2_w5 spin', cexpect: 'spin',
  },
  {
    id: 's2-w5-22', week: W, topic: '第一次 read 拿到目前有的', src: V('W5-07'), group: 's2-W5-read', type: 'fill',
    q: `<p>A child writes 3000 bytes into a pipe, sleeps for one second, writes 3000 more bytes, and exits. The parent (which has closed its write end) waits until the first 3000 bytes are in the pipe and then calls ${c('read(fd[0], buf, 4096)')}. What does this first read() return?</p>`,
    ans: ['3000'],
    exp: `<p>此時 pipe 裡只有 3000 bytes。read 不會等湊滿 4096，有多少給多少 → <b>3000</b>。下一次 read 會 block 到第二批資料寫進來，再下一次（child 結束後）回傳 0。已實測。</p>`,
    cprog: 's2_w5 firstchunk',
  },
  {
    id: 's2-w5-23', week: W, topic: '角色反過來：parent 寫、child 讀', src: V('W5-07'), group: 's2-W5-eof', type: 'single',
    q: `<p>This time the <b>parent</b> is the writer. It writes 1000 bytes into the pipe, forgets to close its write end, and calls ${c('wait(NULL)')}. The child has closed its own write end and reads until read() returns 0, then exits. What happens?</p>`,
    opts: [
      'Deadlock: the child reads the 1000 bytes and then blocks in read(), because the parent still holds a write end; the parent blocks in wait()',
      'It finishes, because 1000 bytes fit in the pipe',
      'The child gets SIGPIPE',
      'The parent gets EOF',
    ],
    ans: 0,
    exp: `<p>跟講義的 Bug 1 一樣，只是角色反過來：read 等的是「所有 write end 都關掉」。parent 自己還握著 write end，卻在 wait 等 child 結束；child 讀完資料後在 read() 等 EOF。兩個都睡著、不耗 CPU、沒有錯誤訊息。已實測（逾時）。</p>`,
    cprog: 's2_w5 parentwriter', cexpect: 'hang',
  },
  {
    id: 's2-w5-24', week: W, topic: '上一題的修法', src: V('W5-07'), group: 's2-W5-eof', type: 'single',
    q: `<p>The parent writes 1000 bytes into a pipe for its child, then calls ${c('wait(NULL)')}. The child reads until read() returns 0. The program hangs. What is the minimal fix?</p>`,
    opts: [
      'The parent calls close(fd[1]) after writing and before wait()',
      'The child calls wait() instead of read()',
      'Make the pipe bigger',
      'The parent calls read() on the pipe before wait()',
    ],
    ans: 0,
    exp: `<p>parent 寫完就關掉自己的 write end → write end 數量變 0 → child 讀完 1000 bytes 後下一次 read() 回傳 0、結束 → parent 的 wait 回來。跟資料量、pipe 大小無關。</p>`,
  },
  // ---------- 容量與 deadlock ----------
  {
    id: 's2-w5-25', week: W, topic: '卡住時 pipe 裡有幾個 byte', src: V('W5-09'), group: 's2-W5-cap', type: 'fill',
    q: `<p>A worker writes 20 chunks of 4096 bytes each (81,920 bytes in total) into a pipe whose capacity is 65,536 bytes, and then exits. Its parent calls wait() before reading anything. When the program is stuck, how many bytes are sitting in the pipe?</p>`,
    ans: ['65536', '65,536', '64 KiB'],
    exp: `<p>前 16 塊（16 × 4096 = 65,536 bytes）剛好把 pipe 填滿；第 17 個 write() 放不進去，worker 就卡在那裡。此時 pipe 裡是容量上限 <b>65,536</b> bytes。parent 卡在 wait() 等 worker 結束 → deadlock，兩邊都不耗 CPU。已實測（強制結束 worker 後把 pipe 讀乾，正好 65,536 bytes）。</p>`,
    calc: { fn: 'stuckBytes', chunks: Array(20).fill(4096), cap: 65536 },
    cprog: 's2_w5 stuck',
  },
  {
    id: 's2-w5-26', week: W, topic: '兩條 pipe：換容量與 chunk', src: V('W5-06'), group: 's2-W5-cap', type: 'multi',
    q: `<p>parent ──(pipe A)──▶ child ──(pipe B)──▶ parent. Each pipe holds 32 KiB; the child loops: read up to 8 KiB from A, write those bytes into B, and exits when A reaches EOF. The parent does ${c('write(A, data, n); close(A); read B until read() returns 0')}. For which n does the program finish?${ALL}</p>`,
    opts: ['n = 40 KiB', 'n = 70 KiB', 'n = 75 KiB', 'n = 100 KiB'],
    ans: [0, 1],
    exp: `<p>parent 開始讀 B 之前，系統最多能吸收：A 32 + B 32 + child 手上的 8 = <b>72 KiB</b>。40、70 KiB ≤ 72 → 跑完；75、100 KiB 超過 → B 滿了 child 卡在 write(B)、A 滿了 parent 卡在 write(A)。</p>`,
    calc: { fn: 'twoPipe', a: 32, b: 32, chunk: 8, opts: [40, 70, 75, 100] },
  },
  {
    id: 's2-w5-27', week: W, topic: 'Deadlock 的 process 狀態', src: N('Part 5'), group: 's2-W5-cap', type: 'single',
    q: `<p>04-capture-broken hangs with a 1 MB output: the worker is blocked in write() on the full pipe and the parent is blocked in wait(). What does ${c('ps -o pid,stat,cmd')} show for the two processes, and how much CPU do they use?</p>`,
    opts: [
      'Both are in state S (sleeping) and use no CPU',
      'Both are in state R (running) and use 100% of a core each',
      'The worker is Z (zombie) and the parent is S',
      'Both are T (stopped) until someone sends SIGCONT',
    ],
    ans: 0,
    exp: `<p>block 在 system call 裡的 process 睡在 wait queue 上（狀態 S），完全不用 CPU，等 kernel 叫醒——所以 deadlock 不會有任何錯誤訊息，也不會讓機器變慢。worker 還沒 exit，所以不是 zombie。wchan 欄位會顯示它們卡在 kernel 的哪個函式（寫 pipe、等 child）。</p>`,
  },
  {
    id: 's2-w5-28', week: W, topic: 'AgentScope：逾時其實是 deadlock', src: N('Part 3'), group: 's2-W5-cap', type: 'single',
    q: `<p>An AI-agent framework runs shell commands, waits for each command to exit, and then reads its output. Commands that print more than 64 KiB hang and are reported as "timeout". What is the right fix?</p>`,
    opts: [
      'Read the command\'s output while it runs (drain the pipe until EOF, then wait), for example with communicate()',
      'Increase the timeout',
      'Run the commands on a faster machine',
      'Print a warning when a command takes more than 10 seconds',
    ],
    ans: 0,
    exp: `<p>這是講義的 Bug 2：parent 先 wait，child 輸出超過 pipe 容量就卡在 write()，兩邊互等。加長時限只是讓它卡更久，然後誤導人以為指令太慢——問題在 parent。修法是邊跑邊讀，讀到 EOF 再 wait；stdout、stderr 兩條都要讀（communicate() 會處理）。</p>`,
  },
  {
    id: 's2-w5-29', week: W, topic: 'subprocess.run(capture_output=True)', src: N('Part 3'), group: 's2-W5-cap', type: 'single',
    q: `<p>Is ${c('r = subprocess.run(cmd, capture_output=True)')} safe for a command that prints 10 MB to stdout and 10 MB to stderr?</p>`,
    opts: [
      'Yes: run() uses communicate(), which reads both pipes until EOF while waiting for the child',
      'No: it calls wait() first and deadlocks once the output exceeds 64 KiB',
      'No: it can only capture up to 64 KiB',
      'Only if the command writes stdout and stderr in turns',
    ],
    ans: 0,
    exp: `<p>subprocess.run 內部做的事跟 01-pipeline.c 一樣（pipe、fork、dup2、execve），而且用 communicate() 同時讀兩條 pipe 直到 EOF 才收 exit status，所以輸出再大也不會卡。自己用 Popen 再先 p.wait() 才是 Python 文件警告的寫法。</p>`,
  },
  // ---------- signals ----------
  {
    id: 's2-w5-30', week: W, topic: 'kill -INT 的 exit status', src: N('Part 5 exercise 6'), group: 's2-W5-sig', type: 'fill',
    q: `<p>In bash: ${c('sleep 1000 &')}, then ${c('kill -INT %1; wait %1; echo "exit status $?"')}. What number is printed? (SIGINT is signal 2.)</p>`,
    ans: ['130'],
    exp: `<p>sleep 沒有處理 SIGINT → 預設動作終止。被 signal 終止的 process，shell 回報 128 + signal 編號 = 128 + 2 = <b>130</b>。同理 SIGTERM（15）→ 143、SIGKILL（9）→ 137。已實測。</p>`,
    cprog: 'bash kill -INT',
  },
  {
    id: 's2-w5-31', week: W, topic: 'Ctrl-C 之後的 PIPESTATUS', src: V('W5-01'), group: 's2-W5-sig', type: 'fill',
    q: `<p>You run ${c('sleep 1000 | cat')} in the foreground and press Ctrl-C. Then you run ${c('echo "${PIPESTATUS[@]}"')}. What does it print? Type the two numbers separated by a space.</p>`,
    ans: ['130 130'],
    exp: `<p>Ctrl-C 讓終端機送 SIGINT 給<b>整個前景 pipeline</b>：sleep 和 cat 都被 SIGINT 終止 → 兩個都是 128 + 2 = 130 → <b>130 130</b>。對照：從別的終端機 kill -INT 只殺 sleep 時，cat 讀到 EOF 正常結束，會是 130 0。</p>`,
  },
  {
    id: 's2-w5-32', week: W, topic: '有攔 SIGTERM 的程式', src: N('Part 4'), group: 's2-W5-sig', type: 'single',
    q: `<p>A server installs a SIGTERM handler that saves its state and then calls ${c('exit(0)')}. An admin runs ${c('kill <PID>')} (which sends SIGTERM). What exit status does the server's parent see?</p>`,
    opts: [
      'A normal exit with status 0, because the handler ran and the program exited by itself',
      '143, because the process received SIGTERM',
      '137, because kill always uses SIGKILL',
      'The server keeps running, because it caught the signal',
    ],
    ans: 0,
    exp: `<p>SIGTERM 可以被攔：handler 執行（存檔、收尾），然後程式自己 exit(0) → parent 用 wait 拿到的是「正常結束、status 0」，不是被 signal 終止。只有沒攔、走預設動作時才是 128 + 15 = 143。這就是為什麼工具都先送 SIGTERM：給程式機會優雅地結束。已實測。</p>`,
    cprog: 's2_w5 termhandler', cexpect: 'exit 0',
  },
  {
    id: 's2-w5-33', week: W, topic: 'SIGKILL 不能攔', src: N('Part 4'), group: 's2-W5-sig', type: 'single',
    q: `<p>A program calls ${c('signal(SIGKILL, my_handler)')} to try to clean up before being killed. Later someone runs ${c('kill -9 <PID>')}. What happens?</p>`,
    opts: [
      'The signal() call itself fails (SIGKILL cannot be caught), and kill -9 ends the process immediately without running any of its code',
      'my_handler runs, and then the process exits',
      'my_handler runs, and the process keeps running',
      'kill -9 is ignored because a handler is installed',
    ],
    ans: 0,
    exp: `<p>SIGKILL 不能被 catch 也不能被 ignore：signal() 會回傳 SIG_ERR（EINVAL），handler 根本沒裝上去。kernel 收到 SIGKILL 就直接結束 process，不執行它的任何程式碼——沒有機會存檔或刪暫存檔（「媽媽直接拔插頭」）。已實測。</p>`,
    cprog: 's2_w5 killhandler', cexpect: 'SIG_ERR killed 9',
  },
  {
    id: 's2-w5-34', week: W, topic: 'systemd 的 grace period', src: N('Part 4 optional'), group: 's2-W5-sig', type: 'fill',
    q: `<p>When systemd stops a service, it sends SIGTERM, waits for a grace period, and then sends SIGKILL if the service is still running. What is the default grace period (TimeoutStopSec), in seconds?</p>`,
    ans: ['90', '90 s'],
    exp: `<p>systemd 預設 <b>90</b> 秒；docker stop 是 10 秒；Kubernetes pod 是 30 秒（terminationGracePeriodSeconds）。模式都一樣：先 SIGTERM 讓程式收尾，過了寬限期才 SIGKILL。</p>`,
  },
  {
    id: 's2-w5-35', week: W, topic: '為什麼先 SIGTERM 再 SIGKILL', src: N('Part 4'), group: 's2-W5-sig', type: 'single',
    q: `<p>Why do process managers such as timeout, docker stop and systemd send SIGTERM first and SIGKILL only later?</p>`,
    opts: [
      'SIGTERM can be caught, giving the program a chance to finish requests, save state and remove temporary files; SIGKILL is the last resort that cannot be caught',
      'SIGKILL is slower to deliver than SIGTERM',
      'SIGTERM is required before SIGKILL by the kernel',
      'SIGKILL only works on processes that already received SIGTERM',
    ],
    ans: 0,
    exp: `<p>寫得好的 server 會攔 SIGTERM：處理完手上的 request、存好狀態、在寬限期內自己結束。如果它不理（或卡住了），才用不能被攔的 SIGKILL 強制結束，代價是什麼都來不及收尾。</p>`,
  },
  {
    id: 's2-w5-36', week: W, topic: 'timeout：程式自己先結束', src: N('Part 4'), group: 's2-W5-timeout', type: 'fill',
    q: `<p>${c('prog')} exits by itself after about 1 second with exit status 5. You run ${c('timeout 3 ./prog; echo $?')}. What number is printed?</p>`,
    ans: ['5'],
    exp: `<p>程式在時限前就結束了 → timeout 不送任何 signal，而且回傳和程式一樣的 exit status → <b>5</b>。只有時間到、送了 SIGTERM 時才會是 124。已實測。</p>`,
    cprog: 'timeout 3 (exit 5)',
  },
  {
    id: 's2-w5-37', week: W, topic: 'timeout -s INT', src: N('Part 5 exercise 7'), group: 's2-W5-timeout', type: 'fill',
    q: `<p>You run ${c('timeout -s INT 2 sleep 10; echo $?')}. sleep does not handle any signal. What number is printed?</p>`,
    ans: ['124'],
    exp: `<p>${c('-s INT')} 只是把逾時送的 signal 換成 SIGINT；sleep 照樣被終止。因為是逾時造成的，而且送的不是 SIGKILL，timeout 回報 <b>124</b>，讓呼叫者知道「逾時了」。只有用 ${c('-s KILL')}（或 -k 之後真的送出 SIGKILL）時才回報 137。已實測。</p>`,
    cprog: 'timeout -s INT 2 sleep 10',
  },
  {
    id: 's2-w5-38', week: W, topic: '忽略 SIGPIPE 之後的 write', src: V('W5-01'), group: 's2-W5-pipe', type: 'single',
    q: `<p>A writer calls ${c('signal(SIGPIPE, SIG_IGN)')}. Later every read end of its pipe is closed, and it calls ${c('write(fd[1], "x", 1)')}. What happens?</p>`,
    opts: [
      'write() returns −1 with errno EPIPE, and the writer keeps running',
      'The writer is terminated by SIGPIPE anyway',
      'write() blocks until a reader appears',
      'write() succeeds and the byte is discarded',
    ],
    ans: 0,
    exp: `<p>寫進沒有讀者的 pipe 永遠不會成功。預設情況下 kernel 送 SIGPIPE、預設動作是終止寫端（所以 ${c('yes | head')} 會結束）。SIGPIPE 被忽略時，write 改成回傳 −1、errno = EPIPE，程式要自己檢查並處理。已實測。</p>`,
    cprog: 's2_w5 epipe', cexpect: '-1 EPIPE',
  },
  {
    id: 's2-w5-39', week: W, topic: 'yes | head -2 | wc -l 的 PIPESTATUS', src: V('W5-01'), group: 's2-W5-pipe', type: 'fill',
    q: `<p>In bash you run ${c('yes | head -2 | wc -l')} and then ${c('echo "${PIPESTATUS[@]}"')}. What does it print? Type the three numbers separated by spaces.</p>`,
    ans: ['141 0 0'],
    exp: `<p>head 印完 2 行就正常結束（0）。yes 下一次寫進那條已經沒有讀者的 pipe → SIGPIPE（13）→ 128 + 13 = 141。wc 讀到 EOF（head 的 write end 隨它結束而關閉）、印出 2、正常結束（0）→ <b>141 0 0</b>。已實測。</p>`,
    cprog: 'bash PIPESTATUS',
  },
  {
    id: 's2-w5-40', week: W, topic: '殺掉 pipeline 的最後一段', src: V('W5-01'), group: 's2-W5-pipe', type: 'fill',
    q: `<p>${c('yes | cat | wc -l')} is running. From another terminal, someone runs ${c('kill -TERM <PID of wc>')}. What are the three exit statuses of yes, cat and wc, in that order? Type three numbers separated by spaces.</p>`,
    ans: ['141 141 143'],
    exp: `<p>wc 被 SIGTERM 終止 → 143。cat 下一次寫給 wc → 那條 pipe 沒有讀者了 → cat 收到 SIGPIPE → 141。cat 一死，yes 寫給 cat 的那條 pipe 也沒有讀者了 → yes 也收到 SIGPIPE → 141。SIGPIPE 從下游往上游一路傳上去。已實測。</p>`,
    cprog: 's2_w5 killwc',
  },
  {
    id: 's2-w5-41', week: W, topic: '由 exit status 反推 signal', src: N('Part 4'), group: 's2-W5-pipe', type: 'fill',
    q: `<p>A process in a pipeline ended with exit status 141 as reported by the shell. Which signal number terminated it?</p>`,
    ans: ['13', 'SIGPIPE'],
    exp: `<p>被 signal 終止時 shell 回報 128 + n → n = 141 − 128 = <b>13</b>，也就是 SIGPIPE：它寫進了一條已經沒有讀者的 pipe。（${c('kill -l')} 可以看到完整的編號表。）</p>`,
  },
  {
    id: 's2-w5-42', week: W, topic: 'Ctrl-C 不影響背景工作', src: N('Part 4'), group: 's2-W5-sig', type: 'single',
    q: `<p>You start ${c('./backup &')} in the background, then run ${c('sleep 100 | cat')} in the foreground and press Ctrl-C. What happens to ./backup?</p>`,
    opts: [
      'Nothing; Ctrl-C sends SIGINT only to the processes in the foreground pipeline',
      'It is terminated too, because Ctrl-C reaches every process started from this terminal',
      'It receives SIGPIPE',
      'It is paused until the foreground pipeline exits',
    ],
    ans: 0,
    exp: `<p>終端機在 Ctrl-C 時把 SIGINT 送給「前景」pipeline 的每一個 process（sleep 和 cat），背景工作不在前景，不會收到。要停它得用 kill（例如 ${c('kill %1')}）。</p>`,
  },
  // ---------- git 與 pager ----------
  {
    id: 's2-w5-43', week: W, topic: '提早離開 less', src: N('Part 5 exercise 5'), group: 's2-W5-git', type: 'single',
    q: `<p>You run ${c('git log')} in a huge repository and press q in less after the first screen, while git still has thousands of commits to print. What happens to git?</p>`,
    opts: [
      'Its next write into the pipe, whose only reader is gone, makes the kernel send it SIGPIPE, which terminates it without a message',
      'It keeps running in the background until it has printed everything',
      'It receives EOF and exits normally',
      'less sends git SIGINT',
    ],
    ans: 0,
    exp: `<p>git 是寫端、less 是唯一的讀者。less 結束後 git 再寫 → 沒有讀者 → kernel 送 SIGPIPE 給 git → 預設動作終止，什麼訊息都不印。所以關掉 pager 永遠不會留下還在跑的 producer。</p>`,
  },
  {
    id: 's2-w5-44', week: W, topic: 'git 只在終端機上開 pager', src: N('Part 5 exercise 5'), group: 's2-W5-git', type: 'single',
    q: `<p>Why does ${c('git log | grep fix')} not start less, while ${c('git log')} alone does?</p>`,
    opts: [
      'git starts a pager only when its stdout is a terminal; with | its stdout is a pipe',
      'grep kills less automatically',
      'less cannot read from a pipe',
      'The shell removes the pager option when it sees |',
    ],
    ans: 0,
    exp: `<p>git 先檢查自己的 stdout 是不是終端機（isatty），是的話才 fork less、把自己的 stdout dup2 到 pipe。被 pipe 給 grep 時 stdout 已經不是終端機，git 就直接輸出。這也是講義要你用 strace -o 把 trace 寫到檔案的原因（不能用 pipe，否則 git 不開 pager）。</p>`,
  },
  {
    id: 's2-w5-45', week: W, topic: 'git 為什麼先 dup(1)', src: N('Part 1 case study'), group: 's2-W5-git', type: 'single',
    q: `${code(`
      old_fd1 = dup(1);
      dup2(pager_process.in, 1);
      close(pager_process.in);`)}<p>Before redirecting its own stdout into the pager's pipe, git calls ${c('dup(1)')} and keeps the result. Why?</p>`,
    opts: [
      'To keep a descriptor for the original stdout (the terminal), so that git can restore it later',
      'Because dup2 requires the old fd to be duplicated first',
      'To give less a copy of the terminal',
      'To close the terminal',
    ],
    ans: 0,
    exp: `<p>dup(1) 在最小的可用編號上做一份 fd 1 的複本，指向原本的終端機。接著 dup2 把 fd 1 改指 pipe 的 write end。之後 git 需要時，可以用保存下來的 old_fd1 把 stdout 換回終端機。這裡 parent 自己就是 producer，跟 01-pipeline.c（parent 只負責接線）不同。</p>`,
  },
];
