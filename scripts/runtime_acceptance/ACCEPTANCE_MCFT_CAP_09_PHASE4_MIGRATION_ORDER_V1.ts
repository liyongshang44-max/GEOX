import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  listSqlMigrationFiles,
} from "../../apps/server/src/infra/migrations.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE4_MIGRATION_ORDER_V1_RESULT.json",
);

function indexOfRequired(files: readonly string[], name: string): number {
  const index = files.indexOf(name);
  assert.notEqual(index, -1, `MIGRATION_FILE_REQUIRED:${name}`);
  return index;
}

function main(): void {
  const inventory = listSqlMigrationFiles();

  const persistence =
    "2026_08_27_mcft_cap_09_phase3_evidence_runtime_persistence.sql";
  const acl =
    "2026_08_27_mcft_cap_09_phase3_evidence_runtime_acl.sql";

  const persistenceIndex = indexOfRequired(inventory.selected_files, persistence);
  const aclIndex = indexOfRequired(inventory.selected_files, acl);

  assert(
    persistenceIndex < aclIndex,
    `PHASE3_EVIDENCE_SCHEMA_MUST_PRECEDE_ACL:${persistenceIndex}:${aclIndex}`,
  );

  const proof = {
    schema_version: "geox_mcft_cap09_phase4_migration_order_qualification_v1",
    status: "PASS",
    same_day_schema_before_acl: true,
    persistence_file: persistence,
    persistence_index: persistenceIndex,
    acl_file: acl,
    acl_index: aclIndex,
    migration_file_count: inventory.selected_files.length,
    production_container_activation: false,
    runtime_mutation: false,
    formal_v5_armed: false,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  process.stdout.write(JSON.stringify(proof) + "\n");
}

try {
  main();
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
    }, null, 2) + "\n",
  );
  throw error;
}
