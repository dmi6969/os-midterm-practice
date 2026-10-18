// 把題目打散，塞進 template.html，輸出單一檔案的練習網頁。
//   第一回：src/w2.js … w6.js       → os-midterm-practice.html
//   第二回：src/set2/w2.js … w6.js  → os-midterm-practice-2.html
// 用法：node src/build.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TPL = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');

const SETS = [
  {
    dir: __dirname, out: 'os-midterm-practice.html', title: 'OS 期中練習 · 第一回',
    key: 'os-midterm-practice-2026', seed: 20261019,
    other: '<a class="tbtn" id="otherSet" href="os-midterm-practice-2.html">第二回 →</a>',
    // 調整正確選項的位置（避免答案集中在同一個字母）；只用在詳解沒有提到選項字母的題目上
    place: {
      'w3-v17b': 3, 'w4-v04a': 3, 'w4-v05c': 3, 'w4-v01b': 3, 'w4-n01': 3, 'w4-n06': 3, 'w4-n09': 3,
      'w5-v05c': 3, 'w5-v06b': 3, 'w5-r2': 3, 'w6-26': 3,
      'w3-v18a': 2, 'w4-v04c': 2, 'w4-n08': 2, 'w4-n11': 2, 'w5-v01a': 2, 'w5-v04': 2, 'w5-d1': 2,
    },
  },
  {
    dir: path.join(__dirname, 'set2'), out: 'os-midterm-practice-2.html', title: 'OS 期中練習 · 第二回',
    key: 'os-midterm-practice-2026-set2', seed: 20261020,
    other: '<a class="tbtn" id="otherSet" href="os-midterm-practice.html">← 第一回</a>',
    place: {},
    // 第二回的詳解不寫選項字母，單選題的正確選項位置依 id 的雜湊決定（標 keep 的題目保持原順序）
    autoPlace: true,
  },
];

function hash(s) {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const allIds = new Set();
for (const S of SETS) {
  let qs = [];
  for (const w of ['w2', 'w3', 'w4', 'w5', 'w6']) {
    const f = path.join(S.dir, w + '.js');
    if (fs.existsSync(f)) qs = qs.concat(require(f));
  }
  if (!qs.length) continue;

  // ---- 正確選項換位置：S.place 或題目自己的 place 欄位 ----
  for (const q of qs) {
    let to = q.id in S.place ? S.place[q.id] : q.place;
    if (to === undefined && S.autoPlace && q.type === 'single' && !q.keep && !/\([a-h]\)/.test(q.exp)) to = hash(q.id) % q.opts.length;
    delete q.place;
    delete q.keep;
    if (to === undefined || to === q.ans) continue;
    if (q.type !== 'single' || /\([a-h]\)/.test(q.exp)) throw new Error(q.id + ': cannot move answer');
    [q.opts[q.ans], q.opts[to]] = [q.opts[to], q.opts[q.ans]];
    q.ans = to;
  }

  // ---- 基本欄位檢查 ----
  for (const q of qs) {
    const where = q.id || JSON.stringify(q).slice(0, 80);
    for (const k of ['id', 'week', 'topic', 'src', 'group', 'type', 'q', 'exp']) {
      if (!q[k]) throw new Error(`${where}: missing ${k}`);
    }
    if (allIds.has(q.id)) throw new Error('duplicate id ' + q.id);
    allIds.add(q.id);
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
  const rnd = mulberry32(S.seed);
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
        const okHere = !clash(qs[j], qs[i - 1]) && !clash(qs[j], qs[i + 1]);
        const okThere = !clash(qs[i], qs[j - 1]) && !clash(qs[i], qs[j + 1]);
        if (okHere && okThere) { [qs[i], qs[j]] = [qs[j], qs[i]]; break; }
      }
    }
  }

  const json = JSON.stringify(qs).replace(/</g, '\\u003c');
  const html = TPL.split('{{TITLE}}').join(S.title).split('{{KEY}}').join(S.key).split('{{OTHER}}').join(S.other)
    .replace('/*__QDATA__*/', () => json);
  fs.writeFileSync(path.join(ROOT, S.out), html);

  const count = {}, types = {};
  qs.forEach((q) => { count[q.week] = (count[q.week] || 0) + 1; types[q.type] = (types[q.type] || 0) + 1; });
  console.log('wrote', S.out, '—', qs.length, 'questions', count, types);
}
