// Purpose: prove the S4 product path consumes frozen schema identities and strict runtime auth profiles.
// Boundary: static production-source audit only; no database or repository mutation.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("acceptance-output/MCFT_CAP_07_S4_FROZEN_SCHEMA_RESULT.json");
const read = (file: string) => fs.readFileSync(file, "utf8");
const checks: Array<{ name: string; status: "PASS" }> = [];
const check = (name: string, action: () => void) => { action(); checks.push({ name, status: "PASS" }); };

try {
  const timeline = read("apps/server/src/repositories/field_twin_read_model/postgres_field_twin_s4_timeline_repository_v1.ts");
  const replay = read("apps/server/src/repositories/field_twin_read_model/postgres_field_twin_s4_replay_repository_v1.ts");
  const facade = read("apps/server/src/repositories/field_twin_read_model/postgres_field_twin_s4_repository_v1.ts");
  const service = read("apps/server/src/services/mcft_field_twin_read_api_v1.ts");
  const auth = read("apps/server/src/auth/mcft_field_twin_read_authz_v1.ts");

  check("FROZEN_RECORD_SET_INDEX_ONLY", () => {
    assert.match(timeline, /public\.twin_object_idempotency_index_v1/);
    assert.match(timeline, /identity_kind IN \('A0_RECORD_SET','A2_RECORD_SET'\)/);
    assert.doesNotMatch(timeline + replay + facade + service, /twin_runtime_record_set_identity_index_v1/);
  });
  check("NO_UNBOUNDED_COUNT_IN_S4_PRODUCT_PATH", () => {
    assert.doesNotMatch(timeline + replay + facade + service, /count\s*\(\s*\*\s*\)/i);
    assert.match(service, /count_status:\s*"NOT_COMPUTED"/);
    assert.match(service, /total_count:\s*null/);
  });
  check("COLLECTIONS_DO_NOT_REQUIRE_CURRENT_RUNTIME_ROOT", () => {
    const block = service.match(/private async readCollectionV1[\s\S]*?readStates\(/)?.[0] ?? "";
    assert.ok(block.length > 0);
    assert.doesNotMatch(block, /resolveCurrentRuntimeRoot/);
    assert.match(block, /collectionVisibilityContextV1/);
  });
  check("TIMELINE_FILTER_AND_KEYSET_ARE_SQL_PREDICATES", () => {
    assert.match(timeline, /logical_time_text::timestamptz >=/);
    assert.match(timeline, /logical_time_text::timestamptz </);
    assert.match(timeline, /\(logical_time_text::timestamptz,event_rank,object_ref\) >/);
    assert.match(timeline, /ORDER BY logical_time_text::timestamptz ASC,event_rank ASC,object_ref ASC/);
  });
  check("REPLAY_AND_DUAL_HEALTH_RESOLVERS_ARE_PRODUCTION_DEPENDENCIES", () => {
    assert.match(replay + timeline, /ReplayEvidenceFactResolverV1/);
    assert.match(timeline, /RuntimeHealthRoleResolverV1/);
    assert.match(timeline, /A0_RECORD_SET/);
    assert.match(timeline, /operational_attempt_relation/);
  });
  check("STRICT_RUNTIME_AUTH_PROFILES_INCLUDE_PILOT_AND_COMMERCIAL", () => {
    for (const profile of ["pilot", "commercial", "staging", "production"]) assert.match(auth, new RegExp(`"${profile}"`));
    assert.match(auth, /if \(strictRuntimeProfileV1\(\)\) return \{ tokens: \[\] \}/);
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_frozen_schema_result_v1", status: "PASS", check_count: checks.length, checks }, null, 2) + "\n");
  console.log(`MCFT-CAP-07 S4 frozen schema: ${checks.length} PASS`);
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_frozen_schema_result_v1", status: "FAIL", check_count: checks.length, checks, error: String((error as Error)?.stack ?? error) }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
}
