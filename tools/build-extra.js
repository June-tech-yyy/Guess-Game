/* 把网上的词表接进《同频》的词库。
 *
 * 为什么只在“构建期”跑，而不是让游戏运行时去请求网络：
 *   - 静态页面 file:// 打开时 fetch 会被 CORS 拦掉；Devvit 客户端也拿不到第三方接口。
 *   - 评审是人在手机上点几分钟，接口超时/限流就直接变成“今天不能玩”。
 *   - 答案必须是最常见的说法，只有人能判断；抓来的词表只能扩充“听得懂的同类词”。
 *
 * 用法：
 *   node tools/build-extra.js                 # 读 sources/*.txt → 写 extra-words.js
 *   node tools/build-extra.js --dry           # 只看会加什么，不写文件
 *   node tools/build-extra.js --fetch         # 先按 sources/urls.json 下载，再合并
 *   node tools/build-extra.js --src dir --out f.js --limit 40
 *
 * sources/<题材id>.txt：一行一个词，可在词后面用空格或 Tab 跟一个频次（会被忽略）。
 * sources/urls.json：{ "city": ["https://raw.githubusercontent.com/.../city.txt"], ... }
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const flag = name => argv.includes(name);

const SRC = path.resolve(ROOT, arg('--src', 'sources'));
const OUT = path.resolve(ROOT, arg('--out', 'extra-words.js'));
const LIMIT = Number(arg('--limit', 40));
const DRY = flag('--dry');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ids = [...html.matchAll(/^\s{4}id:"([a-z]+)", label:"([^"]+)"/gm)].map(m => ({ id: m[1], label: m[2] }));
if (!ids.length) { console.error('读不到 index.html 里的题材列表'); process.exit(1); }

// 现有词库（用来去重）：一个题材的 family 与 words
function existingFamily(id) {
  const start = html.indexOf(`id:"${id}"`);
  if (start < 0) return [];
  const block = html.slice(start, html.indexOf('\n  },', start));
  const fam = block.match(/family:F\("([^"]*)"\)/);
  const words = [...block.matchAll(/W\("([^|"]+)\|/g)].map(m => m[1]);
  const list = fam ? fam[1].split(',') : [];
  return new Set([...list, ...words]);
}

const CLEAN = /^[\u4e00-\u9fa5]{2,4}$/;

// 别称表里的词（例如“过年”）不放进扩展词库，免得抢了别称判定的位置
const ALIAS_KEYS = (() => {
  const start = html.indexOf('const ALIAS = {');
  const block = html.slice(start, html.indexOf('};', start));
  return new Set([...block.matchAll(/"([^"]+)":/g)].map(m => m[1]));
})();

async function download() {
  const urlsFile = path.join(SRC, 'urls.json');
  if (!fs.existsSync(urlsFile)) { console.log('没有 sources/urls.json，跳过下载'); return; }
  const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
  fs.mkdirSync(SRC, { recursive: true });
  for (const [id, list] of Object.entries(urls)) {
    const target = path.join(SRC, `${id}.txt`);
    if (fs.existsSync(target)) { console.log(`已有 ${id}.txt，跳过下载`); continue; }
    const chunks = [];
    for (const url of [].concat(list)) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) { console.warn(`  ${res.status} ${url}`); continue; }
        chunks.push(await res.text());
        console.log(`  下载成功 ${id}: ${url}`);
      } catch (e) {
        console.warn(`  下载失败 ${id}: ${url} → ${e.message}`);
      }
    }
    if (chunks.length) fs.writeFileSync(target, chunks.join('\n'));
  }
}

function collect(id) {
  const file = path.join(SRC, `${id}.txt`);
  if (!fs.existsSync(file)) return { file, kept: [], rejected: 0 };
  const known = existingFamily(id);
  const seen = new Set();
  let rejected = 0;
  const kept = [];
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const word = raw.split(/[\s\t,，]/)[0].trim();
    if (!word) continue;
    if (!CLEAN.test(word)) { rejected++; continue; }
    if (known.has(word) || seen.has(word)) { rejected++; continue; }
    if (ALIAS_KEYS.has(word)) { rejected++; continue; }
    seen.add(word);
    kept.push(word);
  }
  return { file, kept, rejected };
}

(async () => {
  if (flag('--fetch')) await download();

  const out = {};
  const report = [];
  for (const { id, label } of ids) {
    const { file, kept, rejected } = collect(id);
    const used = kept.slice(0, LIMIT);
    if (used.length) out[id] = used;
    report.push({ id, label, file: path.basename(file), added: used.length, dropped: kept.length - used.length, rejected });
  }

  console.log('\n题材        来源文件            新增  超出上限  格式不符');
  for (const r of report) {
    console.log(`${r.id.padEnd(11)} ${(r.file || '-').padEnd(18)} ${String(r.added).padStart(4)} ${String(r.dropped).padStart(8)} ${String(r.rejected).padStart(9)}`);
  }
  const total = Object.values(out).reduce((s, a) => s + a.length, 0);
  console.log(`合计新增 ${total} 个同类词（只扩充“听得懂”，不会成为答案）`);

  for (const [id, words] of Object.entries(out)) {
    console.log(`  ${id}: ${words.slice(0, 12).join('、')}${words.length > 12 ? ' …' : ''}`);
  }

  if (DRY) { console.log('\n--dry：没有写文件'); return; }
  if (!total) {
    console.log(`\n没有新增词，未生成 ${path.relative(ROOT, OUT)}`);
    return;
  }
  const body = '/* 由 tools/build-extra.js 生成，可随时删掉这个文件（页面会自动忽略）。 */\n' +
    'window.EXTRA_FAMILY = ' + JSON.stringify(out, null, 2) + ';\n';
  fs.writeFileSync(OUT, body);
  console.log(`\n已写入 ${path.relative(ROOT, OUT)}；刷新 index.html 即生效。`);
})();
