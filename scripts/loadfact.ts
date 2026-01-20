#!/usr/bin/env node
/**
 * CAF dataset importer (Route A)
 *
 * Contract:
 * - Append-only: INSERT ... ON CONFLICT DO NOTHING
 * - Evidence-preserving: facts.record_json stores a JSON text that includes
 *   the original input line as `source_line_text`.
 * - Projection tables (raw_samples / markers) are derived rows, keyed by fact_id.
 *
 * Usage (PowerShell):
 *   pnpm exec ts-node .\scripts\loadfact.ts --file .\datasets\CAF009.txt --projectId P_DEFAULT --groupId G_CAF --writeRawSamples 1 --writeMarkers 1
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Pool } from "pg";

/* -------------------- CLI utils -------------------- */

function arg(name: string, fallback: string | null = null): string | null {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v == null ? fallback : String(v);
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function bool01(v: string | null, fallback = false): boolean {
  if (v == null) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function sha1(s: string): string {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function iso(tsMs: number): string {
  return new Date(tsMs).toISOString().replace(".000Z", "Z");
}

function numOrNa(v: unknown): number {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  if (s.toUpperCase() === "NA") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/* -------------------- parsing -------------------- */

type ParsedLine = {
  line_no: number;
  line_text: string;
  row: Record<string, string>;
  ts_ms: number;
  sensor_id: string;
};

function parseTsMs(dateRaw: string, timeRaw: string): number {
  // Input format:
  // - Date: MM/DD/YYYY
  // - Time: HH:MM (or H:MM)
  // Convert to an ISO-ish string that Date.parse can reliably parse.
  const date = dateRaw.trim();
  const time = timeRaw.trim();
  const m = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return NaN;
  const yyyy = m[3];
  const mm = String(m[1]).padStart(2, "0");
  const dd = String(m[2]).padStart(2, "0");
  // Treat source timestamps as UTC (dataset timestamps are typically in UTC in GEOX workflows).
  const isoLike = `${yyyy}-${mm}-${dd}T${time.padStart(5, "0")}:00Z`;
  const t = Date.parse(isoLike);
  return Number.isFinite(t) ? t : NaN;
}

function metricFromColumn(col: string): string | null {
  const vw = col.match(/^VW_(\d+)cm$/i);
  if (vw) return `soil_moisture_vwc_${vw[1]}cm`;
  const tt = col.match(/^T_(\d+)cm$/i);
  if (tt) return `soil_temp_c_${tt[1]}cm`;
  return null;
}

function parseTsvFile(filePath: string, sensorIdOverride: string | null): { metrics: string[]; lines: ParsedLine[] } {
  const text = fs.readFileSync(filePath, "utf8");
  const allLines = text.split(/\r?\n/);
  const nonEmpty = allLines.filter((l) => l.trim() !== "");
  if (nonEmpty.length < 2) die(`TSV file has <2 non-empty lines: ${filePath}`);

  const header = nonEmpty[0].split("\t").map((s) => s.trim());
  const idxDate = header.indexOf("Date");
  const idxTime = header.indexOf("Time");
  const idxLoc = header.indexOf("Location");
  if (idxDate === -1 || idxTime === -1) die(`Header must include Date and Time: ${filePath}`);

  const metricCols = header.filter((h) => metricFromColumn(h));
  const metrics = metricCols.map((c) => metricFromColumn(c)!).filter(Boolean);
  if (metrics.length === 0) die(`No metric columns matched (VW_*/T_*): ${filePath}`);

  const out: ParsedLine[] = [];
  for (let i = 1; i < nonEmpty.length; i++) {
    const lineText = nonEmpty[i];
    const cols = lineText.split("\t");
    if (cols.length < 2) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length && j < cols.length; j++) row[header[j]] = String(cols[j]).trim();

    const dateRaw = row["Date"];
    const timeRaw = row["Time"];
    if (!dateRaw || !timeRaw) continue;
    const tsMs = parseTsMs(dateRaw, timeRaw);
    if (!Number.isFinite(tsMs)) continue;

    const sensorId = sensorIdOverride ?? row["Location"] ?? null;
    if (!sensorId) continue;

    out.push({
      line_no: i + 1, // 1-based line numbers in files
      line_text: lineText,
      row,
      ts_ms: tsMs,
      sensor_id: String(sensorId),
    });
  }

  out.sort((a, b) => a.ts_ms - b.ts_ms);
  return { metrics, lines: out };
}

/* -------------------- DB writes -------------------- */

type RawFact = {
  type: "raw_sample_v1";
  schema_version: number;
  occurred_at: string;
  entity: { project_id: string; group_id: string; sensor_id: string };
  payload: {
    sensorId: string;
    metric: string;
    ts_ms: number;
    value: number;
    quality: "ok" | "suspect" | "bad";
    source: "import";
    source_file: string;
    source_line_no: number;
    source_line_text: string;
  };
};

type MarkerFact = {
  type: "marker_v1";
  schema_version: number;
  occurred_at: string;
  entity: { project_id: string; group_id: string; sensor_id: string };
  payload: {
    sensorId: string;
    metric: string;
    ts_ms: number;
    kind: "MISSING_VALUE";
    source: "import";
    note: string;
    source_file: string;
    source_line_no: number;
    source_line_text: string;
  };
};

async function main(): Promise<void> {
  const filePath = arg("--file", null);
  if (!filePath) die("Missing --file");

  const projectId = arg("--projectId", "P_DEFAULT")!;
  const groupId = arg("--groupId", "G_CAF")!;
  const sensorIdOverride = arg("--sensorId", null);
  const writeRawSamples = bool01(arg("--writeRawSamples", null), true);
  const writeMarkers = bool01(arg("--writeMarkers", null), true);

  const absFile = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absFile)) die(`File not found: ${absFile}`);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) die("Missing DATABASE_URL env var (e.g. postgres://landos:...)");

  const { metrics, lines } = parseTsvFile(absFile, sensorIdOverride);
  if (lines.length === 0) die(`Parsed 0 rows from file: ${absFile}`);

  const pool = new Pool({ connectionString: databaseUrl });

  const insertFactSql = `
    INSERT INTO facts (fact_id, occurred_at, source, record_json)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (fact_id) DO NOTHING
  `;

  const insertRawSql = `
    INSERT INTO raw_samples (fact_id, sensor_id, metric, ts_ms, occurred_at, value, quality)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (fact_id) DO NOTHING
  `;

  const insertMarkerSql = `
    INSERT INTO markers (fact_id, sensor_id, metric, ts_ms, start_ts_ms, end_ts_ms, kind, source, note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (fact_id) DO NOTHING
  `;

  let nFacts = 0;
  let nRaw = 0;
  let nMarkers = 0;

  for (const ln of lines) {
    for (let i = 0; i < metrics.length; i++) {
      const metricCol = metrics[i];
      // Map back to the original column name (VW_*/T_*).
      const col = metricCol.replace("soil_moisture_vwc_", "VW_").replace("soil_temp_c_", "T_");
      const v = numOrNa(ln.row[col]);

      if (!Number.isFinite(v)) {
        if (writeMarkers) {
          const markerId = `mk_${sha1(`${projectId}|${groupId}|${ln.sensor_id}|${metricCol}|${ln.ts_ms}|MISSING_VALUE`)}`;
          const markerFact: MarkerFact = {
            type: "marker_v1",
            schema_version: 1,
            occurred_at: iso(ln.ts_ms),
            entity: { project_id: projectId, group_id: groupId, sensor_id: ln.sensor_id },
            payload: {
              sensorId: ln.sensor_id,
              metric: metricCol,
              ts_ms: ln.ts_ms,
              kind: "MISSING_VALUE",
              source: "import",
              note: "NA in source file",
              source_file: path.basename(absFile),
              source_line_no: ln.line_no,
              source_line_text: ln.line_text,
            },
          };
          await pool.query(insertFactSql, [markerId, markerFact.occurred_at, "import", JSON.stringify(markerFact)]);
          nFacts++;

          await pool.query(insertMarkerSql, [
            markerId,
            ln.sensor_id,
            metricCol,
            ln.ts_ms,
            ln.ts_ms,
            ln.ts_ms,
            "MISSING_VALUE",
            "import",
            "NA in source file",
          ]);
          nMarkers++;
        }
        continue;
      }

      const rawId = `raw_${sha1(`${projectId}|${groupId}|${ln.sensor_id}|${metricCol}|${ln.ts_ms}`)}`;
      const rawFact: RawFact = {
        type: "raw_sample_v1",
        schema_version: 1,
        occurred_at: iso(ln.ts_ms),
        entity: { project_id: projectId, group_id: groupId, sensor_id: ln.sensor_id },
        payload: {
          sensorId: ln.sensor_id,
          metric: metricCol,
          ts_ms: ln.ts_ms,
          value: v,
          quality: "ok",
          source: "import",
          source_file: path.basename(absFile),
          source_line_no: ln.line_no,
          source_line_text: ln.line_text,
        },
      };

      await pool.query(insertFactSql, [rawId, rawFact.occurred_at, "import", JSON.stringify(rawFact)]);
      nFacts++;

      if (writeRawSamples) {
        await pool.query(insertRawSql, [rawId, ln.sensor_id, metricCol, ln.ts_ms, rawFact.occurred_at, v, "ok"]);
        nRaw++;
      }
    }
  }

  await pool.end();

  const minTs = lines[0].ts_ms;
  const maxTs = lines[lines.length - 1].ts_ms;

  console.log(
    JSON.stringify(
      {
        file: absFile,
        projectId,
        groupId,
        sensorIdOverride,
        metrics,
        parsed_lines: lines.length,
        inserted_facts_attempted: nFacts,
        inserted_raw_samples_attempted: nRaw,
        inserted_markers_attempted: nMarkers,
        min_ts_ms: minTs,
        max_ts_ms: maxTs,
        min_utc: iso(minTs),
        max_utc: iso(maxTs),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
