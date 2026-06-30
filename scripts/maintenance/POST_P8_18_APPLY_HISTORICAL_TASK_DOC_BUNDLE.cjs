// scripts/maintenance/POST_P8_18_APPLY_HISTORICAL_TASK_DOC_BUNDLE.cjs
// Purpose: apply the historical_task_doc reference update and file move bundle.
// Boundary: modifies only planned documentation and governance reference files from POST-P8-13.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const PLAN = 'docs/legacy/POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN.json';
const PREVIEW = 'docs/legacy/POST_P8_15_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PREVIEW_REPORT.json';
const OWNER = 'docs/legacy/POST_P8_16_HISTORICAL_TASK_DOC_OWNER_CONFIRMATION_REPORT.json';
const OUTPUT = 'docs/legacy/POST_P8_18_HISTORICAL_TASK_DOC_APPLY_BUNDLE_REPORT.json';
const SELECTED_GROUP = 'historical_task_doc';

const RUNTIME_PREFIXES = ['apps/', 'packages/', 'db/', 'prisma/', 'migrations/', 'seeds/', 'docker/', '.github/'];
const RUNTIME_FILES = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (true) {
    const found = text.indexOf(needle, index);
    if (found === -1) return count;
    count += 1;
    index = found + needle.length;
  }
}

function replaceAllExact(text, needle, replacement) {
  return text.split(needle).join(replacement);
}

function unique(values) {
  return [...new Set(values)];
}

function isRuntimeSurface(file) {
  return RUNTIME_FILES.has(file) || RUNTIME_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function gitChangedFiles() {
  try {
    const output = childProcess.execFileSync('git', ['diff', '--name-only', 'main...HEAD'], { encoding: 'utf8' });
    return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function flattenPlan(plan) {
  const filePlans = Array.isArray(plan.file_plans) ? plan.file_plans : [];
  const referencePlans = [];
  for (const filePlan of filePlans) {
    const refs = Array.isArray(filePlan.reference_plans) ? filePlan.reference_plans : [];
    for (const refPlan of refs) {
      referencePlans.push({
        source_file: filePlan.source_file,
        planned_destination: filePlan.planned_destination,
        referencing_file: refPlan.referencing_file,
        old_reference: refPlan.old_reference,
        planned_reference: refPlan.planned_reference,
        exact_reference_count: refPlan.exact_reference_count,
      });
    }
  }
  return { filePlans, referencePlans };
}

function validateInputs(plan, preview, owner, filePlans, referencePlans) {
  if (plan.selected_group !== SELECTED_GROUP) throw new Error(`UNEXPECTED_PLAN_GROUP:${plan.selected_group}`);
  if (preview.selected_group !== SELECTED_GROUP) throw new Error(`UNEXPECTED_PREVIEW_GROUP:${preview.selected_group}`);
  if (owner.selected_group !== SELECTED_GROUP) throw new Error(`UNEXPECTED_OWNER_GROUP:${owner.selected_group}`);
  if (owner.owner_confirmation_recorded !== true) throw new Error('OWNER_CONFIRMATION_NOT_RECORDED');
  if (preview.mismatch_count !== 0) throw new Error(`PREVIEW_MISMATCH_COUNT:${preview.mismatch_count}`);
  if (filePlans.length !== 48) throw new Error(`UNEXPECTED_FILE_PLAN_COUNT:${filePlans.length}`);
  if (referencePlans.length !== 371) throw new Error(`UNEXPECTED_REFERENCE_PLAN_COUNT:${referencePlans.length}`);
  const expected = referencePlans.reduce((sum, item) => sum + item.exact_reference_count, 0);
  if (expected !== 585) throw new Error(`UNEXPECTED_REFERENCE_COUNT:${expected}`);
}

function applyReferenceUpdates(referencePlans) {
  const byFile = new Map();
  for (const item of referencePlans) {
    if (!byFile.has(item.referencing_file)) byFile.set(item.referencing_file, []);
    byFile.get(item.referencing_file).push(item);
  }

  let replacementCount = 0;
  const results = [];

  for (const [referencingFile, items] of byFile.entries()) {
    if (!fs.existsSync(referencingFile)) throw new Error(`MISSING_REFERENCING_FILE:${referencingFile}`);
    let content = fs.readFileSync(referencingFile, 'utf8');
    let fileReplacementCount = 0;

    for (const item of items) {
      const observedBefore = countOccurrences(content, item.old_reference);
      if (observedBefore !== item.exact_reference_count) {
        throw new Error(`REFERENCE_COUNT_MISMATCH:${referencingFile}:${item.old_reference}:${observedBefore}:${item.exact_reference_count}`);
      }
      content = replaceAllExact(content, item.old_reference, item.planned_reference);
      replacementCount += observedBefore;
      fileReplacementCount += observedBefore;
    }

    fs.writeFileSync(referencingFile, content, 'utf8');
    results.push({ referencing_file: referencingFile, replacement_count: fileReplacementCount });
  }

  return { replacementCount, results };
}

function moveFiles(filePlans) {
  const results = [];
  for (const filePlan of filePlans) {
    const source = filePlan.source_file;
    const destination = filePlan.planned_destination;
    if (!fs.existsSync(source)) throw new Error(`MISSING_SOURCE_FILE:${source}`);
    if (fs.existsSync(destination)) throw new Error(`DESTINATION_ALREADY_EXISTS:${destination}`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(source, destination);
    results.push({ source_file: source, planned_destination: destination, moved: true });
  }
  return results;
}

function auditAfter(filePlans, referencePlans) {
  const movedPath = new Map(filePlans.map((item) => [item.source_file, item.planned_destination]));
  let oldExactReferenceCountAfter = 0;
  let newExactReferenceCountAfter = 0;
  let brokenReferenceCount = 0;
  const missingDestinations = [];
  const remainingSources = [];

  for (const filePlan of filePlans) {
    if (!fs.existsSync(filePlan.planned_destination)) missingDestinations.push(filePlan.planned_destination);
    if (fs.existsSync(filePlan.source_file)) remainingSources.push(filePlan.source_file);
  }

  for (const item of referencePlans) {
    const currentReferencingFile = movedPath.get(item.referencing_file) || item.referencing_file;
    if (!fs.existsSync(currentReferencingFile)) throw new Error(`MISSING_CURRENT_REFERENCING_FILE:${currentReferencingFile}`);
    const content = fs.readFileSync(currentReferencingFile, 'utf8');
    oldExactReferenceCountAfter += countOccurrences(content, item.old_reference);
    newExactReferenceCountAfter += countOccurrences(content, item.planned_reference);
    if (!fs.existsSync(item.planned_reference)) brokenReferenceCount += 1;
  }

  const changedFiles = gitChangedFiles();
  const runtimeSurfaceFiles = changedFiles.filter(isRuntimeSurface);

  return {
    oldExactReferenceCountAfter,
    newExactReferenceCountAfter,
    missing_destination_file_count: missingDestinations.length,
    remaining_source_file_count: remainingSources.length,
    broken_reference_count: brokenReferenceCount,
    runtime_surface_diff_count: runtimeSurfaceFiles.length,
    missing_destinations: missingDestinations,
    remaining_sources: remainingSources,
    runtime_surface_files: runtimeSurfaceFiles,
    changed_file_count: changedFiles.length,
    changed_files: changedFiles,
  };
}

function main() {
  if (!fs.existsSync(PLAN)) throw new Error(`MISSING_PLAN:${PLAN}`);
  if (!fs.existsSync(PREVIEW)) throw new Error(`MISSING_PREVIEW:${PREVIEW}`);
  if (!fs.existsSync(OWNER)) throw new Error(`MISSING_OWNER:${OWNER}`);

  const plan = readJson(PLAN);
  const preview = readJson(PREVIEW);
  const owner = readJson(OWNER);
  const { filePlans, referencePlans } = flattenPlan(plan);

  validateInputs(plan, preview, owner, filePlans, referencePlans);

  const sourceFiles = unique(filePlans.map((item) => item.source_file));
  const destinationFiles = unique(filePlans.map((item) => item.planned_destination));
  const affectedReferencingFiles = unique(referencePlans.map((item) => item.referencing_file));

  if (sourceFiles.length !== 48) throw new Error(`UNEXPECTED_UNIQUE_SOURCE_COUNT:${sourceFiles.length}`);
  if (destinationFiles.length !== 48) throw new Error(`UNEXPECTED_UNIQUE_DESTINATION_COUNT:${destinationFiles.length}`);

  const updateResult = applyReferenceUpdates(referencePlans);
  const moveResults = moveFiles(filePlans);
  const audit = auditAfter(filePlans, referencePlans);

  const output = {
    generated_at: new Date().toISOString(),
    report: 'POST_P8_18_HISTORICAL_TASK_DOC_APPLY_BUNDLE_REPORT',
    selected_group: SELECTED_GROUP,
    input_plan_report: PLAN,
    input_preview_report: PREVIEW,
    input_owner_report: OWNER,
    output_report: OUTPUT,
    moved_file_count: moveResults.length,
    source_file_count: sourceFiles.length,
    destination_file_count: destinationFiles.length,
    affected_referencing_file_count: affectedReferencingFiles.length,
    reference_update_plan_item_count: referencePlans.length,
    replacement_count: updateResult.replacementCount,
    expected_replacement_count: 585,
    old_exact_reference_count_after: audit.oldExactReferenceCountAfter,
    new_exact_reference_count_after: audit.newExactReferenceCountAfter,
    missing_destination_file_count: audit.missing_destination_file_count,
    remaining_source_file_count: audit.remaining_source_file_count,
    broken_reference_count: audit.broken_reference_count,
    runtime_surface_diff_count: audit.runtime_surface_diff_count,
    changed_file_count: audit.changed_file_count,
    runtime_surface_files: audit.runtime_surface_files,
    missing_destinations: audit.missing_destinations,
    remaining_sources: audit.remaining_sources,
    apply_allowed: true,
    applied: true,
    move_results: moveResults,
    reference_update_results: updateResult.results,
    next_step: 'POST_P8_19_HISTORICAL_TASK_DOC_APPLY_BUNDLE_FINAL_TAG',
  };

  writeJson(OUTPUT, output);

  console.log(JSON.stringify({
    ok: true,
    output_report: OUTPUT,
    selected_group: output.selected_group,
    moved_file_count: output.moved_file_count,
    reference_update_plan_item_count: output.reference_update_plan_item_count,
    replacement_count: output.replacement_count,
    old_exact_reference_count_after: output.old_exact_reference_count_after,
    new_exact_reference_count_after: output.new_exact_reference_count_after,
    missing_destination_file_count: output.missing_destination_file_count,
    remaining_source_file_count: output.remaining_source_file_count,
    broken_reference_count: output.broken_reference_count,
    runtime_surface_diff_count: output.runtime_surface_diff_count,
    next_step: output.next_step,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
