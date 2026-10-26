import fs from 'node:fs'
const j = JSON.parse(fs.readFileSync(process.env.TEMP + '/eslint-import.json', 'utf8'))
for (const f of j) {
  const errs = f.messages.filter(m => m.severity === 2)
  const rules = {}
  for (const e of errs) rules[e.ruleId] = (rules[e.ruleId] || 0) + 1
  const rel = f.filePath.split('otaku_project').pop().replace(/^[\\/]/, '')
  console.log(rel.padEnd(48), 'erreurs=' + String(errs.length).padEnd(3), 'avert=' + String(f.messages.length - errs.length).padEnd(3), Object.entries(rules).map(([r, n]) => r.replace(/^.*\//, '') + '×' + n).join(' '))
}
