// Purpose: validate immutable S1 contracts and predecessor authority from S2 or later delivery contexts.
// Boundary: pure-domain successor regression only; no S1 seed-state or changed-file-boundary assertion.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_FACT_VISIBILITY_METADATA_CONTRACT_V1,
  FIELD_TWIN_COLLECTION_KINDS_V1,
  FIELD_TWIN_CURSOR_AUTHENTICATION_CONTRACT_V1,
  FIELD_TWIN_READ_MODEL_VERSION_V1,
  FIELD_TWIN_SOURCE_PROFILE_VERSION_V1,
  FIELD_TWIN_TIMELINE_EVENT_KINDS_V1,
  FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1,
  SOURCE_VALIDATION_PROFILE_FAMILIES_V1,
  buildCanonicalVisibilitySnapshotV1,
  buildScopeHashV1,
  buildSourceValidationProfileRegistryV1,
  buildTimelineFilterHashV1,
  canonicalUtcInstantV1,
  canonicalizeTimelineFilterV1,
  createCursorPayloadV1,
  signFieldTwinCursorV1,
  sortXid8TextNumericAscendingV1,
  validateSourceValidationObligationMatrixV1,
  verifyFieldTwinCursorV1,
  xid8TextV1,
  type FieldTwinScopeV1,
  type SemanticHashTextV1,
} from "../../apps/server/src/domain/field_twin_read_model/index.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_S1_CONTRACTS_RESULT.json");
const CAP = "docs/digital_twin/mcft/cap_07";
const checks: Array<{ name: string; status: "PASS" }> = [];

function check(name: string, action: () => void): void {
  action();
  checks.push({ name, status: "PASS" });
}

function loadJson(relativePath: string): any {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

const scope: FieldTwinScopeV1 = {
  tenant_id: "tenant-a",
  project_id: "project-a",
  group_id: "group-a",
  field_id: "field-a",
  season_id: "season-a",
  zone_id: "zone-a",
};

try {
  check("PURE_CONTRACT_INVENTORIES_EXACT", () => {
    assert.equal(SOURCE_VALIDATION_PROFILE_FAMILIES_V1.length, 8);
    assert.equal(new Set(SOURCE_VALIDATION_PROFILE_FAMILIES_V1).size, 8);
    assert.equal(FIELD_TWIN_COLLECTION_KINDS_V1.length, 8);
    assert.equal(FIELD_TWIN_TIMELINE_EVENT_KINDS_V1.length, 17);
    assert.equal(FIELD_TWIN_READ_MODEL_VERSION_V1, "minimal_field_twin_runtime_read_model_v1");
    assert.equal(FIELD_TWIN_SOURCE_PROFILE_VERSION_V1, "mcft_cap_07_source_profiles_v1");
  });

  check("VISIBILITY_METADATA_CONTRACT_FROZEN", () => {
    assert.equal(CANONICAL_FACT_VISIBILITY_METADATA_CONTRACT_V1.visibility_anchor_type, "xid8");
    assert.equal(CANONICAL_FACT_VISIBILITY_METADATA_CONTRACT_V1.application_runtime_direct_dml, "FORBIDDEN");
    assert.equal(CANONICAL_FACT_VISIBILITY_METADATA_CONTRACT_V1.visibility_anchor_kinds.length, 3);
  });

  const rawMatrix = loadJson(`${CAP}/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json`);
  const matrix = validateSourceValidationObligationMatrixV1(rawMatrix);
  const sourceRegistry = buildSourceValidationProfileRegistryV1(matrix);
  check("SOURCE_VALIDATION_MATRIX_AND_REGISTRY_EXACT", () => {
    assert.equal(matrix.rows.length, 40);
    assert.equal(sourceRegistry.entries.length, 40);
    assert.equal(new Set(sourceRegistry.entries.map((entry) => `${entry.source_name}|${entry.profile_family}`)).size, 40);
  });

  check("XID8_NUMERIC_ORDER_AND_CANONICAL_TEXT_PRESERVED", () => {
    assert.deepEqual(sortXid8TextNumericAscendingV1([xid8TextV1("10"), xid8TextV1("2"), xid8TextV1("1")]), ["1", "2", "10"]);
    assert.throws(() => xid8TextV1("01"), /MCFT_XID8_TEXT_INVALID/);
  });

  const t0 = canonicalUtcInstantV1("2026-07-19T00:00:00.000Z");
  const t1 = canonicalUtcInstantV1("2026-07-19T01:00:00.000Z");
  const tHalf = canonicalUtcInstantV1("2026-07-19T01:30:00.000Z");
  const t2 = canonicalUtcInstantV1("2026-07-19T02:00:00.000Z");
  const visibility = buildCanonicalVisibilitySnapshotV1({
    database_visibility_epoch_id: "epoch-a",
    pg_snapshot_token: "1:20:2,10",
    snapshot_xmin: "1",
    snapshot_xmax: "20",
    snapshot_xip_values_for_hash: ["10", "2"],
  });
  const filterHash = buildTimelineFilterHashV1(canonicalizeTimelineFilterV1({ from_logical_time: t0, until_logical_time: t2 }));
  const scopeHash = buildScopeHashV1(scope);
  const rootHash = semanticHashV1({ root: "tick-a" }) as SemanticHashTextV1;
  const payload = createCursorPayloadV1({
    cursor_kind: "TIMELINE",
    collection_kind: null,
    sort_contract_id: FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1,
    scope_hash: scopeHash,
    filter_hash: filterHash,
    canonical_visibility_snapshot: visibility,
    fixed_root_ref: "tick-a",
    fixed_root_graph_content_hash: rootHash,
    sort_direction: "ASC",
    last_sort_tuple: { cursor_kind: "TIMELINE", logical_time: t1, event_rank: 90, object_ref: "health-a" },
    page_limit: 50,
    issued_at: t1,
    expires_at: t2,
  });
  const signed = signFieldTwinCursorV1(payload, "key-v1", "0123456789abcdef0123456789abcdef");
  const verifyContext = {
    scope_hash: scopeHash,
    filter_hash: filterHash,
    database_visibility_epoch_id: "epoch-a",
    fixed_root_ref: "tick-a",
    fixed_root_graph_content_hash: rootHash,
    cursor_kind: "TIMELINE" as const,
    collection_kind: null,
    page_limit: 50,
    now: tHalf,
    signing_keys: { "key-v1": "0123456789abcdef0123456789abcdef" },
  };
  check("CURSOR_HMAC_CONTRACT_PRESERVED", () => {
    assert.deepEqual(verifyFieldTwinCursorV1(signed.wire, verifyContext).payload, payload);
    assert.equal(signed.wire.includes("="), false);
    assert.equal(FIELD_TWIN_CURSOR_AUTHENTICATION_CONTRACT_V1.checksum_only_forbidden, true);
    assert.throws(() => verifyFieldTwinCursorV1(signed.wire, { ...verifyContext, signing_keys: {} }), /MCFT_CURSOR_SIGNING_KEY_UNAVAILABLE/);
  });

  const manifest = loadJson(`${CAP}/GEOX-MCFT-CAP-07-RESOLVED-MANIFEST-V1.json`);
  const s1 = loadJson(`${CAP}/GEOX-MCFT-CAP-07-S1-DELIVERY-STATUS-V1.json`);
  const s2 = loadJson(`${CAP}/GEOX-MCFT-CAP-07-S2-DELIVERY-STATUS-V1.json`);
  const predecessor = loadJson(`${CAP}/GEOX-MCFT-CAP-07-S1-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json`);
  const candidateRegistry = loadJson("docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json");

  check("S1_PREDECESSOR_ARTIFACT_CONSUMPTION_EXACT", () => {
    assert.equal(predecessor.status, "PASS");
    assert.equal(predecessor.subject_commit, "0790da7708971a690601051c521bb2678c38fb7f");
    assert.equal(predecessor.semantic_artifact_digest, "sha256:e442288dfa25fa5b1356124c67a6c3d64f9412d7acb5161a192c749ab7648dcd");
    assert.equal(predecessor.transport_archive_sha256, "sha256:32ce9615416134c0cc7ab062589b2e17f351832dd784fbf2689022771cdba911");
    assert.equal(predecessor.retention_authority.readback_verified, true);
    assert.equal(predecessor.retention_authority.locked_version_delete_denied, true);
  });

  check("S1_AUTHORITY_NOT_REGRESSED", () => {
    assert.equal(s1.s1_candidate_implemented, true);
    assert.equal(s1.implementation_authorized, true);
    assert.equal(s1.runtime_authority_delta, "PURE_DOMAIN_CONTRACTS_ONLY");
    assert.equal(s1.canonical_write_authority_delta, "ZERO");
    assert.equal(s1.postgresql_authority_delta, "ZERO");
    assert.equal(s1.route_authority_delta, "ZERO");
    assert.equal(s1.migration_authority_delta, "ZERO");
    assert.equal(s1.frontend_authority_delta, "ZERO");
    assert.equal(s1.effective_next_slice_when_attested, "S2");
  });

  check("SUCCESSOR_STATE_COHERENT_WITHOUT_STALE_SEED_ASSERTION", () => {
    assert.equal(s2.canonical_write_authority_delta, "ZERO");
    if (s2.s2_candidate_implemented === true) {
      assert.equal(s2.implementation_authorized, true);
    } else {
      assert.equal(s2.s2_candidate_implemented, false);
      assert.equal(s2.implementation_authorized, false);
    }
  });

  check("CAPABILITY_AUTHORITY_NO_FORBIDDEN_ESCALATION", () => {
    assert.equal(manifest.document_status, "FROZEN");
    assert.equal(manifest.implementation_authorized, true);
    assert.equal(manifest.runtime_source_authorized, false);
    assert.equal(manifest.canonical_write_authorized, false);
    assert.equal(manifest.mcft_cap_08_authorized, false);
    assert.equal(manifest.s0_external_effectiveness.status, "PASS");
  });

  check("REGISTRY_S1_S2_TRANSITIONS_PRESERVED", () => {
    const cap = candidateRegistry.capabilities.find((entry: any) => entry.capability_line === "MCFT-CAP-07");
    assert.ok(cap);
    assert.ok(cap.candidate_transition_fields.some((entry: any) => entry.status_file.endsWith("S1-DELIVERY-STATUS-V1.json") && entry.field_path === "s1_candidate_implemented"));
    assert.ok(cap.candidate_transition_fields.some((entry: any) => entry.status_file.endsWith("S2-DELIVERY-STATUS-V1.json") && entry.field_path === "s2_candidate_implemented"));
  });

  const result = {
    schema_version: "geox_mcft_cap_07_s1_contracts_result_v1",
    status: "PASS",
    execution_mode: "SUCCESSOR_REGRESSION_MODE",
    check_count: checks.length,
    checks,
    source_profile_count: SOURCE_VALIDATION_PROFILE_FAMILIES_V1.length,
    source_obligation_row_count: matrix.rows.length,
    collection_kind_count: FIELD_TWIN_COLLECTION_KINDS_V1.length,
    timeline_event_kind_count: FIELD_TWIN_TIMELINE_EVENT_KINDS_V1.length,
    runtime_authority_delta: "PURE_DOMAIN_CONTRACTS_ONLY",
    canonical_write_authority_delta: "ZERO",
    database_access_performed: false,
    route_access_performed: false,
    persistence_performed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`MCFT-CAP-07 S1 successor regression: ${checks.length} PASS`);
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ schema_version: "geox_mcft_cap_07_s1_contracts_result_v1", status: "FAIL", execution_mode: "SUCCESSOR_REGRESSION_MODE", error: error instanceof Error ? error.message : String(error), checks }, null, 2)}\n`, "utf8");
  console.error(error);
  process.exitCode = 1;
}
