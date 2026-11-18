const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('no script'); process.exit(1); }

const mkEl = () => ({
  innerHTML: '', textContent: '', value: '', disabled: false,
  classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  style: {}, dataset: {}, focus(){}, addEventListener(){}, appendChild(){}, remove(){}, select(){},
  querySelector: () => mkEl(), querySelectorAll: () => [],
});
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
global.document = { querySelector: () => mkEl(), querySelectorAll: () => [], createElement: () => mkEl(), body: { appendChild(){} } };
global.window = {}; global.navigator = {}; global.location = { href: 'file:///x' };
global.setInterval = () => 0; global.clearInterval = () => {};
global.setTimeout = () => 0; global.clearTimeout = () => {};

vm.runInThisContext(m[1]);

let fails = 0;
const check = (c, msg) => { if (!c) { console.error('FAIL:', msg); fails++; } };
const n = s => String(s).trim();
const day = i => new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10);

// 1. 每个题材的结构完整性
check(PROMPTS.length >= 8, `only ${PROMPTS.length} themes`);
check(new Set(PROMPTS.map(p => p.id)).size === PROMPTS.length, 'duplicate theme ids');
check(new Set(PROMPTS.map(p => p.label)).size === PROMPTS.length, 'duplicate theme labels');

for (const p of PROMPTS) {
  check(!!p.label && !!p.kind && !!p.q, `${p.id}: missing label/kind/q`);
  check(p.q.includes(p.kind), `${p.id}: q "${p.q}" does not name kind "${p.kind}"`);
  check(p.words.length >= 15, `${p.id}: only ${p.words.length} candidates`);
  p.words.forEach(w => {
    check(typeof w.w === 'string' && w.w.length > 0, `${p.id}: empty word`);
    check(Array.isArray(w.tags) && w.tags.length >= 3, `${p.id}/${w.w}: fewer than 3 tags`);
    check(new Set(w.tags).size === w.tags.length, `${p.id}/${w.w}: duplicate tags`);
  });
  const names = p.words.map(w => n(w.w));
  check(new Set(names).size === names.length, `${p.id}: duplicate candidates`);

  check(Array.isArray(p.family) && p.family.length >= 40, `${p.id}: family only ${p.family.length} words`);
  const fam = p.family.map(n);
  check(new Set(fam).size === fam.length, `${p.id}: duplicate family words`);
  for (const w of names) check(fam.includes(w), `${p.id}: bank word ${w} missing from family`);
}

// 2. 题材按天轮转：12 天走一圈，且不连着两天同题材
const rotation = [];
for (let i = 0; i < PROMPTS.length * 2; i++) rotation.push(pickPrompt(day(i)).id);
const cycle = new Set(rotation.slice(0, PROMPTS.length));
check(cycle.size === PROMPTS.length, `rotation covered ${cycle.size}/${PROMPTS.length} themes in one cycle`);
check(rotation[PROMPTS.length] === rotation[0], 'rotation does not repeat after one cycle');
for (let i = 1; i < rotation.length; i++) check(rotation[i] !== rotation[i - 1], `theme repeated at day ${i}`);

// 3. 答案确定性 + 分散度（每个题材在 120 天里出现 10 次，至少 5 个不同答案）
const seenAnswers = new Map();
for (let i = 0; i < 120; i++) {
  const seed = day(i);
  const r = makeRound(seed), r2 = makeRound(seed);
  check(r.prompt.id === r2.prompt.id && r.answer.w === r2.answer.w, `${seed}: not deterministic`);
  check(r.prompt.words.some(w => w.w === r.answer.w), `${seed}: answer not in bank`);
  const key = r.prompt.id;
  if (!seenAnswers.has(key)) seenAnswers.set(key, new Set());
  seenAnswers.get(key).add(r.answer.w);
}
for (const p of PROMPTS) {
  const got = seenAnswers.get(p.id);
  check(got && got.size >= 5, `${p.id}: only ${got ? got.size : 0} distinct answers in 120 days`);
}

// 4. 判定逻辑，逐题材验证 exact / kin / wrong
for (const p of PROMPTS) {
  const seed = day(30);
  const r = makeRound(seed);
  // 用当前题材自己构造一轮，避免受当天轮转影响
  const ans = p.words[Math.floor(hashStr('test-' + p.id) % p.words.length)];
  check(judge(ans.w, ans, p).type === 'exact', `${p.id}: self-judge not exact`);
  check(judge(ans.w + '吧', ans, p).type === 'exact', `${p.id}: particle strip failed`);
  check(judge('  ' + ans.w + '！ ', ans, p).type === 'exact', `${p.id}: punct/space strip failed`);

  const kinWord = p.family.map(n).find(w => !p.words.some(x => n(x.w) === w) && !(w in ALIAS));
  check(!!kinWord, `${p.id}: no family word outside the bank`);
  check(judge(kinWord, ans, p).type === 'kin', `${p.id}: expected kin for ${kinWord}`);
  check(judge('qwzx', ans, p).type === 'unknown', `${p.id}: garbage should be unknown`);
  check(judge('', ans, p).type === 'unknown', `${p.id}: empty should be unknown`);
}

// 4a 跨题材的词要判成“不是这一类”
const cityTheme = PROMPTS.find(p => p.id === 'city');
const animalTheme = PROMPTS.find(p => p.id === 'animal');
const foreign = animalTheme.family.find(w => !cityTheme.family.includes(w));
check(judge(foreign, cityTheme.words[0], cityTheme).type === 'wrong', `expected wrong for ${foreign} in city theme`);

// 4b 标签梯度：找一对重合 2 个标签的词
const pt = PROMPTS.find(p => p.id === 'food');
const a = pt.words[0];
const warmish = pt.words.find(w => w.w !== a.w && w.tags.filter(t => a.tags.includes(t)).length >= 2);
check(!!warmish, 'no warm pair in food theme');
if (warmish) check(['warm', 'exact'].includes(judge(warmish.w, a, pt).type), `expected warm for ${warmish.w}`);

// 4c 别称
check(judge('凤梨', { w: '菠萝', tags: [] }, PROMPTS.find(p => p.id === 'fruit')).type === 'exact', 'alias 凤梨 failed');
check(judge('过年', { w: '春节', tags: [] }, PROMPTS.find(p => p.id === 'festival')).type === 'exact', 'alias 过年 failed');
check(judge('单车', { w: '自行车', tags: [] }, PROMPTS.find(p => p.id === 'transport')).type === 'exact', 'alias 单车 failed');
check(judge('蓝色', { w: '蓝', tags: [] }, PROMPTS.find(p => p.id === 'color')).type === 'exact', 'alias 蓝色 failed');

// 5. 惩罚引擎
check(PUNISH.length === 15, `expected 15 punishments, got ${PUNISH.length}`);
check(new Set(PUNISH.map(p => p.id)).size === 15, 'duplicate punishment ids');
for (const t of [1, 2, 3]) check(PUNISH.filter(p => p.tier === t).length === 5, `tier ${t} not 5`);
PUNISH.forEach(p => {
  check(typeof p.build === 'function', `${p.id}: missing build`);
  try { p.build(mkEl(), { pass(){}, fail(){}, note(){} }, mulberry32(hashStr('t-' + p.id))); }
  catch (e) { check(false, `${p.id}: build threw ${e.message}`); }
});
const got = { 1: new Set(), 2: new Set(), 3: new Set() };
for (let i = 0; i < 60; i++) {
  for (const attempt of [1, 2, 3]) {
    const x = pickPunish(day(i), 'fruit', attempt);
    check(x === pickPunish(day(i), 'fruit', attempt), `${day(i)}/${attempt}: not deterministic`);
    check(x.tier === attempt, `${day(i)}/${attempt}: picked tier ${x.tier}`);
    got[attempt].add(x.id);
  }
}
for (const t of [1, 2, 3]) check(got[t].size >= 3, `tier ${t} only reached ${got[t].size} punishments`);


// 6. 练习模式：种子带 -pN，必须换题材、不能崩，且不影响当天
{
  const seed = day(0);
  const daily = makeRound(seed);
  check(!!daily.prompt && !!daily.answer, 'daily round broken');
  const themeSeen = new Set();
  for (let i = 1; i <= 12; i++) {
    const r = makeRound(seed + '-p' + i);
    check(!!r.prompt && !!r.answer, 'practice round crashed at -p' + i);
    check(i >= PROMPTS.length || r.prompt.id !== daily.prompt.id, 'practice -p' + i + ' reused the daily theme');
    themeSeen.add(r.prompt.id);
  }
  check(themeSeen.size >= 8, 'practice covered only ' + themeSeen.size + ' themes in 12 tries');
  check(makeRound(seed + '-p1').answer.w === makeRound(seed + '-p1').answer.w, 'practice not deterministic');
}

const words = PROMPTS.reduce((s, p) => s + p.words.length, 0);
const fams = PROMPTS.reduce((s, p) => s + p.family.length, 0);
console.log(fails === 0
  ? `ALL OK — ${PROMPTS.length} themes, ${words} candidates / ${fams} family words, ` +
    `rotation ${PROMPTS.length}-day cycle, 7 judge types, 15 punishments deterministic`
  : `${fails} failures`);
