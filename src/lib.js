// 出題用的小工具：HTML escape、程式碼區塊、行內程式碼
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 多行程式碼 → <pre><code>，自動去掉開頭換行與共同縮排
function code(s) {
  let lines = String(s).replace(/^\n+/, '').replace(/\s+$/, '').split('\n');
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  lines = lines.map((l) => l.slice(ind));
  return '<pre><code>' + esc(lines.join('\n')) + '</code></pre>';
}

// 行內程式碼
const c = (s) => '<code>' + esc(s) + '</code>';

// 多選題題幹統一加上提示
const ALL = ' <b>(Select all that apply)</b>';

module.exports = { esc, code, c, ALL };
