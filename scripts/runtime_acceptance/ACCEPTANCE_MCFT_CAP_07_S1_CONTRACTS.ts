// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_S1_CONTRACTS.ts
// Purpose: execute MCFT-CAP-07 S1 pure-contract, registry, hash, ordering, visibility-snapshot, filter, and signed-cursor acceptance.
// Boundary: pure-domain acceptance only; no database, Runtime service, route, migration, frontend, persistence, or network access.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_FACT_VISIBILITY_METADATA_CONTRACT_V1,
  FIELD_TWIN_COLLECTION_KINDS_V1,
  FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1,
  FIELD_TWIN_CURSOR_AUTHENTICATION_CONTRACT_V1,
  FIELD_TWIN_HASH_CONTRACT_REGISTRY_V1,
  FIELD_TWIN_READ_MODEL_VERSION_V1,
  FIELD_TWIN_SOURCE_PROFILE_VERSION_V1,
  FIELD_TWIN_TIMELINE_EVENT_KINDS_V1,
  FIELD_TWIN_TIMELINE_EVENT_RANKS_V1,
  FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1,
  SOURCE_VALIDATION_PROFILE_FAMILIES_V1,
  FieldTwinCursorContractErrorV1,
  assertCollectionKindForEndpointV1,
  assertContinuationTimelineFilterV1,
  assertTimelineEventRankV1,
  buildAttachmentContentHashV1,
  buildCanonicalVisibilitySnapshotV1,
  buildCollectionItemsContentHashV1,
  buildCollectionPageContentHashV1,
  buildEmptyCollectionFilterHashV1,
  buildHealthContentHashV1,
  buildResponseInstanceHashV1,
  buildRootGraphContentHashV1,
  buildScopeHashV1,
  buildSourceValidationProfileRegistryV1,
  buildTimelineFilterHashV1,
  buildTimelineItemsContentHashV1,
  buildTimelinePageContentHashV1,
  buildTraceGraphContentHashV1,
  canonicalUtcInstantV1,
  canonicalizeTimelineFilterV1,
  createCursorPayloadV1,
  normalizeCollectionLimitV1,
  signFieldTwinCursorV1,
  sortXid8TextNumericAscendingV1,
  validateSourceValidationObligationMatrixV1,
  verifyFieldTwinCursorV1,
  xid8TextV1,
  type FieldTwinCollectionItemV1,
  type FieldTwinScopeV1,
  type FieldTwinTimelineEventV1,
  type FieldTwinTraceEdgeV1,
  type FieldTwinTraceNodeV1,
  type SemanticHashTextV1,
} from "../../apps/server/src/domain/field_twin_read_model/index.js";
import { canonicalJsonV1, semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_S1_CONTRACTS_RESULT.json");
const CAP = "docs/digital_twin/mcft/cap_07";
const checks: Array<{ name: string; status: "PASS" }> = [];

function check(name: string, action: () => void): void {
  action();
  checks.push({ name, status: "PASS" });
}

function expectCode(name: string, code: string, action: () => unknown): void {
  check(name, () => assert.throws(action, (error: unknown) => error instanceof FieldTwinCursorContractErrorV1 && error.code === code));
}

function loadJson(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

const hash = (value: unknown): SemanticHashTextV1 => semanticHashV1(value) as SemanticHashTextV1;
const scope: FieldTwinScopeV1 = {
  tenant_id: "tenant-a",
  project_id: "project-a",
  group_id: "group-a",
  field_id: "field-a",
  season_id: "season-a",
  zone_id: "zone-a",
};
const t0 = canonicalUtcInstantV1("2026-07-19T00:00:00.000Z");
const t1 = canonicalUtcInstantV1("2026-07-19T01:00:00.000Z");
const tHalf = canonicalUtcInstantV1("2026-07-19T01:30:00.000Z");
const t2 = canonicalUtcInstantV1("2026-07-19T02:00:00.000Z");
const t3 = canonicalUtcInstantV1("2026-07-19T03:00:00.000Z");
const t4 = canonicalUtcInstantV1("2026-07-19T04:00:00.000Z");
const sourceRefs = [{ ref_type: "FACT", ref_value: "fact-1" }] as const;

function event(kind: FieldTwinTimelineEventV1["event_kind"], logicalTime: typeof t0, objectRef: string): FieldTwinTimelineEventV1 {
  const health = kind === "RUNTIME_HEALTH";
  return {
    event_id: `event-${objectRef}`,
    event_kind: kind,
    event_rank: FIELD_TWIN_TIMELINE_EVENT_RANKS_V1[kind],
    object_ref: objectRef,
    object_type: kind.toLowerCase(),
    object_hash: hash({ kind, objectRef }),
    scope,
    lineage_id: "lineage-a",
    revision_id: null,
    logical_time: logicalTime,
    as_of: null,
    observed_at: null,
    available_to_runtime_at: null,
    created_at: null,
    transaction_family: health ? "A_STATE_TICK_COMMIT" : null,
    health_role: health ? "TERMINAL_RECORD_SET_MEMBER" : null,
    health_resolution_basis: health ? "EXACT_RECORD_SET_MEMBERSHIP" : null,
    health_resolution_evidence_refs: health ? sourceRefs : null,
    atomic_group_ref: "record-set-a",
    source_fact_ref: "fact-1",
    source_refs: sourceRefs,
    evidence_refs: sourceRefs,
    attachment_status: null,
    limitations: [],
  };
}

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
  const registry = buildSourceValidationProfileRegistryV1(matrix);
  check("SOURCE_VALIDATION_MATRIX_AND_REGISTRY_EXACT", () => {
    assert.equal(matrix.rows.length, 40);
    assert.equal(registry.entries.length, 40);
    assert.equal(new Set(registry.entries.map((entry) => `${entry.source_name}|${entry.profile_family}`)).size, 40);
  });
  check("SOURCE_VALIDATION_DUPLICATE_FAILS_CLOSED", () => {
    const duplicate = structuredClone(rawMatrix) as { rows: unknown[] };
    duplicate.rows[1] = structuredClone(duplicate.rows[0]);
    assert.throws(() => validateSourceValidationObligationMatrixV1(duplicate), /MCFT_SOURCE_VALIDATION_DUPLICATE_ROW/);
  });

  const events = [event("RUNTIME_TICK", t1, "tick-a"), event("RUNTIME_HEALTH", t1, "health-a"), event("EVIDENCE_WINDOW", t0, "window-a")];
  check("TIMELINE_TAXONOMY_RANK_AND_ORDER_EXACT", () => {
    events.forEach(assertTimelineEventRankV1);
    assert.equal(FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1, "LOGICAL_TIME_EVENT_RANK_OBJECT_REF_ASC_V1");
  });
  check("TIMELINE_ITEMS_HASH_INSERTION_ORDER_INDEPENDENT", () => {
    assert.equal(buildTimelineItemsContentHashV1(events), buildTimelineItemsContentHashV1([...events].reverse()));
  });

  check("XID8_NUMERIC_SORT_AND_CANONICAL_TEXT", () => {
    assert.deepEqual(sortXid8TextNumericAscendingV1([xid8TextV1("10"), xid8TextV1("2"), xid8TextV1("1")]), ["1", "2", "10"]);
  });
  expectCode("XID8_LEADING_ZERO_REJECTED", "MCFT_XID8_TEXT_INVALID", () => xid8TextV1("01"));

  const visibility = buildCanonicalVisibilitySnapshotV1({
    database_visibility_epoch_id: "epoch-a",
    pg_snapshot_token: "1:20:2,10",
    snapshot_xmin: "1",
    snapshot_xmax: "20",
    snapshot_xip_values_for_hash: ["10", "2"],
  });
  check("VISIBILITY_SNAPSHOT_XIP_NUMERIC_ORDER_STABLE", () => {
    const reordered = buildCanonicalVisibilitySnapshotV1({
      database_visibility_epoch_id: "epoch-a",
      pg_snapshot_token: "1:20:2,10",
      snapshot_xmin: "1",
      snapshot_xmax: "20",
      snapshot_xip_values_for_hash: ["2", "10"],
    });
    assert.equal(visibility.snapshot_xip_hash, reordered.snapshot_xip_hash);
    assert.equal(visibility.visibility_snapshot_hash, reordered.visibility_snapshot_hash);
  });

  const filter = canonicalizeTimelineFilterV1({ from_logical_time: t0, until_logical_time: t3 });
  const filterHash = buildTimelineFilterHashV1(filter);
  check("TIMELINE_FILTER_NULL_AND_CONTINUATION_EQUIVALENCE", () => {
    assert.deepEqual(canonicalizeTimelineFilterV1({}), { filter_schema_version: "field_twin_timeline_filter_v1", from_logical_time: null, until_logical_time: null });
    assertContinuationTimelineFilterV1(filterHash, { from_logical_time: t0, until_logical_time: t3 });
    assertContinuationTimelineFilterV1(filterHash);
  });
  expectCode("TIMELINE_FILTER_NON_CANONICAL_REJECTED", "MCFT_TIMELINE_FILTER_INVALID", () => canonicalizeTimelineFilterV1({ from_logical_time: "2026-07-19T00:00:00Z" }));
  expectCode("TIMELINE_FILTER_RANGE_REJECTED", "MCFT_TIMELINE_FILTER_INVALID", () => canonicalizeTimelineFilterV1({ from_logical_time: t2, until_logical_time: t1 }));
  expectCode("TIMELINE_FILTER_CONFLICT_REJECTED", "MCFT_CURSOR_FILTER_MISMATCH", () => assertContinuationTimelineFilterV1(filterHash, { from_logical_time: t1, until_logical_time: t3 }));

  check("COLLECTION_KIND_MAPPING_AND_LIMITS_EXACT", () => {
    assertCollectionKindForEndpointV1("/states", "STATE");
    assertCollectionKindForEndpointV1("/model-governance", "MODEL_ACTIVATION");
    assert.equal(normalizeCollectionLimitV1(undefined), 50);
    assert.equal(normalizeCollectionLimitV1(200), 200);
  });
  assert.throws(() => assertCollectionKindForEndpointV1("/states", "FORECAST"), /MCFT_COLLECTION_KIND_INVALID/);
  assert.throws(() => normalizeCollectionLimitV1(201), /MCFT_COLLECTION_LIMIT_INVALID/);
  checks.push({ name: "COLLECTION_KIND_AND_LIMIT_INVALID_FAIL_CLOSED", status: "PASS" });

  const rootObject = { object_ref: "tick-a", object_type: "twin_runtime_tick_v1", object_hash: hash("tick-a"), source_fact_ref: "fact-tick-a" } as const;
  const rootHash = buildRootGraphContentHashV1({
    read_model_version: FIELD_TWIN_READ_MODEL_VERSION_V1,
    scope,
    root_graph_status: "COMPLETE_EXACT_GRAPH",
    mandatory_objects: [rootObject],
    record_set_validation: null,
    terminal_record_set_health: null,
    current_tick_forecast_result: null,
    active_lineage_authority_validation: null,
    source_profile_version: FIELD_TWIN_SOURCE_PROFILE_VERSION_V1,
  });
  check("ROOT_HASH_DETERMINISTIC", () => assert.equal(rootHash, buildRootGraphContentHashV1({
    read_model_version: FIELD_TWIN_READ_MODEL_VERSION_V1,
    scope,
    root_graph_status: "COMPLETE_EXACT_GRAPH",
    mandatory_objects: [rootObject],
    record_set_validation: null,
    terminal_record_set_health: null,
    current_tick_forecast_result: null,
    active_lineage_authority_validation: null,
    source_profile_version: FIELD_TWIN_SOURCE_PROFILE_VERSION_V1,
  })));

  check("HASH_EXCLUSION_REGISTRY_EXPLICIT", () => {
    assert.equal(FIELD_TWIN_HASH_CONTRACT_REGISTRY_V1.root_graph_content_hash.self_hash_exclusion, true);
    assert.equal(FIELD_TWIN_HASH_CONTRACT_REGISTRY_V1.timeline_page_content_hash.derived_hash_exclusion, true);
  });

  const attachmentHash = buildAttachmentContentHashV1({
    latest_successful_forecast: null,
    scenario_source_forecast: null,
    current_scenario_attachment: null,
    latest_scenario_in_scope: null,
    optional_domain_summaries: [],
    limitations: [],
  });
  const healthHash = buildHealthContentHashV1({
    terminal_record_set_health: null,
    latest_operational_runtime_health: null,
    health_relationship: "BOTH_ABSENT",
    health_role_resolutions: [],
    health_pointer_validation_summary: [],
  });
  check("ROOT_ATTACHMENT_HEALTH_HASH_OWNERSHIP_SEPARATED", () => {
    assert.notEqual(rootHash, attachmentHash);
    assert.notEqual(rootHash, healthHash);
    assert.notEqual(attachmentHash, healthHash);
  });

  const timelineItemsHash = buildTimelineItemsContentHashV1(events);
  const timelinePageHash = buildTimelinePageContentHashV1({
    scope,
    filter_hash: filterHash,
    canonical_visibility_snapshot_hash: visibility.visibility_snapshot_hash,
    fixed_root_ref: "tick-a",
    fixed_root_graph_content_hash: rootHash,
    sort_direction: "ASC",
    page_limit: 50,
    request_cursor_boundary: null,
    timeline_items_content_hash: timelineItemsHash,
    first_sort_tuple: { logical_time: t0, event_rank: 10, object_ref: "window-a" },
    last_sort_tuple: { logical_time: t1, event_rank: 90, object_ref: "health-a" },
    has_more: false,
  });
  check("TIMELINE_PAGE_HASH_VISIBILITY_BOUND", () => assert.notEqual(timelineItemsHash, timelinePageHash));

  const collectionItems: FieldTwinCollectionItemV1[] = [
    { object_ref: "state-b", object_type: "twin_state_estimate_v1", object_hash: hash("state-b"), logical_time: t2, attachment_status: "ATTACHED_EXACT" },
    { object_ref: "state-a", object_type: "twin_state_estimate_v1", object_hash: hash("state-a"), logical_time: t1, attachment_status: "ATTACHED_EXACT" },
  ];
  const collectionItemsHash = buildCollectionItemsContentHashV1("STATE", collectionItems);
  check("COLLECTION_ITEMS_HASH_ORDER_INDEPENDENT", () => assert.equal(collectionItemsHash, buildCollectionItemsContentHashV1("STATE", [...collectionItems].reverse())));
  const collectionPageHash = buildCollectionPageContentHashV1({
    collection_items_content_hash: collectionItemsHash,
    collection_kind: "STATE",
    scope,
    filter_hash: buildEmptyCollectionFilterHashV1(),
    canonical_visibility_snapshot_hash: visibility.visibility_snapshot_hash,
    fixed_root_ref: "tick-a",
    fixed_root_graph_content_hash: rootHash,
    page_limit: 50,
    request_cursor_boundary: null,
    first_sort_tuple: { logical_time: t2, object_ref: "state-b" },
    last_sort_tuple: { logical_time: t1, object_ref: "state-a" },
    has_more: false,
  });
  check("COLLECTION_PAGE_HASH_BOUNDED", () => assert.notEqual(collectionItemsHash, collectionPageHash));

  const traceNode: FieldTwinTraceNodeV1 = {
    node_id: "node-tick-a",
    object_ref: "tick-a",
    object_type: "twin_runtime_tick_v1",
    object_hash: rootObject.object_hash,
    scope,
    lineage_id: "lineage-a",
    revision_id: null,
    logical_time: t1,
    source_fact_ref: "fact-tick-a",
    validation_profile: "CANONICAL_TWIN_FACT_DIRECT",
    validation_status: "PASS",
  };
  const traceEdge: FieldTwinTraceEdgeV1 = { edge_kind: "CHECKPOINT_TARGET", from_ref: "checkpoint-a", to_ref: "tick-a", evidence_refs: sourceRefs };
  check("TRACE_HASH_ORDER_INDEPENDENT", () => {
    const input = { scope, nodes: [traceNode], edges: [traceEdge], unattached_objects: [], missing_diagnostics: [], record_set_validation: null, health_role_resolutions: [], active_lineage_authority_validation: null };
    assert.equal(buildTraceGraphContentHashV1(input), buildTraceGraphContentHashV1({ ...input, nodes: [...input.nodes].reverse(), edges: [...input.edges].reverse() }));
  });

  const responseHashA = buildResponseInstanceHashV1({
    endpoint_id: "runtime",
    endpoint_version: "v1",
    scope,
    response_started_at: t1,
    request_filter_hash: null,
    request_cursor_boundary: null,
    canonical_visibility_snapshot_hash: null,
    endpoint_content_hashes: { root_graph_content_hash: rootHash, attachment_content_hash: attachmentHash },
    next_cursor_envelope_digest: null,
  });
  const responseHashB = buildResponseInstanceHashV1({
    endpoint_id: "runtime",
    endpoint_version: "v1",
    scope,
    response_started_at: t2,
    request_filter_hash: null,
    request_cursor_boundary: null,
    canonical_visibility_snapshot_hash: null,
    endpoint_content_hashes: { root_graph_content_hash: rootHash, attachment_content_hash: attachmentHash },
    next_cursor_envelope_digest: null,
  });
  check("RESPONSE_INSTANCE_HASH_BINDS_STARTED_AT", () => assert.notEqual(responseHashA, responseHashB));

  const scopeHash = buildScopeHashV1(scope);
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
  check("CURSOR_HMAC_BASE64URL_ROUNDTRIP", () => {
    const verified = verifyFieldTwinCursorV1(signed.wire, verifyContext);
    assert.deepEqual(verified.payload, payload);
    assert.equal(signed.wire.includes("="), false);
    assert.equal(FIELD_TWIN_CURSOR_AUTHENTICATION_CONTRACT_V1.checksum_only_forbidden, true);
  });
  expectCode("CURSOR_TAMPER_REJECTED", "MCFT_CURSOR_AUTH_INVALID", () => {
    const envelope = structuredClone(signed.envelope);
    envelope.payload.fixed_root_ref = "tick-tampered";
    const wire = Buffer.from(canonicalJsonV1(envelope), "utf8").toString("base64url");
    verifyFieldTwinCursorV1(wire, verifyContext);
  });
  expectCode("CURSOR_UNKNOWN_KEY_REJECTED", "MCFT_CURSOR_SIGNING_KEY_UNAVAILABLE", () => verifyFieldTwinCursorV1(signed.wire, { ...verifyContext, signing_keys: {} }));
  expectCode("CURSOR_SCOPE_MISMATCH_REJECTED", "MCFT_CURSOR_SCOPE_MISMATCH", () => verifyFieldTwinCursorV1(signed.wire, { ...verifyContext, scope_hash: hash("wrong-scope") }));
  expectCode("CURSOR_FILTER_MISMATCH_REJECTED", "MCFT_CURSOR_FILTER_MISMATCH", () => verifyFieldTwinCursorV1(signed.wire, { ...verifyContext, filter_hash: hash("wrong-filter") }));
  expectCode("CURSOR_EPOCH_MISMATCH_REJECTED", "MCFT_CURSOR_VISIBILITY_EPOCH_MISMATCH", () => verifyFieldTwinCursorV1(signed.wire, { ...verifyContext, database_visibility_epoch_id: "epoch-b" }));
  expectCode("CURSOR_FIXED_ROOT_MISMATCH_REJECTED", "MCFT_CURSOR_FIXED_ROOT_MISMATCH", () => verifyFieldTwinCursorV1(signed.wire, { ...verifyContext, fixed_root_ref: "tick-b" }));
  expectCode("CURSOR_EXPIRED_REJECTED", "MCFT_CURSOR_EXPIRED", () => verifyFieldTwinCursorV1(signed.wire, { ...verifyContext, now: t4 }));
  expectCode("CURSOR_WIRE_PADDING_REJECTED", "MCFT_CURSOR_WIRE_INVALID", () => verifyFieldTwinCursorV1(`${signed.wire}=`, verifyContext));

  const collectionPayload = createCursorPayloadV1({
    cursor_kind: "OPTIONAL_COLLECTION",
    collection_kind: "STATE",
    sort_contract_id: FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1,
    scope_hash: scopeHash,
    filter_hash: buildEmptyCollectionFilterHashV1(),
    canonical_visibility_snapshot: visibility,
    fixed_root_ref: "tick-a",
    fixed_root_graph_content_hash: rootHash,
    sort_direction: "DESC",
    last_sort_tuple: { cursor_kind: "OPTIONAL_COLLECTION", logical_time: t1, object_ref: "state-a" },
    page_limit: 50,
    issued_at: t1,
    expires_at: t2,
  });
  const collectionSigned = signFieldTwinCursorV1(collectionPayload, "key-v1", "0123456789abcdef0123456789abcdef");
  expectCode("CURSOR_COLLECTION_KIND_MISMATCH_REJECTED", "MCFT_CURSOR_COLLECTION_KIND_MISMATCH", () => verifyFieldTwinCursorV1(collectionSigned.wire, {
    ...verifyContext,
    cursor_kind: "OPTIONAL_COLLECTION",
    collection_kind: "FORECAST",
    filter_hash: buildEmptyCollectionFilterHashV1(),
  }));

  check("S1_PREDECESSOR_ARTIFACT_CONSUMPTION_EXACT", () => {
    const predecessor = loadJson(`${CAP}/GEOX-MCFT-CAP-07-S1-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json`) as Record<string, unknown>;
    assert.equal(predecessor.status, "PASS");
    assert.equal(predecessor.subject_commit, "0790da7708971a690601051c521bb2678c38fb7f");
    assert.equal(predecessor.semantic_artifact_digest, "sha256:e442288dfa25fa5b1356124c67a6c3d64f9412d7acb5161a192c749ab7648dcd");
    assert.equal(predecessor.transport_archive_sha256, "sha256:32ce9615416134c0cc7ab062589b2e17f351832dd784fbf2689022771cdba911");
    const retention = predecessor.retention_authority as Record<string, unknown>;
    assert.equal(retention.readback_verified, true);
    assert.equal(retention.locked_version_delete_denied, true);
  });

  check("S1_STATUS_AND_S2_SEED_AUTHORITY_EXACT", () => {
    const s1 = loadJson(`${CAP}/GEOX-MCFT-CAP-07-S1-DELIVERY-STATUS-V1.json`) as Record<string, unknown>;
    const s2 = loadJson(`${CAP}/GEOX-MCFT-CAP-07-S2-DELIVERY-STATUS-V1.json`) as Record<string, unknown>;
    assert.equal(s1.s1_candidate_implemented, true);
    assert.equal(s1.delivery_state, "IMPLEMENTED_AWAITING_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION");
    assert.equal(s1.effective_next_slice_when_attested, "S2");
    assert.equal(s1.runtime_authority_delta, "PURE_DOMAIN_CONTRACTS_ONLY");
    assert.equal(s1.canonical_write_authority_delta, "ZERO");
    assert.equal(s2.s2_candidate_implemented, false);
    assert.equal(s2.implementation_authorized, false);
  });

  const base = process.env.MCFT_BASE_SHA || "";
  if (base) check("S1_CHANGED_FILE_BOUNDARY_EXACT", () => {
    const changed = cp.execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { cwd: ROOT, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
    const allowed = (file: string): boolean => file.startsWith("apps/server/src/domain/field_twin_read_model/")
      || file === "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_S1_CONTRACTS.ts"
      || file.startsWith(`${CAP}/`)
      || file === "docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json"
      || file === ".github/workflows/mcft-cap-07-s1-contracts.yml";
    assert.deepEqual(changed.filter((file) => !allowed(file)), []);
    const forbidden = changed.filter((file) => file.includes("/db/migrations/") || file.startsWith("apps/server/src/routes/") || file.startsWith("apps/web/") || file.startsWith("apps/server/src/runtime/") || file.startsWith("apps/server/src/projections/"));
    assert.deepEqual(forbidden, []);
  });

  const result = {
    schema_version: "geox_mcft_cap_07_s1_contracts_result_v1",
    status: "PASS",
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
  console.log(`MCFT-CAP-07 S1 contracts: ${checks.length} PASS`);
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ schema_version: "geox_mcft_cap_07_s1_contracts_result_v1", status: "FAIL", error: error instanceof Error ? error.message : String(error), checks }, null, 2)}\n`, "utf8");
  console.error(error);
  process.exitCode = 1;
}
