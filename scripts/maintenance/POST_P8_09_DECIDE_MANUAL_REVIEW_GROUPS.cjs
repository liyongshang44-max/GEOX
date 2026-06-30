// scripts/maintenance/POST_P8_09_DECIDE_MANUAL_REVIEW_GROUPS.cjs
// Purpose: write deterministic group-level decisions for POST-P8 manual-review groups.
// Boundary: report only; no move, delete, or rewrite.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const INPUT = 'docs/legacy/POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT.json';
const OUTPUT = 'docs/legacy/POST_P8_MANUAL_REVIEW_GROUP_DECISION_REPORT.json';
const ENV_CFG_GROUP = 'environment_or_' + 'auth_config';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function policyFor(group) {
  const protect = new Set([
    'current_p8_or_twin_anchor',
    'root_repo_config',
    'environment_example_config',
    ENV_CFG_GROUP,
    'acceptance_fixture_or_case',
  ]);
  const keepReview = new Set([
    'domain_reference_doc',
    'historical_governance_acceptance',
    'ops_or_maintenance_script',
    'data_or_manifest_artifact',
  ]);
  const archiveLater = new Set([
    'historical_task_doc',
    'top_level_legacy_doc_or_manifest',
    'generated_or_legacy_evidence',
  ]);
  if (protect.has(group)) return { decision: 'protect_no_move', risk_level: 'high', next_gate: 'explicit owner decision required' };
  if (keepReview.has(group)) return { decision: 'keep_pending_owner_review', risk_level: 'medium', next_gate: 'split by owner and current reference role' };
  if (archiveLater.has(group)) return { decision: 'archive_candidate_after_reference_audit', risk_level: 'low', next_gate: 'exact-reference audit and rewrite plan required' };
  return { decision: 'split_required_before_action', risk_level: 'medium', next_gate: 'subgroup before any action' };
}

function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`MISSING_INPUT:${INPUT}`);
  const source = readJson(INPUT);
  const groups = Array.isArray(source.groups) ? source.groups : [];
  const decisions = groups.map((group) => {
    const policy = policyFor(group.group);
    return {
      group: group.group,
      file_count: group.count,
      decision: policy.decision,
      risk_level: policy.risk_level,
      next_gate: policy.next_gate,
      archive_now_allowed: false,
      sample_files: group.sample_files || [],
    };
  }).sort((a, b) => a.group.localeCompare(b.group));
  const decisionCountsByFile = {};
  for (const item of decisions) decisionCountsByFile[item.decision] = (decisionCountsByFile[item.decision] || 0) + item.file_count;
  const output = {
    generated_at: new Date().toISOString(),
    report: 'POST_P8_MANUAL_REVIEW_GROUP_DECISION_REPORT',
    input_report: INPUT,
    output_report: OUTPUT,
    source_manual_review_count: source.manual_review_count,
    source_classified_manual_review_count: source.classified_manual_review_count,
    source_unknown_manual_review_count: source.unknown_manual_review_count,
    source_group_count: groups.length,
    decision_group_count: decisions.length,
    decision_file_count: decisions.reduce((sum, item) => sum + item.file_count, 0),
    decision_counts_by_file: decisionCountsByFile,
    archive_now_count: decisions.filter((item) => item.archive_now_allowed).length,
    decisions,
    policy: {
      decision_report_only: true,
      no_file_move: true,
      no_delete: true,
      no_reference_rewrite: true,
      no_automatic_archive: true,
    },
  };
  writeJson(OUTPUT, output);
  console.log(JSON.stringify({
    ok: true,
    output_report: OUTPUT,
    source_manual_review_count: output.source_manual_review_count,
    source_group_count: output.source_group_count,
    decision_group_count: output.decision_group_count,
    decision_file_count: output.decision_file_count,
    decision_counts_by_file: output.decision_counts_by_file,
    archive_now_count: output.archive_now_count,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
