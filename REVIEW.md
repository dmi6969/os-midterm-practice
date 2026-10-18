# REVIEW：答案疑慮與改寫說明

> 第一回（os-midterm-practice.html）的說明在前半；第二回（os-midterm-practice-2.html）的說明在最後一節。

> 題號格式：`網頁第 N 題（題目 id / 題庫編號）`。網頁上的順序是固定的（打散後不會再變），作答紀錄用 id 存。

## 結論

**題庫裡的答案，我沒有找到跟講義或實測結果衝突的地方，所以沒有改任何原題答案。**
所有跟 C 程式輸出有關的原題都實際編譯執行過（verify/run_c.sh），結果和題庫答案一致：W2-07、W2-08、W2-14、W2-16、W2-17 P1–P4、W2-22、W3-08、W3-14、W3-15、W3-16、W3-19、W3-21、W3-22、W5-01、W5-02、W5-06、W5-07（共 59 題原題 + 變化題對到實測結果）。

下面是值得你留意、但**不影響原題答案**的地方。

---

## 1. W3-21 的解析備註有一半不成立（建議看懂）

- **題號**：網頁第 157 題（w3-21a / W3-21）的解析；相關變化題：第 9 題（w3-v21a）、第 126 題（w3-v21b）
- **題庫寫的**：「終端機是 line-buffered……（若導向檔案，A 會印 2 次——好的變化題方向）」
- **問題**：這句話只在 **exec 失敗**（Run 2）時成立。**exec 成功**（Run 1，`./prog /bin/echo > out.txt`）時，child 的 stdio buffer 會跟著舊程式映像一起被 exec 丟掉，不會 flush，所以 **A 只出現 1 次**。
- **實測**（MSYS2 + gcc，verify/c/w3_fork.c）：
  - `./prog /bin/echo > out.txt` → out.txt 是 `B A D E`（A 1 次）
  - `./prog /bin/_i_dont_exist_just_4_fun > out.txt` → out.txt 是 `A C A D E`（A 2 次）
- **講義依據**：W3 Part 2「If exec succeeds, it never returns: the old program no longer exists」；W3 Part 1 的 Question「./fork > out.txt 時 hello 出現兩次」那個例子是 child **沒有 exec**、正常結束才會 flush 兩份。
- **原題答案（終端機情況：C=0、D=1、E=1，E 一定最後）不受影響。**

## 2. 選項是推測重建的原題（答案沿用題庫）

題庫標了「選項為推測重建」，網頁照題庫的答案出題，只是選項文字是重建的，考試的選項措辭可能不同：

| 網頁題號 | id / 題庫 | 說明 |
|---|---|---|
| 第 177 題 | w2-01 / W2-01 ⚠️ | 原本 VSZ 一小題的選項是重建的。網頁把 VSZ、RSS 方向和 RSS 數值合成一題單選（VSZ 不變、RSS ≈ 8.2 GiB）。 |
| 第 123 題 | w5-08 / W5-08 | 題庫只給了答案 (e) 和 (b) 錯的理由，其餘選項是我補的。 |
| 第 102 題 | w5-10a / W5-10 ⚠️ | 選項：fd 3 of the shell / fd 4 of the shell / fd 0 of grep / fd 4 of grep，答案 fd 4 of grep。 |

## 3. Orphan 的 PPID「一定是 1」是講義的簡化（考試照講義答）

- **題號**：網頁第 194 題（w3-12 / W3-12）、第 188 題（w3-19 / W3-19）
- **說明**：講義說 parent 結束後 orphan 的 PPID 變成 1、由 init 收養，題庫答案也是這樣，網頁照用。補充一點：現代桌面 Linux 上，orphan 有時會被「subreaper」（例如使用者層級的 `systemd --user`）收養，`ps` 看到的 PPID 不一定是 1。這不是題庫答案的錯，只是怕你實際在自己電腦上看到 PPID 不是 1 而困惑。
- **講義依據**：W3 Part 4 表格「Orphan … changes the child's PPID to 1; init adopts the child and will reap it」。
- 實測（MSYS2）：double fork 後 G 的 `getppid()` = 1，與答案一致。

## 4. 驗證環境的限制

- 這台電腦沒有 WSL / Linux，所以 C 程式是在 **MSYS2（Cygwin 的 POSIX 環境）** 上用 gcc 13 編譯執行的（為此用 pacman 裝了 MSYS2 的 gcc）。fork、pipe、dup2、signal、stdio 緩衝的行為都和 Linux 相同；pipe 容量實測也是 65536 bytes。
- 「終端機」情況用 `script` 開 pty 來跑（stdout 是 tty → line-buffered），「導向檔案」情況就是 `> out.txt`（fully buffered），兩者分開驗證。
- **沒辦法在 MSYS2 上實測的**：page fault 次數（網頁第 138 題 w4-n14，MSYS2 不回報 minor fault）。這題只用 verify/check.js 依頁號公式重算（答案 3）。
- 所有 W6 排程題用 verify/check.js 裡的小模擬器重算；模擬器先重現了講義上的 12 個數字（FIFO 66、SJF 30 / 62、STCF 30 / 28、7-Eleven 三種、RR q=1 / q=2）才拿來驗題目。

## 5. 改寫方式（格式改變，答案沒變）

只有選擇題和填充題，所以這些原題的題型改了：

| 原題型 | 題庫 | 網頁怎麼問 |
|---|---|---|
| 排序 | W2-18、W4-01、W4-05、W5-04 | 「下列哪個順序正確」單選（W2-18 合併問「write() 跳過哪一步」；W5-04 拆成 parent 的順序、cat child 的順序兩題） |
| 分類 | W2-03（S1–S5 歸類） | 多選：「哪些描述 batch back end」 |
| 下拉 / 對應 | W5-05（git 的 fd 0/1/3/4） | 單選：fd 0 一題、fd 1/3/4 一題、close(4) 為什麼安全一題 |
| 多小題數值 | W2-08、W2-10、W2-12、W2-14、W2-20、W3-05 等 | 合併成「組合選項」單選，或拆成填充題 |
| 同程式兩個計數 | W3-15（X、Y 次數） | X 次數是填充題；Y 改成「哪個 process 印 Y、共幾行」單選，避免兩題只差一個字 |

另外，網頁第 40 題和第 139 題（W2-17 的 P1、P2）只差一行 `fflush(stdout);`。這是題庫原題本身的對照組，答案不同，所以照原樣保留；check.js 在檢查「只改一個字的題目」時特別放行這一組，其他題都沒有這種情況。

---

## 第二回（os-midterm-practice-2.html）

200 題全部是新出的變化題（原題都在第一回）。和第一回、和自己逐題比對過，沒有重複或只差 1–2 個字的題目。跟 C 程式或 shell 輸出有關的 48 題都實測過，35 題計算題重算過，全部一致。下面是需要你知道的地方：

### 1. 因為平台差異改過的題目

- **網頁第 173 題（s2-w5-25，pipe 卡住時裡面有幾個 byte）**：原本出的是「寫三塊 30,000 bytes」。在 Linux 上，大的 write 會先把 pipe 填到 65,536 再 block；但 MSYS2（Windows）的 pipe 只寫入整塊放得下的資料，實測停在 60,000。為了讓答案不依賴平台，改成「寫 20 塊 4096 bytes」，兩種平台都是 65,536（已實測）。

### 2. 沒辦法在這台電腦實測、依講義作答的題目

| 網頁題號 | id | 原因 |
|---|---|---|
| 第 145、12 題 | s2-w4-13、s2-w4-14 | strace 數 write 次數。MSYS2 的 strace 和 Linux 不同；答案依講義 Part 9 的實驗（3 個 printf、只有最後一個換行 → 1 次 write）與 line-buffered 的規則。 |
| 第 24 題 | s2-w5-31 | Ctrl-C 之後的 PIPESTATUS 要在互動式終端機按鍵，自動化測不到；依講義「SIGINT 送給整個前景 pipeline」作答（130 130）。 |
| 第 54 題 | s2-w5-27 | ps 的狀態字母（S）是 Linux 的顯示；依講義 exercise 4 作答。 |

### 3. 稍微超出講義文字、但是標準行為的題目

這幾題講義沒有逐字寫到，但都是 POSIX 的標準行為，而且都實測過：

- 第 167 題（s2-w5-38）：忽略 SIGPIPE 之後，寫進沒有讀者的 pipe 會回傳 −1、errno = EPIPE。
- 第 128、43 題（s2-w5-05、s2-w5-06）：dup2 的來源 fd 沒開、對 pipe 的 read end 寫入 → 都是 EBADF。
- 第 115 題（s2-w5-16）：`2>&1 > file` 和 `> file 2>&1` 的差別（dup2 複製「當下」的參照）。
- 第 28 題（s2-w3-21）：用 `source` 讓 script 在目前的 shell 裡執行。

如果你覺得這些超出考試範圍，可以先跳過。

### 4. 刻意避開的題目

講義說 touch（包括「讀」）會讓頁面拿到 frame，但 np.zeros 的頁在只讀不寫時是指向共用的 zero page。「只讀不寫時 RSS 會不會增加」這個問題，講義兩處的說法容易讓人誤會，所以第二回沒有出這種題，只出「寫入」的情況（例如 s2-w2-24 的跳著寫）。
