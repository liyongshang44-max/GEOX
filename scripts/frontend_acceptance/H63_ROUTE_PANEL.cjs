'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'apps/web/src/app/App.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'apps/web/src/layouts/OperatorLayout.tsx'), 'utf8');
const page = fs.readFileSync(path.join(root, 'apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx'), 'utf8');
function ok(name, pass) { if (!pass) throw new Error('ASSERTION_FAILED:' + name); console.log('[h63-route-panel] ok:', name); }
ok('app_operator_wildcard', app.includes('path="/operator/*"') && app.includes('<OperatorShell />'));
ok('layout_pilot_path', layout.includes('location.pathname === "/operator/pilot"') && layout.includes('OperatorPilotPage'));
ok('layout_pilot_nav', layout.includes('key: "pilot"') && layout.includes('to: "/operator/pilot"') && layout.includes('status: "enabled"'));
ok('required_panels', ['Candidate Site Scope', 'Evidence Protocol', 'Device / Gateway Readiness Plan', 'Human Role Matrix', 'Safety / Stop Rules and Rollback Plan', 'Go / No-Go Gate'].every((token) => page.includes(token)));
console.log(JSON.stringify({ ok: true, acceptance: 'H63_ROUTE_PANEL' }, null, 2));
