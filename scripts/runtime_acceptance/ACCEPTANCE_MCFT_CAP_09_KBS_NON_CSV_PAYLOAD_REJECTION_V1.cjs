#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repo = process.cwd();
const core = path.join(
  repo,
  "apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py",
);
const lifecycle = path.join(
  repo,
  "apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.ts",
);

function runPythonCase(label, bytes, expectedToken) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `mcft-cap09-kbs-non-csv-${label}-`));
  try {
    const input = path.join(dir, "raw-hourly.csv");
    const output = path.join(dir, "result.json");
    fs.writeFileSync(input, bytes);

    const result = spawnSync(
      process.env.PYTHON || "python",
      [
        core,
        "inspect-snapshot",
        "--available-at",
        "2026-09-28T01:07:38.054Z",
        "--input",
        input,
        "--output",
        output,
      ],
      { encoding: "utf8" },
    );

    const combined = `${result.stdout || ""}\n${result.stderr || ""}`;
    assert.notEqual(result.status, 0, `${label}: expected non-zero exit`);
    assert.match(combined, new RegExp(expectedToken), `${label}: expected ${expectedToken}`);
    assert.doesNotMatch(combined, /UnicodeDecodeError/, `${label}: raw UnicodeDecodeError must not leak`);
    assert.doesNotMatch(
      combined,
      /MCFT_CAP09_KBS_SCIENTIFIC_SUBPROCESS_UNCLASSIFIED/,
      `${label}: must not become unclassified`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

runPythonCase(
  "grib",
  Buffer.concat([Buffer.from("GRIB"), Buffer.from([0x00, 0xb3, 0x00, 0x00, 0x00, 0x00])]),
  "MCFT_CAP09_KBS_RAW_HOURLY_NON_CSV_PAYLOAD:GRIB",
);

runPythonCase(
  "invalid-utf8",
  Buffer.from([0xdc, 0x00, 0x00, 0x2c, 0x31, 0x32, 0x33]),
  "MCFT_CAP09_KBS_RAW_HOURLY_INVALID_UTF8",
);

const lifecycleText = fs.readFileSync(lifecycle, "utf8");
assert.match(
  lifecycleText,
  /"MCFT_CAP09_KBS_RAW_HOURLY_NON_CSV_PAYLOAD"/,
  "classifier must reject non-CSV KBS payloads",
);
assert.match(
  lifecycleText,
  /"MCFT_CAP09_KBS_RAW_HOURLY_INVALID_UTF8"/,
  "classifier must reject invalid UTF-8 KBS payloads",
);

console.log(JSON.stringify({
  acceptance: "PASS",
  contract: "MCFT_CAP09_KBS_NON_CSV_PAYLOAD_REJECTION_V1",
  unclassified_kbs_subprocess: 0,
  process_fatal_expected: false
}, null, 2));
