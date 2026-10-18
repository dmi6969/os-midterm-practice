// 用真的瀏覽器（headless Chrome）打開 os-midterm-practice.html，逐題作答，檢查：
//   1. 每一題用正確答案作答都判為「答對」，用錯誤答案作答都判為「答錯」
//   2. 送出後鎖定、顯示正確答案與詳解（含週次）
//   3. 重新整理後作答紀錄還在（localStorage）
//   4. 「只看答錯的題目」只顯示答錯的題、「全部重來」會清空
//   5. 手機寬度沒有水平捲動
// 用法：NODE_PATH=<含 puppeteer-core 的 node_modules> node verify/browser_test.js [chrome 路徑]
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE = 'file:///' + path.resolve(__dirname, '..', 'os-midterm-practice.html').replace(/\\/g, '/');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'out');

function fail(msg) { console.error('FAIL:', msg); process.exitCode = 1; }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const QS = await page.evaluate(() => JSON.parse(document.getElementById('qdata').textContent));
  console.log('questions in page:', QS.length);

  // 錯誤答案：選擇題選第一個不對的選項；填充題填 "zzz"
  const wrongResp = (q) => {
    if (q.type === 'fill') return 'zzz-wrong';
    if (q.type === 'single') return q.opts.findIndex((_, i) => i !== q.ans);
    const all = q.opts.map((_, i) => i);
    const w = all.filter((i) => !q.ans.includes(i));
    return w.length ? [w[0]] : q.ans.slice(0, q.ans.length - 1);
  };

  let okCount = 0, wrongCount = 0;
  for (let i = 0; i < QS.length; i++) {
    const q = QS[i];
    const answerRight = i % 4 !== 3; // 每 4 題故意答錯 1 題
    // 跳到這一題：打開題號格子點下去
    await page.evaluate((n) => {
      if (document.getElementById('grid').hidden) document.getElementById('bGrid').click();
      const cell = [...document.querySelectorAll('#grid .cell')].find((b) => b.textContent === String(n));
      cell.click();
    }, i + 1);
    const head = await page.$eval('#card .qno', (e) => e.textContent);
    if (head !== `第 ${i + 1} 題`) fail(`navigation to ${i + 1} shows "${head}"`);
    // 作答前不能看到週次
    const leak = await page.$eval('#card', (e) => /\bW[2-6]\b/.test(e.querySelector('.stem').textContent + [...e.querySelectorAll('.qhead')].map((x) => x.textContent).join('')));
    if (leak) fail(`${q.id}: week label visible before submit`);

    if (q.type === 'fill') {
      // 正確作答時，輪流用不同的可接受答案並加上大小寫 / 空白干擾
      let v = answerRight ? q.ans[i % q.ans.length] : wrongResp(q);
      if (answerRight) v = '  ' + (i % 2 ? v.toUpperCase() : v) + ' ';
      await page.click('#fillIn');
      await page.type('#fillIn', v);
    } else {
      const picks = answerRight ? (q.type === 'single' ? [q.ans] : q.ans) : [].concat(wrongResp(q));
      for (const k of picks) await page.click(`#card .opt:nth-of-type(${k + 1})`);
    }
    await page.click('#bSubmit');
    const res = await page.evaluate(() => {
      const v = document.querySelector('#card .verdict');
      const meta = document.querySelector('#card .meta');
      const exp = document.querySelector('#card .exp');
      const locked = document.querySelector('#bSubmit').disabled &&
        [...document.querySelectorAll('#card input')].every((x) => x.disabled);
      return { verdict: v && v.textContent, meta: meta && meta.textContent, exp: exp && exp.textContent.length, locked };
    });
    const want = answerRight ? '✓ 答對了' : '✗ 答錯了';
    if (res.verdict !== want) fail(`${q.id} (#${i + 1}): expected "${want}", got "${res.verdict}"`);
    if (!res.locked) fail(`${q.id}: not locked after submit`);
    if (!res.meta || !res.meta.includes(q.week)) fail(`${q.id}: week tag missing after submit`);
    if (!res.exp || res.exp < 20) fail(`${q.id}: explanation missing`);
    answerRight ? okCount++ : wrongCount++;
  }
  console.log(`answered all: ${okCount} right, ${wrongCount} wrong`);

  const statsText = async () => page.evaluate(() => ['sAns', 'sOk', 'sAcc'].map((id) => document.getElementById(id).textContent).join(' '));
  const before = await statsText();
  console.log('stats:', before);
  if (before.split(' ')[0] !== String(QS.length)) fail('answered count mismatch');

  // 重新整理後還在
  await page.reload();
  const after = await statsText();
  if (after !== before) fail(`after reload stats changed: ${before} -> ${after}`);
  else console.log('reload keeps progress: OK');

  // 只看答錯的題目
  await page.click('#bWrong');
  const wrongCells = await page.evaluate(() => [...document.querySelectorAll('#grid .cell')].map((b) => b.className));
  if (wrongCells.length !== wrongCount || wrongCells.some((c) => !c.includes('bad'))) fail(`wrong-only filter shows ${wrongCells.length} cells`);
  else console.log('wrong-only filter: OK (' + wrongCells.length + ')');
  // 在錯題模式下一題 / 上一題只在錯題間移動
  const posText = await page.$eval('#pos', (e) => e.textContent);
  console.log('wrong-only position label:', posText);
  await page.click('#bWrong');

  await page.screenshot({ path: path.join(SHOTS, 'desktop.png'), fullPage: false });

  // 手機寬度
  await page.setViewport({ width: 375, height: 800, isMobile: true, hasTouch: true });
  let maxOverflow = 0;
  for (let i = 0; i < QS.length; i++) {
    await page.evaluate((id) => {
      const s = JSON.parse(localStorage.getItem('os-midterm-practice-2026')); s.cur = id; s.grid = false;
      localStorage.setItem('os-midterm-practice-2026', JSON.stringify(s));
    }, QS[i].id);
    if (i % 25 === 0 || i === QS.length - 1) {
      await page.reload();
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      maxOverflow = Math.max(maxOverflow, ov);
    }
  }
  // 每一題都檢查一次頁面寬度（不重新整理，直接用下一題按鈕走過去）
  await page.evaluate((id) => {
    const s = JSON.parse(localStorage.getItem('os-midterm-practice-2026')); s.cur = id;
    localStorage.setItem('os-midterm-practice-2026', JSON.stringify(s));
  }, QS[0].id);
  await page.reload();
  for (let i = 0; i < QS.length; i++) {
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (ov > 0) fail(`mobile horizontal overflow ${ov}px on #${i + 1}`);
    maxOverflow = Math.max(maxOverflow, ov);
    if (i < QS.length - 1) await page.click('#bNext');
  }
  console.log('mobile max horizontal overflow:', maxOverflow, 'px');
  await page.screenshot({ path: path.join(SHOTS, 'mobile.png'), fullPage: true });

  // 全部重來
  page.on('dialog', (d) => d.accept());
  await page.click('#bReset');
  const reset = await statsText();
  if (!reset.startsWith('0 ')) fail('reset did not clear: ' + reset);
  else console.log('reset: OK');

  if (errors.length) fail('page errors: ' + errors.join(' | '));
  else console.log('no console errors');
  await browser.close();
  console.log(process.exitCode ? 'BROWSER TEST FAILED' : 'BROWSER TEST PASSED');
})();
