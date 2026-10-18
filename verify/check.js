// 驗證 os-midterm-practice.html 裡的題目資料。
//   node verify/check.js
// 檢查項目：
//   1. 題目總數 = 200、各週題數、題型比例、欄位完整（答案 / 詳解 / 選項 / 多選標示）
//   2. 題庫的原題全部收錄、⚠️ 題每題至少 2 題變化題
//   3. 沒有重複題、沒有「只改一個字」的題目
//   4. 計算題：用下面的小模擬器重算答案（排程、頁面、read 回傳值、pipe 容量、CFS……）
//   5. C 程式題：比對 verify/c_results.tsv（由 verify/run_c.sh 實際編譯執行產生）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'os-midterm-practice.html'), 'utf8');
const m = html.match(/<script id="qdata" type="application\/json">([\s\S]*?)<\/script>/);
if (!m) throw new Error('question data not found in HTML');
const QS = JSON.parse(m[1]);

let fails = 0;
const fail = (msg) => { fails++; console.log('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);
const section = (t) => console.log('\n== ' + t + ' ==');

// ---------- 與網頁相同的填充題比對 ----------
function norm(s) { return String(s).trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ','); }
function asNum(s) {
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? parseFloat(s) : null;
}
function fillCorrect(input, accepted) {
  const a = norm(input);
  if (!a) return false;
  const na = asNum(a);
  return accepted.some((x) => {
    const b = norm(x);
    if (a === b) return true;
    const nb = asNum(b);
    return na !== null && nb !== null && Math.abs(na - nb) < 1e-9;
  });
}
const plain = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// =====================================================================
section('1. 題數、題型、欄位');
const WANT = { W2: 45, W3: 45, W4: 35, W5: 45, W6: 30 };
const byWeek = {}, byType = {};
QS.forEach((q) => { byWeek[q.week] = (byWeek[q.week] || 0) + 1; byType[q.type] = (byType[q.type] || 0) + 1; });
QS.length === 200 ? ok('題目總數 200') : fail('題目總數 ' + QS.length);
for (const [w, n] of Object.entries(WANT)) (byWeek[w] === n) ? ok(`${w}: ${n} 題`) : fail(`${w}: ${byWeek[w] || 0} 題（應為 ${n}）`);
const choice = (byType.single || 0) + (byType.multi || 0), fill = byType.fill || 0;
console.log(`  選擇題 ${choice}（單選 ${byType.single || 0}、多選 ${byType.multi || 0}）= ${(choice / QS.length * 100).toFixed(1)}%；填充題 ${fill} = ${(fill / QS.length * 100).toFixed(1)}%`);
(choice / QS.length >= 0.55 && choice / QS.length <= 0.65) ? ok('選擇 / 填充比例約 60 / 40') : fail('選擇 / 填充比例偏離 60 / 40');
const ids = new Set();
for (const q of QS) {
  if (ids.has(q.id)) fail('重複 id ' + q.id);
  ids.add(q.id);
  if (!q.q || plain(q.q).length < 15) fail(q.id + ': 題幹太短');
  if (!q.exp || plain(q.exp).length < 20) fail(q.id + ': 沒有詳解');
  if (!q.week || !q.topic || !q.src) fail(q.id + ': 缺週次 / 主題 / 出處');
  if (q.type === 'fill') {
    if (!Array.isArray(q.ans) || !q.ans.length) fail(q.id + ': 填充題沒有答案');
    if (q.opts) fail(q.id + ': 填充題不該有選項');
  } else {
    if (!Array.isArray(q.opts) || q.opts.length < 3) fail(q.id + ': 選項少於 3 個');
    if (new Set(q.opts.map(plain)).size !== q.opts.length) fail(q.id + ': 有重複的選項');
    if (q.type === 'single' && !(Number.isInteger(q.ans) && q.ans >= 0 && q.ans < q.opts.length)) fail(q.id + ': 單選答案無效');
    if (q.type === 'multi') {
      if (!Array.isArray(q.ans) || !q.ans.length || q.ans.some((i) => i < 0 || i >= q.opts.length)) fail(q.id + ': 多選答案無效');
      if (!/Select all that apply/.test(q.q)) fail(q.id + ': 多選題沒有標「Select all that apply」');
    } else if (/Select all that apply/.test(q.q)) fail(q.id + ': 單選題卻標了 Select all that apply');
  }
  if (/\bW[2-6]\b/.test(plain(q.q)) || (q.opts || []).some((o) => /\bW[2-6]\b/.test(plain(o)))) fail(q.id + ': 題幹或選項洩漏週次');
  if (/[一-鿿]/.test(plain(q.q).replace(/（選項為推測重建）/g, ''))) fail(q.id + ': 題幹含中文（題幹應為英文）');
}
ok('欄位檢查完成（每題都有題幹、答案、詳解、週次、主題）');
// 單選答案位置分布（避免答案都在同一個位置）
const pos = {};
QS.filter((q) => q.type === 'single').forEach((q) => { pos[q.ans] = (pos[q.ans] || 0) + 1; });
console.log('  單選題正確答案位置分布：' + Object.entries(pos).map(([k, v]) => `(${'abcdefgh'[k]}) ${v}`).join('、'));

// =====================================================================
section('2. 原題收錄與 ⚠️ 變化題');
const ORIG = {
  W2: 22, W3: 22, W4: 5, W5: 10,
};
const WARN = ['W2-01', 'W2-08', 'W2-11', 'W2-12', 'W2-13', 'W2-14', 'W2-15', 'W2-16', 'W2-17', 'W2-19',
  'W3-06', 'W3-17', 'W3-18', 'W3-21', 'W3-22', 'W4-04', 'W4-05', 'W5-05', 'W5-06', 'W5-07', 'W5-10'];
const origs = QS.filter((q) => q.src.startsWith('原題'));
const variants = QS.filter((q) => !q.src.startsWith('原題'));
console.log(`  原題改寫 ${origs.length} 題、變化題 / 新題 ${variants.length} 題`);
const missing = [];
for (const [w, n] of Object.entries(ORIG)) {
  for (let i = 1; i <= n; i++) {
    const tag = `${w}-${String(i).padStart(2, '0')}`;
    if (!origs.some((q) => new RegExp('原題 ' + tag + '\\b').test(q.src))) missing.push(tag);
  }
}
missing.length ? fail('沒收錄的原題：' + missing.join(', ')) : ok('題庫 Quiz 1–4 的 59 個原題全部收錄');
for (const t of WARN) {
  const n = variants.filter((q) => q.src.includes(t)).length;
  n >= 2 ? null : fail(`${t} ⚠️ 只有 ${n} 題變化題`);
}
ok('⚠️ 題的變化題數：' + WARN.map((t) => `${t}×${variants.filter((q) => q.src.includes(t)).length}`).join(' '));

// =====================================================================
section('3. 重複與近似題');
const toks = (q) => plain(q.q + ' ' + (q.opts || []).join(' ')).toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
const T = QS.map(toks);
function editDist(a, b) {
  const dp = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}
let closest = [];
for (let i = 0; i < QS.length; i++) {
  const si = new Set(T[i]);
  for (let j = i + 1; j < QS.length; j++) {
    const sj = new Set(T[j]);
    let inter = 0; si.forEach((x) => { if (sj.has(x)) inter++; });
    const jac = inter / (si.size + sj.size - inter);
    if (jac < 0.6) continue;
    const d = editDist(T[i], T[j]);
    closest.push([d, QS[i].id, QS[j].id]);
    if (d <= 2) {
      // 題庫本身的對照組（例如 W2-17 的 P1 / P2 只差一行 fflush）照原樣收錄，其餘一律不允許
      const bothOrig = QS[i].src.startsWith('原題') && QS[j].src.startsWith('原題') && QS[i].group === QS[j].group;
      if (bothOrig) console.log(`  · ${QS[i].id} / ${QS[j].id} 只差 ${d} 個字：這是題庫原題本身的對照組，答案不同，保留`);
      else fail(`${QS[i].id} 與 ${QS[j].id} 只差 ${d} 個字`);
    }
  }
}
closest.sort((a, b) => a[0] - b[0]);
ok('沒有完全相同、或只差 1–2 個字的題目（題庫原題的對照組除外）');
console.log('  最相近的幾組（字數差）：' + closest.slice(0, 6).map(([d, a, b]) => `${a}/${b}:${d}`).join('  '));

// =====================================================================
section('4. 計算題重算');
// --- 排程模擬器 ---
function simulate(policy, jobs, q) {
  const J = jobs.map(([name, arrive, burst], idx) => ({ name, arrive, burst, rem: burst, idx, first: null, done: null }));
  let t = 0;
  const arrived = (x) => x.arrive <= t && x.rem > 0;
  const left = () => J.some((x) => x.rem > 0);
  if (policy === 'fifo' || policy === 'sjf') {
    while (left()) {
      let cand = J.filter(arrived);
      if (!cand.length) { t = Math.min(...J.filter((x) => x.rem > 0).map((x) => x.arrive)); continue; }
      if (policy === 'fifo') cand.sort((a, b) => a.arrive - b.arrive || a.idx - b.idx);
      else cand.sort((a, b) => a.burst - b.burst || a.arrive - b.arrive || a.idx - b.idx);
      const x = cand[0];
      x.first = t; t += x.rem; x.rem = 0; x.done = t;
    }
  } else if (policy === 'stcf') {
    const dt = 0.5;
    while (left()) {
      const cand = J.filter(arrived).sort((a, b) => a.rem - b.rem || a.arrive - b.arrive || a.idx - b.idx);
      if (!cand.length) { t += dt; continue; }
      const x = cand[0];
      if (x.first === null) x.first = t;
      x.rem -= dt; t += dt;
      if (x.rem <= 1e-9) { x.rem = 0; x.done = t; }
    }
  } else if (policy === 'rr') {
    const queue = [];
    const pending = J.slice().sort((a, b) => a.arrive - b.arrive || a.idx - b.idx);
    const admit = () => { while (pending.length && pending[0].arrive <= t) queue.push(pending.shift()); };
    admit();
    while (left()) {
      if (!queue.length) { t = pending[0].arrive; admit(); continue; }
      const x = queue.shift();
      if (x.first === null) x.first = t;
      const run = Math.min(q, x.rem);
      t += run; x.rem -= run;
      admit();                         // 先讓這段期間抵達的人排進去
      if (x.rem > 0) queue.push(x); else x.done = t;
    }
  }
  return J.map((x) => ({ name: x.name, turnaround: x.done - x.arrive, response: x.first - x.arrive, waiting: x.done - x.arrive - x.burst }));
}
const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
function schedMetric(c) {
  const r = simulate(c.policy, c.jobs, c.q);
  if (c.metric === 'avgTurnaround') return avg(r.map((x) => x.turnaround));
  if (c.metric === 'avgResponse') return avg(r.map((x) => x.response));
  const j = r.find((x) => x.name === c.job);
  return j[c.metric];
}
// 先用講義上的數字檢查模擬器本身
const selfTest = [
  [schedMetric({ policy: 'fifo', jobs: [['Dog', 0, 60], ['Capoo', 0, 6], ['Mika', 0, 6]], metric: 'avgTurnaround' }), 66, '講義 FIFO 66'],
  [schedMetric({ policy: 'sjf', jobs: [['Dog', 0, 60], ['Capoo', 0, 6], ['Mika', 0, 6]], metric: 'avgTurnaround' }), 30, '講義 SJF 30'],
  [schedMetric({ policy: 'sjf', jobs: [['Dog', 0, 60], ['Capoo', 6, 6], ['Mika', 6, 6]], metric: 'avgTurnaround' }), 62, '講義 SJF 晚到 62'],
  [schedMetric({ policy: 'stcf', jobs: [['Dog', 0, 60], ['Capoo', 6, 6], ['Mika', 6, 6]], metric: 'avgTurnaround' }), 30, '講義 STCF 30'],
  [schedMetric({ policy: 'stcf', jobs: [['Dog', 0, 60], ['Capoo', 6, 6], ['Mika', 30, 6]], metric: 'avgTurnaround' }), 28, '講義 STCF Mika@30 = 28'],
  [schedMetric({ policy: 'fifo', jobs: [['Dog', 0, 8], ['Capoo', 1, 4], ['Mika', 2, 2]], metric: 'avgTurnaround' }), 31 / 3, '講義 7-Eleven FIFO 10.33'],
  [schedMetric({ policy: 'sjf', jobs: [['Dog', 0, 8], ['Capoo', 1, 4], ['Mika', 2, 2]], metric: 'avgTurnaround' }), 29 / 3, '講義 7-Eleven SJF 9.67'],
  [schedMetric({ policy: 'stcf', jobs: [['Dog', 0, 8], ['Capoo', 1, 4], ['Mika', 2, 2]], metric: 'avgTurnaround' }), 22 / 3, '講義 7-Eleven STCF 7.33'],
  [schedMetric({ policy: 'rr', q: 1, jobs: [['A', 0, 4], ['B', 0, 4], ['C', 0, 4]], metric: 'avgTurnaround' }), 11, '講義 RR q=1 turnaround 11'],
  [schedMetric({ policy: 'rr', q: 1, jobs: [['A', 0, 4], ['B', 0, 4], ['C', 0, 4]], metric: 'avgResponse' }), 1, '講義 RR q=1 response 1'],
  [schedMetric({ policy: 'rr', q: 2, jobs: [['A', 0, 4], ['B', 0, 4], ['C', 0, 4]], metric: 'avgTurnaround' }), 10, '講義 RR q=2 turnaround 10'],
  [schedMetric({ policy: 'rr', q: 2, jobs: [['A', 0, 4], ['B', 0, 4], ['C', 0, 4]], metric: 'avgResponse' }), 2, '講義 RR q=2 response 2'],
];
for (const [got, want, name] of selfTest) Math.abs(got - want) < 1e-6 ? null : fail(`模擬器自我檢查失敗：${name}（算出 ${got}）`);
ok('排程模擬器重現講義上的 12 個數字');

const CALC = {
  rssAfterTouch: (c) => (c.vsz !== undefined ? [c.vsz, c.base + c.touched] : c.base + c.touched),
  pages: (c) => { const n = new Set(c.offsets.map((o) => Math.floor(o / c.pageSize))).size; return c.unit === 'KiB' ? n * c.pageSize / 1024 : n; },
  eye: (c) => { const s = new Set(); for (let i = 0; i < c.n; i++) s.add(Math.floor((i * c.n * c.elem + i * c.elem) / c.pageSize)); return s.size * c.pageSize / 1024; },
  readSeq: (c) => { let off = 0; const r = c.reqs.map((q) => { const n = Math.max(0, Math.min(q, c.size - off)); off += n; return n; }); return r[c.which]; },
  readChars: (c) => { let off = 0; const got = c.reqs.map((q) => { const s = c.content.slice(off, off + q); off += s.length; return s; }); return c.pick.map((i) => got[i][0]).join(''); },
  pathWalk: (c) => { const k = c.path.split('/').filter(Boolean).length; return c.expect ? [k, k] : k; },
  overcommit: (c) => { const full = c.dram / c.limit; return [full, (c.dram / c.avg) / full]; },
  linkMem: (c) => [c.n * c.lib, c.lib],
  linkDisk: (c) => (c.mode === 'dynamic' ? c.n * c.own + c.lib : c.n * (c.own + c.lib)),
  twoPipe: (c) => { const th = c.a + c.b + c.chunk; return c.opts ? c.opts.map((n, i) => (n <= th ? i : -1)).filter((i) => i >= 0) : th; },
  waitFirst: (c) => c.opts.map((n, i) => (n > c.cap ? i : -1)).filter((i) => i >= 0),
  cycles: (c) => c.ghz * 1e9 / c.hz,
  timeline: (c) => {
    const done = c.runs[c.runs.length - 1][1], burst = c.runs.reduce((s, [a, b]) => s + b - a, 0);
    return { turnaround: done - c.arrive, response: c.runs[0][0] - c.arrive, waiting: done - c.arrive - burst }[c.metric];
  },
  sched: schedMetric,
  predict: (c) => c.bursts.reduce((g, b) => c.alpha * b + (1 - c.alpha) * g, c.guess),
  cfsShare: (c) => c.weights[c.which] / c.weights.reduce((s, w) => s + w, 0) * 100,
  cfsDv: (c) => c.run * 1024 / c.weight,
  cfsSlice: (c) => c.latency * c.weights[c.which] / c.weights.reduce((s, w) => s + w, 0),
  overhead: (c) => c.sw / (c.slice + c.sw) * 100,
  aging: (c) => (c.high - c.start + 1) * c.step,
};
const decimals = (s) => (String(s).split('.')[1] || '').length;
const numsIn = (s) => (plain(s).match(/\d+(\.\d+)?/g) || []).map(Number);
const isSubseq = (need, have) => { let k = 0; for (const h of have) if (k < need.length && Math.abs(h - need[k]) < 1e-9) k++; return k === need.length; };
let calcN = 0;
for (const q of QS.filter((x) => x.calc)) {
  calcN++;
  const fn = CALC[q.calc.fn];
  if (!fn) { fail(q.id + ': 未知的計算 ' + q.calc.fn); continue; }
  const v = fn(q.calc);
  if (q.type === 'fill') {
    if (typeof v === 'string') { fillCorrect(v, q.ans) ? null : fail(`${q.id}: 重算 ${v}，答案 ${q.ans[0]}`); continue; }
    const want = parseFloat(q.ans[0]);
    const rounded = Number(v.toFixed(decimals(q.ans[0])));
    Math.abs(rounded - want) < 1e-9 ? null : fail(`${q.id}: 重算 ${v}，答案 ${q.ans[0]}`);
  } else if (q.type === 'multi') {
    const a = q.ans.slice().sort().join(','), b = v.slice().sort().join(',');
    a === b ? null : fail(`${q.id}: 重算出正確選項 ${b}，答案是 ${a}`);
  } else {
    const exp = q.calc.expect;
    if (JSON.stringify(v) !== JSON.stringify(exp)) fail(`${q.id}: 重算 ${JSON.stringify(v)}，預期 ${JSON.stringify(exp)}`);
    if (!isSubseq(exp, numsIn(q.opts[q.ans]))) fail(`${q.id}: 正確選項裡找不到 ${exp}`);
    q.opts.forEach((o, i) => { if (i !== q.ans && isSubseq(exp, numsIn(o))) fail(`${q.id}: 選項 ${i} 也符合 ${exp}`); });
  }
}
ok(`${calcN} 題計算題全部重算一致`);

// =====================================================================
section('5. C 程式實測結果');
const tsv = path.join(__dirname, 'c_results.tsv');
if (!fs.existsSync(tsv)) fail('找不到 verify/c_results.tsv，請先執行 bash verify/run_c.sh');
else {
  const R = {};
  fs.readFileSync(tsv, 'utf8').split('\n').filter(Boolean).forEach((l) => { const [k, ...v] = l.split('\t'); R[k] = v.join('\t'); });
  let n = 0;
  for (const q of QS.filter((x) => x.cprog)) {
    n++;
    const got = R[q.id];
    if (got === undefined) { fail(`${q.id}: 沒有實測結果`); continue; }
    let good;
    if (q.id === 'w5-s3') {
      const mm = got.match(/status=(\d+) elapsed=(\d+)s/);
      good = mm && mm[1] === '137' && +mm[2] >= 7 && +mm[2] <= 9;
    } else if (q.cexpect !== undefined) good = got === q.cexpect;
    else good = fillCorrect(got, q.ans);
    good ? null : fail(`${q.id}: 實測「${got}」與題目答案「${q.cexpect !== undefined ? q.cexpect : q.ans[0]}」不符`);
  }
  ok(`${n} 題 C 程式題與實測結果一致`);
}

console.log('\n' + (fails ? `FAILED: ${fails} 個問題` : 'ALL CHECKS PASSED'));
process.exitCode = fails ? 1 : 0;
