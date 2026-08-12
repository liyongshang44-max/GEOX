#!/usr/bin/env node
const fs = require('fs');

const runnerPath = 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts';
const canonicalizerPath = 'apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts';
const runner = fs.readFileSync(runnerPath, 'utf8');
const canonicalizer = fs.readFileSync(canonicalizerPath, 'utf8');

function requireText(haystack, needle, code) {
  if (!haystack.includes(needle)) throw new Error(code);
}

requireText(
  canonicalizer,
  'requireCondition(Date.parse(retrievedAt) <= Date.parse(retainedAt), "EA3_RETAINED_BEFORE_RETRIEVAL");',
  'EA5E2_CAUSAL_REUSE_EA3_INVARIANT_DRIFT',
);
requireText(
  runner,
  'const retrievedAt = canonicalIso(input.retrieved_at, "EA5E2_TRANSIENT_RETRIEVED_AT_INVALID");',
  'EA5E2_CAUSAL_REUSE_CURRENT_RETRIEVAL_CLOCK_REQUIRED',
);
requireText(
  runner,
  'if (Date.parse(retainedAt) >= Date.parse(retrievedAt)) {',
  'EA5E2_CAUSAL_REUSE_GUARD_REQUIRED',
);
requireText(
  runner,
  'await this.deleteRetainedRawEvidence(ref);',
  'EA5E2_CAUSAL_REUSE_STALE_DELETE_REQUIRED',
);

const probeBlock = runner.match(/const probe = await this\.request\(\{ method: "HEAD", key, allowed_statuses: \[200, 404\] \}\);[\s\S]*?const retainedAt = new Date\(\)\.toISOString\(\);/);
if (!probeBlock) throw new Error('EA5E2_CAUSAL_REUSE_PROBE_BLOCK_REQUIRED');
const block = probeBlock[0];
if (block.indexOf('Date.parse(retainedAt) >= Date.parse(retrievedAt)') > block.indexOf('await this.deleteRetainedRawEvidence(ref);')) {
  throw new Error('EA5E2_CAUSAL_REUSE_GUARD_MUST_PRECEDE_STALE_DELETE');
}
if (block.indexOf('await this.deleteRetainedRawEvidence(ref);') > block.indexOf('const retainedAt = new Date().toISOString();')) {
  throw new Error('EA5E2_CAUSAL_REUSE_STALE_DELETE_MUST_PRECEDE_RERETENTION');
}

console.log(JSON.stringify({
  status: 'PASS',
  ea3_retrieved_before_retained_invariant_preserved: true,
  stale_transient_object_reuse_forbidden: true,
  stale_transient_object_delete_before_reretain: true,
  formal_authority_changed: false,
  write_count: 0,
}));
