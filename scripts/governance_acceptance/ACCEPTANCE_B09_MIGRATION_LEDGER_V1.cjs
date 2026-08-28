#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const baseDir = path.join(repoRoot, "docs/architecture/semantic_convergence");
const registerPath = path.join(baseDir, "GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const graphPath = path.join(baseDir, "GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");
const ledgerPath = path.join(baseDir, "GEOX-B09-MIGRATION-LEDGER-V1.json");

const fail = [];
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const repoPath = (p) => path.relative(repoRoot, p).split(path.sep).join("/");
const existsRepo = (p) => fs.existsSync(path.join(repoRoot, p));

for (const p of [registerPath, graphPath, ledgerPath]) {
  if (!fs.existsSync(p)) fail.push("B09_REQUIRED_FILE_MISSING:" + repoPath(p));
}

if (!fail.length) {
  const reg = read(registerPath);
  const graph = read(graphPath);
  const ledger = read(ledgerPath);

  if (ledger.schema_version !== "b09_migration_ledger_v1") fail.push("B09_LEDGER_SCHEMA_INVALID");
  if (ledger.phase !== "B-09" || ledger.subphase !== "B-09a") fail.push("B09_LEDGER_PHASE_INVALID");
  if (ledger.status !== "PRE_REMOVAL_INVENTORY") fail.push("B09_LEDGER_STATUS_INVALID");
  if (ledger.authoritative_product_base !== "6702631be2f66587d4fa1230e0f97f6fd4e9b8b9") fail.push("B09_LEDGER_BASE_INVALID:" + ledger.authoritative_product_base);

  const inv = ledger.b09a_global_invariants || {};
  for (const key of [
    "authority_removal_enabled",
    "any_authority_removal_eligible",
    "shadow_compare_complete_allowed",
    "divergence_adjudication_allowed",
    "consumer_migration_complete_allowed",
    "runtime_authority_mutation_allowed",
    "mass_deletion_allowed",
    "real_mcft_adr_llm_integration_allowed"
  ]) {
    if (inv[key] !== false) fail.push("B09A_INVARIANT_MUST_BE_FALSE:" + key);
  }
  if (inv.historical_removal_target_must_remain !== "B-09") fail.push("B09A_REMOVAL_TARGET_INVARIANT_INVALID");

  const producers = new Map();
  const semantics = new Set();
  const grandfathered = new Map();
  for (const s of reg.semantics || []) {
    semantics.add(s.semantic_id);
    for (const p of s.registered_producers || []) {
      producers.set(p.producer_id, { semantic_id: s.semantic_id, producer: p });
      if (p.grandfathered_duplicate === true) grandfathered.set(p.producer_id, { semantic_id:s.semantic_id, producer:p });
    }
  }

  const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
  const byProducer = new Map();
  for (const e of entries) {
    if (byProducer.has(e.legacy_producer_id)) fail.push("B09_DUPLICATE_LEDGER_PRODUCER:" + e.legacy_producer_id);
    byProducer.set(e.legacy_producer_id, e);
  }

  if (entries.length !== grandfathered.size) fail.push("B09_LEDGER_COUNT_MISMATCH:ledger=" + entries.length + ":grandfathered=" + grandfathered.size);
  if (entries.length !== 29) fail.push("B09A_EXPECTED_29_ENTRIES:" + entries.length);

  const replacementEnum = new Set(["PROVEN_REPLACEMENT","PARTIAL_REPLACEMENT","NO_REPLACEMENT"]);
  const shadowEnum = new Set(["NOT_STARTED","CAPABLE","RUNNING","COMPLETE"]);
  const divergenceEnum = new Set(["UNKNOWN","MATCH","ACCEPTABLE_DIFFERENCE","BLOCKING_DIFFERENCE"]);
  const migrationEnum = new Set(["NOT_REQUIRED","NOT_STARTED","PARTIAL","COMPLETE"]);
  const dispositionEnum = new Set([
    "REMOVE_AUTHORITY_AFTER_GATES",
    "COMPATIBILITY_ONLY_NO_NEW_FEATURE",
    "RETAIN_UNTIL_EXTERNAL_REPLACEMENT",
    "RETAIN_AS_NONAUTHORITATIVE_SOURCE"
  ]);

  const connByProducer = new Map();
  for (const edge of graph.current_connectivity_edges || []) {
    if (!connByProducer.has(edge.from_producer)) connByProducer.set(edge.from_producer, []);
    connByProducer.get(edge.from_producer).push(edge);
  }
  const parallelByProducer = new Map();
  for (const edge of graph.current_parallel_edges || []) {
    if (!parallelByProducer.has(edge.producer_id)) parallelByProducer.set(edge.producer_id, []);
    parallelByProducer.get(edge.producer_id).push(edge);
  }

  function validateRef(ref, entryId, field) {
    const raw = String(ref || "");
    if (raw.startsWith("producer:")) {
      const id = raw.slice("producer:".length);
      const p = producers.get(id);
      if (!p) return fail.push("B09_UNKNOWN_REPLACEMENT_PRODUCER_REF:" + entryId + ":" + field + ":" + id);
      if (field === "canonical_replacement_refs" && p.producer.grandfathered_duplicate === true) {
        fail.push("B09_CANONICAL_REPLACEMENT_CANNOT_BE_GRANDFATHERED:" + entryId + ":" + id);
      }
      return;
    }
    if (raw.startsWith("path:")) {
      const p = raw.slice("path:".length);
      if (!existsRepo(p)) fail.push("B09_REPLACEMENT_PATH_MISSING:" + entryId + ":" + field + ":" + p);
      return;
    }
    if (raw.startsWith("semantic:")) {
      const id = raw.slice("semantic:".length);
      if (!semantics.has(id)) fail.push("B09_REPLACEMENT_SEMANTIC_UNKNOWN:" + entryId + ":" + field + ":" + id);
      return;
    }
    fail.push("B09_REPLACEMENT_REF_FORMAT_INVALID:" + entryId + ":" + field + ":" + raw);
  }

  for (const [pid, g] of grandfathered) {
    const e = byProducer.get(pid);
    if (!e) { fail.push("B09_GRANDFATHERED_PRODUCER_NOT_IN_LEDGER:" + pid); continue; }

    const p = g.producer;
    if (e.semantic_id !== g.semantic_id) fail.push("B09_SEMANTIC_MISMATCH:" + pid);
    if (e.legacy_path !== p.path) fail.push("B09_PATH_MISMATCH:" + pid);
    if (e.legacy_authority_level !== p.authority_level) fail.push("B09_AUTHORITY_LEVEL_MISMATCH:" + pid);
    if (e.legacy_connection_class !== p.connection_class) fail.push("B09_CONNECTION_CLASS_MISMATCH:" + pid);
    if (e.legacy_activation !== p.activation) fail.push("B09_ACTIVATION_MISMATCH:" + pid);
    if (e.legacy_runtime_edge !== p.runtime_edge) fail.push("B09_RUNTIME_EDGE_MISMATCH:" + pid);
    if (p.removal_target !== "B-09" || e.removal_target !== "B-09") fail.push("B09_REMOVAL_TARGET_DRIFT:" + pid);

    if (!replacementEnum.has(e.replacement_state)) fail.push("B09_REPLACEMENT_STATE_INVALID:" + pid);
    if (!shadowEnum.has(e.shadow_compare_state)) fail.push("B09_SHADOW_STATE_INVALID:" + pid);
    if (!divergenceEnum.has(e.divergence_state)) fail.push("B09_DIVERGENCE_STATE_INVALID:" + pid);
    if (!migrationEnum.has(e.consumer_migration_state)) fail.push("B09_CONSUMER_MIGRATION_STATE_INVALID:" + pid);
    if (!dispositionEnum.has(e.intended_disposition)) fail.push("B09_DISPOSITION_INVALID:" + pid);

    if (e.authority_removal_eligible !== false) fail.push("B09A_AUTHORITY_REMOVAL_ELIGIBLE_FORBIDDEN:" + pid);
    if ((e.authority_removal_refs || []).length !== 0) fail.push("B09A_AUTHORITY_REMOVAL_REFS_FORBIDDEN:" + pid);
    if (e.shadow_compare_state === "RUNNING" || e.shadow_compare_state === "COMPLETE") fail.push("B09A_SHADOW_EXECUTION_PREMATURE:" + pid);
    if (e.divergence_state !== "UNKNOWN") fail.push("B09A_DIVERGENCE_ADJUDICATION_PREMATURE:" + pid);
    if ((e.divergence_refs || []).length !== 0) fail.push("B09A_DIVERGENCE_REFS_PREMATURE:" + pid);
    if (e.consumer_migration_state === "PARTIAL" || e.consumer_migration_state === "COMPLETE") fail.push("B09A_CONSUMER_MIGRATION_PREMATURE:" + pid);
    if ((e.consumer_migration_refs || []).length !== 0) fail.push("B09A_CONSUMER_MIGRATION_REFS_PREMATURE:" + pid);
    if ((e.shadow_evidence_refs || []).length !== 0) fail.push("B09A_SHADOW_EVIDENCE_REFS_PREMATURE:" + pid);

    const replacements = e.canonical_replacement_refs || [];
    const futureTargets = e.future_target_refs || [];
    replacements.forEach(r => validateRef(r, e.entry_id, "canonical_replacement_refs"));
    futureTargets.forEach(r => validateRef(r, e.entry_id, "future_target_refs"));

    if (e.replacement_state === "NO_REPLACEMENT") {
      if (replacements.length !== 0) fail.push("B09_NO_REPLACEMENT_CANNOT_HAVE_CANONICAL_REFS:" + pid);
      if (e.shadow_compare_state !== "NOT_STARTED") fail.push("B09_NO_REPLACEMENT_SHADOW_STATE_INVALID:" + pid);
      if (e.intended_disposition === "REMOVE_AUTHORITY_AFTER_GATES") fail.push("B09_NO_REPLACEMENT_CANNOT_TARGET_AUTHORITY_REMOVAL:" + pid);
    } else {
      if (replacements.length === 0) fail.push("B09_REPLACEMENT_STATE_REQUIRES_CANONICAL_REF:" + pid);
      if (e.shadow_compare_state !== "CAPABLE") fail.push("B09_REPLACEMENT_BACKED_ENTRY_MUST_BE_SHADOW_CAPABLE:" + pid);
    }

    if (e.intended_disposition === "RETAIN_UNTIL_EXTERNAL_REPLACEMENT" && e.replacement_state !== "NO_REPLACEMENT") {
      fail.push("B09_RETAIN_EXTERNAL_REPLACEMENT_STATE_INVALID:" + pid);
    }
    if (e.intended_disposition === "REMOVE_AUTHORITY_AFTER_GATES" && e.replacement_state === "NO_REPLACEMENT") {
      fail.push("B09_REMOVE_DISPOSITION_WITHOUT_REPLACEMENT:" + pid);
    }

    const expectedConn=(connByProducer.get(pid)||[]).map(x=>x.edge_id).sort();
    const gotConn=[...(e.current_connectivity_edge_ids||[])].sort();
    if (JSON.stringify(expectedConn)!==JSON.stringify(gotConn)) fail.push("B09_CONNECTIVITY_EDGE_SET_MISMATCH:" + pid);

    const expectedPar=(parallelByProducer.get(pid)||[]).map(x=>x.edge_id).sort();
    const gotPar=[...(e.current_parallel_edge_ids||[])].sort();
    if (JSON.stringify(expectedPar)!==JSON.stringify(gotPar)) fail.push("B09_PARALLEL_EDGE_SET_MISMATCH:" + pid);

    const expectedConsumers=Array.from(new Set((connByProducer.get(pid)||[])
      .filter(x=>x.to_consumer!=="NONE"&&x.runtime_edge==="PROVEN")
      .map(x=>x.to_consumer))).sort();
    const gotConsumers=[...(e.current_proven_consumer_ids||[])].sort();
    if (JSON.stringify(expectedConsumers)!==JSON.stringify(gotConsumers)) fail.push("B09_PROVEN_CONSUMER_SET_MISMATCH:" + pid);
    if (e.consumer_migration_state === "NOT_REQUIRED" && expectedConsumers.length > 0) {
      fail.push("B09_CONSUMER_MIGRATION_NOT_REQUIRED_BUT_PROVEN_CONSUMER_EXISTS:" + pid);
    }
  }

  for (const e of entries) {
    if (!grandfathered.has(e.legacy_producer_id)) fail.push("B09_LEDGER_ENTRY_NOT_GRANDFATHERED:" + e.legacy_producer_id);
  }

  for (const edge of graph.current_parallel_edges || []) {
    const e=byProducer.get(edge.producer_id);
    if (!e) fail.push("B09_PARALLEL_EDGE_WITHOUT_LEDGER_ENTRY:" + edge.edge_id);
    if (edge.removal_target !== "B-09") fail.push("B09_PARALLEL_EDGE_REMOVAL_TARGET_DRIFT:" + edge.edge_id);
  }

  const summary=ledger.summary||{};
  if (summary.grandfathered_entries !== entries.length) fail.push("B09_SUMMARY_ENTRY_COUNT_INVALID");
  if (summary.proven_replacement !== entries.filter(e=>e.replacement_state==="PROVEN_REPLACEMENT").length) fail.push("B09_SUMMARY_PROVEN_INVALID");
  if (summary.partial_replacement !== entries.filter(e=>e.replacement_state==="PARTIAL_REPLACEMENT").length) fail.push("B09_SUMMARY_PARTIAL_INVALID");
  if (summary.no_replacement !== entries.filter(e=>e.replacement_state==="NO_REPLACEMENT").length) fail.push("B09_SUMMARY_NONE_INVALID");
  if (summary.authority_removal_eligible !== 0) fail.push("B09A_SUMMARY_REMOVAL_ELIGIBLE_MUST_BE_ZERO");

  const twinEntries=entries.filter(e=>e.semantic_id==="twin.physical_state"||e.semantic_id==="twin.forecast_scenario");
  for (const e of twinEntries) {
    if (e.replacement_state!=="NO_REPLACEMENT") fail.push("B09A_TWIN_REAL_REPLACEMENT_MUST_NOT_BE_CLAIMED:" + e.legacy_producer_id);
  }
}

for (const f of fail) console.error("FAIL " + f);
if (fail.length) {
  console.error("B09_MIGRATION_LEDGER_FAIL count=" + fail.length);
  process.exitCode=1;
} else {
  console.log("B09_MIGRATION_LEDGER_PASS");
}
