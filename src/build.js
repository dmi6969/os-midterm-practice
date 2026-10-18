// 把 src/w2.js … w6.js 的題目打散，塞進 template.html，輸出單一檔案 os-midterm-practice.html
// 用法：node src/build.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'os-midterm-practice.html');

let qs = [];
for (const w of ['w2', 'w3', 'w4', 'w5', 'w6']) {
  const f = path.join(__dirname, w + '.js');
  if (fs.existsSync(f)) qs = qs.concat(require(f));
}

// ---- 調整正確選項的位置（避免答案集中在同一個字母）----
// place 只用在詳解沒有提到選項字母的題目上：把正確選項和 place 位置的選項互換。
const PLACE = {
  'w3-v17b': 3, 'w4-v04a': 3, 'w4-v05c': 3, 'w4-v01b': 3, 'w4-n01': 3, 'w4-n06': 3, 'w4-n09': 3,
  'w5-v05c': 3, 'w5-v06b': 3, 'w5-r2': 3, 'w6-26': 3,
  'w3-v18a': 2, 'w4-v04c': 2, 'w4-n08': 2, 'w4-n11': 2, 'w5-v01a': 2, 'w5-v04': 2, 'w5-d1': 2,
};
for (const q of qs) {
  if (!(q.id in PLACE)) continue;
  const to = PLACE[q.id];
  if (q.type !== 'single' || /\([a-h]\)/.test(q.exp)) throw new Error(q.id + ': cannot move answer');
  [q.opts[q.ans], q.opts[to]] = [q.opts[to], q.opts[q.ans]];
  q.ans = to;
}

// ---- 基本欄位檢查 ----
const ids = new Set();
for (const q of qs) {
  const where = q.id || JSON.stringify(q).slice(0, 80);
  for (const k of ['id', 'week', 'topic', 'src', 'group', 'type', 'q', 'exp']) {
    if (!q[k]) throw new Error(`${where}: missing ${k}`);
  }
  if (ids.has(q.id)) throw new Error('duplicate id ' + q.id);
  ids.add(q.id);
  if (q.type === 'single') {
    if (!Array.isArray(q.opts) || !Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.opts.length) throw new Error(where + ': bad single');
  } else if (q.type === 'multi') {
    if (!Array.isArray(q.opts) || !Array.isArray(q.ans) || !q.ans.length || q.ans.some((i) => i < 0 || i >= q.opts.length)) throw new Error(where + ': bad multi');
    if (!/Select all that apply/.test(q.q)) throw new Error(where + ': multi without "Select all that apply"');
  } else if (q.type === 'fill') {
    if (!Array.isArray(q.ans) || !q.ans.length || q.ans.some((a) => typeof a !== 'string' || !a.trim())) throw new Error(where + ': bad fill');
  } else throw new Error(where + ': bad type ' + q.type);
}

// ---- 固定種子打散，並避免同一來源的題目相鄰 ----
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261019);
for (let i = qs.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [qs[i], qs[j]] = [qs[j], qs[i]];
}
const clash = (a, b) => a && b && (a.group === b.group);
for (let pass = 0; pass < 5; pass++) {
  for (let i = 1; i < qs.length; i++) {
    if (!clash(qs[i], qs[i - 1])) continue;
    for (let j = 0; j < qs.length; j++) {
      if (Math.abs(j - i) <= 1) continue;
      // 把 qs[i] 換到 j 之後，兩邊都不能撞
      const okHere = !clash(qs[j], qs[i - 1]) && !clash(qs[j], qs[i + 1]);
      const okThere = !clash(qs[i], qs[j - 1]) && !clash(qs[i], qs[j + 1]);
      if (okHere && okThere) { [qs[i], qs[j]] = [qs[j], qs[i]]; break; }
    }
  }
}

const json = JSON.stringify(qs).replace(/</g, '\\u003c');
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
if (!tpl.includes('/*__QDATA__*/')) throw new Error('template placeholder missing');
fs.writeFileSync(OUT, tpl.replace('/*__QDATA__*/', () => json));

const count = {};
qs.forEach((q) => { count[q.week] = (count[q.week] || 0) + 1; });
const types = {};
qs.forEach((q) => { types[q.type] = (types[q.type] || 0) + 1; });
console.log('wrote', path.relative(ROOT, OUT), '—', qs.length, 'questions', count, types);
