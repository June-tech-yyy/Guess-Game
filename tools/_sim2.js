/* 场景 2：当天已玩过 → 启动即复原；练手能重玩；回到今日又回到复原状态 */
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

const day = new Date().toISOString().slice(0, 10);
const store = {
  'same-freq.v1': JSON.stringify({
    days: { [day]: { date: day, win: true, tries: 2, streak: 3, score: 80,
      guesses: [{ guess: '苹果', type: 'near' }, { guess: '香蕉', type: 'exact' }] } },
  }),
};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
global.document = { querySelector: s => mk(s), querySelectorAll: () => [], createElement: () => mk('#tmp'), body: { appendChild(){} } };
global.window = {}; global.navigator = {}; global.location = { href: 'file:///x' };
global.setTimeout = () => 0; global.clearTimeout = () => {};
global.setInterval = () => 0; global.clearInterval = () => {};

vm.runInThisContext(fs.readFileSync(path.join(__dirname,'..','index.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]);

const q = s => (els.get(s) || { textContent: '(未渲染)' }).textContent;
const click = id => ((els.get(id) || mk(id)).listeners.click || []).forEach(f => f());
let bad = 0;
const expect = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };

expect(els.get('#guess').disabled === true, '启动复原：输入框禁用');
expect(String(q('#streak')) === '3', '连胜显示存档值：' + q('#streak'));
const rowsHtml = (els.get('#rows')||{}).innerHTML || '';
expect(rowsHtml.includes('香蕉') || rowsHtml.includes('苹果'), '历史猜测已渲染');

click('#practiceBtn');
expect(!q('#qLabel').includes('练习') === false && els.get('#guess').disabled === false, '练手时可继续输入');
expect(q('#qText').includes('说'), '练手出了新题：' + q('#qText'));

click('#practiceBtn');   // 回到今日
expect(els.get('#guess').disabled === true, '回到今日又复原成"已结束"');
expect(String(q('#streak')) === '3', '连胜仍为 3');

console.log(bad ? `\n${bad} 处失败` : '\nALL OK — 已玩过的当天也能安全进入练手');
process.exit(bad ? 1 : 0);
