const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname,'..','index.html'), 'utf8');
const classes = ['pgDrag', 'pgPad', 'pgGrid', 'pgRow', 'pgProg', 'pgRange'];
let bad = 0;
for (const c of classes) {
  const re = new RegExp('\\.' + c + '\\s*\\{[^}]*\\}');
  const m = s.match(re);
  if (!m) { console.log(c, 'RULE NOT FOUND'); bad++; continue; }
  const ok = /width:\s*100%/.test(m[0]);
  console.log(c.padEnd(8), ok ? 'width 100%' : 'MISSING WIDTH');
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);
