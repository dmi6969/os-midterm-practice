# verify/

驗證兩個練習網頁（第一回 `os-midterm-practice.html`、第二回 `os-midterm-practice-2.html`）用的程式。網頁本身不需要這些檔案，雙擊就能開。

## 怎麼跑

```bash
# 0.（改了題目才需要）從 src/ 重新產生兩個 HTML
node src/build.js

# 1. 編譯並執行所有 C 程式與 shell 測試，結果寫到 verify/c_results.tsv
#    需要 POSIX 環境：Linux，或 Windows 上的 MSYS2（pacman -S gcc）
bash verify/run_c.sh

# 2. 兩回都檢查：題數 / 題型 / 欄位 / 出處 / 重複題（含兩回互相比對），重算計算題，比對實測結果
node verify/check.js

# 3.（選用）用 headless Chrome 實際把兩回各 200 題作答一次，並測試錯題重做等功能
#    需要 puppeteer-core：npm i puppeteer-core，然後
NODE_PATH=<puppeteer-core 所在的 node_modules> node verify/browser_test.js
```

這次的執行紀錄：`run_c.log`（實測輸出）、`check.log`（check.js 的完整輸出）。

## 檔案

| 檔案 | 內容 |
|---|---|
| `c/common.h` | 共用 include 與量測工具（數 process、計時） |
| `c/w2_buffers.c`、`c/w2_files.c` | 第一回 W2：printf / write / buffer、read 與 offset |
| `c/w3_fork.c` | 第一回 W3：fork / exec / wait、終端機 vs 檔案、zombie、double fork |
| `c/w4_exc.c` | 第一回 W4：SIGFPE、SIGSEGV、page fault |
| `c/w5_pipe.c` | 第一回 W5：pipe、read 迴圈、deadlock、signal、SIGPIPE |
| `c/s2_w2.c` … `c/s2_w5.c` | 第二回各週的 C 程式題 |
| `run_c.sh` | 依題目要求的模式（檔案 / 終端機 pty / pipe）執行，產生 `c_results.tsv`；也包含 shell 的測試（環境變數、PATH、redirection、PIPESTATUS、timeout） |
| `check.js` | 所有靜態檢查與計算題重算（含排程模擬器，先用講義數字自我檢查） |
| `browser_test.js` | 在真的瀏覽器裡逐題作答，檢查判分、鎖定、localStorage、篩選、錯題重做、全部重來、手機寬度 |

每個 C 程式裡，跟題目一樣的程式碼照抄；為了量測而加的程式碼都標了 `verify`。
`work/` 是 run_c.sh 每次重建的暫存目錄（執行檔與輸出檔），可以刪。
