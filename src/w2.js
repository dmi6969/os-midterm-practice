// Week 2 · Quiz 1：OS 目標、隔離、檔案 / fd / inode、VSZ / RSS、page cache、printf 緩衝、權限、PATH
const { code, c, ALL } = require('./lib');
const W = 'W2';
const O = (n, warn) => `原題 ${n}${warn ? ' ⚠️' : ''}`;
const V = (n, warn) => `變化題（源自 ${n}${warn ? ' ⚠️' : ''}）`;

module.exports = [
  // ===================== 原題 =====================
  {
    id: 'w2-01', week: W, topic: 'VSZ / RSS、寫滿陣列', src: O('W2-01', 1), group: 'W2-01', type: 'single',
    q: `<p>A Python script has just created an 8 GiB array with ${c('np.zeros')}. At this moment the process has VSZ 8.2 GiB and RSS 0.2 GiB. The script then writes a value to every element of the array.</p><p>After the loop finishes, what are VSZ and RSS, approximately?</p>`,
    opts: [
      'VSZ grows to about 16.2 GiB; RSS is about 8.2 GiB',
      'VSZ stays about 8.2 GiB; RSS is about 8.2 GiB',
      'VSZ stays about 8.2 GiB; RSS is about 1.6 GiB',
      'VSZ stays about 8.2 GiB; RSS stays about 0.2 GiB',
    ],
    ans: 1,
    exp: `<p>np.zeros 只配置虛擬頁：VSZ 一開始就已經包含那 8 GiB，但這些頁還沒有 DRAM frame。</p><p>迴圈把每個元素都寫過一次 → 8 GiB 裡每一頁都被 touch，各自拿到一個 frame，所以 RSS ≈ 0.2 + 8 = <b>8.2 GiB</b>。過程中沒有再配置新的虛擬記憶體，所以 VSZ 不變。</p><p>(c) 的 1.6 是原本答錯的數字；(d) 錯在「寫入」一定會讓那一頁拿到真正的 frame。</p>`,
    calc: { fn: 'rssAfterTouch', vsz: 8.2, base: 0.2, touched: 8, expect: [8.2, 8.2] },
  },
  {
    id: 'w2-02', week: W, topic: 'np.zeros 為什麼快（lazy allocation）', src: O('W2-02'), group: 'W2-02', type: 'multi',
    q: `<p>Nini timed two calls: ${c('np.zeros((1024,1024,128))')} took 0.00004 s, but ${c('np.random.rand(1024,1024,128)')} took 0.42 s. Nini says: "NumPy's zero-filling code must be extremely well optimized." Which statements are true?${ALL}</p>`,
    opts: [
      'np.zeros only allocates pages. VSZ grows, but the pages have no DRAM frame yet.',
      'np.zeros is fast because it reuses an identical array created earlier.',
      'The zeros array never uses memory. Zeros are generated when they are read.',
      'A page gets a DRAM frame when the program first touches it. That cost is paid later.',
      "After np.zeros, the process's RSS barely increases.",
    ],
    ans: [0, 3, 4],
    exp: `<p>np.zeros 根本沒有「填 0」：它只增加 VSZ，這些頁都指向 OS 共用的 zero page。真正的成本延後到第一次寫入時的 page fault（配 frame、清零）。</p><p>(b) 錯：沒有重用任何舊陣列。(c) 錯：一旦寫入，那一頁一定會拿到真正的 frame、佔用記憶體。np.random.rand 必須把每一頁都寫入亂數，所以每頁都要配 frame，才會慢。</p>`,
  },
  {
    id: 'w2-03', week: W, topic: 'User-facing vs batch', src: O('W2-03'), group: 'W2-03', type: 'multi',
    q: `<p>Spotify's front end plays a song the moment you tap it. Its back end computes tonight's recommendations from today's listening. Which statements describe the <b>batch back end</b> (rather than the user-facing front end)?${ALL}</p>`,
    opts: [
      '"99% of requests are answered within 100 ms."',
      '"The whole run finishes within 6 hours."',
      'Throughput is measured in how much data is processed.',
      'A user notices immediately when it is slow.',
      'When the machine runs short of CPU, the scheduler slows down or kills this one first.',
    ],
    ans: [1, 2, 4],
    exp: `<p>User-facing serving：看 availability、latency（SLO 用百分位數，例如 99% 的 request 在 100 ms 內）、每秒能處理多少 request；一慢使用者馬上感覺到 → S1、S4。</p><p>Batch：看資料吞吐量（處理多少資料）和 end-to-end latency（整批跑多久）→ S2、S3。Borg 在機器快滿時只 throttle / kill batch，從不動 user-facing → S5 也是 batch。</p>`,
  },
  {
    id: 'w2-04', week: W, topic: '隔離三層：process / container / VM', src: O('W2-04'), group: 'W2-04', type: 'single',
    q: `<p>Which statement correctly describes what a container and a virtual machine share with other workloads on the same physical machine?</p>`,
    opts: [
      'A container shares only the hardware. A VM shares the OS.',
      'Both share only the hardware.',
      'A container shares the operating system. A VM shares only the hardware.',
      'Both share the OS.',
    ],
    ans: 2,
    exp: `<p>三層隔離，越下面邊界越強、成本越高：</p><p>① process：自己的記憶體和 CPU 時間，共用 OS 和檔案系統（幾乎免費，例如 PTT 一個登入一個 process）。<br>② container：自己的身分、檔案系統視角、CPU / 記憶體上限，<b>共用 OS kernel</b>（Docker、Colab）。<br>③ VM：裡面跑自己的一整個 OS，<b>只共用硬體</b>，由 hypervisor 切分（AWS / GCP VM）。</p>`,
  },
  {
    id: 'w2-05', week: W, topic: '檔案權限：chmod 數字', src: O('W2-05'), group: 'W2-05', type: 'single',
    q: `${code('-rw-r----- 1 nini manager 812 Sep 22 10:03 salary.csv')}<p>Which ${c('chmod')} number gives exactly these permissions?</p>`,
    opts: ['604', '640', '644', '740'],
    ans: 1,
    exp: `<p>r = 4、w = 2、x = 1，每組相加：owner rw- = 4+2 = 6；group r-- = 4；others --- = 0 → <b>640</b>。</p>`,
  },
  {
    id: 'w2-06', week: W, topic: '檔案權限：三組 rwx', src: O('W2-06'), group: 'W2-06', type: 'single',
    q: `<p>A file's permission string is ${c('-rwxr-x---')}. Which statement is correct?</p>`,
    opts: [
      "The owner can read, write and execute; members of the file's group can read and execute; everyone else has no access.",
      'The owner can read and execute; the group can read, write and execute; others have no access.',
      'The owner can read, write and execute; others can read and execute; the group has no access.',
      'Only root can execute it, because the group bits are r-x.',
    ],
    ans: 0,
    exp: `<p>第一個字元是檔案類型（- 是一般檔案），後面每 3 個一組：第一組 rwx = <b>owner</b>、第二組 r-x = <b>group</b>、第三組 --- = <b>others</b>。</p>`,
  },
  {
    id: 'w2-07', week: W, topic: 'read() 會移動 offset', src: O('W2-07'), group: 'W2-07', type: 'fill',
    q: `<p>data.txt contains ${c('ABCDEF')}. A program opens it once and runs:</p>${code(`
      char x, y, a[2];
      read(fd, &x, 1);
      read(fd, a, 2);
      read(fd, &y, 1);`)}<p>What are x and y? Type the two characters with no space, x first (for example ${c('QZ')}).</p>`,
    ans: ['AD', 'A D', 'A,D'],
    exp: `<p>同一個 fd 指向同一個 open file entry，大家共用一個 offset，每次 read 都從上次停下的地方繼續：讀 1 byte → A（offset 變 1）、讀 2 bytes → BC（offset 變 3）、讀 1 byte → D。所以 x = A、y = D。</p>`,
    calc: { fn: 'readChars', content: 'ABCDEF', reqs: [1, 2, 1], pick: [0, 2] },
    cprog: 'w2_files w2-07',
  },
  {
    id: 'w2-08', week: W, topic: 'printf 緩衝與檔案大小', src: O('W2-08', 1), group: 'W2-08', type: 'single',
    q: `<p>A program runs as ${c('./test > out.txt')}. It has executed ${c('printf("hello ")')} (6 bytes) and ${c('printf("world")')} (5 bytes) and has not exited yet. At this moment someone runs ${c('ls -l out.txt')}.</p><p>What file size does ls show, and how many bytes are sitting in the C library's output buffer?</p>`,
    opts: [
      'File size 11 bytes; 0 bytes in the buffer',
      'File size 0 bytes; 11 bytes in the buffer',
      'File size 6 bytes; 5 bytes in the buffer',
      "File size 0 bytes; 0 bytes in the buffer, because the data is in the kernel's page cache",
    ],
    ans: 1,
    exp: `<p>stdout 導向檔案時是 <b>fully buffered</b>：printf 只是把資料複製到程式自己記憶體裡約 4 KB 的 buffer。buffer 沒滿、沒 fflush、程式也還沒正常結束 → 還沒呼叫 write()，一個 byte 都沒進 kernel。所以檔案大小是 <b>0</b>，<b>11</b> bytes 全在 libc buffer 裡（原答 11 / 0 剛好相反）。</p><p>(d) 錯：資料要經過 write() 這個 system call 才會進 page cache。</p>`,
    cprog: 'w2_buffers w2-08', cexpect: '0 11',
  },
  {
    id: 'w2-09', week: W, topic: '每個 indirection 都是一張表', src: O('W2-09'), group: 'W2-09', type: 'single',
    q: `<p>What does a page table map?</p>`,
    opts: ['a block number → a storage location', 'a file descriptor → an open-file table entry', 'a virtual page → a physical frame', 'a file name → an inode'],
    ans: 2,
    exp: `<p>「每個 indirection 都是一張表」：page table 把虛擬頁對應到實體 frame。(a) 是 block 層、(b) 是 fd table、(d) 是目錄（目錄內容就是「名字 → inode 編號」）。</p>`,
  },
  {
    id: 'w2-10', week: W, topic: 'unlink：hard link 與開著的檔案', src: O('W2-10'), group: 'W2-10', type: 'single',
    q: `${code(`
      $ ls -li /data/archive.tar
      131074 -rw-r--r-- 2 nini manager 40000000000 Sep 22 10:03 /data/archive.tar
      $ rm /data/archive.tar`)}<p>A background program still has this file open. Right after ${c('rm')}: how many file names still point to inode 131074? If the background program now calls ${c('read()')}, what happens? And when are the 40 GB actually freed?</p>`,
    opts: [
      '0 names; read() fails; the space is freed immediately',
      '1 name; read() succeeds; the space is freed when the program closes the file',
      '1 name; read() succeeds; the space is freed only when the other name is removed AND the program closes the file',
      '1 name; read() fails; the space is freed when the other name is also removed',
    ],
    ans: 2,
    exp: `<p>權限後面那個 <b>2</b> 是 link count：這個 inode 有兩個名字（hard link）。rm 就是 unlink：只刪掉一個目錄項目，link count 2 → <b>1</b>。</p><p>背景程式走的是 fd → open file entry → inode，從不經過檔名，所以 read() 照樣<b>成功</b>。</p><p>inode 和資料區塊要「link count = 0」<b>而且</b>「沒有任何 open file 參照它」兩個條件都成立才會釋放 → 要等另一個名字也被刪掉、而且程式關檔。</p>`,
  },
  {
    id: 'w2-11a', week: W, topic: 'PATH：command not found', src: O('W2-11'), group: 'W2-11', type: 'single',
    q: `<p>niko has ${c('/home/niko/bin/greet')} with permissions ${c('-rwxr-xr-x')}. Typing ${c('greet')} prints ${c('command not found')}, but typing ${c('/home/niko/bin/greet')} runs it. ${c('echo $PATH')} prints ${c('/usr/local/bin:/usr/bin:/bin')}. Why does ${c('greet')} alone fail?</p>`,
    opts: [
      'The shell only looks in the current directory.',
      'The shell only looks in the directories listed in PATH, and /home/niko/bin is not one of them.',
      'Running programs from a home directory requires sudo.',
      'greet has no execute permission.',
    ],
    ans: 1,
    exp: `<p>沒有斜線的指令名稱，shell 會依序到 PATH 列出的每個目錄找。/home/niko/bin 不在 PATH 裡 → 找不到。打完整路徑就不用搜尋，所以能跑。檔案本身有 x 權限，(d) 錯。</p>`,
  },
  {
    id: 'w2-11b', week: W, topic: 'PATH：怎麼讓 greet 直接能跑', src: O('W2-11', 1), group: 'W2-11', type: 'multi',
    q: `<p>niko's program ${c('/home/niko/bin/greet')} is ${c('-rwxr-xr-x')}, but typing ${c('greet')} prints ${c('command not found')}. PATH is ${c('/usr/local/bin:/usr/bin:/bin')}. Which changes let niko run the program by typing only ${c('greet')}?${ALL}</p>`,
    opts: [
      `Add ${c('export PATH="$PATH:/home/niko/bin"')} to ~/.bashrc and open a new terminal`,
      `Run ${c('chmod +x /home/niko/bin/greet')}`,
      'Copy greet into /usr/bin',
      `${c('cd /home/niko/bin')} first, then type ${c('greet')}`,
      'Run it once with sudo so the shell remembers it',
      `Run ${c('export PATH="$PATH:/home/niko/bin"')} in the current terminal`,
    ],
    ans: [0, 2, 5],
    exp: `<p>關鍵：shell 只搜尋 PATH 裡的目錄。</p><p>(a) 寫進 ~/.bashrc、開新終端機 → 新 shell 的 PATH 包含 /home/niko/bin ✓<br>(c) /usr/bin 本來就在 PATH 裡 ✓<br>(f) 在目前終端機 export，當下這個 shell 立刻生效 ✓</p><p>(b) 本來就有 x 權限，問題不在權限。(d) PATH 裡沒有「.」，shell 不會搜尋目前目錄（要打 ${c('./greet')}）。(e) 沒有這種機制。</p>`,
  },
  {
    id: 'w2-12', week: W, topic: '路徑解析與目錄的 x 權限', src: O('W2-12', 1), group: 'W2-12', type: 'single',
    q: `<p>None of these paths has been looked up yet (nothing is cached):</p>${code(`
      /                         inode 2
      /home                     inode 100
      /home/nini                inode 137
      /home/nini/catfood        inode 198
      /home/nini/catfood/fish   inode 259`)}<p>A program calls ${c('open("/home/nini/catfood/fish", O_RDONLY)')}. (1) How many directories' contents must the kernel read to find fish's inode number? (2) On how many directories must the kernel check execute (x) permission?</p>`,
    opts: ['(1) 4; (2) 3', '(1) 5; (2) 5', '(1) 4; (2) 4', '(1) 3; (2) 4'],
    ans: 2,
    exp: `<p>路徑解析一次走一層：讀 / 的內容找到 home → 讀 /home 找到 nini → 讀 /home/nini 找到 catfood → 讀 /home/nini/catfood 找到 fish(259)。共讀 <b>4</b> 個目錄。</p><p>要「穿過」一個目錄、在裡面查名字，就需要這個目錄的 x（search）權限。/、/home、/home/nini、/home/nini/catfood 四個都要穿過 → <b>4</b> 個（原答 3 錯：最後一層 catfood 也要 x 才能在裡面找到 fish）。fish 是檔案本身，open 檢查的是它的 r。</p>`,
    calc: { fn: 'pathWalk', path: '/home/nini/catfood/fish', expect: [4, 4] },
  },
  {
    id: 'w2-13a', week: W, topic: 'RSS：np.zeros 之後寫兩個元素', src: O('W2-13', 1), group: 'W2-13', type: 'fill',
    q: `<p>Page size is 4 KiB. The array below is 32 KiB (32 × 128 doubles, 8 bytes each, stored row by row). By how many KiB does the process's RSS grow because of this code?</p>${code(`
      a = np.zeros((32, 128))
      a[0, 0] = 1.0
      a[0, 1] = 2.0`)}`,
    ans: ['4', '4 KiB', '4KiB', '4 KB'],
    exp: `<p>np.zeros 只增加 VSZ（8 頁都指向共用的 zero page），不配 frame。一列 128 × 8 = 1024 bytes，a[0,0]、a[0,1] 都在第 0 列、byte 0 和 8 → 都在第一頁。只有 1 頁被寫、fault 1 次 → RSS 只增加 <b>4 KiB</b>（原答 32 錯）。</p>`,
    calc: { fn: 'pages', pageSize: 4096, offsets: [0, 8], unit: 'KiB' },
  },
  {
    id: 'w2-13b', week: W, topic: 'RSS：list、np.eye、random', src: O('W2-13', 1), group: 'W2-13', type: 'multi',
    q: `<p>Page size is 4 KiB. Each object below is 32 KiB (8 pages). Which ones make the process's RSS grow by the full 32 KiB?${ALL}</p>${code(`
      a = np.zeros((32, 128))      # then: a[0,0] = 1.0 ; a[0,1] = 2.0
      b = [0.0] * 4096             # a Python list of 4096 pointers
      c = np.eye(64)               # identity matrix, 98% zeros
      d = np.random.rand(32, 128)`)}`,
    opts: ['a', 'b', 'c', 'd'],
    ans: [1, 2, 3],
    exp: `<p>a：只寫到第一頁 → +4 KiB。</p><p>b：建立 list 時要把 4096 個指標（每個 8 bytes）實際寫進去 → 8 頁全碰 → +32 KiB（原答 0 錯）。</p><p>c：98% 是 0，但對角線<b>每一列</b>都寫了一個 1；一列 64 × 8 = 512 bytes，每頁有 8 列 → 每頁都有對角元素被寫 → +32 KiB。</p><p>d：每個元素都寫入亂數 → +32 KiB。</p><p>重點：RSS 看的是「哪些頁被寫過」，不是「資料是不是大多為 0」。</p>`,
  },
  {
    id: 'w2-14', week: W, topic: 'close 後重新 open：fd 編號與 offset', src: O('W2-14', 1), group: 'W2-14', type: 'single',
    q: `${code(`
      int fd = open("notes.txt", O_RDONLY);   // returns 4
      read(fd, buf, 200);
      close(fd);
      int again = open("notes.txt", O_RDONLY);
      read(again, &c, 1);`)}<p>notes.txt is longer than 1000 bytes. What is the value of ${c('again')}, and at which byte offset does the last ${c('read()')} start?</p>`,
    opts: ['again = 5; byte 200', 'again = 4; byte 200', 'again = 4; byte 0', 'again = 3; byte 199'],
    ans: 2,
    exp: `<p>第一次 open 拿到 4，表示 0–3 都在用。close(4) 之後 4 空出來，open 永遠拿「最小的可用編號」→ again = <b>4</b>。</p><p>每次 open() 都會建立一個<b>新的</b> open-file table entry，offset 從 0 開始。offset 屬於 open file entry，不屬於檔案本身，所以從 byte <b>0</b> 開始讀（原答 199 錯）。</p>`,
    cprog: 'w2_files w2-14', cexpect: '4 0',
  },
  {
    id: 'w2-15', week: W, topic: 'rm 一個仍被開著的檔案', src: O('W2-15', 1), group: 'W2-15', type: 'multi',
    q: `<p>Two programs each have ${c('/data/fish')} open (its link count is 1). Someone runs ${c('rm /data/fish')}. Which statements are true right after that?${ALL}</p>`,
    opts: [
      "While at least one program still has it open, you can copy the contents back out through that program's entry under /proc.",
      'The data blocks stay in use, because the number of programs holding the file open has not reached zero.',
      'The next read() in either program fails, because the path no longer leads anywhere.',
      'Running rm a second time would free the space.',
      'The directory no longer lists the name, so ls cannot show the file.',
      'Both programs can carry on reading. The chain from descriptor to open file entry to inode never uses the name.',
    ],
    ans: [0, 1, 4, 5],
    exp: `<p>rm = unlink：只把名字從目錄刪掉（所以 ls 看不到 ✓e），link count 變 0，但還有 open file 參照 inode，所以資料區塊保留 ✓b。fd → open file entry → inode 這條鏈從不經過名字，兩個程式照樣讀 ✓f。${c('cp /proc/PID/fd/N /data/fish')} 可以把內容救回來 ✓a。</p><p>(c) 錯：讀檔不需要路徑。(d) 錯：名字已經不在了，第二次 rm 會失敗（No such file），也不會釋放空間；要等兩個程式都關檔。</p>`,
  },
  {
    id: 'w2-16', week: W, topic: 'read() 回傳實際讀到的 byte 數', src: O('W2-16', 1), group: 'W2-16', type: 'fill',
    q: `<p>A file contains ${c('fish is tasty\\n')} (14 bytes). A program opens it and runs:</p>${code(`
      read(fd, buf, 4);        // buf gets "fish"
      read(fd, buf, 4);
      n = read(fd, buf, 8);`)}<p>What is n?</p>`,
    ans: ['6'],
    exp: `<p>第一次讀 "fish"（offset 0 → 4）、第二次讀 " is "（4 → 8）。剩 14 − 8 = 6 bytes（"tasty\\n"），要 8 只給 6 → n = <b>6</b>（原答 3 錯）。read() 回傳的是實際讀到的數量，可以比要求的少；再讀一次才會回傳 0（EOF）。</p>`,
    calc: { fn: 'readSeq', size: 14, reqs: [4, 4, 8], which: 2 },
    cprog: 'w2_files w2-16',
  },
  {
    id: 'w2-17-p1', week: W, topic: 'printf vs write 的輸出順序', src: O('W2-17 (P1)', 1), group: 'W2-17', type: 'fill',
    q: `<p>The program is run as ${c('./test > out.txt')}. What does out.txt contain afterwards? Type the words separated by single spaces, or ${c('empty')} if the file is empty.</p>${code(`
      printf("one ");
      write(1, "two ", 4);
      return 0;`)}`,
    ans: ['two one'],
    exp: `<p>導向檔案 → stdout fully buffered。printf 把 "one " 放進 libc buffer；write 是 system call，"two " 立刻進 kernel。return 時 libc 才把 "one " flush 出去，所以排在後面：<b>two one</b>（原答 one two 錯）。</p>`,
    cprog: 'w2_buffers p1',
  },
  {
    id: 'w2-17-p2', week: W, topic: 'printf + fflush + write', src: O('W2-17 (P2)'), group: 'W2-17', type: 'fill',
    q: `<p>The program is run as ${c('./test > out.txt')}. What does out.txt contain afterwards? Type the words separated by single spaces, or ${c('empty')} if the file is empty.</p>${code(`
      printf("one ");
      fflush(stdout);
      write(1, "two ", 4);
      return 0;`)}`,
    ans: ['one two'],
    exp: `<p>fflush(stdout) 讓 libc 立刻用 write() 把 "one " 交給 kernel，之後 write 的 "two " 才進去 → <b>one two</b>。</p>`,
    cprog: 'w2_buffers p2',
  },
  {
    id: 'w2-17-p3', week: W, topic: 'printf + write + crash', src: O('W2-17 (P3)'), group: 'W2-17', type: 'fill',
    q: `<p>The program is run as ${c('./test > out.txt')}. What does out.txt contain afterwards? Type the words separated by single spaces, or ${c('empty')} if the file is empty.</p>${code(`
      printf("one ");
      write(1, "two ", 4);
      *(int *)0 = 1;      // crash`)}`,
    ans: ['two'],
    exp: `<p>"two " 已經用 write 進了 kernel，程式 crash 也不影響。"one " 還在 libc buffer 裡，crash（SIGSEGV）時程式直接被終止，不會 flush → 消失。結果只有 <b>two</b>。</p>`,
    cprog: 'w2_buffers p3',
  },
  {
    id: 'w2-17-p4', week: W, topic: 'write + printf + crash', src: O('W2-17 (P4)'), group: 'W2-17', type: 'fill',
    q: `<p>The program is run as ${c('./test > out.txt')}. What does out.txt contain afterwards? Type the words separated by single spaces, or ${c('empty')} if the file is empty.</p>${code(`
      write(1, "one ", 4);
      printf("two ");
      *(int *)0 = 1;      // crash`)}`,
    ans: ['one'],
    exp: `<p>"one " 由 write 直接進 kernel；"two " 在 libc buffer 裡，crash 時跟著消失 → <b>one</b>。</p>`,
    cprog: 'w2_buffers p4',
  },
  {
    id: 'w2-18', week: W, topic: 'printf 到磁碟的路徑、page cache', src: O('W2-18'), group: 'W2-18', type: 'single',
    q: `<p>The four stages below are listed out of order:</p><p>P. The data enters the kernel's page cache, and the affected pages are marked dirty.<br>Q. The C library copies the data into a buffer in the program's own memory.<br>R. The operating system later writes the dirty pages to the disk.<br>S. When the buffer is flushed, a system call sends the data to the kernel.</p><p>What is the correct order for data written with ${c('printf()')} to reach the disk, and which stage does a direct call to ${c('write()')} skip?</p>`,
    opts: ['Q → S → P → R; write() skips Q', 'Q → P → S → R; write() skips Q', 'S → Q → P → R; write() skips S', 'Q → S → P → R; write() skips R'],
    ans: 0,
    exp: `<p>printf → 複製到 libc buffer（Q）→ flush 時用 write() system call 交給 kernel（S）→ 進 page cache、標成 dirty（P）→ OS 之後批次寫回磁碟（R）。</p><p>直接呼叫 write() 就是那個 system call 本身，跳過的是 libc buffer（Q）。page cache 和之後寫回磁碟仍然會發生；要立刻落盤必須呼叫 fsync()。</p>`,
  },
  {
    id: 'w2-19a', week: W, topic: '碰觸頁面與 frame 數', src: O('W2-19', 1), group: 'W2-19', type: 'fill',
    q: `<p>Page size is 4096 bytes. A program maps 64 KiB (16 pages) that it has not touched yet. It then writes one byte at each of these offsets, in order: 0, 100, 20000, 65000. After all four writes, how many physical frames does this region use?</p>`,
    ans: ['3'],
    exp: `<p>頁號 = offset ÷ 4096 取整數：0 → 第 0 頁、100 → 第 0 頁、20000 → 第 4 頁、65000 → 第 15 頁。前兩次都在第 0 頁（此時只有 1 個 frame）；四次寫完共碰了 0、4、15 三頁 → <b>3</b> 個 frame。frame 數只看碰到幾個「不同的頁」，跟 offset 數字大小無關（原答 21275 錯）。</p>`,
    calc: { fn: 'pages', pageSize: 4096, offsets: [0, 100, 20000, 65000], unit: 'count' },
  },
  {
    id: 'w2-19b', week: W, topic: '碰觸頁面與 RSS', src: O('W2-19', 1), group: 'W2-19', type: 'fill',
    q: `<p>Page size is 4096 bytes. A program maps 64 KiB (16 pages), untouched, and then writes one byte at offsets 0, 100, 20000 and 65000. Finally it writes one more byte at offset 20400. What is this region's RSS now, in KiB?</p>`,
    ans: ['12', '12 KiB', '12KiB'],
    exp: `<p>0、100 → 第 0 頁；20000 → 第 4 頁；65000 → 第 15 頁；20400 ÷ 4096 = 4.98 → 也是第 4 頁，已經有 frame 了，不會再配新的。所以仍是 3 個 frame × 4 KiB = <b>12 KiB</b>（原答 64 錯：RSS 不是整個 mapping 的大小，而是有 frame 的頁）。</p>`,
    calc: { fn: 'pages', pageSize: 4096, offsets: [0, 100, 20000, 65000, 20400], unit: 'KiB' },
  },
  {
    id: 'w2-20', week: W, topic: 'Overcommit：notebook server', src: O('W2-20'), group: 'W2-20', type: 'single',
    q: `<p>A server has 512 GiB of DRAM. Each user's notebook is allowed up to 16 GiB, but measurements show an average RSS of 1 GiB per notebook. (1) If every notebook really used its full 16 GiB, at most how many notebooks fit in DRAM? (2) Using the 1 GiB average instead, about how many times more notebooks can run?</p>`,
    opts: ['(1) 32; (2) about 16 times more', '(1) 32; (2) about 512 times more', '(1) 16; (2) about 32 times more', '(1) 512; (2) about 16 times more'],
    ans: 0,
    exp: `<p>(1) 512 ÷ 16 = <b>32</b> 個。(2) 以平均 RSS 1 GiB 計可以放約 512 個，512 ÷ 32 = <b>16</b> 倍。這就是 overcommit：答應給的（上限 / VSZ）遠多於實際用掉的（RSS）。</p>`,
    calc: { fn: 'overcommit', dram: 512, limit: 16, avg: 1, expect: [32, 16] },
  },
  {
    id: 'w2-21', week: W, topic: 'VSZ 遠大於 DRAM', src: O('W2-21'), group: 'W2-21', type: 'single',
    q: `<p>An online judge runs 10,000 submissions on one server. The dashboard shows: total VSZ = 120,000 GiB, DRAM = 512 GiB, total RSS = 310 GiB. How can the total VSZ be so much larger than DRAM?</p>`,
    opts: [
      'The OS compresses untouched memory.',
      'Allocating a page grows VSZ only. A page takes a DRAM frame only when it is touched.',
      'The dashboard has an error; VSZ can never exceed DRAM.',
      '120,000 GiB is the total over all servers, not this one.',
    ],
    ans: 1,
    exp: `<p>VSZ 算的是「map 了多少頁」，RSS 算的是「有 DRAM frame 的頁」。配置只增加 VSZ，只有被 touch 的頁才拿 frame，所以 VSZ 加總可以遠超 DRAM，真正要跟 DRAM 比的是 RSS（310 GiB &lt; 512 GiB）。</p>`,
  },
  {
    id: 'w2-22', week: W, topic: '什麼事件會 flush stdout buffer', src: O('W2-22'), group: 'W2-22', type: 'multi',
    q: `<p>A program runs as ${c('./test > out.txt')}. Its stdout buffer currently holds 11 bytes. Which of the following events send those bytes to the kernel?${ALL}</p>`,
    opts: [
      'The program crashes from an invalid memory access',
      'The program calls fflush(stdout)',
      'The program keeps printing until the buffer is full',
      'The program prints nothing for 30 seconds',
      'The program returns from main normally',
      'The program calls exit()',
    ],
    ans: [1, 2, 4, 5],
    exp: `<p>libc 只在三種時機把 buffer 交給 kernel：buffer 滿了、呼叫 fflush()、程式正常結束（從 main return 或呼叫 exit()，exit 會先 flush 所有 stdio stream）。</p><p>crash（SIGSEGV）時程式直接被 kernel 終止，buffer 跟著消失；也沒有「閒置多久自動 flush」這回事。注意 ${c('_exit()')} 不會 flush，${c('exit()')} 會。</p>`,
    cprog: 'w2_buffers w2-22-*', cexpect: 'fflush,full,return,exit',
  },

  // ===================== 變化題 =====================
  {
    id: 'w2-v01a', week: W, topic: 'VSZ / RSS：只寫一半、每頁一個 byte', src: V('W2-01', 1), group: 'W2-01', type: 'fill',
    q: `<p>A C program calls ${c('char *p = malloc(6UL << 30);')} (6 GiB). ${c('ps')} now shows VSZ 6.3 GiB and RSS 0.3 GiB. The program then writes one byte into every 4 KiB page of the <b>first half</b> of the buffer:</p>${code(`
      for (size_t i = 0; i < (3UL << 30); i += 4096)
          p[i] = 1;`)}<p>About how large is RSS now, in GiB?</p>`,
    ans: ['3.3', '3.3 GiB', '3.3GiB'],
    exp: `<p>malloc 6 GiB 只增加 VSZ（這麼大的 malloc 由 mmap 配置，頁都還沒有 frame）。迴圈在前 3 GiB 的<b>每一頁</b>各寫 1 byte：一頁只要被寫到一次，整頁就拿到一個 4 KiB frame → 前 3 GiB 全部有 frame → RSS ≈ 0.3 + 3 = <b>3.3 GiB</b>。後 3 GiB 沒碰，仍然沒有 frame；VSZ 不變。</p><p>常見錯誤：以為每頁只寫 1 byte，RSS 只會多幾 MB。frame 是以「頁」為單位配的。</p>`,
    calc: { fn: 'rssAfterTouch', base: 0.3, touched: 3 },
  },
  {
    id: 'w2-v01b', week: W, topic: 'VSZ / RSS：寫入 0 也算寫入', src: V('W2-01', 1), group: 'W2-01', type: 'fill',
    q: `<p>${c('a = np.zeros(512 * 1024 * 1024)')} creates a 4 GiB array of doubles. Right after this, VSZ is 4.1 GiB and RSS is 0.1 GiB. The script then stores 0.0 into every element:</p>${code(`
      for i in range(a.size):
          a[i] = 0.0`)}<p>The array's values never change. About how large is RSS after the loop, in GiB?</p>`,
    ans: ['4.1', '4.1 GiB', '4.1GiB'],
    exp: `<p>kernel 不會檢查你寫的值是不是 0。只要對指向 zero page 的頁做「寫入」，就違反唯讀權限 → page fault → kernel 配一個新的 frame。每一頁都被寫過 → 4 GiB 全部拿到 frame → RSS ≈ 0.1 + 4 = <b>4.1 GiB</b>。</p><p>值沒有變，記憶體用量卻變了：RSS 只看「有沒有被寫」，不看「寫了什麼」。</p>`,
    calc: { fn: 'rssAfterTouch', base: 0.1, touched: 4 },
  },
  {
    id: 'w2-v08a', week: W, topic: 'printf 緩衝：終端機是 line-buffered', src: V('W2-08', 1), group: 'W2-08', type: 'fill',
    q: `<p>${c('./test')} is run in a terminal (no redirection). It has executed:</p>${code(`
      printf("hello\\n");
      printf("world");`)}<p>and is now sleeping. How many bytes are waiting in the C library's stdout buffer?</p>`,
    ans: ['5'],
    exp: `<p>stdout 是終端機時是 <b>line-buffered</b>：遇到 \\n 就 flush。"hello\\n" 已經用 write() 送出、出現在畫面上；"world" 沒有換行，還留在 buffer → <b>5</b> bytes。</p><p>對照原題：導向檔案時是 fully buffered，換行也不會 flush，全部都會留在 buffer。（已用 pty 實測。）</p>`,
    cprog: 'w2_buffers v08a',
  },
  {
    id: 'w2-v08b', week: W, topic: 'printf 緩衝：fflush 之後的檔案大小', src: V('W2-08', 1), group: 'W2-08', type: 'fill',
    q: `<p>A program runs as ${c('./test > out.txt')} and has executed:</p>${code(`
      printf("hello ");
      fflush(stdout);
      printf("world");`)}<p>It has not exited yet. What file size, in bytes, does ${c('ls -l out.txt')} show at this moment?</p>`,
    ans: ['6'],
    exp: `<p>fflush 讓 libc 立刻用 write() 把 "hello "（6 bytes）交給 kernel → 檔案大小 <b>6</b>。之後的 "world" 還在 libc buffer，沒進 kernel。程式正常結束時才會變成 11 bytes；若此時 crash，檔案就停在 6 bytes。</p>`,
    cprog: 'w2_buffers v08b',
  },
  {
    id: 'w2-v11a', week: W, topic: 'PATH 對了，但沒有 x 權限', src: V('W2-11', 1), group: 'W2-11', type: 'single',
    q: `<p>niko's PATH is now ${c('/home/niko/bin:/usr/local/bin:/usr/bin:/bin')}. The file ${c('/home/niko/bin/greet')} exists, but its permissions are ${c('-rw-r--r--')}. Typing ${c('greet')} fails. Which single change lets niko run it by typing ${c('greet')}?</p>`,
    opts: [
      'Add /home/niko/bin to PATH again in ~/.bashrc',
      `Run ${c('chmod +x /home/niko/bin/greet')}`,
      `${c('cd /home/niko/bin')} first, then type ${c('greet')}`,
      'Rename the file to greet.sh',
    ],
    ans: 1,
    exp: `<p>這次 PATH 已經包含 /home/niko/bin，問題變成檔案沒有執行權限：shell 找到的檔案必須有 x 才能 exec（bash 會回報 Permission denied）。${c('chmod +x')} 加上權限即可。</p><p>(a) PATH 本來就對；(c) 換目錄無關，而且 shell 不搜尋目前目錄；(d) 副檔名在 Unix 沒有意義。對照原題：原題是「有 x 但不在 PATH」，這題是「在 PATH 但沒有 x」。</p>`,
  },
  {
    id: 'w2-v11b', week: W, topic: '有斜線就不搜尋 PATH', src: V('W2-11', 1), group: 'W2-11', type: 'multi',
    q: `<p>PATH is ${c('/usr/local/bin:/usr/bin:/bin')} (it does not contain /home/niko/bin), and ${c('/home/niko/bin/greet')} is ${c('-rwxr-xr-x')}. niko's home directory is /home/niko. Which of these commands run the program?${ALL}</p>`,
    opts: [
      `In /home/niko/bin: ${c('greet')}`,
      `In /home/niko/bin: ${c('./greet')}`,
      `In /home/niko: ${c('bin/greet')}`,
      `In any directory: ${c('~/bin/greet')}`,
      `In /home/niko: ${c('greet')}`,
    ],
    ans: [1, 2, 3],
    exp: `<p>指令名稱裡只要有斜線（/），shell 就把它當成路徑直接 exec，不搜尋 PATH：${c('./greet')}、${c('bin/greet')}（相對於目前目錄）、${c('~/bin/greet')}（shell 先把 ~ 展開成 /home/niko）都可以。</p><p>沒有斜線的 ${c('greet')} 才會搜尋 PATH；PATH 裡沒有 /home/niko/bin，也沒有「.」，所以不管在哪個目錄打都找不到。</p>`,
  },
  {
    id: 'w2-v12a', week: W, topic: '路徑解析：要檢查幾個目錄的 x', src: V('W2-12', 1), group: 'W2-12', type: 'fill',
    q: `<p>Nothing is cached. A program calls ${c('open("/srv/www/site/img/logo.png", O_RDONLY)')}. On how many directories must the kernel check execute (x) permission while resolving this path?</p>`,
    ans: ['5'],
    exp: `<p>要穿過的目錄：/、/srv、/srv/www、/srv/www/site、/srv/www/site/img，共 <b>5</b> 個。每穿過一個目錄都要它的 x 權限，也要讀它的內容找下一個名字。logo.png 是檔案本身，檢查的是 r（O_RDONLY），不是 x。</p><p>規則：絕對路徑有 k 個名字時，要穿過 k 個目錄（/ 加上前 k−1 個名字）。</p>`,
    calc: { fn: 'pathWalk', path: '/srv/www/site/img/logo.png' },
  },
  {
    id: 'w2-v12b', week: W, topic: '路徑解析：相對路徑', src: V('W2-12', 1), group: 'W2-12', type: 'fill',
    q: `<p>A process's current working directory is /home/nini (its inode is already known). Nothing else is cached. It calls ${c('open("catfood/fish", O_RDONLY)')} with a relative path. How many directories' contents must the kernel read to find fish's inode number?</p>`,
    ans: ['2'],
    exp: `<p>相對路徑從 cwd 開始解析，不從 / 開始：讀 /home/nini 的內容找到 catfood → 讀 /home/nini/catfood 的內容找到 fish → <b>2</b> 個（也要在這 2 個目錄上檢查 x）。/ 和 /home 不用再走一次。</p>`,
    calc: { fn: 'pathWalk', path: 'catfood/fish' },
  },
  {
    id: 'w2-v13a', week: W, topic: 'RSS：np.zeros 之後寫三個位置', src: V('W2-13', 1), group: 'W2-13', type: 'fill',
    q: `<p>Page size is 4 KiB. ${c('a = np.zeros((64, 128))')} is a 64 KiB array of doubles (8 bytes each, stored row by row; assume it starts at a page boundary). The script then runs:</p>${code(`
      a[0, 0] = 1.0
      a[31, 0] = 1.0
      a[63, 127] = 1.0`)}<p>By how many KiB does RSS grow?</p>`,
    ans: ['12', '12 KiB', '12KiB'],
    exp: `<p>一列 128 × 8 = 1024 bytes，一頁放 4 列。a[0,0] 在 byte 0 → 第 0 頁；a[31,0] 在 31 × 1024 = 31744 → 第 7 頁；a[63,127] 在 63 × 1024 + 127 × 8 = 65528 → 第 15 頁。三個不同的頁 → 3 × 4 = <b>12 KiB</b>，其他 13 頁仍指向 zero page。</p>`,
    calc: { fn: 'pages', pageSize: 4096, offsets: [0, 31744, 65528], unit: 'KiB' },
  },
  {
    id: 'w2-v13b', week: W, topic: 'RSS：np.eye 換成 1024 × 1024', src: V('W2-13', 1), group: 'W2-13', type: 'fill',
    q: `<p>Page size is 4 KiB. ${c('c = np.eye(1024)')} creates a 1024 × 1024 identity matrix of doubles: 8 MiB in total, stored row by row (assume it starts at a page boundary). np.eye first allocates zeros and then writes 1.0 on the diagonal. By how many KiB does RSS grow?</p>`,
    ans: ['4096', '4096 KiB', '4096KiB'],
    exp: `<p>一列 1024 × 8 = 8192 bytes = <b>2 頁</b>。第 i 列的對角元素在該列內的 byte i × 8：i &lt; 512 時落在該列的第 1 頁，i ≥ 512 時落在第 2 頁 → 每一列只碰到 2 頁中的 1 頁 → 1024 頁 × 4 KiB = <b>4096 KiB</b>（4 MiB，剛好一半）。</p><p>對照原題 np.eye(64)：一列只有 512 bytes、每頁 8 列，所以每頁都被碰到。換一個數字，答案就從「全部」變成「一半」。</p>`,
    calc: { fn: 'eye', n: 1024, pageSize: 4096, elem: 8 },
  },
  {
    id: 'w2-v14', week: W, topic: 'dup 出來的 fd 共用 offset', src: V('W2-14', 1), group: 'W2-14', type: 'fill',
    q: `${code(`
      int fd  = open("notes.txt", O_RDONLY);   // returns 3
      int fd2 = dup(fd);                        // returns 4
      read(fd, buf, 200);
      read(fd2, &c, 1);`)}<p>notes.txt is longer than 1000 bytes. At which byte offset does ${c('read(fd2, &c, 1)')} start?</p>`,
    ans: ['200'],
    exp: `<p>dup 不會建立新的 open file entry，只是在 fd table 多一格指向<b>同一個</b> entry → 共用 offset。fd 讀了 200 bytes，offset 變 200，fd2 接著從 <b>200</b> 讀。</p><p>對照原題：close 之後重新 open 會建立新的 entry，offset 從 0 開始。</p>`,
    cprog: 'w2_files v14',
  },
  {
    id: 'w2-v15a', week: W, topic: 'rm 之後建立同名新檔', src: V('W2-15', 1), group: 'W2-15', type: 'single',
    q: `<p>A program opened ${c('/tmp/secret.txt')} (link count 1) and has read its first 10 bytes. Someone runs ${c('rm /tmp/secret.txt')} and then creates a new, different file with the same name ${c('/tmp/secret.txt')}. The program now calls ${c('read()')} on its old descriptor. What does it get?</p>`,
    opts: [
      "The next bytes of the old file's contents",
      'The beginning of the new file',
      'An error (ENOENT), because the old name was removed',
      '0 (end of file), because the file was deleted',
    ],
    ans: 0,
    exp: `<p>程式手上的鏈是 fd → open file entry → <b>舊的 inode</b>，跟名字無關。rm 只刪名字；新檔案雖然同名，卻是另一個 inode。舊 inode 還被開著，所以還在，read 從 offset 10 繼續讀舊內容。</p>`,
  },
  {
    id: 'w2-v15b', week: W, topic: 'rm 之後哪些操作還能用', src: V('W2-15', 1), group: 'W2-15', type: 'multi',
    q: `<p>A program opened ${c('/data/fish')} with ${c('O_RDWR')} (link count 1). Someone runs ${c('rm /data/fish')}. The program is still running. Which of the following still work?${ALL}</p>`,
    opts: [
      "The program's read() on its descriptor",
      "The program's write() on its descriptor",
      c('ls /data/fish'),
      `Another program calling ${c('open("/data/fish", O_RDONLY)')}`,
      `${c('cat /proc/<PID>/fd/<N>')} to see the contents`,
    ],
    ans: [0, 1, 4],
    exp: `<p>開著的 fd 照樣能讀寫（a、b ✓）；資料區塊留到最後一個 open file 關掉為止。/proc/PID/fd/N 是指向那個 inode 的連結，可以把內容讀出來（e ✓，${c('ls -l')} 會顯示 (deleted)）。</p><p>名字已經從目錄刪掉：ls 找不到（c ✗），任何「透過路徑」的 open 都會 ENOENT（d ✗）。</p>`,
  },
  {
    id: 'w2-v16', week: W, topic: 'read() 回傳值：換檔案長度', src: V('W2-16', 1), group: 'W2-16', type: 'fill',
    q: `<p>A file contains ${c('hello, world\\n')} (13 bytes). A program opens it and runs:</p>${code(`
      read(fd, buf, 5);
      read(fd, buf, 5);
      n = read(fd, buf, 5);`)}<p>What is n?</p>`,
    ans: ['3'],
    exp: `<p>前兩次各讀 5 bytes（offset 0 → 5 → 10），剩 13 − 10 = 3 bytes（"ld\\n"）→ n = <b>3</b>。再讀一次才會回傳 0（EOF）。</p>`,
    calc: { fn: 'readSeq', size: 13, reqs: [5, 5, 5], which: 2 },
    cprog: 'w2_files v16',
  },
  {
    id: 'w2-v17a', week: W, topic: 'write / printf / write 的順序', src: V('W2-17', 1), group: 'W2-17', type: 'fill',
    q: `<p>The program is run as ${c('./test > out.txt')}. What does out.txt contain afterwards? Type the words separated by single spaces, or ${c('empty')} if the file is empty.</p>${code(`
      write(1, "one ", 4);
      printf("two ");
      write(1, "three ", 6);
      return 0;`)}`,
    ans: ['one three two'],
    exp: `<p>兩個 write 都是 system call，立刻依序進 kernel：one、three。printf 的 "two " 待在 libc buffer，直到 return 才 flush → <b>one three two</b>。</p>`,
    cprog: 'w2_buffers v17a',
  },
  {
    id: 'w2-v17b', week: W, topic: 'stderr 不緩衝，crash 也留得住', src: V('W2-17', 1), group: 'W2-17', type: 'fill',
    q: `<p>The program is run as ${c('./test > out.txt 2>&1')}, so stdout and stderr both go to out.txt. What does out.txt contain afterwards? Type the words separated by single spaces, or ${c('empty')}.</p>${code(`
      fprintf(stderr, "one ");
      printf("two ");
      write(1, "three ", 6);
      *(int *)0 = 1;      // crash`)}`,
    ans: ['one three'],
    exp: `<p>stderr 是 <b>unbuffered</b>：fprintf(stderr, …) 立刻 write 進 kernel → one。printf 的 "two " 在 stdout 的 buffer（導向檔案 → fully buffered）。write 立刻寫入 three。crash 時 stdout buffer 消失 → <b>one three</b>。</p><p>這就是除錯訊息要印到 stderr 的原因：即使程式下一行就 crash，訊息也不會丟。</p>`,
    cprog: 'w2_buffers v17b',
  },
  {
    id: 'w2-v19', week: W, topic: '碰觸頁面：換成 16 KiB 的頁', src: V('W2-19', 1), group: 'W2-19', type: 'fill',
    q: `<p>A machine uses 16 KiB (16384-byte) pages. A program maps 64 KiB (4 pages) that it has not touched yet, then writes one byte at offsets 0, 100, 20000 and 65000. What is this region's RSS now, in KiB?</p>`,
    ans: ['48', '48 KiB', '48KiB'],
    exp: `<p>頁號 = offset ÷ 16384 取整數：0、100 → 第 0 頁；20000 → 第 1 頁；65000 → 第 3 頁。3 個不同的頁 × 16 KiB = <b>48 KiB</b>。</p><p>同樣的 offset，頁變大後頁號跟著變，RSS 也跟著變（4 KiB 頁時是 3 頁 = 12 KiB）。</p>`,
    calc: { fn: 'pages', pageSize: 16384, offsets: [0, 100, 20000, 65000], unit: 'KiB' },
  },
];
