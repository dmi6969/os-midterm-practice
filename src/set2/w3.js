// 第二回 · Week 3：fork / exec / wait、zombie / orphan / daemon、環境變數、PATH、built-in、everything is a file、連結
const { code, c, ALL } = require('../lib');
const W = 'W3';
const V = (n) => `變化題（源自 ${n}）`;
const N = (part) => `新題（依講義 W3 ${part}）`;

module.exports = [
  // ---------- fork 計數 ----------
  {
    id: 's2-w3-01', week: W, topic: 'fork 計數：child 再 fork', src: V('W3-14'), group: 's2-W3-count', type: 'fill',
    q: `<p>How many lines of ${c('X')} are printed? Assume every fork succeeds and stdout is a terminal.</p>${code(`
      if (fork() == 0)
          fork();
      printf("X\\n");
      return 0;`)}`,
    ans: ['3'],
    exp: `<p>原本的 process（P）fork 出 C；C 拿到 0，再 fork 出孫子 G；P 拿到正數，不進 if。共 P、C、G 三個 process，各印一次 → <b>3</b>。已實測。</p>`,
    cprog: 's2_w3 q1',
  },
  {
    id: 's2-w3-02', week: W, topic: 'fork 計數：parent 多 fork 一次', src: V('W3-14'), group: 's2-W3-count', type: 'fill',
    q: `<p>How many lines of ${c('Y')} are printed? Assume every fork succeeds and stdout is a terminal.</p>${code(`
      if (fork() > 0)
          fork();
      fork();
      printf("Y\\n");
      return 0;`)}`,
    ans: ['6'],
    exp: `<p>第一個 fork：P 和 C1。只有 P（拿到正數）再做 if 裡的 fork → 多一個 C2。現在 P、C1、C2 三個，每個都執行最後那個 fork() → 變成 6 個 process，各印一次 → <b>6</b>。已實測。</p>`,
    cprog: 's2_w3 q2',
  },
  {
    id: 's2-w3-03', week: W, topic: 'fork 計數：&& 和 || 短路', src: V('W3-15'), group: 's2-W3-count', type: 'fill',
    q: `<p>How many lines of ${c('Z')} are printed? Assume every fork succeeds.</p>${code(`
      (fork() && fork()) || fork();
      printf("Z\\n");
      return 0;`)}`,
    ans: ['5'],
    exp: `<p>P：第 1 個 fork 回傳正數 → 做第 2 個 fork，又是正數 → 括號為真，|| 短路，不做第 3 個。</p><p>第 1 個 fork 的 child：拿到 0 → && 短路（不做第 2 個），括號為假 → 做第 3 個 fork，多一個 process。</p><p>第 2 個 fork 的 child：拿到 0 → 括號為假 → 也做第 3 個 fork，再多一個。</p><p>共 P、2 個 child、2 個第 3 個 fork 產生的 process = <b>5</b>。已實測。</p>`,
    cprog: 's2_w3 q3',
  },
  {
    id: 's2-w3-04', week: W, topic: '迴圈 fork + child break', src: V('W3-16'), group: 's2-W3-loop', type: 'fill',
    q: `<p>How many lines are printed in total? Assume every fork succeeds and stdout is a terminal.</p>${code(`
      int i;
      for (i = 0; i < 3; i++)
          if (fork() == 0)
              break;              // the child leaves the loop
      printf("%d\\n", i);
      return 0;`)}`,
    ans: ['4'],
    exp: `<p>child 一出生就 break，不會再 fork；只有原本的 process 跑完整個迴圈。所以 P 產生 3 個 child，分別印 0、1、2，P 自己最後印 3 → 共 <b>4</b> 行。結構是「一個 parent、三個 child」。已實測。</p>`,
    cprog: 's2_w3 q4',
  },
  {
    id: 's2-w3-05', week: W, topic: '迴圈 fork + parent break', src: V('W3-16'), group: 's2-W3-loop', type: 'single',
    q: `${code(`
      for (int i = 0; i < 3; i++)
          if (fork() > 0)
              break;              // the parent leaves the loop
      // ... each process then continues here
      return 0;`)}<p>Assume every fork succeeds. Which description of the processes is correct?</p>`,
    opts: [
      'A chain of 4 processes: each process is the parent of the next one',
      'A tree of 8 processes',
      'One parent with 3 children',
      'Only 3 processes in total',
    ],
    ans: 0,
    exp: `<p>這次是 parent 一 fork 完就 break，child 繼續下一輪、再 fork 自己的 child。P → C1 → C2 → C3，每個 process 最多一個 child：一條 <b>4 個 process 的鏈</b>。對照「child break」的版本：一個 parent、三個 child；都不 break 的版本：8 個 process 的樹。已實測（共 4 個 process）。</p>`,
    cprog: 's2_w3 q5', cexpect: '4',
  },
  {
    id: 's2-w3-06', week: W, topic: 'printf 在 fork 前、導向檔案', src: V('W3-21'), group: 's2-W3-buf', type: 'fill',
    q: `<p>The program is run as ${c('./prog > out.txt')}. How many lines does out.txt contain? Assume every fork succeeds.</p>${code(`
      printf("start\\n");
      for (int i = 0; i < 2; i++)
          fork();
      printf("end\\n");
      return 0;`)}`,
    ans: ['8'],
    exp: `<p>導向檔案 → fully buffered，"start\\n" 不會在換行時寫出，fork 時跟著 buffer 被複製。最後 4 個 process，每個的 buffer 裡都是 start + end 兩行，結束時各自 flush → 4 × 2 = <b>8</b> 行。在終端機上執行則是 1 + 4 = 5 行。已實測。</p>`,
    cprog: 's2_w3 q6',
  },
  {
    id: 's2-w3-07', week: W, topic: '終端機上沒有換行的 printf 也會被複製', src: V('W3-21'), group: 's2-W3-buf', type: 'fill',
    q: `<p>The program is run in a <b>terminal</b>. How many times does ${c('hi')} appear on the screen?</p>${code(`
      printf("hi");
      fork();
      printf("\\n");
      return 0;`)}`,
    ans: ['2'],
    exp: `<p>終端機是 line-buffered，但 "hi" <b>沒有換行</b>，所以 fork 時它還在 buffer 裡，被 child 複製一份。之後兩個 process 各自印 "\\n"、各自 flush → hi 出現 <b>2</b> 次。「終端機就不會重複」只在 fork 前已經印出換行時才成立。已用 pty 實測。</p>`,
    cprog: 's2_w3 q7',
  },
  {
    id: 's2-w3-08', week: W, topic: 'fork 前先 fflush', src: V('W3-21'), group: 's2-W3-buf', type: 'fill',
    q: `<p>The program is run as ${c('./prog > out.txt')}. How many lines does out.txt contain?</p>${code(`
      printf("A\\n");
      fflush(stdout);
      fork();
      printf("B\\n");
      return 0;`)}`,
    ans: ['3'],
    exp: `<p>fflush 在 fork 前就把 "A\\n" 寫進 kernel，buffer 清空，child 複製到的是空 buffer。之後兩個 process 各印一行 B → A 1 行 + B 2 行 = <b>3</b> 行。這就是講義建議的寫法：fork 前先 fflush(stdout)。已實測。</p>`,
    cprog: 's2_w3 q8',
  },
  {
    id: 's2-w3-09', week: W, topic: 'fork 與 exec 之間做 redirection', src: N('Part 2'), group: 's2-W3-exec', type: 'fill',
    q: `${code(`
      if (fork() == 0) {
          int fd = open("out.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
          dup2(fd, 1);
          close(fd);
          execlp("echo", "echo", "hello", (char *)NULL);
          exit(1);
      }
      wait(NULL);
      printf("done\\n");`)}<p>The program is started from a terminal. What does out.txt contain afterwards? (Ignore the trailing newline.)</p>`,
    ans: ['hello'],
    exp: `<p>child 在 fork 之後、exec 之前把自己的 fd 1 改成 out.txt；exec 保留 fd table，所以 echo 照常寫 fd 1，就寫進了檔案，它自己完全不知道。parent 的 fd 1 沒動過，"done" 印在終端機上。out.txt 只有 <b>hello</b>。這就是 shell 做 ${c('echo hello > out.txt')} 的方式。已實測。</p>`,
    cprog: 's2_w3 q9',
  },
  {
    id: 's2-w3-10', week: W, topic: 'child 用 _exit 避免重複輸出', src: V('W3-21'), group: 's2-W3-buf', type: 'fill',
    q: `<p>The program is run as ${c('./prog > out.txt')}. How many lines does out.txt contain?</p>${code(`
      printf("x\\n");
      if (fork() == 0)
          _exit(0);
      wait(NULL);
      return 0;`)}`,
    ans: ['1'],
    exp: `<p>fork 時 "x\\n" 在 buffer 裡，child 也有一份。但 child 呼叫的是 ${c('_exit')}：直接結束、<b>不 flush</b> stdio buffer，那一份就丟了。parent return 時 flush 自己的那份 → 只有 <b>1</b> 行。若 child 用 exit(0)，就會是 2 行。已實測。</p>`,
    cprog: 's2_w3 q10',
  },
  // ---------- wait / zombie / orphan / daemon ----------
  {
    id: 's2-w3-11', week: W, topic: 'wait 回收的是哪個 child', src: V('W3-17'), group: 's2-W3-wait', type: 'single',
    q: `${code(`
      pid_t c1 = fork();
      if (c1 == 0) exit(0);                    // C1 exits at once
      pid_t c2 = fork();
      if (c2 == 0) { sleep(100); exit(0); }    // C2 keeps running
      sleep(1);
      pid_t r = wait(NULL);`)}<p>What happens at the ${c('wait(NULL)')} call?</p>`,
    opts: [
      "It returns at once with C1's PID; afterwards the parent has no zombie children, and C2 is still running",
      'It blocks until C2 exits, because wait() waits for the most recent child',
      "It returns C2's PID, and C1 stays a zombie",
      'It returns −1, because one child is still running',
    ],
    ans: 0,
    exp: `<p>wait() 回收「任何一個」已經結束的 child；如果已經有 zombie，它立刻回傳。C1 早就 exit 了 → 回傳 C1 的 PID、收掉它的 zombie。C2 還在跑，不是 zombie。要等特定的 child 用 waitpid(pid, …)。已實測。</p>`,
    cprog: 's2_w3 q11', cexpect: 'c1 0',
  },
  {
    id: 's2-w3-12', week: W, topic: 'Background job 為什麼不會一直是 zombie', src: N('Part 4'), group: 's2-W3-wait', type: 'single',
    q: `<p>You start ${c('./server &')} in bash. bash does not block in waitpid, so the prompt returns immediately. Why doesn't the server become a long-lived zombie when it later exits?</p>`,
    opts: [
      'Background jobs never become zombies',
      'When the child exits, the kernel sends bash SIGCHLD, and bash calls waitpid in its signal handler',
      'init reaps every background job',
      'bash polls with ps every second',
    ],
    ans: 1,
    exp: `<p>child 結束時 kernel 送 <b>SIGCHLD</b> 給 parent（bash），bash 在 signal handler 裡呼叫 waitpid 收掉它，所以 zombie 只存在幾微秒。init 只收養 parent 已經不在的 orphan，bash 還活著。</p>`,
  },
  {
    id: 's2-w3-13', week: W, topic: 'Double fork：為什麼要第二次 fork', src: V('W3-19'), group: 's2-W3-daemon', type: 'single',
    q: `<p>PTT's daemonize() does: fork (the parent exits), setsid(), fork again, redirect stdin/stdout/stderr, write a PID file. What does the <b>second</b> fork achieve?</p>`,
    opts: [
      'It doubles the number of worker processes',
      'The process can never acquire a controlling terminal again, and init becomes its parent',
      'It resets all environment variables',
      'It lets the shell reap the daemon',
    ],
    ans: 1,
    exp: `<p>setsid() 開一個沒有終端機的新 session，自己是 session leader；再 fork 一次，新的 process 不是 session leader，就不會意外重新取得控制終端機。它的 parent 隨即結束 → 變成刻意製造的 orphan，由 init 收養（PPID = 1）。第一次 fork 則是讓原本的 parent 結束、終端機拿回 prompt。</p>`,
  },
  {
    id: 's2-w3-14', week: W, topic: 'pstree：daemon 都掛在 systemd 下', src: N('Part 4'), group: 's2-W3-daemon', type: 'single',
    q: `<p>In ${c('pstree -p 1')}, sshd, database servers and web servers appear directly under ${c('systemd(1)')}. Why?</p>`,
    opts: [
      'They were started by systemd (PID 1) as services, or they daemonized and were adopted by init',
      'Every process on Linux is a direct child of PID 1',
      'They are threads of systemd',
      'pstree only shows processes owned by root',
    ],
    ans: 0,
    exp: `<p>現代系統用 systemd service unit 啟動伺服器：systemd（PID 1）自己 fork + exec，處理 redirection、環境變數、當機重啟、log。傳統自己 double fork 的 daemon 也會被 init 收養。所以它們都直接掛在 PID 1 下面。你登入後開的 bash 則是一路從 sshd fork 下來的。</p>`,
  },
  {
    id: 's2-w3-15', week: W, topic: 'fork 之後哪些不一樣', src: V('W3-01'), group: 's2-W3-fork', type: 'multi',
    q: `<p>Right after a successful fork(), which of the following are <b>different</b> in the parent and the child?${ALL}</p>`,
    opts: [
      'The PID',
      'The PPID',
      'The value returned by fork()',
      'The file offset of a file opened before the fork',
      'The current working directory',
      'The environment variables',
    ],
    ans: [0, 1, 2],
    exp: `<p>不同的只有：PID（child 拿新的）、PPID（child 的 parent 是呼叫 fork 的 process）、fork 的回傳值（parent 拿 child 的 PID，child 拿 0）。記憶體內容、cwd、使用者、環境變數、signal handler 都一樣；fork 前開的檔案甚至<b>共用</b>同一個 offset（同一個 open-file entry）。</p>`,
  },
  {
    id: 's2-w3-16', week: W, topic: 'exec 失敗之後', src: V('W3-21'), group: 's2-W3-exec', type: 'single',
    q: `${code(`
      if (fork() == 0) {
          execlp("nosuchcmd", "nosuchcmd", (char *)NULL);
          perror("exec");
          exit(127);
      }
      int st;
      wait(&st);`)}<p>No program named nosuchcmd exists in any PATH directory. What happens in the child?</p>`,
    opts: [
      'execlp returns −1, so the child prints "exec: No such file or directory" to stderr and exits with status 127',
      'execlp never returns, so nothing is printed',
      'The kernel kills the child with SIGSEGV',
      'execlp runs the parent program again from the start',
    ],
    ans: 0,
    exp: `<p>exec 只有<b>成功</b>才不會回來。找不到程式 → execlp 回傳 −1、errno = ENOENT，於是接著執行下一行：perror 印出 ${c('exec: No such file or directory')}，然後 exit(127)（shell 對「找不到指令」也用 127）。已實測。</p>`,
    cprog: 's2_w3 q16', cexpect: 'exec: No such file or directory|127',
  },
  {
    id: 's2-w3-17', week: W, topic: 'ls > out.txt：誰在什麼時候 open', src: N('Part 2'), group: 's2-W3-exec', type: 'single',
    q: `<p>You type ${c('ls > out.txt')} in bash. Which process opens out.txt, and when?</p>`,
    opts: [
      'bash itself opens it before forking, so every later command writes there',
      "bash's child opens it after fork and before exec, then makes it fd 1; ls never knows",
      'ls opens it, because the shell passes "> out.txt" to ls as arguments',
      'The kernel opens it during execve',
    ],
    ans: 1,
    exp: `<p>這就是 fork 和 exec 分成兩個呼叫的好處：fork 之後、exec 之前，child 還在跑 bash 的程式碼，可以先 open out.txt、dup2 成 fd 1、關掉多餘的 fd，再 exec ls。exec 保留 fd table，所以 ls 只是照常寫 fd 1。${c('> out.txt')} 不會出現在 ls 的 argv 裡。</p>`,
  },
  {
    id: 's2-w3-18', week: W, topic: 'fork 和 exec 之間降低權限', src: N('Part 2'), group: 's2-W3-exec', type: 'single',
    q: `<p>A server runs as root. For each client it forks, and the child switches to an unprivileged user before calling exec to run the handler program. Why switch users in the child between fork and exec?</p>`,
    opts: [
      'So that the handler program runs with only the privileges it needs, while the root parent keeps its own privileges',
      'Because exec refuses to run programs as root',
      'Because changing users is only allowed in a child process',
      'To make the handler start faster',
    ],
    ans: 0,
    exp: `<p>fork 之後、exec 之前，child 還在執行 server 自己的程式碼，可以先準備環境（redirection、降權限），再 exec 真正的程式。新程式從一開始就是低權限，就算有漏洞也拿不到 root；parent 不受影響，繼續以 root 服務下一個連線。</p>`,
  },
  // ---------- 環境變數 ----------
  {
    id: 's2-w3-19', week: W, topic: 'KEY=abc ./prog 只影響那一個指令', src: V('W3-09'), group: 's2-W3-env', type: 'single',
    q: `<p>In bash (where KEY was not set before), you run ${c('KEY=abc ./prog')} and then, after it finishes, ${c('echo "[$KEY]"')}. What does echo print?</p>`,
    opts: ['[abc]', '[]', 'An error: KEY is not defined', '[./prog]'],
    ans: 1,
    keep: true,
    exp: `<p>${c('KEY=abc ./prog')} 只把 KEY 放進<b>那一個</b> child 的環境；bash 自己並沒有 KEY 這個變數，所以之後 echo 印出空的 <b>[]</b>。（bash 對未設定的變數展開成空字串，不會報錯。）</p>`,
  },
  {
    id: 's2-w3-20', week: W, topic: '哪些寫法讓 child 看得到環境變數', src: V('W3-09'), group: 's2-W3-env', type: 'multi',
    q: `<p>In a fresh bash where KEY is not set, which command lines let ${c('./prog')} see ${c('KEY=abc')} in its environment?${ALL}</p>`,
    opts: [
      c('KEY=abc ./prog'),
      c('KEY=abc; ./prog'),
      c('export KEY=abc; ./prog'),
      c('KEY=abc; export KEY; ./prog'),
      c('./prog KEY=abc'),
    ],
    ans: [0, 2, 3],
    exp: `<p>${c('KEY=abc ./prog')}：只給這一個指令的環境 ✓。${c('KEY=abc;')} 只是 shell 變數，沒有 export 就不會傳給 child ✗；export 之後（不論一起寫或分開寫）從此 fork 出的 child 都會繼承 ✓。${c('./prog KEY=abc')} 是<b>命令列參數</b>（argv），不是環境變數 ✗。已實測。</p>`,
    cprog: 'bash env forms', cexpect: 'a,c,d',
  },
  {
    id: 's2-w3-21', week: W, topic: 'script 裡的 export 改不到父 shell', src: V('W3-09'), group: 's2-W3-env', type: 'single',
    q: `<p>setkey.sh contains the single line ${c('export API_KEY=xyz')}. You run ${c('./setkey.sh')} and then ${c('echo $API_KEY')} in the same terminal. Nothing is printed. Why, and what works instead?</p>`,
    opts: [
      'export only works for root; run it with sudo',
      'The script ran in a child process, whose environment disappears when it exits; source ./setkey.sh runs it inside the current shell instead',
      'The variable name is too long',
      'Environment variables are only visible after logging out and in again',
    ],
    ans: 1,
    exp: `<p>./setkey.sh 會 fork 出一個新的 bash 來跑 script；export 改的是那個 child 自己的環境，child 結束就沒了，parent shell 完全不受影響（跟 cd 必須是 built-in 同一個道理）。${c('source ./setkey.sh')}（或 ${c('. ./setkey.sh')}）讓目前這個 shell 自己執行這些指令。</p>`,
  },
  {
    id: 's2-w3-22', week: W, topic: 'Docker 用 -e 傳密碼', src: V('W3-11'), group: 's2-W3-env', type: 'single',
    q: `<p>Why does the lecture pass a database password with ${c('docker run -e POSTGRES_PASSWORD=... -d postgres')} instead of writing it as an argument after the image name?</p>`,
    opts: [
      'Arguments after the image name become the long-running server\'s command line, which other users can see with ps for as long as the server runs',
      'Docker refuses arguments that contain the word password',
      'Environment variables are encrypted by the kernel',
      'Arguments are limited to 8 characters',
    ],
    ans: 0,
    exp: `<p>寫在 image 名稱後面的參數會變成 PostgreSQL 這個長期執行的 process 的命令列；server 跑多久，別的使用者就能用 ps / top 看多久。用 -e 傳的是環境變數，不會出現在命令列裡；docker run 這個 client 本身只存在很短的時間（-d 會讓它很快結束）。環境變數並沒有加密，只是別人看不到。</p>`,
  },
  // ---------- PATH / built-in ----------
  {
    id: 's2-w3-23', week: W, topic: 'PATH 搜尋失敗幾次', src: V('W3-13'), group: 's2-W3-path', type: 'fill',
    q: `<p>PATH is ${c('/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin')}, and ls is installed only at ${c('/usr/bin/ls')}. The shell searches with execve. How many execve calls fail with ENOENT before ls is found?</p>`,
    ans: ['3'],
    exp: `<p>shell 依序嘗試：/usr/local/sbin/ls ✗、/usr/local/bin/ls ✗、/usr/sbin/ls ✗、/usr/bin/ls ✓ → 失敗 <b>3</b> 次，第 4 次成功，後面的 /sbin、/bin 不會再試。strace 會看到三行 ${c('= -1 ENOENT')}。搜尋的是 shell（或 libc 的 execvp），不是 kernel。</p>`,
    calc: { fn: 'pathSearch', path: ['/usr/local/sbin', '/usr/local/bin', '/usr/sbin', '/usr/bin', '/sbin', '/bin'], at: '/usr/bin' },
  },
  {
    id: 's2-w3-24', week: W, topic: 'PATH 清空之後還能用什麼', src: V('W3-13'), group: 's2-W3-path', type: 'multi',
    q: `<p>In bash you run ${c('PATH=""')}. Which of the following still work in that shell?${ALL}</p>`,
    opts: [c('cd /tmp'), c('/bin/ls'), c('echo hi'), c('export X=1'), c('ls'), c('python3 --version')],
    ans: [0, 1, 2, 3],
    exp: `<p>cd、echo、export 是 bash 的 <b>built-in</b>，在 shell 自己的 process 裡執行，根本不需要找執行檔 ✓。${c('/bin/ls')} 有斜線，直接當路徑執行，不搜尋 PATH ✓。只有沒有斜線的外部程式（ls、python3）要靠 PATH，現在找不到 → command not found。已實測。</p>`,
    cprog: 'bash PATH=""', cexpect: 'cd,abs,echo,export',
  },
  {
    id: 's2-w3-25', week: W, topic: 'script 裡的 cd', src: V('W3-03'), group: 's2-W3-path', type: 'fill',
    q: `<p>Your shell's current directory is ${c('/home/nini')}. goto.sh contains the single line ${c('cd /tmp')} and is executable. You run ${c('./goto.sh')} and then ${c('pwd')}. What does pwd print?</p>`,
    ans: ['/home/nini', '/home/nini/'],
    exp: `<p>./goto.sh 在一個 child process（新的 bash）裡執行，cd 改的是那個 child 的 cwd，child 結束後就消失了 → 你的 shell 仍然在 <b>/home/nini</b>。這正是 cd 不能是獨立程式、必須是 built-in 的原因。已實測（cwd 不變）。</p>`,
    cprog: 'bash goto.sh', cexpect: 'unchanged',
  },
  {
    id: 's2-w3-26', week: W, topic: '為什麼 exit 也是 built-in', src: V('W3-03'), group: 's2-W3-path', type: 'single',
    q: `<p>Why must ${c('exit')} be a shell built-in?</p>`,
    opts: [
      'It has to end the shell process itself; a separate program could only end its own child process',
      'Only built-ins may return an exit status',
      'Because /bin/exit would need root',
      'Because exec cannot run programs named exit',
    ],
    ans: 0,
    exp: `<p>跟 cd 同一個道理：它要改變的是 shell <b>自己</b>的狀態（結束 shell 本身）。如果 exit 是獨立程式，shell 會 fork 一個 child 去跑它，結束的只是那個 child，shell 照樣活著。export 同理（要改 shell 自己的環境）。</p>`,
  },
  // ---------- Unix 哲學 ----------
  {
    id: 's2-w3-27', week: W, topic: 'Everything is a file', src: V('W3-04'), group: 's2-W3-unix', type: 'single',
    q: `<p>Which of the following is <b>not</b> an example of the Unix idea "everything is a file"?</p>`,
    opts: [
      'Reading a disk through /dev/sda',
      'Reading a process\'s state from /proc/1234/status',
      'Reading the CPU temperature with cat /sys/class/thermal/thermal_zone0/temp',
      'Piping the plain-text output of ps into grep',
    ],
    ans: 3,
    exp: `<p>/dev 代表裝置、/proc 代表 process、/sys 代表硬體狀態——都是把東西表示成檔案，讓一般的 cat、ls 就能操作。把 ps 的輸出 pipe 給 grep 展示的是另一個原則：<b>text streams</b> 是通用介面、每個程式只做好一件事、彼此組合。</p>`,
  },
  {
    id: 's2-w3-28', week: W, topic: 'PowerShell vs Unix', src: N('Part 6'), group: 's2-W3-unix', type: 'single',
    q: `<p>What is the key difference between PowerShell pipelines and Unix pipelines, according to the lecture?</p>`,
    opts: [
      'PowerShell passes structured .NET objects between commands; Unix passes unstructured plain text',
      'PowerShell cannot connect more than two commands',
      'Unix pipelines run the commands one after another, PowerShell runs them in parallel',
      'Only PowerShell supports scripting',
    ],
    ans: 0,
    exp: `<p>PowerShell 傳的是 .NET 物件（有結構的 API）；Unix 傳的是沒有結構的純文字。Peter Salus 的說法：text streams are a universal interface——任何語言寫的程式都能讀寫文字，所以 ssh、cat、sort、tail 彼此不用知道對方。</p>`,
  },
  {
    id: 's2-w3-29', week: W, topic: 'Each program does one thing well', src: N('Part 6'), group: 's2-W3-unix', type: 'single',
    q: `${code(`
      for i in server{1..500}; do
          echo -n "$i: "
          ssh $i "cat /sys/class/thermal/thermal_zone0/temp"
      done | sort -n -k2 | tail -n2`)}<p>In this command, ssh, cat, sort and tail know nothing about each other, yet together they find the two hottest servers. Which principle does this show?</p>`,
    opts: [
      'Each program does one thing well, and programs work together through a common text-stream interface',
      'Everything runs in kernel mode',
      'Programs share memory through the page cache',
      'The shell compiles the loop into one program',
    ],
    ans: 0,
    exp: `<p>每個程式只做好一件事：ssh 遠端執行、cat 讀檔、sort 排序、tail 取最後幾行；它們唯一的共同介面是一串純文字。shell script 把小程式接起來，而不是自己實作每個功能。（溫度感測器能用 cat 讀，則是 everything is a file。）</p>`,
  },
  // ---------- 連結 ----------
  {
    id: 's2-w3-30', week: W, topic: '靜態連結的磁碟用量', src: V('W3-05'), group: 's2-W3-link', type: 'fill',
    q: `<p>libZ contains 6 MB of code. 10 different programs each have 1 MB of their own code and all use libZ. With <b>static</b> linking, how much disk space do the 10 executables take in total, in MB?</p>`,
    ans: ['70', '70 MB', '70MB'],
    exp: `<p>靜態連結把 libZ 複製進每個執行檔：10 × (1 + 6) = <b>70 MB</b>。動態連結則是 10 × 1 + 6 = 16 MB（一份 libZ.so）。</p>`,
    calc: { fn: 'linkDisk', lib: 6, own: 1, n: 10, mode: 'static' },
  },
  {
    id: 's2-w3-31', week: W, topic: '靜態連結：同一個執行檔跑兩次', src: V('W3-02'), group: 's2-W3-link', type: 'fill',
    q: `<p>libZ contains 6 MB of code. 10 different programs, each <b>statically</b> linked with libZ, are running, and <b>each program has two processes</b> (20 processes in total). How much DRAM does libZ's code use, in MB?</p>`,
    ans: ['60', '60 MB', '60MB'],
    exp: `<p>kernel 會共享「同一個檔案」的頁：同一個執行檔的兩個 process，code 頁（包括裡面那份 libZ）是共用的。但 10 個不同的執行檔是 10 個不同的檔案，kernel 不會比對內容 → 10 份 × 6 MB = <b>60 MB</b>（不是 120）。若改成動態連結，只有一份 6 MB。</p>`,
    calc: { fn: 'mul', a: 10, b: 6 },
  },
  {
    id: 's2-w3-32', week: W, topic: 'Dynamic loader', src: N('Part 7'), group: 's2-W3-link', type: 'single',
    q: `<p>${c('ldd /bin/ls')} lists ${c('/lib64/ld-linux-x86-64.so.2')} among the libraries. What is it?</p>`,
    opts: [
      'The dynamic loader: after execve and before main, it finds the needed .so files, maps them into the process and fills in the missing addresses',
      'The part of the kernel that runs system calls',
      'A copy of libc used only by ls',
      'The compiler that produced ls',
    ],
    ans: 0,
    exp: `<p>動態連結的執行檔只記錄「NEEDED libc.so.6…」。execve 之後先跑 dynamic loader（ld-linux），由它找到需要的 .so、map 進 process、填上函式位址，最後才跳到 main。靜態連結的程式沒有這一步，execve map 完就直接進 main。</p>`,
  },
  {
    id: 's2-w3-33', week: W, topic: '缺的位址什麼時候填上', src: N('Part 7'), group: 's2-W3-link', type: 'single',
    q: `<p>app1.c calls ${c('meow()')}, which lives in libmeow. When is the missing address of meow() filled in?</p>`,
    opts: [
      'Static linking: by the linker at build time. Dynamic linking: by the dynamic loader at run time',
      'Both: by the compiler when it translates app1.c',
      'Both: by the kernel during fork',
      'Static linking: at run time. Dynamic linking: at build time',
    ],
    ans: 0,
    exp: `<p>compiler 翻譯 app1.c 時不知道 meow() 在哪，留下一個空位。靜態連結：linker 在<b>建置時</b>把 libmeow 的程式碼複製進來並填上位址。動態連結：linker 只寫一個 NEEDED libmeow.so 的註記，程式<b>執行時</b>由 dynamic loader 找到 .so、map 進來再填位址。</p>`,
  },
  {
    id: 's2-w3-34', week: W, topic: '為什麼 library 的 code 可以共用', src: N('Part 7'), group: 's2-W3-link', type: 'single',
    q: `<p>One copy of libc's code in DRAM can be shared by hundreds of processes. Why can its code be shared this way?</p>`,
    opts: [
      'Library code is read-only, so many page tables can point to the same physical frames',
      'Every process runs the same program',
      'The kernel copies libc into each process at exec time',
      'libc runs in kernel mode',
    ],
    ans: 0,
    exp: `<p>共享靠的是 page table：很多 process 的 page table 項目指向同一個實體 frame。library 的 code 是<b>唯讀</b>的，沒有人會改它，所以一份就夠。會被寫入的資料（例如 library 的全域變數）則是每個 process 各自一份（寫的時候 copy-on-write）。講義的測量：共享省下 1.34 GB。</p>`,
  },
  {
    id: 's2-w3-35', week: W, topic: 'Heartbleed：換掉 .so 之後還要做什麼', src: V('W3-18'), group: 's2-W3-link', type: 'single',
    q: `<p>Ubuntu ships a patched ${c('libssl.so')} for Heartbleed, and the admin installs it. What must still be done so that no running program uses the vulnerable code?</p>`,
    opts: [
      'Restart the dynamically linked services that were already running; statically linked programs need a rebuilt version from their vendors',
      'Nothing; every program uses the new library immediately',
      'Reboot only the statically linked programs',
      'Recompile every dynamically linked program',
    ],
    ans: 0,
    exp: `<p>動態連結的程式在啟動時才載入 .so：已經在跑的還留著舊版程式碼，必須重啟（之後啟動的會自動拿到新版，不用重新編譯）。靜態連結的程式把舊版 OpenSSL 帶在執行檔裡，換 .so 對它沒用，只能等廠商重新建置發布。</p>`,
  },
  {
    id: 's2-w3-36', week: W, topic: 'Orphan 計數', src: V('W3-12'), group: 's2-W3-wait', type: 'fill',
    q: `<p>Process P forks C1, C2 and C3. C1 also forks a child G1. Then P exits immediately, while C1, C2, C3 and G1 keep sleeping. After P has exited, how many of these processes have PPID 1?</p>`,
    ans: ['3'],
    exp: `<p>parent 不見了的才是 orphan：C1、C2、C3 的 parent P 結束了 → 由 init 收養，PPID 變 1。G1 的 parent 是 C1，C1 還活著 → G1 的 PPID 仍是 C1。所以是 <b>3</b> 個。已實測。</p>`,
    cprog: 's2_w3 q36',
  },
  {
    id: 's2-w3-37', week: W, topic: 'Zombie 佔用什麼', src: V('W3-10'), group: 's2-W3-wait', type: 'single',
    q: `<p>What does a zombie process still hold?</p>`,
    opts: [
      'Only its row in the process table: its PID and exit status',
      'All of its memory, until the parent calls wait()',
      'Its open files, so the files cannot be deleted',
      'One CPU core, because it keeps running exit()',
    ],
    ans: 0,
    exp: `<p>process 結束時 kernel 立刻釋放它的記憶體、關掉它的檔案；只留下 process table 的那一列（PID + exit code），等 parent 用 wait() 拿走。一個 zombie 無害，但從不 wait 的 server 會一直累積，最後 process table 滿了，所有人的 fork() 都失敗。</p>`,
  },
  {
    id: 's2-w3-38', week: W, topic: 'kill -9 一個 zombie', src: V('W3-10'), group: 's2-W3-wait', type: 'single',
    q: `<p>${c('ps')} shows a zombie (state Z). You run ${c('kill -9 <its PID>')}. What happens, and how can you get rid of the zombie?</p>`,
    opts: [
      "Nothing happens, because the process has already exited; the parent must wait() for it, or the parent must exit so that init adopts and reaps it",
      'The zombie is removed immediately',
      'The zombie restarts and exits normally',
      'The kernel kills the zombie\'s parent instead',
    ],
    ans: 0,
    exp: `<p>zombie 已經死了，沒有任何程式碼可以接收 signal，kill 對它沒有作用。它只是在等 parent 來 wait。解法：讓 parent 呼叫 wait，或結束 parent（講義 exercise：kill %1 殺掉 parent 後再 ps，zombie 就被 init 收掉了）。</p>`,
  },
  {
    id: 's2-w3-39', week: W, topic: 'Fork bomb 與 ulimit -u', src: N('Part 5'), group: 's2-W3-count', type: 'fill',
    q: `<p>A fork bomb starts as one process; in every round, every existing process forks once, so the count doubles. The user's process limit (${c('ulimit -u')}) is 1000. In which round does fork() first fail?</p>`,
    ans: ['10'],
    exp: `<p>第 k 輪結束時應該有 2<sup>k</sup> 個 process：第 9 輪後是 512（沒超過），第 10 輪要變成 1024 &gt; 1000 → 第 <b>10</b> 輪會碰到上限，fork() 開始回傳 −1。每個使用者有 process 上限，就是為了讓一個人的程式不會拖垮整台共用機器的其他使用者。</p>`,
    calc: { fn: 'forkbomb', limit: 1000 },
  },
  {
    id: 's2-w3-40', week: W, topic: 'Subshell 裡的 cd', src: V('W3-03'), group: 's2-W3-path', type: 'single',
    q: `<p>Your shell's current directory is /home/nini. You run ${c('(cd /tmp; pwd); pwd')}. The parentheses make bash run their contents in a forked child. What is printed?</p>`,
    opts: ['/tmp, then /home/nini', '/tmp, then /tmp', '/home/nini, then /home/nini', '/home/nini, then /tmp'],
    ans: 0,
    keep: true,
    exp: `<p>括號裡的指令在 fork 出來的 subshell 裡執行：它的 cd 改的是自己的 cwd，所以裡面的 pwd 印 /tmp；subshell 結束後，外面的 shell 的 cwd 從來沒變 → 第二個 pwd 印 /home/nini。已實測（cwd 不變）。</p>`,
    cprog: 'bash subshell cd', cexpect: 'unchanged',
  },
  {
    id: 's2-w3-41', week: W, topic: 'fork 失敗時', src: V('W3-07'), group: 's2-W3-fork', type: 'single',
    q: `<p>A user has reached the per-user process limit, and a program calls ${c('fork()')}. Which statement is true?</p>`,
    opts: [
      'fork() returns −1 in the parent, and no child is created',
      'fork() returns −1 in the child, and the child exits',
      'fork() returns 0 in both processes',
      'The child is created but cannot run until another process exits',
    ],
    ans: 0,
    exp: `<p>fork 失敗時沒有 child，只有 parent 拿到 −1（errno 說明原因，例如 EAGAIN：超過 process 上限，或記憶體不夠）。所以呼叫 fork 的程式碼要處理三種情況：&gt; 0 是 parent、== 0 是 child、−1 是失敗。</p>`,
  },
  {
    id: 's2-w3-42', week: W, topic: '$? 從哪裡來', src: N('Part 2'), group: 's2-W3-wait', type: 'single',
    q: `<p>After ${c('gcc -o meow meow.c')} finishes, ${c('echo $?')} prints 0. Where did that 0 come from?</p>`,
    opts: [
      'gcc called exit(0); the kernel kept the code in gcc\'s process-table row until bash collected it with waitpid',
      'bash guessed it from the fact that meow was created',
      'gcc printed 0 to stderr and bash read it',
      'The kernel sets $? to 0 for every program that does not crash',
    ],
    ans: 0,
    exp: `<p>gcc 呼叫 exit(0) → kernel 釋放它的記憶體，但把 exit code 留在 process table 那一列 → 叫醒在 waitpid 裡睡覺的 bash → bash 拿到 exit code、存進 $?、顯示新的 prompt。被 signal 終止時，$? 則是 128 + signal 編號。</p>`,
  },
  {
    id: 's2-w3-43', week: W, topic: 'waitpid 指定一個 child', src: V('W3-17'), group: 's2-W3-wait', type: 'fill',
    q: `${code(`
      pid_t kid[3];
      for (int i = 0; i < 3; i++) {
          kid[i] = fork();
          if (kid[i] == 0) exit(0);      // each child exits immediately
      }
      sleep(1);
      waitpid(kid[1], NULL, 0);
      sleep(30);`)}<p>During the final ${c('sleep(30)')}, how many zombie children does the parent have?</p>`,
    ans: ['2'],
    exp: `<p>3 個 child 都已經 exit；waitpid(kid[1], …) 只收掉第二個 → 剩 kid[0] 和 kid[2] 兩個 zombie → <b>2</b>。已實測。</p>`,
    cprog: 's2_w3 q43',
  },
  {
    id: 's2-w3-44', week: W, topic: 'Chrome 一個分頁一個 process', src: N('Part 1'), group: 's2-W3-fork', type: 'single',
    q: `<p>Chrome deliberately uses a separate process for each tab, created with fork(). What is the main benefit?</p>`,
    opts: [
      'Isolation: if one tab crashes, only its process ends, and the browser and the other tabs keep running',
      'Tabs can read each other\'s memory more easily',
      'fork() copies the whole browser instantly, so tabs need no memory at all',
      'Each tab gets its own kernel',
    ],
    ans: 0,
    exp: `<p>這是 W2 講的隔離：每個分頁是獨立的 process、有自己的位址空間，一個分頁 crash 或被攻擊不會波及其他分頁。fork 之所以便宜，是因為 copy-on-write（寫的時候才複製），不是「完全不用記憶體」。</p>`,
  },
  {
    id: 's2-w3-45', week: W, topic: 'fork 為什麼很快', src: N('Part 1'), group: 's2-W3-fork', type: 'single',
    q: `<p>A process with 2 GiB of resident memory calls fork(), and fork() returns within a fraction of a millisecond. How is that possible?</p>`,
    opts: [
      'The child shares all of the parent\'s pages read-only (copy-on-write); a page is copied only when one of them writes to it',
      'fork() copies 2 GiB using a special fast instruction',
      'The child gets an empty address space',
      'fork() returns before the copy finishes, and the copy continues in the background',
    ],
    ans: 0,
    exp: `<p>fork 只複製 page table，讓兩邊指向同樣的 frame 並標成唯讀。之後誰寫某一頁，就觸發 page fault，kernel 才複製那一頁（copy-on-write）。不寫的頁永遠共用。（細節在 Week 10。）</p>`,
  },
];
