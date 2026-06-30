// scripts/maintenance/POST_P8_03_ARCHIVE_FIRST_BATCH.cjs
// Purpose: move the first post-P8 historical task-doc archive batch from docs/tasks to docs/legacy/tasks.
// Boundary: local filesystem migration only; preserves file contents and does not modify runtime, frontend, database, package, or CI files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const BATCH = [
  ['docs/tasks/P1-Completion-Review-Before-P2.md', 'docs/legacy/tasks/P1-Completion-Review-Before-P2.md'],
  ['docs/tasks/P2-01-Adapter-Contract-Reconciliation.md', 'docs/legacy/tasks/P2-01-Adapter-Contract-Reconciliation.md'],
  ['docs/tasks/P2-02-Adapter-Capability-Manifest-and-Registry-Audit.md', 'docs/legacy/tasks/P2-02-Adapter-Capability-Manifest-and-Registry-Audit.md'],
  ['docs/tasks/P2-03-Safe-Real-Adapter-Sandbox-Harness.md', 'docs/legacy/tasks/P2-03-Safe-Real-Adapter-Sandbox-Harness.md'],
  ['docs/tasks/P2-04-Production-Ingestion-Adapter-Boundary.md', 'docs/legacy/tasks/P2-04-Production-Ingestion-Adapter-Boundary.md'],
  ['docs/tasks/P2-05-Real-Adapter-Negative-Runtime-Matrix.md', 'docs/legacy/tasks/P2-05-Real-Adapter-Negative-Runtime-Matrix.md'],
  ['docs/tasks/P2-06-Operator-Controlled-Pilot-Dry-Run.md', 'docs/legacy/tasks/P2-06-Operator-Controlled-Pilot-Dry-Run.md'],
  ['docs/tasks/P2-Completion-Review-Before-P3.md', 'docs/legacy/tasks/P2-Completion-Review-Before-P3.md'],
  ['docs/tasks/P2-Real-Adapter-Integration-Planning.md', 'docs/legacy/tasks/P2-Real-Adapter-Integration-Planning.md'],
  ['docs/tasks/P3-01-Operator-Workflow-Surface-Inventory.md', 'docs/legacy/tasks/P3-01-Operator-Workflow-Surface-Inventory.md'],
  ['docs/tasks/P3-02-Operator-Preflight-Read-Model-Planning.md', 'docs/legacy/tasks/P3-02-Operator-Preflight-Read-Model-Planning.md'],
  ['docs/tasks/P3-03-Operator-Gate-Read-Model-Planning.md', 'docs/legacy/tasks/P3-03-Operator-Gate-Read-Model-Planning.md'],
  ['docs/tasks/P3-04-Dry-Run-Report-Read-Model-Planning.md', 'docs/legacy/tasks/P3-04-Dry-Run-Report-Read-Model-Planning.md'],
  ['docs/tasks/P3-05-Operator-Audit-Trail-Planning.md', 'docs/legacy/tasks/P3-05-Operator-Audit-Trail-Planning.md'],
  ['docs/tasks/P3-06-Operator-UX-Negative-Boundary-Matrix.md', 'docs/legacy/tasks/P3-06-Operator-UX-Negative-Boundary-Matrix.md'],
  ['docs/tasks/P3-07-Operator-UX-Completion-Review-Before-P4.md', 'docs/legacy/tasks/P3-07-Operator-UX-Completion-Review-Before-P4.md'],
  ['docs/tasks/P3-Operator-UX-Refinement-Planning.md', 'docs/legacy/tasks/P3-Operator-UX-Refinement-Planning.md'],
  ['docs/tasks/P4-01-ROI-Source-Boundary-Reconciliation.md', 'docs/legacy/tasks/P4-01-ROI-Source-Boundary-Reconciliation.md'],
  ['docs/tasks/P4-02-ROI-Policy-Gate-Contract.md', 'docs/legacy/tasks/P4-02-ROI-Policy-Gate-Contract.md'],
  ['docs/tasks/P4-03-ROI-Read-Model-Output-Contract.md', 'docs/legacy/tasks/P4-03-ROI-Read-Model-Output-Contract.md'],
];

function abs(file) {
  return path.resolve(ROOT, file);
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function mkdirFor(file) {
  fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
}

function moveOne(source, destination) {
  const sourceExists = exists(source);
  const destinationExists = exists(destination);
  if (!sourceExists && destinationExists) {
    return { source, destination, status: 'already_migrated' };
  }
  if (!sourceExists && !destinationExists) {
    throw new Error(`MISSING_SOURCE_AND_DESTINATION:${source}`);
  }
  if (sourceExists && destinationExists) {
    const sourceContent = fs.readFileSync(abs(source), 'utf8');
    const destinationContent = fs.readFileSync(abs(destination), 'utf8');
    if (sourceContent !== destinationContent) throw new Error(`DESTINATION_CONFLICT:${destination}`);
    fs.unlinkSync(abs(source));
    return { source, destination, status: 'removed_duplicate_source' };
  }
  mkdirFor(destination);
  fs.renameSync(abs(source), abs(destination));
  return { source, destination, status: 'migrated' };
}

const results = [];
try {
  for (const [source, destination] of BATCH) {
    results.push(moveOne(source, destination));
  }
  const migratedCount = results.filter((item) => item.status === 'migrated').length;
  const alreadyMigratedCount = results.filter((item) => item.status === 'already_migrated').length;
  const duplicateRemovedCount = results.filter((item) => item.status === 'removed_duplicate_source').length;
  console.log(JSON.stringify({
    ok: true,
    action: 'POST_P8_03_ARCHIVE_FIRST_BATCH',
    batch_size: BATCH.length,
    migrated_count: migratedCount,
    already_migrated_count: alreadyMigratedCount,
    duplicate_removed_count: duplicateRemovedCount,
    results,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    action: 'POST_P8_03_ARCHIVE_FIRST_BATCH',
    error: error.message,
    results,
  }, null, 2));
  process.exit(1);
}
