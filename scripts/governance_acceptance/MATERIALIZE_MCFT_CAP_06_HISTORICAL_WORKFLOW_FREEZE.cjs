#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const WORKFLOWS = [
  '.github/workflows/mcft-cap-06-s3-focused-validation.yml',
  '.github/workflows/mcft-cap-06-s3-effectiveness-s4-insertion.yml',
  '.github/workflows/mcft-cap-06-s4-focused-validation.yml',
  '.github/workflows/mcft-cap-06-s4-effectiveness-s5-authorization.yml',
  '.github/workflows/mcft-cap-06-s5-entry-controls.yml',
  '.github/workflows/mcft-cap-06-s5-predecessor-graph-conformance.yml',
  '.github/workflows/mcft-cap-06-s5-candidate.yml',
  '.github/workflows/mcft-cap-06-s5-candidate-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s6-paired-shadow.yml',
  '.github/workflows/mcft-cap-06-s6-paired-shadow-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s7-shadow-evaluation.yml',
  '.github/workflows/mcft-cap-06-s7-shadow-evaluation-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s8-restart-readback-rebuild.yml',
  '.github/workflows/mcft-cap-06-s8-restart-readback-rebuild-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s9-non-consumption.yml',
  '.github/workflows/mcft-cap-06-s9-non-consumption-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s10-bounded-chain.yml',
  '.github/workflows/mcft-cap-06-s10-bounded-chain-effectiveness.yml',
  '.github/workflows/mcft-cap-06-taskbook-v0-4-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s11a-closure-candidate.yml',
  '.github/workflows/mcft-cap-06-s11c-capability-completion-effectiveness-activation.yml',
  '.github/workflows/mcft-cap-06-s11d-final-effectiveness-reconciliation.yml',
];

function freeze(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolute)) throw new Error(`HISTORICAL_WORKFLOW_MISSING:${relativePath}`);
  let source = fs.readFileSync(absolute, 'utf8');
  const onMatch = /^on:\s*$/m.exec(source);
  if (!onMatch) throw new Error(`WORKFLOW_ON_BLOCK_MISSING:${relativePath}`);
  const start = onMatch.index;
  const tail = source.slice(start + onMatch[0].length);
  const nextMatch = /\n(?=(?:permissions|concurrency|env|jobs):\s*(?:\n|$))/m.exec(tail);
  if (!nextMatch) throw new Error(`WORKFLOW_NEXT_TOP_LEVEL_BLOCK_MISSING:${relativePath}`);
  const end = start + onMatch[0].length + nextMatch.index + 1;
  source = `${source.slice(0, start)}on:\n  workflow_dispatch:\n\n${source.slice(end)}`;
  if (!source.includes('# Historical MCFT-CAP-06 workflow: automatic triggers frozen after final repair.')) {
    source = source.replace(/^(name:[^\n]*\n)/, '$1# Historical MCFT-CAP-06 workflow: automatic triggers frozen after final repair.\n');
  }
  fs.writeFileSync(absolute, source, 'utf8');
}

try {
  for (const workflow of WORKFLOWS) freeze(workflow);
  process.stdout.write(`${JSON.stringify({ status: 'PASS', frozen_workflow_count: WORKFLOWS.length, workflows: WORKFLOWS }, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
