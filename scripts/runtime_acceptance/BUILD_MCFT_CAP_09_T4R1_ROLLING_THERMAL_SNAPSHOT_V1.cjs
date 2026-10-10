#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const BASE_CONFIG = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-THERMAL-BIOLOGICAL-STAGE-AUTHORITY-V1.json";

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}
function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}
function partsAt(ms, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const values = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}
function localDateAt(ms, timeZone) {
  const p = partsAt(ms, timeZone);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
function previousLocalDate(localDate) {
  const [year, month, day] = localDate.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function localMidnightUtc(localDate, timeZone) {
  const [year, month, day] = localDate.split("-").map(Number);
  const targetWall = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = targetWall;
  for (let i = 0; i < 6; i += 1) {
    const p = partsAt(guess, timeZone);
    const representedWall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const offset = representedWall - guess;
    const next = targetWall - offset;
    if (next === guess) break;
    guess = next;
  }
  const p = partsAt(guess, timeZone);
  if (p.year !== year || p.month !== month || p.day !== day || p.hour !== 0 || p.minute !== 0 || p.second !== 0) {
    fail("ROLLING_THERMAL_LOCAL_MIDNIGHT_RESOLUTION_FAILED", `${localDate}:${new Date(guess).toISOString()}`);
  }
  return new Date(guess).toISOString();
}

const nowText = String(arg("--now") ?? new Date().toISOString()).trim();
const nowMs = Date.parse(nowText);
if (!Number.isFinite(nowMs) || new Date(nowMs).toISOString() !== nowText) fail("ROLLING_THERMAL_NOW_INVALID", nowText);
const outPath = String(arg("--out") ?? "").trim();
if (!outPath) fail("ROLLING_THERMAL_OUT_REQUIRED");

const baseBytes = fs.readFileSync(BASE_CONFIG);
const base = JSON.parse(baseBytes.toString("utf8"));
if (base.schema_version !== "geox_mcft_cap09_t4r1_thermal_biological_stage_authority_v1") fail("ROLLING_THERMAL_BASE_SCHEMA_INVALID");
if (base.data_use_policy?.scheduler_write_authorized !== false) fail("ROLLING_THERMAL_SCHEDULER_WRITE_MUST_REMAIN_FALSE");
if (base.data_use_policy?.runtime_config_write_authorized !== false) fail("ROLLING_THERMAL_RUNTIME_WRITE_MUST_REMAIN_FALSE");
if (base.qualification_snapshot?.future_observations_authorized !== false) fail("ROLLING_THERMAL_FUTURE_OBSERVATIONS_FORBIDDEN");

const timeZone = String(base.planting_authority?.timezone ?? "").trim();
if (timeZone !== "America/Detroit") fail("ROLLING_THERMAL_TIMEZONE_DRIFT", timeZone);
const currentLocalDate = localDateAt(nowMs, timeZone);
const lastCompleteLocalDate = previousLocalDate(currentLocalDate);
const boundaryIso = localMidnightUtc(currentLocalDate, timeZone);
const boundaryMs = Date.parse(boundaryIso);
if (boundaryMs > nowMs) fail("ROLLING_THERMAL_BOUNDARY_IN_FUTURE");
if (nowMs - boundaryMs >= 24 * 60 * 60 * 1000) fail("ROLLING_THERMAL_BOUNDARY_AGE_INVALID");

const overlay = JSON.parse(JSON.stringify(base));
overlay.qualification_snapshot = {
  ...base.qualification_snapshot,
  as_of_logical_time: boundaryIso,
  last_complete_temperature_local_date: lastCompleteLocalDate,
  future_observations_authorized: false,
  full_season_ex_post_normalization_authorized: false,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");

process.stdout.write(`${JSON.stringify({
  schema_version: "geox_mcft_cap09_t4r1_rolling_thermal_snapshot_overlay_v1",
  status: "PASS",
  base_config_path: BASE_CONFIG,
  base_config_sha256: sha256(baseBytes),
  time_zone: timeZone,
  evaluated_at: nowText,
  current_local_date: currentLocalDate,
  last_complete_temperature_local_date: lastCompleteLocalDate,
  as_of_logical_time: boundaryIso,
  future_observations_authorized: false,
  scheduler_write_authorized: false,
  runtime_config_write_authorized: false,
  production_effect: false,
}, null, 2)}\n`);
