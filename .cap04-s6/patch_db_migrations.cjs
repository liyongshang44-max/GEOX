// .cap04-s6/patch_db_migrations.cjs
// Purpose: initialize the existing Runtime authority snapshot migration required by the real next-tick PostgreSQL adapter.
// Temporary file; removed before final candidate.

'use strict';

const fs = require('node:fs');
const file = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_DB.ts';
let text = fs.readFileSync(file, 'utf8');
const marker = '  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));\n';
const replacement = `${marker}  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql"));\n`;
if (!text.includes('2026_07_10_mcft_cap_01_closure_remediation.sql')) {
  if (!text.includes(marker)) throw new Error('S6_DB_MIGRATION_MARKER_NOT_FOUND');
  text = text.replace(marker, replacement);
  fs.writeFileSync(file, text, 'utf8');
  console.log('added existing Runtime authority snapshot migration');
} else {
  console.log('Runtime authority snapshot migration already present');
}
