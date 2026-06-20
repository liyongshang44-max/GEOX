#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const fail = (m) => { console.error('[pr-metadata-contract] FAIL:', m); process.exit(1); };
const assert = (c, m) => { if (!c) fail(m); };
const templatePath = path.join(root, '.github/pull_request_template.md');
assert(fs.existsSync(templatePath), '.github/pull_request_template.md must exist');
const template = fs.readFileSync(templatePath, 'utf8');
for (const heading of ['Scope', 'Boundary', 'Acceptance', 'Commands']) assert(new RegExp(`(^|\\n)##\\s+${heading}\\b`, 'i').test(template), `PR template must contain ${heading}`);
assert(/Risk\s*\/\s*Non-goals/i.test(template), 'PR template must contain Risk / Non-goals');
assert(/\b(a|fix|tmp|test)\b/i.test(template) && /title/i.test(template) && /(forbid|禁止|reject|must not)/i.test(template), 'PR template must explicitly forbid low-signal titles a/fix/tmp/test');
const badTitles = new Set(['a', 'fix', 'tmp', 'test']);
const title = process.env.GITHUB_PR_TITLE;
const body = process.env.GITHUB_PR_BODY;
if (title || body) {
  assert(title && !badTitles.has(title.trim().toLowerCase()), 'PR title must be descriptive and not a/fix/tmp/test');
  assert(body && body.trim().length > 0, 'PR body must not be empty');
  for (const section of ['Scope', 'Boundary', 'Acceptance']) assert(new RegExp(`(^|\\n)##\\s+${section}\\b`, 'i').test(body), `PR body must contain ${section}`);
}
console.log('[pr-metadata-contract] PASS');
