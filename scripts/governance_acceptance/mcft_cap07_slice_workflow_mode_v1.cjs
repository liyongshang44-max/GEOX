#!/usr/bin/env node
// Purpose: classify CAP-07 predecessor workflows into exact-candidate or successor-regression mode.
// Boundary: governance-only PR declaration parsing; no repository mutation or capability authority change.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const EXACT_CANDIDATE_MODE = 'EXACT_CANDIDATE_MODE';
const SUCCESSOR_REGRESSION_MODE = 'SUCCESSOR_REGRESSION_MODE';
const HTML_DECLARATION_PATTERN = /<!--\s*MCFT_CANDIDATE_DECLARATION_V2\s*([\s\S]*?)-->/g;
const FENCED_DECLARATION_PATTERN = /```(?:text)?\s*\r?\nMCFT_CANDIDATE_DECLARATION_V2\s*\r?\n([\s\S]*?)```/g;

function declarationBlocks(body) {
  const text = String(body || '');
  return [
    ...[...text.matchAll(HTML_DECLARATION_PATTERN)].map((match) => match[1]),
    ...[...text.matchAll(FENCED_DECLARATION_PATTERN)].map((match) => match[1]),
  ];
}

function parseDeclaration(body) {
  const text = String(body || '');
  const markerPresent = text.includes('MCFT_CANDIDATE_DECLARATION_V2');
  const blocks = declarationBlocks(text);
  if (!markerPresent && blocks.length === 0) return null;
  if (blocks.length !== 1) throw new Error('MCFT_CAP07_DECLARATION_COUNT_INVALID');

  const fields = Object.create(null);
  for (const rawLine of blocks[0].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) throw new Error(`MCFT_CAP07_DECLARATION_LINE_INVALID:${line}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key || !value) throw new Error(`MCFT_CAP07_DECLARATION_FIELD_INVALID:${key || 'EMPTY'}`);
    if (Object.hasOwn(fields, key)) throw new Error(`MCFT_CAP07_DECLARATION_FIELD_DUPLICATE:${key}`);
    fields[key] = value;
  }

  if (!fields.capability_line || !fields.slice_id) throw new Error('MCFT_CAP07_DECLARATION_IDENTITY_MISSING');
  return fields;
}

function classify({ eventName, body, targetSlice }) {
  if (!/^MCFT-CAP-07\.S[0-6]$/.test(String(targetSlice || ''))) {
    throw new Error(`MCFT_CAP07_TARGET_SLICE_INVALID:${targetSlice || 'EMPTY'}`);
  }
  if (String(eventName || '') !== 'pull_request') {
    return { mode: SUCCESSOR_REGRESSION_MODE, declaredSlice: null };
  }

  const declaration = parseDeclaration(body);
  if (!declaration) return { mode: SUCCESSOR_REGRESSION_MODE, declaredSlice: null };
  const exact = declaration.capability_line === 'MCFT-CAP-07' && declaration.slice_id === targetSlice;
  return {
    mode: exact ? EXACT_CANDIDATE_MODE : SUCCESSOR_REGRESSION_MODE,
    declaredSlice: declaration.slice_id,
  };
}

function selfTest() {
  const html = (slice) => `<!-- MCFT_CANDIDATE_DECLARATION_V2\ncapability_line=MCFT-CAP-07\nslice_id=${slice}\n-->`;
  const fenced = (slice) => `\`\`\`text\nMCFT_CANDIDATE_DECLARATION_V2\ncapability_line=MCFT-CAP-07\nslice_id=${slice}\n\`\`\``;
  assert.equal(classify({ eventName: 'pull_request', body: html('MCFT-CAP-07.S0'), targetSlice: 'MCFT-CAP-07.S0' }).mode, EXACT_CANDIDATE_MODE);
  assert.equal(classify({ eventName: 'pull_request', body: html('MCFT-CAP-07.S1'), targetSlice: 'MCFT-CAP-07.S1' }).mode, EXACT_CANDIDATE_MODE);
  assert.equal(classify({ eventName: 'pull_request', body: fenced('MCFT-CAP-07.S3'), targetSlice: 'MCFT-CAP-07.S3' }).mode, EXACT_CANDIDATE_MODE);
  assert.equal(classify({ eventName: 'pull_request', body: fenced('MCFT-CAP-07.S4'), targetSlice: 'MCFT-CAP-07.S3' }).mode, SUCCESSOR_REGRESSION_MODE);
  assert.equal(classify({ eventName: 'pull_request', body: html('MCFT-CAP-07.S6'), targetSlice: 'MCFT-CAP-07.S0' }).mode, SUCCESSOR_REGRESSION_MODE);
  assert.equal(classify({ eventName: 'pull_request', body: '', targetSlice: 'MCFT-CAP-07.S3' }).mode, SUCCESSOR_REGRESSION_MODE);
  assert.equal(classify({ eventName: 'merge_group', body: html('MCFT-CAP-07.S3'), targetSlice: 'MCFT-CAP-07.S3' }).mode, SUCCESSOR_REGRESSION_MODE);
  assert.throws(() => parseDeclaration('MCFT_CANDIDATE_DECLARATION_V2'), /DECLARATION_COUNT_INVALID/);
  assert.throws(() => parseDeclaration('<!-- MCFT_CANDIDATE_DECLARATION_V2\ncapability_line=MCFT-CAP-07\nslice_id=MCFT-CAP-07.S0\nslice_id=MCFT-CAP-07.S1\n-->'), /FIELD_DUPLICATE:slice_id/);
  assert.throws(() => parseDeclaration(`${html('MCFT-CAP-07.S0')}\n${fenced('MCFT-CAP-07.S1')}`), /DECLARATION_COUNT_INVALID/);
  console.log('MCFT-CAP-07 slice workflow classifier: PASS');
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  const targetSlice = readArg('--target');
  const result = classify({
    eventName: process.env.MCFT_EVENT_NAME,
    body: process.env.MCFT_PR_BODY,
    targetSlice,
  });
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    fs.appendFileSync(output, `mode=${result.mode}\n`, 'utf8');
    fs.appendFileSync(output, `declared_slice=${result.declaredSlice || ''}\n`, 'utf8');
  }
  console.log(JSON.stringify({ target_slice: targetSlice, execution_mode: result.mode, declared_slice: result.declaredSlice }));
}
