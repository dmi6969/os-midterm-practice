# verify/

驗證 `os-midterm-practice.html` 用的程式。網頁本身不需要這些檔案，雙擊就能開。

## 怎麼跑

```bash
# 0.（改了題目才需要）從 src/ 重新產生 HTML
node src/build.js

# 1. 編譯並執行所有 C 程式，結果寫到 verify/c_results.tsv
#    需要 POSIX 環境：Linux，或 Windows 上的 MSYS2（pacman -S gcc）
bash verify/run_c.sh

# 2. 檢查題數 / 題型 / 欄位 / 原題收錄 / ⚠️ 變化題 / 重複題，重算計算題，比對 C 實測結果
node verify/check.js

# 3.（選用）用 headless Chrome 實際把 200 題都作答一次
#    需要 puppeteer-core：npm i puppeteer-core，然後
NODE_PATH=<puppeteer-core 所在的 node_modules> node verify/browser_test.js
```

這次的執行紀錄：`run_c.log`（C 實測輸出）、`check.log`（check.js 的完整輸出）。

## 檔案

| 檔案 | 內容 |
|---|---|
| `c/common.h` | 共用 include 與量測工具（數 process、計時） |
| `c/w2_buffers.c` | printf / write / fflush / crash / exit / _exit：W2-08、W2-17 P1–P4、W2-22 與變化題 |
| `c/w2_files.c` | read 回傳值與 offset、close 後重新 open、dup：W2-07、W2-14、W2-16 與變化題、一般檔案 EOF |
| `c/w3_fork.c` | fork / exec / wait 計數、輸出到終端機 vs 檔案、共用 offset、zombie、double fork：W3-08、W3-14、W3-15、W3-16、W3-19、W3-21、W3-22 與變化題 |
| `c/w4_exc.c` | 除以 0（SIGFPE → 136）、segfault（139）、page fault 計數 |
| `c/w5_pipe.c` | pipe 的 fd 編號、read 迴圈（spin vs block）、read 三種結果、兩條 pipe 的 deadlock、先 wait 再讀、kill pipeline 成員、SIGPIPE、dup2 之後 close |
| `run_c.sh` | 編譯並依題目要求的模式（檔案 / 終端機 pty / pipe）執行，產生 `c_results.tsv` |
| `check.js` | 所有靜態檢查與計算題重算（含排程模擬器，先用講義數字自我檢查） |
| `browser_test.js` | 在真的瀏覽器裡逐題作答、檢查判分、鎖定、localStorage、錯題篩選、全部重來、手機寬度 |

每個 C 程式裡，跟題目一樣的程式碼照抄；為了量測而加的程式碼都標了 `verify`。
`work/` 是 run_c.sh 每次重建的暫存目錄（執行檔與輸出檔），可以刪。
