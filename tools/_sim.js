/* 用带注册表的 DOM 桩跑真实交互路径：启动 → 练手 → 换一题 → 回到今日 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const els = new Map();
const mk = (sel) => {
  if (els.has(sel)) return els.get(sel);
  const el = {
    sel, innerHTML: '', textContent: '', value: '', disabled: false,
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} },
    style: {}, dataset: {}, listeners: {},
    addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); },
    focus(){}, remove(){}, select(){}, appendChild(){},
    querySelector(s){ return mk(sel + ' ' + s); }, querySelectorAll(){ return []; },
  };
  els.set(sel, el);
  return el;
};

const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
global.document = { querySelector: s => mk(s), querySelectorAll: () => [], createElement: () => mk('#tmp'), body: { appendChild(){} } };
global.window = {}; global.navigator = {}; global.location = { href: 'file:///x' };
global.setTimeout = () => 0; global.clearTimeout = () => {};
global.setInterval = () => 0; global.clearInterval = () => {};

const html = fs.readFileSync(path.join(__dirname,'..','index.html'), 'utf8');
vm.runInThisContext(html.match(/<script>([\s\S]*?)<\/script>/)[1]);

const q = s => (els.get(s) || { textContent: '(未渲染)' }).textContent;
const click = id => ((els.get(id) || mk(id)).listeners.click || []).forEach(f => f());
let bad = 0;
const expect = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };

const dailyTheme = q('#qText');
expect(dailyTheme.includes('说'), '启动即出今日题：' + q('#qLabel') + ' ' + dailyTheme);

click('#practiceBtn');
const p1 = q('#qText');
expect(q('#qLabel').includes('练习'), '点练手进入练习模式');
expect(p1 !== dailyTheme, '练习换了题材：' + p1);
expect(q('#practiceBtn') === '回到今日', '按钮变成"回到今日"');

click('#practiceBtn');            // 回到今日
click('#practiceBtn');            // 再练一题
const p2 = q('#qText');
expect(q('#qLabel').includes('练习') && p2 !== p1, '再次练手换到另一个题材：' + p2);

click('#practiceBtn');
expect(!q('#qLabel').includes('练习') && q('#qText') === dailyTheme, '回到今日恢复当天题目');
expect(q('#practiceBtn') === '练手', '按钮变回"练手"');
expect(els.get('#guess').disabled === false, '当天没玩过时输入框可输入');

console.log(bad ? `\n${bad} 处失败` : '\nALL OK — 练习模式交互正常');
process.exit(bad ? 1 : 0);
