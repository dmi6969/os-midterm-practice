// 第二回 · Week 2：OS 目標、user-facing vs batch、隔離、fd / open file / inode、unlink、VSZ / RSS、page cache、printf vs write、權限、PATH
const { code, c, ALL } = require('../lib');
const W = 'W2';
const V = (n) => `變化題（源自 ${n}）`;
const N = (part) => `新題（依講義 W2 ${part}）`;

module.exports = [
  {
    id: 's2-w2-01', week: W, topic: 'OS 擋得住的錯：權限與 sandbox', src: N('Part 1'), group: 's2-W2-goal', type: 'single',
    q: `<p>In July 2025 an AI coding agent ran a command that dropped a company's production database. It ran with exactly the same permissions as the engineer who launched it. Which change would have prevented the damage most directly?</p>`,
    opts: [
      'Use a larger AI model that makes fewer mistakes',
      'Run the agent as a separate, less-privileged user inside a sandbox',
      'Give the agent root so that it can undo its own mistakes',
      'Move the database to a faster disk',
    ],
    ans: 1,
    exp: `<p>程式語言和模型都擋不住它，因為它擁有跟工程師一樣的權限。OS 能強制執行的是<b>權限與隔離</b>：讓 agent 以另一個權限較低的使用者、在 sandbox 裡執行，它就碰不到 production database。這是講義說的四個 production 問題之一：security（只碰得到被允許的東西）。給它 root 只會更糟。</p>`,
  },
  {
    id: 's2-w2-02', week: W, topic: '為什麼重開機能修好大部分問題', src: N('Part 2'), group: 's2-W2-goal', type: 'single',
    q: `<p>Why does rebooting fix most OS crashes, and why did rebooting <b>not</b> fix the machines hit by the 2024 CrowdStrike update?</p>`,
    opts: [
      'A reboot installs a newer kernel; the CrowdStrike machines had no network connection',
      "A reboot throws away all in-memory state and rebuilds it from disk; CrowdStrike's bad file was on disk, so every boot crashed again",
      "A reboot erases the disk caches; CrowdStrike's bug lived only in RAM",
      "A reboot resets the CPU clock; CrowdStrike's bug depended on the date",
    ],
    ans: 1,
    exp: `<p>重開機會丟掉所有記憶體中的狀態、從磁碟上的副本重建。大部分 bug 弄壞的是記憶體，不是磁碟，所以重開就好了。CrowdStrike 麻煩在壞掉的設定檔在<b>磁碟</b>上，每次開機 kernel driver 又讀到它又當機（boot loop），直到有人手動刪掉那個檔案。</p>`,
  },
  {
    id: 's2-w2-03', week: W, topic: 'Kernel-mode driver 當機', src: N('Part 2'), group: 's2-W2-goal', type: 'single',
    q: `<p>An out-of-bounds memory read in an ordinary program usually just ends that one program. Why did the same kind of bug in CrowdStrike's Falcon sensor take down about 8.5 million Windows machines?</p>`,
    opts: [
      'The sensor is a driver that runs inside the kernel, so the bug corrupted the kernel itself and nothing at a higher privilege level could contain it',
      'The sensor ran as root, and root processes are not protected by virtual memory',
      'All 8.5 million machines shared one copy of the sensor over the network',
      'Windows cannot kill a program that reads memory out of bounds',
    ],
    ans: 0,
    exp: `<p>Falcon sensor 是跑在 Windows kernel 裡的 <b>driver</b>（kernel mode）。一般程式 out-of-bounds 只會被 kernel 終止那個 process；kernel mode 的程式出錯則是 kernel 自己壞了，沒有更高權限的元件能把它隔離起來 → 整台機器當掉（藍屏）。這跟 root 無關：root 仍是 user mode。</p>`,
  },
  {
    id: 's2-w2-04', week: W, topic: 'iPhone 為什麼跑好幾個 OS', src: N('Part 3'), group: 's2-W2-goal', type: 'multi',
    q: `<p>An iPhone runs several small operating systems on separate chips (for example sepOS on the Secure Enclave and RTKit on the Always-On Processor) instead of letting iOS do everything. Which reasons are correct?${ALL}</p>`,
    opts: [
      'If iOS is compromised, Face ID data and payment keys handled by the other chips can stay protected',
      'The low-power processor can listen for "Hey Siri" while iOS sleeps, which saves battery',
      'iOS is too slow to compare two face images',
      'Apple has to license each OS separately, so splitting them is cheaper',
    ],
    ans: [0, 1],
    exp: `<p>兩個理由：<b>安全</b>——每個子系統在自己的小 OS 上，iOS 被駭也拿不到 Secure Enclave（Face ID）和 Secure Element（Apple Pay）的秘密；<b>省電</b>——聽「Hey Siri」的處理器要一直醒著，用很小的 OS 就能讓 iOS 睡覺。跟 iOS 速度、授權費無關。</p>`,
  },
  {
    id: 's2-w2-05', week: W, topic: 'Tail at scale：fan-out 放大尾端延遲', src: N('Part 3 Machine sharing'), group: 's2-W2-qos', type: 'fill',
    q: `<p>Each backend server answers 1 request in 100 slowly. Loading one web page needs answers from 20 servers, and the page is slow if <b>any</b> of them is slow. About what percentage of page loads are slow? (Round to the nearest whole percent; type just the number.)</p>`,
    ans: ['18', '18%', '18.2'],
    exp: `<p>20 台都快的機率 = 0.99²⁰ ≈ 0.818，所以至少碰到一台慢的機率 = 1 − 0.818 ≈ <b>18%</b>。講義的例子是 100 台：1 − 0.99¹⁰⁰ ≈ 63%。fan-out 越多，尾端延遲被放大得越嚴重——這就是 SLO 要用百分位數的原因。</p>`,
    calc: { fn: 'tail', p: 0.01, n: 20 },
  },
  {
    id: 's2-w2-06', week: W, topic: 'SLO 為什麼用百分位數', src: N('Part 3 Machine sharing'), group: 's2-W2-qos', type: 'single',
    q: `<p>Why does a site reliability engineer write the objective as "99% of requests are answered within 100 ms" instead of "the average latency is below 50 ms"?</p>`,
    opts: [
      'Percentiles are cheaper to compute than averages',
      'An average can look fine while a slow tail of requests, which real users hit, is hidden; fan-out makes that tail even more common',
      'Averages cannot be computed for latencies measured in milliseconds',
      'Batch jobs are measured with percentiles, so serving jobs must be too',
    ],
    ans: 1,
    exp: `<p>平均值會掩蓋少數很慢的 request（corner case），但使用者感受到的正是那些慢的。一個網頁要等很多台 server，只要一台慢整頁就慢，所以要用百分位數（p99）直接管住尾端。</p>`,
  },
  {
    id: 's2-w2-07', week: W, topic: 'Borg 的 overcommit 與 colocation', src: N('Part 3 Machine sharing'), group: 's2-W2-qos', type: 'multi',
    q: `<p>Which statements about Google's cluster scheduler Borg (as described in the lecture) are true?${ALL}</p>`,
    opts: [
      'User-facing jobs are allocated about 70% of the CPU but use only about 60%',
      'Borg lends the unused part of that allocation to batch jobs',
      'When a machine nears its limit, Borg throttles or kills user-facing jobs first',
      'Running both kinds of work on the same machines saves an estimated 20–30% of hardware',
      'Batch jobs are never killed',
    ],
    ans: [0, 1, 3],
    exp: `<p>user-facing 工作分到約 70% CPU、實際只用約 60%（保留突發用量）。Borg 把沒用到的部分拿去跑 batch，比分開兩批機器省 20–30% 硬體。代價是：機器快滿時 Borg 會 throttle 或 kill <b>batch</b>，從不動 user-facing——所以「先砍 user-facing」和「batch 從不被殺」都錯。</p>`,
  },
  {
    id: 's2-w2-08', week: W, topic: 'User-facing 的指標', src: V('W2-03'), group: 's2-W2-qos', type: 'multi',
    q: `<p>A video-streaming company runs a user-facing playback service and a nightly batch job that turns viewing logs into recommendations. Which metrics belong to the <b>user-facing</b> service?${ALL}</p>`,
    opts: [
      'The fraction of play requests that get an answer at all',
      'The 99th-percentile time from tapping play until the video starts',
      'Play requests handled per second',
      'Terabytes of viewing logs processed per hour',
      'How long the nightly recommendation job takes from start to finish',
    ],
    ans: [0, 1, 2],
    exp: `<p>user-facing serving 看 <b>availability</b>（回不回得了）、<b>latency</b>（多快回，用百分位數）、<b>throughput</b>（每秒幾個 request）。batch 看 throughput（每小時處理多少資料）和 end-to-end latency（整批跑多久）。同一個詞（throughput、latency）在兩邊意思不同。</p>`,
  },
  {
    id: 's2-w2-09', week: W, topic: '隔離層級：需要自己的 kernel', src: V('W2-04'), group: 's2-W2-iso', type: 'single',
    q: `<p>A course wants each student to have a machine on which the student can load their own kernel modules and even boot a different kernel version, without affecting other students. Which isolation level is needed?</p>`,
    opts: ['A separate process for each student', 'A container for each student', 'A virtual machine for each student', 'A separate user account for each student'],
    ans: 2,
    keep: true,
    exp: `<p>process 和 container 都<b>共用同一個 OS kernel</b>，所以不能換 kernel、也不能各自載 kernel module。只有 VM 裡面有自己完整的 OS（自己的 kernel），和別人只共用硬體（由 hypervisor 切分）。代價是最高的：每個 VM 都要多跑一整個 OS。</p>`,
  },
  {
    id: 's2-w2-10', week: W, topic: 'Process 層級的隔離（PTT）', src: V('W2-04'), group: 's2-W2-iso', type: 'single',
    q: `<p>PTT gives every logged-in user a process of their own on one Linux machine. What do these users' processes still share with each other?</p>`,
    opts: ['Their private memory', 'The operating system and the file system', 'Nothing at all', 'A hypervisor that splits the hardware'],
    ans: 1,
    exp: `<p>process 層級：每個人有自己的私有記憶體和公平的 CPU 時間，但<b>共用 OS 和檔案系統</b>（靠 Linux 的權限機制隔開）。幾乎不花成本，所以一台機器能撐十幾萬人同時上線。container 只共用 OS；VM 只共用硬體。</p>`,
  },
  {
    id: 's2-w2-11', week: W, topic: 'Container 拿到什麼', src: V('W2-04'), group: 's2-W2-iso', type: 'multi',
    q: `<p>Compared with a plain process, what does a container get of its own?${ALL}</p>`,
    opts: ['Its own view of the file system', 'Its own CPU and memory limits', 'Its own identity (users and process IDs)', 'Its own kernel', 'Its own physical hardware'],
    ans: [0, 1, 2],
    exp: `<p>container = 一群 process，有自己的身分、自己看到的檔案系統、自己的 CPU / 記憶體上限，但仍<b>共用 host 的 kernel</b>。要有自己的 kernel 得用 VM；VM 也只是共用硬體，不是獨佔硬體。</p>`,
  },
  {
    id: 's2-w2-12', week: W, topic: 'open 拿最小的可用 fd', src: V('W2-14'), group: 's2-W2-fd', type: 'fill',
    q: `<p>A process starts with fds 0, 1 and 2 open. It opens a.txt, b.txt and c.txt, in that order, then closes b.txt, then closes a.txt, and then opens d.txt and e.txt, in that order. What fd number does e.txt get?</p>`,
    ans: ['4'],
    exp: `<p>a = 3、b = 4、c = 5。關掉 4 和 3 之後，可用的是 3、4、6…。open 永遠拿<b>最小</b>的可用編號：d = 3、e = <b>4</b>。（跟關閉的順序無關。）已實測。</p>`,
    cprog: 's2_w2 fdnum',
  },
  {
    id: 's2-w2-13', week: W, topic: '兩次 open：各自的 offset', src: V('W2-14'), group: 's2-W2-fd', type: 'fill',
    q: `${code(`
      int fd1 = open("notes.txt", O_RDONLY);
      int fd2 = open("notes.txt", O_RDONLY);
      read(fd1, buf, 10);
      read(fd2, buf, 3);
      read(fd1, buf, 5);`)}<p>notes.txt is 1000 bytes long. At which byte offset will the <b>next</b> read on fd2 start?</p>`,
    ans: ['3'],
    exp: `<p>兩次 open 建立兩個獨立的 open-file table entry，各有自己的 offset。fd2 只讀過 3 bytes → 下一次從 <b>3</b> 開始；fd1 讀了 10 + 5 = 15，跟 fd2 無關。已實測。</p>`,
    cprog: 's2_w2 twoopen',
  },
  {
    id: 's2-w2-14', week: W, topic: 'Offset 存在哪一張表', src: N('Part 4 Walkthrough 1'), group: 's2-W2-fd', type: 'single',
    q: `<p>Linux keeps three tables for files: each process's file-descriptor table, the system-wide open-file table, and the inodes. Where is a file's current read/write <b>offset</b> kept?</p>`,
    opts: ["In the process's file-descriptor table", 'In the open-file table entry', "In the file's inode", 'In the directory entry for the file name'],
    ans: 1,
    keep: true,
    exp: `<p>offset 在 <b>open-file table entry</b>。所以：同一個 entry 被多個 fd 指到（dup、fork）就會共用 offset；分別 open 會各有一個 entry、各自的 offset。fd table 只是「編號 → entry」的對照；inode 存的是檔案本身（大小、權限、資料位置），所有人共用。</p>`,
  },
  {
    id: 's2-w2-15', week: W, topic: 'inode 存什麼', src: N('Part 4 Walkthrough 1'), group: 's2-W2-fd', type: 'single',
    q: `<p>Which structure stores a file's size, its permission bits, and where its data blocks are on disk?</p>`,
    opts: ['The file descriptor', 'The open-file table entry', 'The inode', 'The directory entry that holds the file name'],
    ans: 2,
    keep: true,
    exp: `<p><b>inode</b> 是檔案本身：大小、權限、擁有者、link count、資料區塊的位置。目錄只存「名字 → inode 編號」；open-file entry 存 offset 和開啟模式；fd 只是 process 自己的編號。這就是為什麼刪掉名字（unlink）不會立刻刪掉 inode。</p>`,
  },
  {
    id: 's2-w2-16', week: W, topic: '兩個 process 各自 open 同一個檔', src: N('Part 4 Walkthrough 1'), group: 's2-W2-fd', type: 'single',
    q: `<p>Two unrelated processes each call ${c('open("/data/fish", O_RDONLY)')} once. How many file-descriptor table entries, open-file table entries and inodes are involved in total?</p>`,
    opts: [
      '2 fd entries, 1 open-file entry, 1 inode',
      '2 fd entries, 2 open-file entries, 1 inode',
      '2 fd entries, 2 open-file entries, 2 inodes',
      '1 fd entry, 1 open-file entry, 1 inode',
    ],
    ans: 1,
    keep: true,
    exp: `<p>每個 process 有自己的 fd table → 2 個 fd entry。每次 open() 都建立一個新的 open-file entry → 2 個（所以 offset 各自獨立）。同一個檔案只有一個 inode → 1 個。只有 fork 或 dup 才會讓兩個 fd 指向同一個 open-file entry。</p>`,
  },
  {
    id: 's2-w2-17', week: W, topic: 'write 和 read 共用同一個 offset', src: V('W2-07'), group: 's2-W2-fd', type: 'fill',
    q: `<p>data.txt contains ${c('ABCDEF')}.</p>${code(`
      int fd = open("data.txt", O_RDWR);
      write(fd, "xy", 2);
      char c;
      read(fd, &c, 1);`)}<p>What character is in ${c('c')}?</p>`,
    ans: ['C'],
    exp: `<p>同一個 fd 的讀和寫共用一個 offset。write 把 "xy" 蓋在 offset 0–1（檔案變成 xyCDEF），offset 變 2；read 從 offset 2 讀 → <b>C</b>。已實測。</p>`,
    cprog: 's2_w2 rdwr',
  },
  {
    id: 's2-w2-18', week: W, topic: '沒有 O_TRUNC 的覆寫', src: V('W2-07'), group: 's2-W2-fd', type: 'fill',
    q: `<p>log.txt contains ${c('hello world')} (11 bytes, no newline).</p>${code(`
      int fd = open("log.txt", O_WRONLY);   // no O_TRUNC, no O_APPEND
      write(fd, "HEY", 3);
      close(fd);`)}<p>What does log.txt contain now? Type its exact contents.</p>`,
    ans: ['HEYlo world'],
    exp: `<p>沒有 O_TRUNC 就不會清空，沒有 O_APPEND 就從 offset 0 開始寫：前 3 個 byte 被蓋掉 → <b>HEYlo world</b>，檔案仍是 11 bytes。已實測。</p>`,
    cprog: 's2_w2 overwrite',
  },
  {
    id: 's2-w2-19', week: W, topic: 'Hard link 的 link count', src: V('W2-10'), group: 's2-W2-unlink', type: 'fill',
    q: `<p>File f has link count 1. You run ${c('ln f g')}, then ${c('ln f h')}, then ${c('rm g')}. What is f's link count now?</p>`,
    ans: ['2'],
    exp: `<p>每個 ln 為同一個 inode 多加一個名字：1 → 2 → 3。rm（unlink）只刪掉一個名字：3 → <b>2</b>（f 和 h）。資料還在，因為 link count 不是 0。已實測。</p>`,
    cprog: 'ln / rm / stat',
  },
  {
    id: 's2-w2-20', week: W, topic: '刪掉兩個名字之後', src: V('W2-10'), group: 's2-W2-unlink', type: 'single',
    q: `<p>A file has three hard links, /a, /b and /c, and no process has it open. Someone runs ${c('rm /a /b')}. What happens to the file's data?</p>`,
    opts: [
      'It is freed, because two of the three names were removed',
      'It stays: the link count drops to 1 and /c still leads to the inode',
      'It is freed when the next program opens /c',
      'It is moved to a trash folder',
    ],
    ans: 1,
    exp: `<p>inode 只有在「link count = 0」而且「沒有任何 open file 參照它」時才會被釋放。刪掉兩個名字後 link count 是 1，/c 還指著同一個 inode，資料完整保留。</p>`,
  },
  {
    id: 's2-w2-21', week: W, topic: 'rm 之後磁碟還是滿的', src: V('W2-15'), group: 's2-W2-unlink', type: 'single',
    q: `<p>The disk is full, so an admin runs ${c('rm /var/log/nginx/huge.log')}. ${c('df')} still shows the disk as full, and ${c('ls -l /proc/<nginx PID>/fd')} shows ${c('huge.log (deleted)')}. Which action frees the space?</p>`,
    opts: [
      'Run rm on the same path again',
      'Run sync so that the deletion reaches the disk',
      'Restart (or reload) nginx so that it closes its descriptor for the old log',
      'Wait a few minutes; the kernel frees deleted files in the background',
    ],
    ans: 2,
    exp: `<p>名字刪掉了（link count = 0），但 nginx 還開著它 → inode 和資料區塊被保留。只有最後一個參照它的 open file 關掉時才會釋放：讓 nginx 關檔（重啟或重新開 log）。再 rm 一次會失敗（名字已經沒了）；sync 只是把 dirty page 寫回；kernel 也不會自己去回收還開著的檔案。</p>`,
  },
  {
    id: 's2-w2-22', week: W, topic: 'Delete-while-open 的用途', src: V('W2-15'), group: 's2-W2-unlink', type: 'single',
    q: `<p>A program creates a temporary file, opens it, and immediately calls ${c('unlink()')} on its name, then keeps reading and writing through the descriptor. Why would a program do this on purpose?</p>`,
    opts: [
      'unlink makes later reads and writes faster',
      'The space is reclaimed automatically when the program closes the file or exits, even if it crashes, and no other program can open the file by name',
      'unlink encrypts the file contents',
      'It moves the file into the page cache only',
    ],
    ans: 1,
    exp: `<p>這就是講義說的 delete-while-open trick：名字刪掉了，但 fd → open file → inode 不需要名字，程式照常讀寫。程式一結束（就算是 crash），最後一個參照消失，kernel 自動回收空間——不會留下垃圾暫存檔，別人也沒辦法用路徑打開它。</p>`,
  },
  {
    id: 's2-w2-23', week: W, topic: 'malloc 之後還沒寫', src: V('W2-01'), group: 's2-W2-vm', type: 'single',
    q: `<p>A C program calls ${c('char *p = malloc(2UL << 30);')} (2 GiB) and has not written to the buffer yet. Compared with just before the call, what happened?</p>`,
    opts: [
      'VSZ grew by about 2 GiB; RSS barely changed',
      'VSZ and RSS both grew by about 2 GiB',
      'RSS grew by about 2 GiB; VSZ barely changed',
      'Neither changed until the program calls free()',
    ],
    ans: 0,
    exp: `<p>配置只增加 <b>VSZ</b>（map 了多少頁）；只有被 touch 的頁才會拿到 DRAM frame（RSS）。還沒寫入 → 幾乎沒有 frame → RSS 幾乎不變。所以 malloc 很大的空間不會讓機器當掉，真正「用」（寫）才會。</p>`,
  },
  {
    id: 's2-w2-24', week: W, topic: 'RSS：跳著寫（stride 大於一頁）', src: V('W2-13'), group: 's2-W2-vm', type: 'fill',
    q: `<p>Page size is 4 KiB. ${c('a = np.zeros(8192)')} creates 8192 doubles (64 KiB = 16 pages; assume it starts at a page boundary). The script then runs:</p>${code('a[::1024] = 1.0     # writes elements 0, 1024, 2048, ..., 7168')}<p>By how many KiB does RSS grow?</p>`,
    ans: ['32', '32 KiB', '32KiB'],
    exp: `<p>第 1024k 個元素在 byte 1024k × 8 = 8192k → 頁號 2k：寫到的是第 0、2、4、…、14 頁，共 8 頁 → 8 × 4 = <b>32 KiB</b>。間隔（8 KiB）比一頁大，所以有一半的頁沒被碰到、仍指向 zero page。如果改成 ${c('a[::256]')}（間隔 2 KiB），每一頁都會被寫到 → 64 KiB。</p>`,
    calc: { fn: 'pages', pageSize: 4096, offsets: [0, 8192, 16384, 24576, 32768, 40960, 49152, 57344], unit: 'KiB' },
  },
  {
    id: 's2-w2-25', week: W, topic: 'RSS 超過 DRAM 時', src: N('Part 5'), group: 's2-W2-vm', type: 'single',
    q: `<p>Many processes keep writing to memory they allocated earlier, and the total RSS of all processes is about to exceed the machine's DRAM (no swap). What does Linux do?</p>`,
    opts: [
      'Nothing; the allocations already succeeded, so the writes are guaranteed to work',
      "The out-of-memory (OOM) killer picks a victim process and kills it",
      'It refuses every new malloc() but lets the writes continue',
      'It reboots the machine',
    ],
    ans: 1,
    exp: `<p>overcommit 的代價：配置（VSZ）永遠不會讓機器當掉，<b>touch</b> 才會。當所有 process 的 RSS 加起來超過 DRAM，kernel 的 OOM killer 會選一個 process 殺掉，把它的 frame 收回來。</p>`,
  },
  {
    id: 's2-w2-26', week: W, topic: 'fork 的 copy-on-write', src: N('Part 4 Walkthrough 2'), group: 's2-W2-vm', type: 'fill',
    q: `<p>A parent process has written to every page of a 1 GiB array, so all of it is resident. It then calls fork(). The child writes to 25% of the array's pages; the parent does not write to the array again. About how much <b>extra</b> physical memory, in GiB, does the array use now, beyond the original 1 GiB?</p>`,
    ans: ['0.25', '0.25 GiB', '1/4'],
    exp: `<p>fork 之後 parent 和 child 共用所有頁（唯讀，copy-on-write）。只有被寫的頁才會複製一份：child 寫了 25% 的頁 → 多出 0.25 × 1 GiB = <b>0.25 GiB</b>。沒被寫的 75% 仍然共用同一份 frame。這就是 fork 很便宜的原因。</p>`,
    calc: { fn: 'cow', size: 1, frac: 0.25 },
  },
  {
    id: 's2-w2-27', week: W, topic: 'Overcommit 倍數', src: V('W2-20'), group: 's2-W2-vm', type: 'fill',
    q: `<p>A cloud-notebook server has 256 GB of DRAM. It promises each of its 2,000 users 8 GB of memory. By what factor is the memory oversubscribed?</p>`,
    ans: ['62.5', '62.5x', '62.5×'],
    exp: `<p>答應的總量 = 2000 × 8 = 16,000 GB；實際 256 GB → 16000 / 256 = <b>62.5</b> 倍。能這樣做是因為大部分使用者閒置、程式要的記憶體大多沒被 touch、相同的頁可以共用。（講義的例子是 10,000 人 × 12 GB 對 0.5 TB，約 240 倍。）</p>`,
    calc: { fn: 'ratio', a: 16000, b: 256 },
  },
  {
    id: 's2-w2-28', week: W, topic: 'Page cache：第二次 import 為什麼快', src: N('Part 6'), group: 's2-W2-cache', type: 'single',
    q: `<p>${c('python3 -c "import numpy"')} takes over a second the first time, but only a few milliseconds when run again right afterwards. The program did not change. Why?</p>`,
    opts: [
      'Python compiled numpy into machine code during the first run',
      'The first run left copies of the file pages in the page cache, so the second run reads them from memory instead of the SSD',
      'The second run skips most of the 2,549 files',
      'The CPU clock speed increased after the first run',
    ],
    ans: 1,
    exp: `<p>第一次要從 SSD 讀進 2,549 個檔案的每一頁，OS 把它們留在記憶體裡（<b>page cache</b>）。第二次的讀取直接從記憶體回答（每頁約 100 ns，而不是約 100 µs）。程式完全感覺不到差別——這就是 file abstraction。而且不一定要同一個程式，任何讀這些檔案的程式都受益。</p>`,
  },
  {
    id: 's2-w2-29', week: W, topic: 'Page cache：怎麼讓它再變慢', src: N('Part 6'), group: 's2-W2-cache', type: 'multi',
    q: `<p>The second ${c('import numpy')} is fast because the files are in the page cache. Which of the following would make the next import slow again?${ALL}</p>`,
    opts: [
      'Run other programs that need so much memory that the OS throws the cached pages away',
      'Tell the OS to drop its page cache',
      'Reboot the machine',
      'Run import numpy a third time',
      'Run chmod on the numpy files',
    ],
    ans: [0, 1, 2],
    exp: `<p>page cache 在 DRAM 裡：只要那些頁被丟掉，下次就要再從磁碟讀。記憶體不夠時 OS 會先丟 clean 的快取頁；也可以叫 OS 直接 drop caches；重開機會清空所有記憶體。再 import 一次只會更快；chmod 只改 inode 的權限，不影響資料頁是否在快取裡。</p>`,
  },
  {
    id: 's2-w2-30', week: W, topic: 'Write buffering 與斷電', src: N('Part 6'), group: 's2-W2-cache', type: 'single',
    q: `<p>${c('cp big.iso /mnt/usb/')} returns after one second. Two seconds later the power fails. After reboot, the copy on the USB drive is empty. Why?</p>`,
    opts: [
      'cp never wrote anything; it only printed a message',
      "cp's write() calls put the data into the page cache as dirty pages and returned; the OS had not yet written those pages to the drive",
      'The USB drive erases files that were written less than five seconds ago',
      "The data stayed in cp's libc buffer",
    ],
    ans: 1,
    exp: `<p>write() 把資料複製進 kernel 的 page cache、標成 <b>dirty</b>（比磁碟新）就回報完成；OS 幾秒後才把 dirty pages 一起寫出去。斷電時 dirty pages 還沒寫 → 資料遺失，即使程式被告知「寫好了」。要保證落盤得呼叫 fsync()（「安全移除」就是這樣做）。cp 用的是 write，不是 printf，所以不是 libc buffer 的問題。</p>`,
  },
  {
    id: 's2-w2-31', week: W, topic: 'fsync 做什麼', src: N('Part 6'), group: 's2-W2-cache', type: 'single',
    q: `<p>What does a program get by calling ${c('fsync(fd)')} after its writes?</p>`,
    opts: [
      "It flushes the C library's stdout buffer",
      "The kernel writes the file's dirty pages to the device right away, and fsync blocks until the device confirms",
      'It removes the file from the page cache so that the next read is slower',
      'It makes later writes skip the page cache',
    ],
    ans: 1,
    exp: `<p>fsync 是 system call：要求 OS <b>立刻</b>把這個檔案的 dirty pages 寫到裝置上，並且等裝置確認後才回來。這是「耐久性」要自己明確要求的原因。fflush 只負責 libc buffer → kernel，跟 fsync（kernel → 磁碟）是不同的兩層。</p>`,
  },
  {
    id: 's2-w2-32', week: W, topic: 'Page cache 的性質', src: N('Part 6'), group: 's2-W2-cache', type: 'multi',
    q: `<p>Which statements about the page cache are true?${ALL}</p>`,
    opts: [
      'Pages cached by one program speed up a different program that reads the same file',
      'write() usually returns once the data is in the page cache, before it reaches the disk',
      'A clean page can be dropped without writing anything to the disk',
      'A dirty page holds data newer than the copy on disk',
      'Data in the page cache survives a power failure',
    ],
    ans: [0, 1, 2, 3],
    exp: `<p>page cache 是 kernel 管的、全系統共用的檔案頁快取：誰讀進來都能讓別人受益。clean page 和磁碟內容一樣，記憶體不夠時直接丟掉即可；dirty page 比磁碟新，丟掉前必須先寫回。它在 DRAM 裡，斷電就沒了。</p>`,
  },
  {
    id: 's2-w2-33', week: W, topic: 'printf / write / fflush / _exit 混合', src: V('W2-17'), group: 's2-W2-printf', type: 'fill',
    q: `<p>The program is run as ${c('./test > out.txt')}. What does out.txt contain afterwards? Type the characters with no spaces, or ${c('empty')} if the file is empty.</p>${code(`
      printf("A");
      write(1, "B", 1);
      printf("C");
      fflush(stdout);
      write(1, "D", 1);
      printf("E");
      _exit(0);`)}`,
    ans: ['BACD'],
    exp: `<p>導向檔案 → fully buffered。printf A → 進 buffer；write B → 立刻進 kernel（檔案：B）；printf C → buffer 裡是 AC；fflush → 把 AC 寫出（檔案：BAC）；write D → BACD；printf E → 進 buffer；${c('_exit')} 直接結束、<b>不 flush</b> → E 消失。結果 <b>BACD</b>。已實測。</p>`,
    cprog: 's2_w2 mix',
  },
  {
    id: 's2-w2-34', week: W, topic: '終端機上的 printf 與 crash', src: V('W2-17'), group: 's2-W2-printf', type: 'fill',
    q: `<p>The program is run in a terminal (no redirection). Which words appear on the screen? Type them in order, separated by single spaces.</p>${code(`
      printf("one\\n");
      printf("two ");
      write(1, "three\\n", 6);
      *(int *)0 = 1;      // crash`)}`,
    ans: ['one three'],
    exp: `<p>終端機 → line-buffered：一遇到 \\n 就 flush。"one\\n" 立刻寫出；"two " 沒有換行，留在 buffer；write 直接寫出 three；crash 時 buffer 消失 → 畫面上是 <b>one three</b>。如果導向檔案（fully buffered），one 也會一起消失，只剩 three。已用 pty 實測。</p>`,
    cprog: 's2_w2 ttycrash',
  },
  {
    id: 's2-w2-35', week: W, topic: 'Buffer 滿了才寫出', src: V('W2-22'), group: 's2-W2-printf', type: 'fill',
    q: `<p>The program is run as ${c('./test > out.txt')}. The first line makes stdout fully buffered with a 4096-byte buffer.</p>${code(`
      setvbuf(stdout, NULL, _IOFBF, 4096);
      for (int i = 0; i < 5000; i++)
          printf("x");
      *(int *)0 = 1;      // crash`)}<p>How many bytes does out.txt contain afterwards?</p>`,
    ans: ['4096'],
    exp: `<p>buffer 滿了（4096 個 x）時 libc 會呼叫 write() 把它送進 kernel；剩下的 5000 − 4096 = 904 個 x 還在 buffer 裡，crash 時消失 → 檔案 <b>4096</b> bytes。buffer 滿是 flush 的三種時機之一（另外兩種是 fflush 和正常結束）。已實測。</p>`,
    cprog: 's2_w2 full',
  },
  {
    id: 's2-w2-36', week: W, topic: '終端機：沒有換行就不會出現', src: V('W2-08'), group: 's2-W2-printf', type: 'single',
    q: `<p>A program running in a terminal executes ${c('printf("hello");')} (no newline) and then ${c('sleep(60);')}. What does the user see during those 60 seconds?</p>`,
    opts: [
      'hello appears immediately, because stdout is a terminal',
      'Nothing; hello stays in the C library buffer until a newline, a full buffer, fflush, or a normal exit',
      'hello appears after about 1 second, when libc flushes idle buffers',
      'hello appears on stderr instead',
    ],
    ans: 1,
    exp: `<p>終端機是 <b>line-buffered</b>，不是 unbuffered：要遇到換行（或 buffer 滿、fflush、正常結束）才會 write。沒有換行的 "hello" 會一直待在 buffer 裡，60 秒後程式正常結束時才出現。libc 沒有「閒置多久自動 flush」的機制。</p>`,
  },
  {
    id: 's2-w2-37', week: W, topic: '為什麼 stderr 不緩衝', src: N('Part 7'), group: 's2-W2-printf', type: 'single',
    q: `<p>Why does the C library leave stderr <b>unbuffered</b> while stdout is buffered?</p>`,
    opts: [
      'So that an error message reaches the user right away, even if the program crashes on the next line',
      'Because stderr is always a file, and files cannot be buffered',
      'Because the kernel refuses to buffer fd 2',
      'To make error messages appear in the next command of a pipeline',
    ],
    ans: 0,
    exp: `<p>每次 fprintf(stderr, …) 都立刻交給 kernel，不等 buffer 滿、fflush 或正常結束。所以程式下一行就 crash 時，錯誤訊息也已經送出去了，而前面印到 stdout 的正常輸出反而可能丟失。這也是除錯訊息應該寫到 stderr 的原因。</p>`,
  },
  {
    id: 's2-w2-38', week: W, topic: 'chmod 數字轉權限字串', src: V('W2-05'), group: 's2-W2-perm', type: 'fill',
    q: `<p>After ${c('chmod 754 report.sh')}, what does ${c('ls -l')} show for the permission bits? Type the nine characters (for example ${c('rw-r--r--')}).</p>`,
    ans: ['rwxr-xr--', '-rwxr-xr--'],
    exp: `<p>7 = 4 + 2 + 1 = rwx（owner）；5 = 4 + 1 = r-x（group）；4 = r--（others）→ <b>rwxr-xr--</b>。</p>`,
  },
  {
    id: 's2-w2-39', week: W, topic: '權限字串轉 chmod 數字', src: V('W2-05'), group: 's2-W2-perm', type: 'fill',
    q: `<p>A file's permission string is ${c('-rwx--x--x')}. Which ${c('chmod')} number gives exactly these permissions?</p>`,
    ans: ['711', '0711'],
    exp: `<p>owner rwx = 7；group --x = 1；others --x = 1 → <b>711</b>。（常見於只想讓別人執行、不讓別人讀內容的程式。）</p>`,
  },
  {
    id: 's2-w2-40', week: W, topic: 'Group 權限', src: V('W2-06'), group: 's2-W2-perm', type: 'single',
    q: `${code('-rw-r----- 1 nini manager 812 Sep 22 10:03 salary.csv')}<p>niko is not nini, but niko is a member of the group ${c('manager')}. What can niko do with salary.csv?</p>`,
    opts: ['Read it and write it', 'Read it, but not write it', 'Neither read nor write it', 'Write it, but not read it'],
    ans: 1,
    keep: true,
    exp: `<p>niko 不是 owner，但在 manager 群組裡 → 套用第二組 <b>r--</b>：可以讀、不能寫。只有不是 owner 也不在群組裡的人才套用第三組 ---。</p>`,
  },
  {
    id: 's2-w2-41', week: W, topic: '目錄只有 r 沒有 x', src: V('W2-12'), group: 's2-W2-perm', type: 'single',
    q: `<p>For you, the directory ${c('/srv/box')} has permissions ${c('r--')} (read but no execute). The file ${c('/srv/box/note.txt')} itself is ${c('rw-r--r--')}. What happens?</p>`,
    opts: [
      `${c('ls /srv/box')} lists the names, but ${c('cat /srv/box/note.txt')} fails with Permission denied`,
      'Both ls and cat work, because note.txt is readable by everyone',
      'Neither works, because the directory has no x',
      'cat works, but ls fails',
    ],
    ans: 0,
    exp: `<p>目錄的 r = 可以讀目錄內容（列出名字）；目錄的 x = 可以「穿過」它、用名字去找裡面的 inode。沒有 x → 路徑解析到 /srv/box 就停住，打不開裡面的任何檔案，即使檔案本身大家都能讀。所以 ls 看得到名字、cat 失敗。</p>`,
  },
  {
    id: 's2-w2-42', week: W, topic: 'PATH 的順序', src: V('W2-11'), group: 's2-W2-path', type: 'fill',
    q: `<p>PATH is ${c('/home/niko/bin:/usr/bin:/bin')}. Both ${c('/home/niko/bin/python3')} and ${c('/usr/bin/python3')} exist and are executable. When niko types ${c('python3')}, which file runs? Type its full path.</p>`,
    ans: ['/home/niko/bin/python3'],
    exp: `<p>shell 依 PATH 的順序一個一個目錄找，用<b>第一個</b>找到的：/home/niko/bin 排最前面 → <b>/home/niko/bin/python3</b>。${c('which python3')} 做同樣的搜尋，會印出這個路徑。</p>`,
  },
  {
    id: 's2-w2-43', week: W, topic: 'VSZ 可以比 DRAM 大', src: V('W2-21'), group: 's2-W2-vm', type: 'single',
    q: `<p>On a laptop with 2 GiB of DRAM and no swap, ${c('ps')} shows a process with VSZ 3.2 GiB and RSS 0.4 GiB. Is that possible?</p>`,
    opts: [
      'No; VSZ can never exceed DRAM',
      'Yes: VSZ counts the pages the process has mapped, and only the pages it has touched (RSS) need DRAM frames',
      'Yes, but only because the extra 1.2 GiB is stored on the disk',
      'Only if the process runs as root',
    ],
    ans: 1,
    exp: `<p>VSZ = 所有 map 的頁（配置了就算），RSS = 現在真的有 DRAM frame 的頁。沒被 touch 的頁不佔記憶體，也不必放到磁碟上。只有 RSS 的總和必須塞得進 DRAM。</p>`,
  },
  {
    id: 's2-w2-44', week: W, topic: '三種 abstraction', src: N('Part 4'), group: 's2-W2-abs', type: 'single',
    q: `<p>The file system works with numbered 4 KB blocks and does not know whether they live on a hard disk or an SSD. Which OS abstraction is this?</p>`,
    opts: ['The file abstraction', 'The block abstraction', 'The virtual-memory abstraction', 'The process abstraction'],
    ans: 1,
    keep: true,
    exp: `<p>講義的三種 abstraction：<b>file</b>——open("movie.mp4") 不知道資料在 SSD、USB 還是雲端；<b>block</b>——檔案系統只看到編號的 4 KB block，不知道底下是 HDD 或 SSD；<b>virtual memory</b>——程式看到私有、連續、看似無限的位址空間。每一層 indirection 都是一張表。</p>`,
  },
  {
    id: 's2-w2-45', week: W, topic: 'OS 替 production 程式把關的四件事', src: N('Part 1'), group: 's2-W2-goal', type: 'single',
    q: `<p>The lecture lists four things a demo program often ignores and the OS can enforce for production software. Which of the following is <b>not</b> one of them?</p>`,
    opts: [
      'Security: touching only what it is allowed to touch',
      'Resource constraints: working when memory, CPU and disk are finite',
      'Coexistence: sharing the machine without corrupting other programs',
      'A pleasant user-interface design',
    ],
    ans: 3,
    exp: `<p>四件事是 security（權限、特權）、resource constraints（虛擬記憶體、排程）、coexistence（隔離、公平分享）、scale（同一個 kernel 用不同設定跑在手錶到資料中心）。UI 好不好看不是 OS 能強制的。</p>`,
  },
];
