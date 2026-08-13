#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const MIN_TARGET_LEAD_MINUTES = 35;
const CANDIDATE_RETENTION_HOURS = 36;

function canonicalHour(ms) {
  return new Date(Math.ceil(ms / HOUR_MS) * HOUR_MS).toISOString();
}

function keyForTarget(target) {
  return target.replace(/[-:.]/g, "").replace("000Z", "Z").toLowerCase();
}

function plan(nowText) {
  const nowMs = Date.parse(nowText);
  if (!Number.isFinite(nowMs) || new Date(nowMs).toISOString() !== nowText) {
    throw new Error("MCFT_CAP09_ROLLING_PREBOUNDARY_NOW_INVALID");
  }
  const target = canonicalHour(nowMs + MIN_TARGET_LEAD_MINUTES * MINUTE_MS);
  const targetMs = Date.parse(target);
  const leadMinutes = (targetMs - nowMs) / MINUTE_MS;
  if (leadMinutes < MIN_TARGET_LEAD_MINUTES || leadMinutes > MIN_TARGET_LEAD_MINUTES + 60) {
    throw new Error("MCFT_CAP09_ROLLING_PREBOUNDARY_LEAD_OUT_OF_RANGE");
  }
  return {
    schema_version: "geox_mcft_cap09_rolling_preboundary_target_plan_v1",
    status: "PASS",
    planned_at: nowText,
    target_t: target,
    target_key: keyForTarget(target),
    target_lead_minutes: leadMinutes,
    pre_boundary_operational_target: new Date(targetMs - 30 * MINUTE_MS).toISOString(),
    soil_window_start: new Date(targetMs - 15 * MINUTE_MS).toISOString(),
    evidence_deadline: target,
    candidate_retention_hours: CANDIDATE_RETENTION_HOURS,
    candidate_expires_at: new Date(targetMs + CANDIDATE_RETENTION_HOURS * HOUR_MS).toISOString(),
    provider_publication_dependency: "NONE",
    kbs_raw_hourly_dependency: "NONE",
    crop_authority_dependency: "NONE",
    temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
    formal_effect: false
  };
}

function selftest() {
  const cases = [
    ["2026-08-13T11:05:00.000Z", "2026-08-13T12:00:00.000Z"],
    ["2026-08-13T11:20:00.000Z", "2026-08-13T12:00:00.000Z"],
    ["2026-08-13T11:26:00.000Z", "2026-08-13T13:00:00.000Z"],
    ["2026-08-13T23:50:00.000Z", "2026-08-14T01:00:00.000Z"]
  ];
  for (const [now, expected] of cases) {
    const actual = plan(now);
    if (actual.target_t !== expected) throw new Error(`MCFT_CAP09_ROLLING_PREBOUNDARY_SELFTEST_TARGET:${now}:${actual.target_t}:${expected}`);
    if (actual.provider_publication_dependency !== "NONE" || actual.crop_authority_dependency !== "NONE") {
      throw new Error("MCFT_CAP09_ROLLING_PREBOUNDARY_SELFTEST_INDEPENDENCE");
    }
  }
  console.log(JSON.stringify({
    schema_version: "geox_mcft_cap09_rolling_preboundary_target_planner_selftest_v1",
    status: "PASS",
    case_count: cases.length,
    minimum_target_lead_minutes: MIN_TARGET_LEAD_MINUTES,
    candidate_retention_hours: CANDIDATE_RETENTION_HOURS,
    kbs_dependency: false,
    crop_dependency: false,
    formal_effect: false
  }));
}

const mode = process.argv[2] || "plan";
if (mode === "selftest") {
  selftest();
  process.exit(0);
}
if (mode !== "plan") throw new Error("MCFT_CAP09_ROLLING_PREBOUNDARY_PLANNER_MODE_INVALID");

const now = process.env.MCFT_CAP09_PLANNER_NOW || new Date().toISOString();
const result = plan(now);
fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync("acceptance-output/MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.json", JSON.stringify(result, null, 2) + "\n");
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `target_t=${result.target_t}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `target_key=${result.target_key}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `candidate_expires_at=${result.candidate_expires_at}\n`);
}
console.log(JSON.stringify(result));
