#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { evaluateTargetCropConsensus } = require("./PREFLIGHT_MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS.cjs");

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`MCFT_CAP09_ROLLING_CROP_ARG_REQUIRED:${name}`);
  return process.argv[index + 1];
}

function walk(root) {
  const found = [];
  if (!fs.existsSync(root)) return found;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.isFile() && entry.name === "MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json") found.push(full);
  }
  return found.sort();
}

function build(root) {
  const byTarget = new Map();
  const rejected = [];
  for (const file of walk(root)) {
    let candidate;
    try { candidate = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (error) {
      rejected.push({ candidate_file: file, target_t: null, reason: "CANDIDATE_JSON_INVALID" });
      continue;
    }
    const target = String(candidate?.target_t ?? "");
    if (candidate?.status !== "PASS" || candidate?.temporal_authority !== "PROVIDER_AVAILABILITY_WATERMARK_V1") {
      rejected.push({ candidate_file: file, target_t: target || null, reason: "CANDIDATE_AUTHORITY_BOUNDARY_INVALID" });
      continue;
    }
    try {
      const crop = evaluateTargetCropConsensus(target);
      const current = byTarget.get(target);
      if (!current) {
        byTarget.set(target, {
          target_t: target,
          crop_stage_code: crop.crop_stage_code,
          crop_consensus_status: crop.status,
          candidate_file_count: 1,
        });
      } else {
        current.candidate_file_count += 1;
      }
    } catch (error) {
      rejected.push({
        candidate_file: file,
        target_t: target || null,
        reason: String(error?.message ?? error),
      });
    }
  }
  const legal = [...byTarget.values()].sort((a, b) => Date.parse(a.target_t) - Date.parse(b.target_t));
  return {
    schema_version: "geox_mcft_cap09_rolling_crop_legality_v1",
    status: "PASS",
    selection_role: "PRE_KBS_CROP_AUTHORITY_INTERSECTION",
    temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
    crop_authority_effect: "NONE",
    future_observations_used: false,
    provider_request_count: 0,
    database_write_count: 0,
    legal_target_count: legal.length,
    legal_targets: legal,
    rejected_candidate_count: rejected.length,
    rejected_candidates: rejected,
  };
}

function selftest() {
  const targets = ["2026-08-23T07:00:00.000Z", "2026-08-23T08:00:00.000Z"];
  const results = targets.map((target) => evaluateTargetCropConsensus(target));
  if (results.some((item) => item.status !== "PASS" || item.crop_stage_code !== "MID" || item.crop_authority_effect !== "NONE")) {
    throw new Error("MCFT_CAP09_ROLLING_CROP_SELFTEST_CURRENT_T4R1_MID_REQUIRED");
  }
  console.log(JSON.stringify({
    status: "PASS",
    current_t4r1_mid_targets_proven: targets.length,
    crop_authority_effect: "NONE",
    provider_request_count: 0,
    database_write_count: 0,
  }));
}

if (process.argv[2] === "selftest") {
  selftest();
} else {
  const root = arg("--candidate-root");
  const output = arg("--output");
  const result = build(root);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
}
