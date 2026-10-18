#!/usr/bin/env bash
# 編譯並執行 verify/c/ 裡的程式，把「實際觀察到的答案」寫進 verify/c_results.tsv（題號<TAB>結果）。
# 之後 node verify/check.js 會拿這些結果跟 HTML 裡的答案比對。
#
# 需要 POSIX 環境（Linux，或 Windows 上的 MSYS2：pacman -S gcc）。
# 「終端機」情況用 script(1) 開一個 pty 來跑，stdout 就是終端機（line-buffered）；
# 「檔案」情況就是 > out.txt（fully buffered）。
set -u
cd "$(dirname "$0")"
HERE=$(pwd)
OUT="$HERE/c_results.tsv"
W="$HERE/work"
rm -rf "$W"; mkdir -p "$W"
: > "$OUT"
CC=${CC:-gcc}

for f in c/*.c; do
  b=$(basename "$f" .c)
  $CC -O0 -w -o "$W/$b" "$f" || { echo "compile failed: $f"; exit 1; }
done
cd "$W"

res() { printf '%s\t%s\n' "$1" "$2" >> "$OUT"; printf '%-12s %s\n' "$1" "$2"; }
# 在 pty 裡執行（stdout 是終端機）；後面多睡 1 秒，讓變成 orphan 的子孫也印完
tty_run() { script -qc "$1; sleep 1" /dev/null | tr -d '\r'; }
# 檔案內容轉成「以單一空白分隔的字」，空檔案回傳 empty
words() { local s; s=$(tr -s ' \n' '  ' < "$1" | sed 's/^ *//; s/ *$//'); echo "${s:-empty}"; }
count() { grep -c -x "$1" "$2"; }
cpu_of() { # 回傳 user+sys 秒數（整數部分即可判斷 spin / block）
  local t; { TIMEFORMAT='%U %S'; t=$( { time "$@" > /dev/null 2>&1; } 2>&1 ); }
  awk -v a="$t" 'BEGIN{split(a,x," "); printf "%.2f", x[1]+x[2]}'
}

echo "== W2 =="
./w2_files w2-07 > o.txt; res w2-07 "$(cat o.txt)"
./w2_buffers w2-08 > out.txt 2> e.txt; res w2-08 "$(cat e.txt)"
tty_run "./w2_buffers v08a" > tty.txt; res w2-v08a "$(cat pending.txt)"
./w2_buffers v08b > out.txt 2> e.txt; res w2-v08b "$(cat e.txt)"
head -c 1500 /dev/zero | tr '\0' 'n' > notes.txt
./w2_files w2-14 > o.txt; res w2-14 "$(cat o.txt)"
./w2_files v14 > o.txt; res w2-v14 "$(awk '{print $3}' o.txt)"
./w2_files w2-16 > o.txt; res w2-16 "$(cat o.txt)"
./w2_files v16 > o.txt; res w2-v16 "$(cat o.txt)"
for p in p1 p2 p3 p4; do ./w2_buffers $p > out.txt 2>/dev/null; res "w2-17-$p" "$(words out.txt)"; done
./w2_buffers v17a > out.txt; res w2-v17a "$(words out.txt)"
./w2_buffers v17b > out.txt 2>&1; res w2-v17b "$(words out.txt)"
flushed=()
for m in crash fflush full idle return exit _exit; do
  ./w2_buffers "w2-22-$m" > out.txt 2> e.txt
  case $m in fflush|full|idle) n=$(cat e.txt) ;; *) n=$(wc -c < out.txt | tr -d ' ') ;; esac
  [ "${n:-0}" -gt 0 ] && flushed+=("$m")
done
res w2-22 "$(IFS=,; echo "${flushed[*]}")"

echo "== W3 =="
./w3_fork w3-08 > o.txt; res w3-08 "$(paste -sd'|' o.txt)"
rm -f count.txt; tty_run "./w3_fork w3-14" > tty.txt; sleep 0.5
res w3-14a "$(count Hi tty.txt)"; res w3-14b "$(wc -c < count.txt | tr -d ' ')"
tty_run "./w3_fork w3-15" > tty.txt; res w3-15a "$(count X tty.txt)"; res w3-15b "$(count Y tty.txt)"
rm -f count.txt; tty_run "./w3_fork w3-16" > tty.txt; sleep 0.5
res w3-16a "$(count Hi tty.txt)"; res w3-16b "$(wc -c < count.txt | tr -d ' ')"
rm -f count.txt; ./w3_fork w3-16 > out.txt; sleep 1; res w3-f6 "$(count Hi out.txt)"
tty_run "./w3_fork w3-21 /bin/echo" > t1.txt
tty_run "./w3_fork w3-21 /bin/_i_dont_exist_just_4_fun" > t2.txt
res w3-21a "run1 C$(count C t1.txt) D$(count D t1.txt) E$(count E t1.txt)|run2 C$(count C t2.txt) D$(count D t2.txt) E$(count E t2.txt)"
echo "   (terminal run 1 lines: $(paste -sd' ' t1.txt))"
./w3_fork w3-21 /bin/echo > out.txt; res w3-v21a "$(count A out.txt)"
echo "   (file run 1 content: $(paste -sd' ' out.txt))"
./w3_fork w3-21 /bin/_i_dont_exist_just_4_fun > out.txt; res w3-v21b "$(wc -l < out.txt | tr -d ' ')"
echo "   (file run 2 content: $(paste -sd' ' out.txt))"
./w3_fork v21c > out.txt; sleep 0.5; res w3-v21c "$(count hi out.txt)"
tty_run "./w3_fork v21c" > tty.txt; echo "   (v21c on a terminal: $(count hi tty.txt) line)"
rm -f log.txt; ./w3_fork w3-22; res w3-22 "$(cat log.txt)"
rm -f log.txt; ./w3_fork v22a; res w3-v22a "$(cat log.txt)"
./w3_fork v22b > o.txt; res w3-v22b "$(cat o.txt)"
tty_run "./w3_fork f1" > tty.txt; res w3-f1 "$(count Hi tty.txt)"
tty_run "./w3_fork f2" > tty.txt; res w3-f2 "$(count X tty.txt)"
./w3_fork f5 > out.txt; sleep 0.5; res w3-f5 "$(wc -l < out.txt | tr -d ' ')"
tty_run "./w3_fork f5" > tty.txt; echo "   (loop.c on a terminal: $(grep -c . tty.txt) lines)"
./w3_fork f8 > out.txt; res w3-f8 "$(( $(count hi out.txt) + 1 ))"
rm -f count.txt; tty_run "./w3_fork p2" > tty.txt; sleep 0.5
res w3-p2 "$(count Hi tty.txt)"; echo "   (p2 processes: $(wc -c < count.txt | tr -d ' '))"
./w3_fork z4 2> e.txt; res w3-v17a "$(cat e.txt)"
rm -f ppid.txt; ./w3_fork w3-19; sleep 3; res w3-19 "$(cat ppid.txt)"

echo "== W4 =="
./w4_exc fpe 2>/dev/null; res w4-n04 "$?"
./w4_exc segv 2>/dev/null; echo "   (segv exit status: $?)"
./w4_exc pf; echo "   (Linux 上 faults 應為 3；MSYS2 不一定支援 ru_minflt，僅供參考)"

echo "== W5 =="
./w5_pipe w5-02 2> e.txt; res w5-02 "$(cat e.txt)"
./w5_pipe v02a 2> e.txt; res w5-v02a "$(cat e.txt)"
./w5_pipe v02b 2> e.txt; res w5-v02b "$(cat e.txt)"
./w5_pipe v02c 2> e.txt; echo "   (pipe(p); pipe(q); → q = $(cat e.txt))"
c=$(cpu_of timeout 5 ./w5_pipe w5-07); res w5-07a "$(awk -v c=$c 'BEGIN{print (c>1.0)?"spin":"block"}')"; echo "   (cpu ${c}s in 5s)"
./w5_pipe first 2> e.txt; res w5-07b "$(cat e.txt)"
c=$(cpu_of timeout 5 ./w5_pipe v07a); res w5-v07a "$(awk -v c=$c 'BEGIN{print (c>1.0)?"spin":"block"}')"; echo "   (cpu ${c}s in 5s)"
./w5_pipe v07b 2> e.txt; res w5-v07b "$(awk '{print $3}' e.txt)"; echo "   (reads: $(cat e.txt))"
./w5_pipe r1 2> e.txt; echo "   (r1: $(cat e.txt))"
res w5-r1 "$(awk '{print $3}' e.txt)"
res w5-r2 "$(awk '{split($5,a,"="); print (a[2]>=1.0)?"block":"no-block"}' e.txt)"
./w2_files r3 > o.txt; res w5-r3 "$(awk '{print $3}' o.txt)"; echo "   (reads: $(cat o.txt))"
./w5_pipe kill-sleep 2> e.txt; res w5-01 "$(cat e.txt)"
./w5_pipe three-stage 2> e.txt; res w5-v01b "$(cat e.txt)"
./w5_pipe dup2close 2> e.txt; res w5-d1 "$(cat e.txt)"
fin=()
for n in 10 100 200 1024; do timeout 3 ./w5_pipe twopipe $n 2>/dev/null; [ $? -eq 0 ] && fin+=("$n"); done
res w5-06a "$(IFS=,; echo "${fin[*]}")"
timeout 3 ./w5_pipe twopipe-late-close 10 2>/dev/null; res w5-v06b "$([ $? -eq 124 ] && echo hang || echo finished)"
hang=()
for n in 10240 61440 102400 3145728; do timeout 3 ./w5_pipe waitfirst $n 2>/dev/null; [ $? -eq 124 ] && hang+=("$n"); done
res w5-v09a "$(IFS=,; echo "${hang[*]}")"
timeout 3 ./w5_pipe waitfirst 65536 2>/dev/null; a=$?
timeout 3 ./w5_pipe waitfirst 65537 2>/dev/null; b=$?
res w5-c1 "$([ $a -eq 0 ] && [ $b -eq 124 ] && echo 65536 || echo "unexpected $a $b")"
timeout 2 sleep 60; res w5-s2 "$?"
s=$(date +%s); timeout -k 3 5 ./w5_pipe ignterm; st=$?; e=$(( $(date +%s) - s ))
res w5-s3 "status=$st elapsed=${e}s"
timeout -s KILL 2 sleep 10 2>/dev/null; res w5-s5 "$?"
seq 1 10 > a.txt; res w5-e1 "$(cat a.txt missing.txt 2>&1 | wc -l | tr -d ' ')"

echo "done → $OUT"
