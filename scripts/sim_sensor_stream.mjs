#!/usr/bin/env node
/**
 * GEOX sensor stream simulator (one script per sensor)
 *
 * Goal:
 * - Simulate a *real* device integration by streaming 1-minute samples into Postgres.
 * - Each emitted sample is append-only and carries coarse `quality`: ok | suspect | bad
 * - QC "reasons/types" (RANGE/SPIKE/...) stay as metadata (qc.*), not new quality enums.
 *
 * Forward-fill semantics:
 * - Hourly historical values are expanded to 1-minute cadence
 * - Each minute uses the most recent hourly value (sample-and-hold)
 * - No interpolation, no future look-ahead
 *
 * Missing-value semantics:
 * - If the hourly value is NA, we DO NOT write an NA raw_sample.
 * - If we have a previous good value for that metric, we carry it forward into raw_samples
 *   but mark the minute as missing-origin => quality becomes "bad".
 * - We also write a marker_v1 fact + markers row for that minute to record "value missing at source".
 * - If there is no previous good value yet, we only write the marker (no raw_sample).
 *
 * Time semantics:
 * - Historical timestamps are used ONLY to read values / QC
 * - Written samples use CURRENT local time (minute-aligned) when running normally
 * - If --once is provided, we backfill one window (minute cadence) ending at "now"
 *
 * Route A import mode:
 * - If --import-file (or --file) is provided, we import the TSV file as-is
 *   (use file timestamps, no map-to-now), and write facts/raw_samples (+ optional markers).
 * - Evidence is preserved by embedding the original input line as `source_line_text`.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { Pool } from "pg";

/* -------------------- utils -------------------- */

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v == null ? fallback : v;
}

function hasFlag(name) { return process.argv.includes(name); }

function argCsv(name, fallback = "") {
  // Parse a comma-separated list argument.
  // Example: --locations CAF009,CAF010
  const raw = arg(name, fallback);
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function argBool(name, fallback = false) {
  const v = arg(name, null);
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes" || s === "y") return true;
  if (s === "0" || s === "false" || s === "no" || s === "n") return false;
  return fallback;
}

function readJsonMaybe(fp) {
  try {
    if (!fp) return null;
    if (!fs.existsSync(fp)) return null;
    const txt = fs.readFileSync(fp, "utf8");
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function readRepoDefaultSimConfig() {
  // Repo-root relative: config/sim/default.json
  // (The script may run from repo root; we resolve via script dir for stability.)
  const here = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.resolve(here, "..");
  const fp = path.join(repoRoot, "config", "sim", "default.json");
  return readJsonMaybe(fp);
}

function readConfigFromArgs() {
  const fp = arg("--config", null);
  if (fp) {
    const cfg = readJsonMaybe(fp);
    if (!cfg) die(`Cannot read --config JSON: ${fp}`);
    return cfg;
  }
  const b64 = arg("--config-b64", null);
  if (b64) {
    try {
      const txt = Buffer.from(String(b64), "base64").toString("utf8");
      return JSON.parse(txt);
    } catch {
      die("Cannot parse --config-b64 as base64(JSON)");
    }
  }
  return null;
}

function die(msg) { console.error(msg); process.exit(1); }
function sha1(s) { return crypto.createHash("sha1").update(s).digest("hex"); }
function iso(tsMs) { return new Date(tsMs).toISOString().replace(".000Z", "Z"); }
function minuteAlign(tsMs) { return Math.floor(tsMs / 60000) * 60000; }

function numOrNa(v) {
  const s = String(v ?? "").trim();
  if (!s || s.toUpperCase() === "NA") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/* -------------------- parsing -------------------- */

function parseHourlyTsv(text) {
  const lines = text.split(/\r?\n/);
  const nonEmpty = lines.filter((l) => String(l ?? "").trim().length > 0);
  if (nonEmpty.length < 2) return [];
  const header = nonEmpty[0].split("\t").map((s) => s.trim());
  if (lines.length < 2) return [];
  const out = [];
  for (let i = 1; i < nonEmpty.length; i++) {
    const lineText = nonEmpty[i];
    const cols = lineText.split("\t");
    if (cols.length < 2) continue;
    const row = {};
    for (let j = 0; j < header.length && j < cols.length; j++) {
      row[header[j]] = cols[j].trim();
    }
    const dt = `${row["Date"]} ${row["Time"]}`;
    // MM/DD/YYYY -> YYYY-MM-DD
    const t = Date.parse(dt.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, "$3-$1-$2"));
    if (!Number.isFinite(t)) continue;
    row.__ts = t;
    row.__line_no = i + 1; // 1-based in file
    row.__line_text = lineText;
    out.push(row);
  }
  out.sort((a, b) => a.__ts - b.__ts);
  return out;
}

function metricMap(col) {
  const m = String(col);
  const vw = m.match(/^VW_(\d+)cm$/i);
  if (vw) return `soil_moisture_vwc_${vw[1]}cm`;
  const tt = m.match(/^T_(\d+)cm$/i);
  if (tt) return `soil_temp_c_${tt[1]}cm`;
  return null;
}

/* -------------------- import (Route A) -------------------- */

async function importFileRouteA({
  file,
  projectId,
  groupId,
  locationOverride,
  writeRawSamples,
  writeMarkers,
  source,
  dryRun,
}) {
  if (!file) die("Missing --import-file/--file");
  if (!fs.existsSync(file)) die(`Import file not found: ${file}`);

  const txt = fs.readFileSync(file, "utf8");
  const lines = txt.split(/\r?\n/);
  const nonEmpty = lines.filter((l) => String(l ?? "").trim().length > 0);
  if (nonEmpty.length < 2) die(`Import file has no data rows: ${file}`);

  const header = nonEmpty[0].split("\t").map((s) => s.trim());
  const idx = (name) => header.indexOf(name);
  const iDate = idx("Date");
  const iTime = idx("Time");
  const iLoc = idx("Location");
  if (iDate < 0 || iTime < 0) die("Import file header must contain Date and Time columns");

  const metricCols = header.filter((c) => metricMap(c));
  if (!metricCols.length) die("Import file has no metric columns (VW_*cm or T_*cm)");

  // NOTE: pool is created once near the top of main (shared by stream/import modes).

  async function insertFact(factId, occurredAtMs, src, recordObj) {
    const sql = `
      INSERT INTO facts (fact_id, occurred_at, source, record_json)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (fact_id) DO NOTHING
    `;
    const occurredAtIso = iso(occurredAtMs);
    const recordText = JSON.stringify(recordObj);
    if (dryRun) return;
    await pool.query(sql, [factId, occurredAtIso, src, recordText]);
  }

  async function insertRawSample(row) {
    const sql = `
      INSERT INTO raw_samples (fact_id, sensor_id, metric, ts_ms, occurred_at, value, quality)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (fact_id) DO NOTHING
    `;
    if (dryRun) return;
    await pool.query(sql, [row.fact_id, row.sensor_id, row.metric, row.ts_ms, iso(row.occurred_at_ms), row.value, row.quality]);
  }

  async function insertMarker(row) {
    const sql = `
      INSERT INTO markers (fact_id, sensor_id, metric, ts_ms, start_ts_ms, end_ts_ms, kind, source, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (fact_id) DO NOTHING
    `;
    if (dryRun) return;
    await pool.query(sql, [row.fact_id, row.sensor_id, row.metric, row.ts_ms, row.start_ts_ms, row.end_ts_ms, row.kind, row.source, row.note ?? null]);
  }

  const src = source || "import";

  for (let li = 1; li < nonEmpty.length; li++) {
    const line = nonEmpty[li];
    const cols = line.split("\t");
    const row = {};
    for (let j = 0; j < header.length && j < cols.length; j++) row[header[j]] = cols[j].trim();

    const loc = locationOverride || (iLoc >= 0 ? (row["Location"] || "").trim() : "");
    if (!loc) continue;

    const dt = `${row["Date"]} ${row["Time"]}`;
    const t = Date.parse(dt.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, "$3-$1-$2"));
    if (!Number.isFinite(t)) continue;
    const tsMs = minuteAlign(t);

    for (const col of metricCols) {
      const metric = metricMap(col);
      if (!metric) continue;

      const raw = row[col];
      const v = numOrNa(raw);

      if (!Number.isFinite(v)) {
        if (!writeMarkers) continue;
        const mkId = `mk_${sha1(`${projectId}|${groupId}|${loc}|${metric}|${tsMs}|MISSING_VALUE`)}`;
        const mkFact = {
          type: "marker_v1",
          schema_version: 1,
          occurred_at: iso(tsMs),
          entity: { project_id: projectId, group_id: groupId, sensor_id: loc },
          payload: {
            sensorId: loc,
            metric,
            ts_ms: tsMs,
            kind: "MISSING_VALUE",
            source: src,
            note: "NA in source line",
            source_file: path.basename(file),
            source_line_no: li + 1,
            source_line_text: line,
          },
        };
        if (!dryRun) {
          await insertFact(mkId, tsMs, src, mkFact);
          await insertMarker({
            fact_id: mkId,
            sensor_id: loc,
            metric,
            ts_ms: tsMs,
            start_ts_ms: tsMs,
            end_ts_ms: tsMs,
            kind: "MISSING_VALUE",
            source: src,
            note: "NA in source line",
          });
        }
        continue;
      }

      const factId = `raw_${sha1(`${projectId}|${groupId}|${loc}|${metric}|${tsMs}`)}`;
      const fact = {
        type: "raw_sample_v1",
        schema_version: 1,
        occurred_at: iso(tsMs),
        entity: { project_id: projectId, group_id: groupId, sensor_id: loc },
        payload: {
          sensorId: loc,
          metric,
          ts_ms: tsMs,
          value: v,
          quality: "ok",
          source: src,
          source_file: path.basename(file),
          source_line_no: li + 1,
          source_line_text: line,
        },
      };

      if (!dryRun) {
        await insertFact(factId, tsMs, src, fact);
        if (writeRawSamples) {
          await insertRawSample({
            fact_id: factId,
            sensor_id: loc,
            metric,
            ts_ms: tsMs,
            occurred_at_ms: tsMs,
            value: v,
            quality: "ok",
          });
        }
      }
    }
  }

  if (pool) await pool.end();
}

/* -------------------- QC -------------------- */

function listQcFiles(datasetDir) {
  const dir = path.join(datasetDir, "QC", "Flags");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".txt")).map((f) => path.join(dir, f));
}

function buildQcIndex(datasetDir) {
  const dayMap = new Map();
  const pointMap = new Map();

  for (const fp of listQcFiles(datasetDir)) {
    const base = path.basename(fp);
    const isRange = base.startsWith("range");
    const isSpikes = base.startsWith("spikes");
    if (!isRange && !isSpikes) continue;

    const txt = fs.readFileSync(fp, "utf8");
    const lines = txt.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) continue;

    const header = lines[0].replaceAll('"', "").split(/\t/).map((s) => s.trim());
    const colMetric = header.find((h) => /^VW_\d+cm$/i.test(h) || /^T_\d+cm$/i.test(h));
    if (!colMetric) continue;
    const metric = metricMap(colMetric);
    if (!metric) continue;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].replaceAll('"', "").split(/\t/);
      const row = {};
      for (let j = 0; j < header.length && j < cols.length; j++) row[header[j]] = cols[j].trim();

      const loc = row["Location"];
      const date = row["Date"];
      if (!loc || !date) continue;

      const flag = row[colMetric] || "";
      const ymd = date.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, "$3-$1-$2");

      if (isRange) {
        dayMap.set(`${loc}|${metric}|${ymd}`, flag || "C");
      } else {
        const time = row["Time"] || "0:00";
        const ts = Date.parse(`${ymd} ${time}`);
        if (!Number.isFinite(ts)) continue;
        const hourTs = Math.floor(ts / 3600000) * 3600000;
        pointMap.set(`${loc}|${metric}|${hourTs}`, flag || "D");
      }
    }
  }

  return { dayMap, pointMap };
}

function qcForTs(qc, loc, metric, tsMs) {
  const ymd = new Date(tsMs).toISOString().slice(0, 10);
  const dayKey = `${loc}|${metric}|${ymd}`;
  const hourKey = `${loc}|${metric}|${Math.floor(tsMs / 3600000) * 3600000}`;

  const pointFlag = qc.pointMap.get(hourKey) || null;
  if (pointFlag) return { qc_flag: "SPIKE", qc_scope: "POINT", qc_source: "IMPORT", qc_code: pointFlag, quality: "suspect" };

  const dayFlag = qc.dayMap.get(dayKey) || null;
  if (dayFlag) return { qc_flag: "RANGE", qc_scope: "RANGE", qc_source: "IMPORT", qc_code: dayFlag, quality: "suspect" };

  return null;
}

/* -------------------- forward fill -------------------- */

function forwardFillMinute(rows, metricCol, minuteTs) {
  let last = null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].__ts <= minuteTs) last = rows[i];
    else break;
  }
  if (!last) return { value: NaN, missing: true };
  const v = numOrNa(last[metricCol]);
  if (!Number.isFinite(v)) return { value: NaN, missing: true };
  return { value: v, missing: false };
}


// Find a usable numeric value at/before a timestamp (look-back in the parsed hourly rows).
// Used to "seed" lastGood when we start in an NA region so realtime can still emit samples.
function findLastFiniteBefore(rows, metricCol, tsMs) {
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.__ts > tsMs) continue;
    const v = numOrNa(r[metricCol]);
    if (Number.isFinite(v)) return v;
  }
  return NaN;
}

/* -------------------- import (Route A) -------------------- */

async function importTsvToDb({
  filePath,
  projectId,
  groupId,
  pool,
  dryRun,
  writeRawSamples,
  writeMarkers,
  source,
}) {
  if (!fs.existsSync(filePath)) die(`import file not found: ${filePath}`);
  const txt = fs.readFileSync(filePath, "utf8");
  const rows = parseHourlyTsv(txt);
  if (!rows.length) die(`import parsed 0 rows: ${filePath}`);

  const cols = Object.keys(rows[0]).filter((k) => !k.startsWith("__") && k !== "Date" && k !== "Time");
  const metricCols = cols.filter((c) => metricMap(c));
  if (!metricCols.length) die(`import: no metric columns matched: ${filePath}`);

  const insertFact = async (factId, occurredAtMs, recordObj) => {
    const sql = `
      INSERT INTO facts (fact_id, occurred_at, source, record_json)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (fact_id) DO NOTHING
    `;
    const occurredAtIso = iso(occurredAtMs);
    const recordText = JSON.stringify(recordObj);
    if (dryRun) {
      console.log("[dry-run] facts", factId, recordObj.type, occurredAtIso);
      return;
    }
    await pool.query(sql, [factId, occurredAtIso, source, recordText]);
  };

  const insertRawSample = async (row) => {
    const sql = `
      INSERT INTO raw_samples (fact_id, sensor_id, metric, ts_ms, occurred_at, value, quality)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (fact_id) DO NOTHING
    `;
    if (dryRun) return;
    await pool.query(sql, [
      row.fact_id,
      row.sensor_id,
      row.metric,
      row.ts_ms,
      iso(row.occurred_at_ms),
      row.value,
      row.quality,
    ]);
  };

  const insertMarker = async (row) => {
    const sql = `
      INSERT INTO markers (fact_id, sensor_id, metric, ts_ms, start_ts_ms, end_ts_ms, kind, source, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (fact_id) DO NOTHING
    `;
    if (dryRun) return;
    await pool.query(sql, [
      row.fact_id,
      row.sensor_id,
      row.metric,
      row.ts_ms,
      row.start_ts_ms,
      row.end_ts_ms,
      row.kind,
      source,
      row.note ?? null,
    ]);
  };

  const sourceFile = path.basename(filePath);

  for (const r of rows) {
    const sensorId = r["Location"] || r["location"] || r["LOC"] || r["Loc"];
    if (!sensorId) continue;

    const tsMs = r.__ts;
    for (const col of metricCols) {
      const metric = metricMap(col);
      if (!metric) continue;

      const raw = r[col];
      const v = numOrNa(raw);

      if (!Number.isFinite(v)) {
        if (!writeMarkers) continue;
        const markerFactId = `mk_${sha1(`${projectId}|${groupId}|${sensorId}|${metric}|${tsMs}|MISSING_VALUE`)}`;
        const markerFact = {
          type: "marker_v1",
          schema_version: 1,
          occurred_at: iso(tsMs),
          entity: { project_id: projectId, group_id: groupId, sensor_id: sensorId },
          payload: {
            sensorId,
            metric,
            ts_ms: tsMs,
            kind: "MISSING_VALUE",
            source,
            note: "value missing at source (NA)",
            source_file: sourceFile,
            source_line_no: r.__line_no,
            source_line_text: r.__line_text,
          },
        };
        await insertFact(markerFactId, tsMs, markerFact);
        await insertMarker({
          fact_id: markerFactId,
          sensor_id: sensorId,
          metric,
          ts_ms: tsMs,
          start_ts_ms: tsMs,
          end_ts_ms: tsMs,
          kind: "MISSING_VALUE",
          note: "value missing at source (NA)",
        });
        continue;
      }

      const rawFactId = `raw_${sha1(`${projectId}|${groupId}|${sensorId}|${metric}|${tsMs}`)}`;
      const rawFact = {
        type: "raw_sample_v1",
        schema_version: 1,
        occurred_at: iso(tsMs),
        entity: { project_id: projectId, group_id: groupId, sensor_id: sensorId },
        payload: {
          sensorId,
          metric,
          ts_ms: tsMs,
          value: v,
          quality: "ok",
          source,
          source_file: sourceFile,
          source_line_no: r.__line_no,
          source_line_text: r.__line_text,
        },
      };
      await insertFact(rawFactId, tsMs, rawFact);

      if (writeRawSamples) {
        await insertRawSample({
          fact_id: rawFactId,
          sensor_id: sensorId,
          metric,
          ts_ms: tsMs,
          occurred_at_ms: tsMs,
          value: v,
          quality: "ok",
        });
      }
    }
  }
}


/* -------------------- main -------------------- */

async function main() {
  // Config resolution order:
  // 1) repo default (config/sim/default.json)
  // 2) --config / --config-b64
  // 3) explicit CLI flags override
  const repoDefault = readRepoDefaultSimConfig() || {};
  const cfgArg = readConfigFromArgs() || {};
  const merged = { ...repoDefault, ...cfgArg };

  // Route A import mode: prefer file-driven import when --file/--import-file is set.
  const importFile = arg("--import-file", arg("--file", merged.import_file || null));
  const importMode = hasFlag("--import") || merged.mode === "import" || !!importFile;

  const datasetDir = arg("--datasetDir", merged.datasetDir || null);
  const locationSingle = arg("--location", null);
  const locationsCsv = argCsv("--locations", "");
  const locations = locationSingle
    ? [String(locationSingle)]
    : (locationsCsv.length ? locationsCsv : Array.isArray(merged.locations) ? merged.locations : []);

  const groupId = arg("--group", merged.groupId || `G_${(locations[0] || "X").slice(0, 3)}`);
  const projectId = arg("--project", merged.projectId || "P_DEFAULT");

  const windowDays = Number(arg("--window-days", String(merged.window_days ?? "1")));
  const speed = Number(arg("--speed", String(merged.speed ?? "60")));
  const once = hasFlag("--once") ? true : !!merged.once;
  const dryRun = hasFlag("--dry-run") ? true : !!merged.dry_run;

  // DB handle is needed for both modes.
  const pool = dryRun ? null : new Pool({ connectionString: process.env.DATABASE_URL });

  if (importMode) {
    const writeRawSamples = argBool("--write-raw-samples", argBool("--writeRawSamples", !!merged.write_raw_samples));
    const writeMarkers = argBool("--write-markers", argBool("--writeMarkers", !!merged.write_markers));
    const source = arg("--source", merged.source || "import");

    console.log(`[import] file=${importFile} project=${projectId} group=${groupId} writeRawSamples=${writeRawSamples} writeMarkers=${writeMarkers} dryRun=${dryRun}`);
    await importTsvToDb({
      filePath: importFile,
      projectId,
      groupId,
      pool,
      dryRun,
      writeRawSamples,
      writeMarkers,
      source,
    });
    if (pool) await pool.end();
    console.log("[import] done");
    return;
  }

  if (!importMode) {
    if (!datasetDir) die("Missing datasetDir (set --datasetDir or config.datasetDir)");
    if (!locations.length) die("Missing locations (set --location/--locations or config.locations)");
    if (!fs.existsSync(datasetDir)) die(`datasetDir not found: ${datasetDir}`);
  } else {
    if (!importFile) die("Missing --file/--import-file for import mode");
  }

  // Fix "now" window once so multi-sensor mapping is consistent for a run.
  const nowEndGlobal = Date.now();
  const nowStartGlobal = nowEndGlobal - windowDays * 24 * 3600 * 1000;

  const qc = buildQcIndex(datasetDir);

  function loadSensorState(location) {
    const hourlyPath = path.join(datasetDir, "caf_sensors", "Hourly", `${location}.txt`);
    if (!fs.existsSync(hourlyPath)) die(`Hourly file not found: ${hourlyPath}`);
    const rows = parseHourlyTsv(fs.readFileSync(hourlyPath, "utf8"));
    if (!rows.length) die(`Hourly file parsed 0 rows: ${hourlyPath}`);

    const cols = Object.keys(rows[0]).filter((k) => !k.startsWith("__") && k !== "Date" && k !== "Time");
    const metricCols = cols.filter((c) => metricMap(c));
    if (!metricCols.length) die(`No metric columns matched for ${location}`);

    const colByMetric = new Map();
    for (const c of metricCols) colByMetric.set(metricMap(c), c);
    const chosen = Array.from(colByMetric.keys());

    // Map a rolling window of historical data onto "now" time.
    // Pick a historical anchor that is NOT in an all-NA tail.
    let histEnd = rows[rows.length - 1].__ts;
    for (let k = rows.length - 1; k >= 0; k--) {
      const r = rows[k];
      let hasAny = false;
      for (const c of metricCols) {
        const v = numOrNa(r[c]);
        if (Number.isFinite(v)) { hasAny = true; break; }
      }
      if (hasAny) { histEnd = r.__ts; break; }
    }
    const histStart = histEnd - windowDays * 24 * 3600 * 1000;
    const nowEnd = nowEndGlobal;
    const nowStart = nowStartGlobal;
    const offset = nowStart - histStart;
    const toHistTs = (nowTs) => nowTs - offset;

    return { location, rows, metricCols, colByMetric, chosen, toHistTs };
  }

  const sensors = locations.map((loc) => loadSensorState(String(loc)));

  // Keyed by "<sensor>|<metric>" so multiple sensors can run in one process.
  const lastGood = new Map(); // string -> number

  async function insertFact(factId, occurredAtMs, source, recordObj) {
    // NOTE: facts.record_json is TEXT (not jsonb). Downstream queries cast to jsonb when needed.
    const sql = `
      INSERT INTO facts (fact_id, occurred_at, source, record_json)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (fact_id) DO NOTHING
    `;
    const occurredAtIso = iso(occurredAtMs);
    const recordText = JSON.stringify(recordObj);

    if (dryRun) {
      console.log("[dry-run] facts", factId, source, recordObj.type, occurredAtIso);
      return;
    }
    await pool.query(sql, [factId, occurredAtIso, source, recordText]);
  }

  async function insertRawSample(row) {
    const sql = `
      INSERT INTO raw_samples (fact_id, sensor_id, metric, ts_ms, occurred_at, value, quality)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (fact_id) DO NOTHING
    `;
    if (dryRun) return;
    await pool.query(sql, [
      row.fact_id,
      row.sensor_id,
      row.metric,
      row.ts_ms,
      iso(row.occurred_at_ms),
      row.value,
      row.quality,
    ]);
  }

  async function insertMarker(row) {
    const sql = `
      INSERT INTO markers (fact_id, sensor_id, metric, ts_ms, start_ts_ms, end_ts_ms, kind, source, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (fact_id) DO NOTHING
    `;
    if (dryRun) return;
    await pool.query(sql, [
      row.fact_id,
      row.sensor_id,
      row.metric,
      row.ts_ms,
      row.start_ts_ms,
      row.end_ts_ms,
      row.kind,
      row.source,
      row.note ?? null,
    ]);
  }

  function makeRawFact(nowMinuteTs, sensorId, metric, value, quality, qcHit) {
    return {
      type: "raw_sample_v1",
      schema_version: 1,
      occurred_at: iso(nowMinuteTs),
      entity: { project_id: projectId, group_id: groupId, sensor_id: sensorId },
      payload: {
        sensorId: sensorId,
        metric,
        ts_ms: nowMinuteTs,
        value,
        quality,
        source: "sim",
        ...(qcHit ? { qc: qcHit } : {}),
      },
    };
  }

  function makeMissingMarkerFact(nowMinuteTs, sensorId, metric, note) {
    return {
      type: "marker_v1",
      schema_version: 1,
      occurred_at: iso(nowMinuteTs),
      entity: { project_id: projectId, group_id: groupId, sensor_id: sensorId },
      payload: {
        sensorId: sensorId,
        metric,
        ts_ms: nowMinuteTs,
        kind: "MISSING_VALUE",
        source: "sim",
        note: note ?? "value missing at source (NA)",
      },
    };
  }

  console.log(
    `[sim] sensors=${sensors.map((s) => s.location).join(",")} group=${groupId} project=${projectId} windowDays=${windowDays} speed=${speed} once=${once} dryRun=${dryRun}`
  );

  // Backfill mode: produce one full window of minute-cadence points ending now.
  // Realtime mode (default): write one minute per loop aligned to current local time.
  let curNow = minuteAlign(nowStartGlobal);
  const endNowAligned = minuteAlign(nowEndGlobal);

  while (true) {
    const nowMinuteTs = once ? curNow : minuteAlign(Date.now());

    for (const sensor of sensors) {
      const histTs = sensor.toHistTs(nowMinuteTs);

      for (const metric of sensor.chosen) {
        const col = sensor.colByMetric.get(metric);
        if (!col) continue;

        let { value, missing } = forwardFillMinute(sensor.rows, col, histTs);

        const srcWasMissing = !Number.isFinite(value);
        const lgKey = `${sensor.location}|${metric}`;

        if (srcWasMissing) {
          // Try carry-forward from runtime cache first; if empty (fresh start), seed from historical look-back.
          let prev = lastGood.get(lgKey);
          if (!Number.isFinite(prev)) {
            prev = findLastFiniteBefore(sensor.rows, col, histTs);
            if (Number.isFinite(prev)) lastGood.set(lgKey, prev);
          }
          if (Number.isFinite(prev)) {
            value = prev;
            missing = true; // missing-origin but density preserved
          }
        } else {
          lastGood.set(lgKey, value);
        }

        const qcHit = qcForTs(qc, sensor.location, metric, histTs);

        // Marker for missing-at-source (NA) always, so "Apple I facts capture arrived-but-missing".
        if (srcWasMissing) {
          const markerFactId = `mk_${sha1(`${projectId}|${groupId}|${sensor.location}|${metric}|${nowMinuteTs}|MISSING_VALUE`)}`;
          const markerFact = makeMissingMarkerFact(
            nowMinuteTs,
            sensor.location,
            metric,
            "NA in hourly source at mapped timestamp"
          );
          await insertFact(markerFactId, nowMinuteTs, "sim", markerFact);
          await insertMarker({
            fact_id: markerFactId,
            sensor_id: sensor.location,
            metric,
            ts_ms: nowMinuteTs,
            start_ts_ms: nowMinuteTs,
            end_ts_ms: nowMinuteTs,
            kind: "MISSING_VALUE",
            source: "sim",
            note: "NA in hourly source (mapped); marker recorded",
          });
        }

        // Only write raw_sample if we have a numeric value (real or carried-forward).
        if (!Number.isFinite(value)) continue;

        let quality = missing ? "bad" : "ok";
        if (qcHit && quality !== "bad") quality = qcHit.quality;

        const rawFactId = `raw_${sha1(`${projectId}|${groupId}|${sensor.location}|${metric}|${nowMinuteTs}`)}`;
        const rawFact = makeRawFact(nowMinuteTs, sensor.location, metric, value, quality, qcHit);

        await insertFact(rawFactId, nowMinuteTs, "sim", rawFact);
        await insertRawSample({
          fact_id: rawFactId,
          sensor_id: sensor.location,
          metric,
          ts_ms: nowMinuteTs,
          occurred_at_ms: nowMinuteTs,
          value,
          quality,
        });
      }
    }

    if (once) {
      curNow += 60000;
      if (curNow > endNowAligned) break;
    } else {
      const sleepMs = Math.max(250, Math.floor(60000 / Math.max(1, speed)));
      await sleep(sleepMs);
    }
  }

  if (pool) await pool.end();
  console.log("[sim] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
