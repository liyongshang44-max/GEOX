#!/usr/bin/env python3
from pathlib import Path


def replace_exact(path: str, old: str, new: str, count: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise RuntimeError(f"REPLACE_COUNT:{path}:expected={count}:actual={actual}:needle={old[:80]!r}")
    p.write_text(text.replace(old, new))


def insert_after(path: str, marker: str, addition: str, count: int = 1) -> None:
    replace_exact(path, marker, marker + addition, count)


workflow = ".github/workflows/mcft-cap-09-ea5e2-timing-budget-qualification.yml"
collector = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts"
acceptance = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_TIMING_BUDGET_QUALIFICATION.cjs"
selector = Path("scripts/runtime_acceptance/SELECT_MCFT_CAP_09_EA5E2_TIMING_TARGET_AMENDMENT11.py")

# Timing workflow: make Amendment-11 decoder/selector explicit dependencies.
replace_exact(
    workflow,
    "      - 'scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'\n",
    "      - 'scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'\n"
    "      - 'scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py'\n"
    "      - 'scripts/runtime_acceptance/SELECT_MCFT_CAP_09_EA5E2_TIMING_TARGET_AMENDMENT11.py'\n",
    2,
)
replace_exact(
    workflow,
    "      - name: Prove timing-only KBS target selection fails closed\n"
    "        run: python scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py selftest-kbs-timing-target\n",
    "      - name: Prove Amendment-11 authoritative-late target selection fails closed\n"
    "        run: |\n"
    "          python scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py selftest\n"
    "          python -m py_compile scripts/runtime_acceptance/SELECT_MCFT_CAP_09_EA5E2_TIMING_TARGET_AMENDMENT11.py\n",
)
replace_exact(
    workflow,
    "      - name: Select complete exact KBS timing row with unchanged source freshness\n"
    "        id: target\n"
    "        shell: bash\n"
    "        run: |\n"
    "          set -euo pipefail\n"
    "          python scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py select-kbs-timing-target > /tmp/mcft-kbs-timing-target.json\n"
    "          node - <<'NODE' >> \"$GITHUB_OUTPUT\"\n"
    "          const fs=require('fs');\n"
    "          const value=JSON.parse(fs.readFileSync('/tmp/mcft-kbs-timing-target.json','utf8').trim().split(/\\r?\\n/).filter(Boolean).at(-1));\n"
    "          if(value.status!=='PASS'||Number(value.latest_age_hours)>6||value.selection_scope!=='QUALIFICATION_TIMING_ONLY_NOT_LIVE_TARGET_ADMISSION'||!String(value.selected_target_t).endsWith(':00:00.000Z')) throw new Error('EA5E2_TIMING_QUALIFICATION_FRESH_COMPLETE_EXACT_TARGET_REQUIRED');\n"
    "          process.stdout.write(`target_t=${value.selected_target_t}\\n`);\n"
    "          NODE\n",
    "      - name: Select complete exact KBS timing row under Amendment-11 watermark\n"
    "        id: target\n"
    "        shell: bash\n"
    "        run: |\n"
    "          set -euo pipefail\n"
    "          python scripts/runtime_acceptance/SELECT_MCFT_CAP_09_EA5E2_TIMING_TARGET_AMENDMENT11.py > /tmp/mcft-kbs-timing-target.json\n"
    "          node - <<'NODE' >> \"$GITHUB_OUTPUT\"\n"
    "          const fs=require('fs');\n"
    "          const value=JSON.parse(fs.readFileSync('/tmp/mcft-kbs-timing-target.json','utf8').trim().split(/\\r?\\n/).filter(Boolean).at(-1));\n"
    "          if(value.status!=='PASS'||value.temporal_authority!=='PROVIDER_AVAILABILITY_WATERMARK_V1'||value.provider_publication_cadence!=='DAILY_BATCH'||value.freshness_is_late_authoritative_admission_gate!==false||value.selection_scope!=='QUALIFICATION_TIMING_ONLY_NOT_LIVE_TARGET_ADMISSION'||!String(value.selected_target_t).endsWith(':00:00.000Z')) throw new Error('EA5E2_TIMING_QUALIFICATION_AMENDMENT11_COMPLETE_EXACT_TARGET_REQUIRED');\n"
    "          process.stdout.write(`target_t=${value.selected_target_t}\\n`);\n"
    "          NODE\n",
)

# Collector: route KBS late decode through already-qualified Amendment-11 decoder.
insert_after(
    collector,
    'const PROVIDER_SCRIPT = path.resolve("scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py");\n',
    'const KBS_AUTHORITATIVE_LATE_DECODER_SCRIPT = path.resolve("scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py");\n',
)
run_python = '''async function runPython(args: string[], deadlineMs?: number): Promise<{ stdout: string; stderr: string }> {
  let timeoutMs = 20 * 60_000;
  if (deadlineMs !== undefined) {
    const remaining = deadlineMs - Date.now();
    if (remaining <= 0) throw new Error("EA5E2_PROVIDER_EXECUTION_DEADLINE_EXCEEDED");
    timeoutMs = Math.max(1_000, Math.min(timeoutMs, Math.floor(remaining)));
  }
  const result = await execFileAsync(PYTHON, [PROVIDER_SCRIPT, ...args], { cwd: process.cwd(), maxBuffer: 32 * 1024 * 1024, timeout: timeoutMs });
  return { stdout: String(result.stdout), stderr: String(result.stderr) };
}
'''
run_script = '''
async function runPythonScript(script: string, args: string[], deadlineMs?: number): Promise<{ stdout: string; stderr: string }> {
  let timeoutMs = 20 * 60_000;
  if (deadlineMs !== undefined) {
    const remaining = deadlineMs - Date.now();
    if (remaining <= 0) throw new Error("EA5E2_PROVIDER_EXECUTION_DEADLINE_EXCEEDED");
    timeoutMs = Math.max(1_000, Math.min(timeoutMs, Math.floor(remaining)));
  }
  const result = await execFileAsync(PYTHON, [script, ...args], { cwd: process.cwd(), maxBuffer: 32 * 1024 * 1024, timeout: timeoutMs });
  return { stdout: String(result.stdout), stderr: String(result.stderr) };
}
'''
insert_after(collector, run_python, run_script)
old_decoder = '''class PythonKbsLateDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = "MCFT_CAP09_EA5E2_KBS_RAW_HOURLY_EXACT_INTERVAL_DECODER_V1";
  readonly decoder_version = "1";
  constructor(private readonly target: string, private readonly deadlineMs?: number) {}
  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-ea5e2-kbs-late-"));
    const raw = path.join(temp, "kbs-raw-hourly.csv");
    const output = path.join(temp, "kbs-late-drafts.json");
    try {
      fs.writeFileSync(raw, Buffer.from(input.raw_bytes));
      await runPython(["decode-kbs-late", "--target", this.target, "--available-at", input.provenance.available_at, "--input", raw, "--output", output], this.deadlineMs);
      const parsed = JSON.parse(fs.readFileSync(output, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("EA5E2_KBS_LATE_DRAFT_PAIR_REQUIRED");
      return parsed.drafts;
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
}
'''
new_decoder = '''class PythonKbsLateDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = "MCFT_CAP09_EA5E2_KBS_RAW_HOURLY_EXACT_INTERVAL_DECODER_V1";
  readonly decoder_version = "1";
  constructor(private readonly target: string, private readonly deadlineMs?: number) {}
  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-ea5e2-kbs-late-"));
    const raw = path.join(temp, "kbs-raw-hourly.csv");
    const output = path.join(temp, "kbs-late-drafts.json");
    const meta = path.join(temp, "kbs-late-meta.json");
    try {
      fs.writeFileSync(raw, Buffer.from(input.raw_bytes));
      await runPythonScript(KBS_AUTHORITATIVE_LATE_DECODER_SCRIPT, ["decode", "--target-t", this.target, "--available-at", input.provenance.available_at, "--input", raw, "--output", output, "--meta", meta], this.deadlineMs);
      const parsed = JSON.parse(fs.readFileSync(output, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("EA5E2_KBS_LATE_DRAFT_PAIR_REQUIRED");
      const safe = JSON.parse(fs.readFileSync(meta, "utf8")) as Record<string, unknown>;
      if (safe.status !== "PASS"
          || safe.selection_mode !== "EXACT_REQUESTED_TARGET"
          || safe.requested_target_t !== this.target
          || safe.freshness_is_late_authoritative_admission_gate !== false
          || safe.provider_publication_cadence !== "DAILY_BATCH") throw new Error("EA5E2_KBS_AMENDMENT11_LATE_DECODER_PROOF_REQUIRED");
      return parsed.drafts;
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
}
'''
replace_exact(collector, old_decoder, new_decoder)

# New timing-only selector. It preserves 6h as diagnostic only and selects a complete exact row.
selector.write_text('''#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path.cwd()
DECODER_PATH = ROOT / "scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py"
SPEC = importlib.util.spec_from_file_location("mcft_cap09_kbs_authoritative_late", DECODER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("EA5E2_TIMING_AMENDMENT11_DECODER_LOAD_FAILED")
kbs = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(kbs)
KBS_URL = kbs.ea4.AUTH["kbs"]["raw_hourly_csv"]


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def main() -> None:
    requested_at = datetime.now(timezone.utc)
    status, _, body, final = kbs.ea4.request_bytes(
        KBS_URL,
        "EA5E2_TIMING_AMENDMENT11_KBS_HOURLY",
        110_000_000,
        {"Accept": "text/csv,text/plain;q=0.9,*/*;q=0.5"},
    )
    require(status == 200, "EA5E2_TIMING_AMENDMENT11_KBS_HTTP")
    retrieved_at = datetime.now(timezone.utc)
    parsed_final = urlparse(final)
    require(parsed_final.hostname == "lter.kbs.msu.edu" and parsed_final.path == "/datatables/13.csv", "EA5E2_TIMING_AMENDMENT11_KBS_IDENTITY")
    latest, selected, _, skipped, selection_mode = kbs.select_complete_exact_row(kbs.ea4.parse_kbs_csv(body), retrieved_at)
    latest_age_hours = (retrieved_at - latest).total_seconds() / 3600.0
    proof = {
        "schema_version": "geox_mcft_cap09_ea5e2_timing_target_amendment11_v1",
        "status": "PASS",
        "temporal_authority": "PROVIDER_AVAILABILITY_WATERMARK_V1",
        "provider_publication_cadence": "DAILY_BATCH",
        "observation_resolution": "HOURLY",
        "requested_at": kbs.iso(requested_at),
        "retrieved_at": kbs.iso(retrieved_at),
        "latest_raw_hourly_timestamp": kbs.iso(latest),
        "latest_age_hours": round(latest_age_hours, 6),
        "historical_online_freshness_diagnostic_le_6h": latest_age_hours <= kbs.HISTORICAL_FRESHNESS_HOURS,
        "freshness_is_late_authoritative_admission_gate": False,
        "selected_target_t": kbs.iso(selected),
        "selected_target_lag_hours_from_latest": (latest - selected).total_seconds() / 3600.0,
        "skipped_newer_incomplete_or_duplicate_row_count": skipped,
        "selection_mode": selection_mode,
        "selection_scope": "QUALIFICATION_TIMING_ONLY_NOT_LIVE_TARGET_ADMISSION",
        "same_source_exact_t_decoder_still_required": True,
        "authority_effect": False,
        "raw_values_emitted": False,
    }
    print(json.dumps(proof, sort_keys=True))


if __name__ == "__main__":
    main()
''')

# Static acceptance: bind the timing path to Amendment-11 and reject reintroduced age hard gates.
insert_after(
    acceptance,
    'const AGGREGATE = "scripts/runtime_acceptance/QUALIFY_MCFT_CAP_09_EA5E2_TIMING_BUDGETS.ts";\n',
    'const KBS_LATE_DECODER = "scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py";\n'
    'const KBS_TIMING_SELECTOR = "scripts/runtime_acceptance/SELECT_MCFT_CAP_09_EA5E2_TIMING_TARGET_AMENDMENT11.py";\n',
)
insert_after(
    acceptance,
    'const aggregate = read(AGGREGATE);\n',
    'const kbsLateDecoder = read(KBS_LATE_DECODER);\nconst kbsTimingSelector = read(KBS_TIMING_SELECTOR);\n',
)
replace_exact(acceptance, '  "select-kbs-timing-target",\n  "selftest-kbs-timing-target",\n', '  "MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py selftest",\n  "SELECT_MCFT_CAP_09_EA5E2_TIMING_TARGET_AMENDMENT11.py",\n  "PROVIDER_AVAILABILITY_WATERMARK_V1",\n')
replace_exact(
    acceptance,
    '  "PostgresExternalFormalEvidenceIngressV1",\n  "collection_to_ingress_completion_elapsed_ms",\n',
    '  "PostgresExternalFormalEvidenceIngressV1",\n  "KBS_AUTHORITATIVE_LATE_DECODER_SCRIPT",\n  "freshness_is_late_authoritative_admission_gate",\n  "--target-t",\n  "collection_to_ingress_completion_elapsed_ms",\n',
)
anchor = '''], "EA5E2_COLLECTOR_TIMING_PATH_MISSING");
'''
addition = '''requireAll(kbsLateDecoder, [
  "HISTORICAL_FRESHNESS_HOURS = 6.0",
  "freshness_is_late_authoritative_admission_gate\\\": False",
  "provider_publication_cadence\\\": \\\"DAILY_BATCH\\\"",
  "select_complete_exact_row",
  "EXACT_REQUESTED_TARGET",
  "stale_daily_batch_remains_selectable",
], "EA5E2_AMENDMENT11_LATE_DECODER_CONTRACT_MISSING");
requireAll(kbsTimingSelector, [
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "freshness_is_late_authoritative_admission_gate\\\": False",
  "provider_publication_cadence\\\": \\\"DAILY_BATCH\\\"",
  "QUALIFICATION_TIMING_ONLY_NOT_LIVE_TARGET_ADMISSION",
  "select_complete_exact_row",
], "EA5E2_AMENDMENT11_TIMING_SELECTOR_CONTRACT_MISSING");
if (workflow.includes("Number(value.latest_age_hours)>6")) throw new Error("EA5E2_TIMING_WORKFLOW_FRESHNESS_HARD_GATE_FORBIDDEN");
if (collector.includes('runPython(["decode-kbs-late"')) throw new Error("EA5E2_COLLECTOR_LEGACY_FRESHNESS_DECODER_FORBIDDEN");
'''
insert_after(acceptance, anchor, addition)

print("AMENDMENT11_FRESHNESS_TIMING_EDIT_APPLIED")
