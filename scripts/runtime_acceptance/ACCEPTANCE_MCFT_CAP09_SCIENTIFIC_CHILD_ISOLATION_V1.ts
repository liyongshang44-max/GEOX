import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GfsRawBundleEvidenceDecoderV1 } from "../../apps/server/src/external_evidence/provider/gfs_raw_bundle_evidence_decoder_v1.js";
import { KbsRawHourlyExactIntervalDecoderV1 } from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.js";
import { KbsRawHourlyPublicationSnapshotComparisonV1 } from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_comparison_v1.js";
import { KbsRawHourlyPublicationSnapshotInspectorV1 } from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_snapshot_v1.js";

test("scientific entry points run with private cwd, isolated imports and child-only environment", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cap09-isolation-test-"));
  const driver = path.join(root, "driver.py");
  const log = path.join(root, "calls.jsonl");
  const python = process.platform === "win32" ? "python" : "python3";
  const at = "2026-01-01T00:00:00.000Z";
  const input = Buffer.from("fixture");
  const key = "MCFT_FIXTURE_PARENT_ONLY";
  const previous = process.env[key];
  try {
    process.env[key] = "TEST_ONLY";
    fs.writeFileSync(driver, [
      "import json, os, pathlib, sys, tempfile",
      "assert sys.flags.isolated and sys.flags.no_user_site and sys.dont_write_bytecode",
      "assert 'MCFT_FIXTURE_PARENT_ONLY' not in os.environ",
      "assert pathlib.Path.cwd() == pathlib.Path(tempfile.gettempdir())",
      "assert str(pathlib.Path.cwd()) not in sys.path",
      "assert pathlib.Path(sys.argv[sys.argv.index('--output') + 1]).parent == pathlib.Path.cwd()",
      "for flag in ('--input', '--previous-input', '--current-input'):",
      "    if flag in sys.argv: assert pathlib.Path(sys.argv[sys.argv.index(flag) + 1]).read_bytes() == b'fixture'",
      `with open(${JSON.stringify(log)}, 'a', encoding='utf8') as f:`,
      "    print(json.dumps([sys.argv[1], str(pathlib.Path.cwd())]), file=f)",
      "sys.exit(17)",
    ].join("\n"));
    const config = { python_executable: python, scientific_core_path: driver };
    const file = path.join(root, "raw");
    fs.writeFileSync(file, input);
    const gfs = new GfsRawBundleEvidenceDecoderV1(at, { python_executable: python, product_decoder_path: driver });
    const kbs = new KbsRawHourlyExactIntervalDecoderV1(at, config);
    type Provenance = Parameters<typeof gfs.decodeRetainedEvidenceFile>[0]["provenance"];
    const provenance = { available_at: at } as Provenance;
    await assert.rejects(gfs.decodeRetainedEvidenceFile({ raw_file_path: path.relative(process.cwd(), file), provenance } as Parameters<typeof gfs.decodeRetainedEvidenceFile>[0]));
    await assert.rejects(kbs.decodeRetainedEvidence({ raw_bytes: input, provenance } as Parameters<typeof kbs.decodeRetainedEvidence>[0]));
    await assert.rejects(new KbsRawHourlyPublicationSnapshotComparisonV1(config).compare({
      previous_raw_bytes: input, current_raw_bytes: input,
      previous_available_at: at, current_available_at: at, baseline_latest_event_time: at,
    }));
    const inspector = new KbsRawHourlyPublicationSnapshotInspectorV1(config);
    await assert.rejects(inspector.inspectSnapshot({ raw_bytes: input, available_at: at }));
    await assert.rejects(inspector.diffForward({ raw_bytes: input, available_at: at, after_event_time: at }));
    const rows: [string, string][] = fs.readFileSync(log, "utf8").trim().split(/\r?\n/).map(line => JSON.parse(line));
    assert.deepEqual(rows.map(([cmd]) => cmd), ["decode-bundle", "decode-exact", "compare-snapshots", "inspect-snapshot", "diff-forward"]);
    assert.equal(new Set(rows.map(([, dir]) => dir)).size, rows.length);
    for (const [, dir] of rows) assert.equal(fs.existsSync(dir), false);
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
