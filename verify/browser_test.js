// 用真的瀏覽器（headless Chrome）打開練習網頁，逐題作答並測試所有功能：
//   1. 每一題用正確答案作答都判為「答對」，用錯誤答案作答都判為「答錯」；送出後鎖定、顯示答案與詳解（含週次）
//   2. 作答前看不到週次；重新整理後作答紀錄還在（localStorage）
//   3. 「只看答錯」「曾經答錯」篩選；「重做這題」；「重做錯題」整輪重做、再重做仍答錯的；重做後答對標成「已訂正」
//   4. 舊版紀錄格式可以讀進來；「全部重來」清空；手機寬度沒有水平捲動
// 用法：NODE_PATH=<含 puppeteer-core 的 node_modules> node verify/browser_test.js [html 檔名 ...]
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILES = process.argv.slice(2).length ? process.argv.slice(2) : ['os-midterm-practice.html', 'os-midterm-practice-2.html'];
const SHOTS = process.env.SHOTS || path.join(__dirname, 'out');

let failed = 0;
function fail(msg) { console.error('  FAIL:', msg); failed++; }

async function testFile(browser, file) {
  console.log('\n=== ' + file + ' ===');
  const url = 'file:///' + path.resolve(__dirname, '..', file).split(path.sep).join('/');
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto(url);
  const KEY = await page.evaluate(() => {
    const m = [...document.scripts].map((s) => s.textContent).join('').match(/var KEY = '([^']+)'/);
    return m && m[1];
  });
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload();
  const QS = await page.evaluate(() => JSON.parse(document.getElementById('qdata').textContent));
  console.log('  questions:', QS.length, ' storage key:', KEY);
  const byId = Object.fromEntries(QS.map((q, i) => [q.id, i]));

  const wrongResp = (q) => {
    if (q.type === 'fill') return 'zzz-wrong';
    if (q.type === 'single') return q.opts.findIndex((_, i) => i !== q.ans);
    const w = q.opts.map((_, i) => i).filter((i) => !q.ans.includes(i));
    return w.length ? [w[0]] : q.ans.slice(0, q.ans.length - 1);
  };
  const openGrid = () => page.evaluate(() => { if (document.getElementById('grid').hidden) document.getElementById('bGrid').click(); });
  const goNum = async (n) => {
    await openGrid();
    await page.evaluate((n) => { [...document.querySelectorAll('#grid .cell')].find((b) => b.textContent === String(n)).click(); }, n);
  };
  const answer = async (q, right, i) => {
    if (q.type === 'fill') {
      let v = right ? q.ans[i % q.ans.length] : wrongResp(q);
      if (right) v = '  ' + (i % 2 ? v.toUpperCase() : v) + ' ';
      await page.click('#fillIn');
      await page.type('#fillIn', v);
    } else {
      const picks = right ? (q.type === 'single' ? [q.ans] : q.ans) : [].concat(wrongResp(q));
      for (const k of picks) await page.click(`#card .opt:nth-of-type(${k + 1})`);
    }
    await page.click('#bSubmit');
    return page.evaluate(() => {
      const v = document.querySelector('#card .verdict');
      const meta = document.querySelector('#card .meta');
      const exp = document.querySelector('#card .exp');
      const locked = document.querySelector('#bSubmit').disabled && [...document.querySelectorAll('#card input')].every((x) => x.disabled);
      return { verdict: v && v.textContent, meta: meta && meta.textContent, exp: exp ? exp.textContent.length : 0, locked,
        note: (document.querySelector('#card .note') || {}).textContent || '' };
    });
  };
  const stats = () => page.evaluate(() => ['sAns', 'sOk', 'sAcc', 'sBad'].map((id) => document.getElementById(id).textContent));
  const cells = () => page.evaluate(() => [...document.querySelectorAll('#grid .cell')].map((b) => ({ n: +b.textContent, cls: b.className })));

  // ---- 1. 逐題作答 ----
  let okN = 0, badN = 0;
  const wrongIds = [];
  for (let i = 0; i < QS.length; i++) {
    const q = QS[i];
    const right = i % 4 !== 3;
    await goNum(i + 1);
    const head = await page.$eval('#card .qno', (e) => e.textContent);
    if (head !== `第 ${i + 1} 題`) fail(`navigation to ${i + 1} shows "${head}"`);
    const leak = await page.$eval('#card', (e) => /\bW[2-6]\b/.test(e.querySelector('.stem').textContent + e.querySelector('.qhead').textContent));
    if (leak) fail(`${q.id}: week visible before submit`);
    const res = await answer(q, right, i);
    const want = right ? '✓ 答對了' : '✗ 答錯了';
    if (res.verdict !== want) fail(`${q.id} (#${i + 1}): expected "${want}", got "${res.verdict}"`);
    if (!res.locked) fail(`${q.id}: not locked after submit`);
    if (!res.meta || !res.meta.includes(q.week)) fail(`${q.id}: week tag missing after submit`);
    if (res.exp < 20) fail(`${q.id}: explanation missing`);
    if (right) okN++; else { badN++; wrongIds.push(q.id); }
  }
  let s = await stats();
  console.log(`  answered all: ${okN} right, ${badN} wrong → stats ${s.join(' / ')}`);
  if (+s[0] !== QS.length || +s[1] !== okN || +s[3] !== badN) fail('stats mismatch ' + s);

  await page.reload();
  const s2 = await stats();
  if (s2.join() !== s.join()) fail('reload changed stats'); else console.log('  reload keeps progress: OK');

  // ---- 2. 篩選 ----
  await openGrid();
  await page.click('#fWrong');
  let cs = await cells();
  if (cs.length !== badN || cs.some((c) => !c.cls.includes('bad'))) fail(`wrong filter shows ${cs.length} cells`); else console.log('  只看答錯: OK (' + cs.length + ')');
  await page.click('#fAll');

  // ---- 3a. 重做這題 ----
  const one = wrongIds[0];
  await goNum(byId[one] + 1);
  await page.click('#bRedoOne');
  const unlocked = await page.evaluate(() => document.querySelector('#bSubmit').textContent === '送出' && !document.querySelector('#card .result'));
  if (!unlocked) fail('重做這題 did not unlock the question');
  let r = await answer(QS[byId[one]], true, 0);
  if (r.verdict !== '✓ 答對了' || !r.note.includes('之前答錯 1 次')) fail('redo-one result: ' + JSON.stringify(r));
  s = await stats();
  if (+s[3] !== badN - 1) fail('wrong count after redo-one: ' + s[3]); else console.log('  重做這題: OK（錯題剩 ' + s[3] + '）');

  // ---- 3b. 重做錯題（整輪）----
  const redoIds = wrongIds.slice(1);
  await page.click('#bRedo');
  cs = await cells();
  if (cs.length !== redoIds.length || cs.some((c) => /\b(ok|bad|fixed)\b/.test(c.cls))) fail(`redo round shows ${cs.length} cells, classes ${cs.map((c) => c.cls).join('|').slice(0, 80)}`);
  const banner1 = await page.$eval('#banner', (e) => e.textContent);
  if (!banner1.includes('錯題重做')) fail('redo banner missing');
  // 第一題再答錯一次，其餘答對
  for (let k = 0; k < redoIds.length; k++) {
    const q = QS[byId[redoIds[k]]];
    await goNum(byId[q.id] + 1);
    r = await answer(q, k !== 0, k);
    if (r.verdict !== (k !== 0 ? '✓ 答對了' : '✗ 答錯了')) fail(`redo ${q.id}: ${r.verdict}`);
  }
  s = await stats();
  if (+s[3] !== 1) fail('after redo round wrong count = ' + s[3]);
  const again = await page.$('#bRedoAgain');
  if (!again) fail('「再重做仍答錯的」button missing'); else console.log('  重做錯題（' + redoIds.length + ' 題）: OK，仍答錯 1 題');
  cs = await cells();
  const fixedN = cs.filter((c) => c.cls.includes('fixed')).length;
  if (fixedN !== redoIds.length - 1) fail('fixed cells in redo grid: ' + fixedN);
  // 再重做那 1 題
  await page.click('#bRedoAgain');
  cs = await cells();
  if (cs.length !== 1) fail('second redo round size ' + cs.length);
  r = await answer(QS[byId[redoIds[0]]], true, 1);
  if (!r.note.includes('之前答錯 2 次')) fail('second redo note: ' + r.note);
  const banner2 = await page.$eval('#banner', (e) => e.textContent);
  if (!banner2.includes('全部訂正')) fail('banner after all fixed: ' + banner2); else console.log('  再重做仍答錯的: OK（全部訂正）');
  await page.click('#bRedoExit');
  s = await stats();
  if (+s[3] !== 0 || +s[1] !== QS.length) fail('final stats ' + s);
  await page.click('#fEver');
  cs = await cells();
  if (cs.length !== badN || cs.some((c) => !c.cls.includes('fixed'))) fail(`曾經答錯 filter shows ${cs.length}`); else console.log('  曾經答錯: OK (' + cs.length + '，全部標成已訂正)');
  const redoDisabled = await page.$eval('#bRedo', (b) => b.disabled);
  if (!redoDisabled) fail('重做錯題 should be disabled when no wrong answers');
  await page.click('#fAll');
  await page.reload();
  s = await stats();
  if (+s[1] !== QS.length) fail('reload after redo lost data');
  await page.screenshot({ path: path.join(SHOTS, path.basename(file, '.html') + '-desktop.png') });

  // ---- 4. 手機寬度 ----
  await page.setViewport({ width: 375, height: 800, isMobile: true, hasTouch: true });
  await page.evaluate((k, id) => { const st = JSON.parse(localStorage.getItem(k)); st.cur = id; st.grid = false; localStorage.setItem(k, JSON.stringify(st)); }, KEY, QS[0].id);
  await page.reload();
  let maxOv = 0;
  for (let i = 0; i < QS.length; i++) {
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (ov > 0) fail(`mobile overflow ${ov}px on #${i + 1}`);
    maxOv = Math.max(maxOv, ov);
    if (i < QS.length - 1) await page.click('#bNext');
  }
  console.log('  mobile max horizontal overflow:', maxOv, 'px');
  await page.screenshot({ path: path.join(SHOTS, path.basename(file, '.html') + '-mobile.png'), fullPage: true });

  // ---- 5. 舊版紀錄格式（只有 ans / cur / wrongOnly）----
  const w = QS[5], g = QS[6];
  await page.evaluate((k, w, g) => {
    const ans = {}; ans[w.id] = { r: w.type === 'fill' ? 'zzz' : w.type === 'single' ? (w.ans + 1) % w.opts.length : [99], ok: false };
    ans[g.id] = { r: g.type === 'fill' ? g.ans[0] : g.ans, ok: true };
    localStorage.setItem(k, JSON.stringify({ ans, cur: w.id, wrongOnly: true, grid: true }));
  }, KEY, w, g);
  await page.reload();
  s = await stats();
  const mode = await page.$eval('#fWrong', (b) => b.getAttribute('aria-pressed'));
  const expectBad = w.type === 'multi' ? 0 : 1;   // 多選的 [99] 對不上選項，會被丟掉
  if (+s[3] !== expectBad || (expectBad && mode !== 'true')) fail(`old-format migration: stats ${s}, wrong filter ${mode}`); else console.log('  舊版紀錄格式: OK');

  // ---- 6. 全部重來 ----
  await page.click('#bReset');
  s = await stats();
  await page.click('#fEver');
  const everN = (await cells()).length;
  if (+s[0] !== 0 || everN !== 0) fail(`reset: stats ${s}, ever ${everN}`); else console.log('  全部重來: OK（含錯題紀錄）');
  const other = await page.$('#otherSet');
  if (!other) fail('link to the other set missing');

  if (errors.length) fail('page errors: ' + errors.join(' | ')); else console.log('  no console errors');
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files'] });
  for (const f of FILES) await testFile(browser, f);
  await browser.close();
  console.log(failed ? `\nBROWSER TEST FAILED (${failed})` : '\nBROWSER TEST PASSED');
  process.exitCode = failed ? 1 : 0;
})();
