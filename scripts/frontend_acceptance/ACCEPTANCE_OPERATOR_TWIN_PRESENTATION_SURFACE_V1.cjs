#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fail = (m) => { console.error('[operator-twin-presentation-surface] FAIL:', m); process.exit(1); };
const assert = (c, m) => { if (!c) fail(m); };

const operatorPages = [
  'apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx',
  'apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx',
  'apps/web/src/features/operator/pages/OperatorFieldTwinForecastPage.tsx',
  'apps/web/src/features/operator/pages/OperatorFieldTwinScenarioComparePage.tsx',
];
const forbiddenClasses = ['customerReportPage', 'customerCard', 'customerTable', 'customerList', 'customerStatusPill'];
const requiredClasses = ['operatorWorkbenchPage', 'operatorPanel', 'operatorTable', 'operatorList', 'operatorPill'];

for (const file of operatorPages) {
  const text = read(file);
  for (const klass of forbiddenClasses) assert(!text.includes(klass), `${file} must not contain ${klass}`);
  assert(!/from\s+["'][^"']*customer[^"']*["']/i.test(text), `${file} must not import customer-specific modules`);
  assert(!/from\s+["'][^"']*Customer[^"']*["']/.test(text), `${file} must not import customer-specific components`);
}

const combined = operatorPages.map(read).join('\n') + '\n' + read('apps/web/src/styles/operatorTwin.css');
for (const klass of requiredClasses) assert(combined.includes(klass), `operator presentation class ${klass} is missing`);

assert(read('apps/web/src/styles.css').includes('./styles/operatorTwin.css'), 'global style entry must import operatorTwin.css');

const customerFiles = [];
for (const dir of ['apps/web/src/views', 'apps/web/src/layouts', 'apps/web/src/features/customer']) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  const stack = [abs];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(tsx?|jsx?)$/.test(entry.name) && /Customer|customer/.test(full)) customerFiles.push(path.relative(root, full));
    }
  }
}
for (const file of customerFiles) {
  const text = read(file);
  assert(!text.includes('operatorTwin.css'), `${file} must not import operatorTwin.css`);
  assert(!/from\s+["'][^"']*features\/operator\/components/i.test(text), `${file} must not import operator components`);
}

console.log('[operator-twin-presentation-surface] PASS');
