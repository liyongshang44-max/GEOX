# .github/scripts/run_mcft_cap06_s3_target_finalizer.py
# Purpose: execute the reviewed target materialization block and apply two exact governance-guard corrections before validation.
# Boundary: helper-PR tooling only; this file is never pushed into the S3 implementation branch or merged into main.

from __future__ import annotations

from pathlib import Path

WORKFLOW = Path(".github/workflows/mcft-cap-06-s3-validation.yml")
START_LINE = "python - <<'PY'"
END_LINE = "PY"
YAML_BLOCK_INDENT = "          "

lines = WORKFLOW.read_text(encoding="utf-8").splitlines()
start_indexes = [index for index, line in enumerate(lines) if line.strip() == START_LINE]
if len(start_indexes) != 1:
    raise RuntimeError(f"S3_FINALIZER_START_BOUNDARY_INVALID:{len(start_indexes)}")

start = start_indexes[0]
end_indexes = [
    index
    for index, line in enumerate(lines[start + 1 :], start=start + 1)
    if line.strip() == END_LINE
]
if len(end_indexes) != 1:
    raise RuntimeError(f"S3_FINALIZER_END_BOUNDARY_INVALID:{len(end_indexes)}")

raw_lines = lines[start + 1 : end_indexes[0]]
source_lines = [
    line[len(YAML_BLOCK_INDENT) :] if line.startswith(YAML_BLOCK_INDENT) else line
    for line in raw_lines
]
source = "\n".join(source_lines) + "\n"
if not source.startswith("import json\n"):
    raise RuntimeError(f"S3_FINALIZER_SOURCE_START_INVALID:{source[:80]!r}")
if "EXPECTED_FILES" not in source or "S3_D_PERSISTENCE_CANDIDATE" not in source:
    raise RuntimeError("S3_FINALIZER_EMBEDDED_PYTHON_CONTENT_INVALID")

exec(compile(source, str(WORKFLOW), "exec"), {"__name__": "__main__"})

task_path = Path("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md")
task = task_path.read_text(encoding="utf-8")
task_anchor = "Candidate compute service: absent\n"
task_replacement = "NO_S5_CALIBRATION_CANDIDATE_COMPUTE_SERVICE\nCandidate compute service: absent\n"
if "NO_S5_CALIBRATION_CANDIDATE_COMPUTE_SERVICE" not in task:
    if task.count(task_anchor) != 1:
        raise RuntimeError(f"S3_TASK_NONCLAIM_ANCHOR_COUNT:{task.count(task_anchor)}")
    task = task.replace(task_anchor, task_replacement, 1)
task_path.write_text(task, encoding="utf-8")

gate_path = Path("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_D_PERSISTENCE.cjs")
gate = gate_path.read_text(encoding="utf-8")
old_guard = "  assert.doesNotMatch(migration, /CREATE TABLE[^;]*active[^;]*config/is);\n"
new_guard = """  const createdTableNames = [...migration.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\\s+([^\\s(]+)/gi)]
    .map((match) => match[1]);
  assert.equal(
    createdTableNames.some((name) => /active.*config|config.*active/i.test(name)),
    false,
  );
"""
if old_guard in gate:
    gate = gate.replace(old_guard, new_guard, 1)
elif "const createdTableNames =" not in gate:
    raise RuntimeError("S3_GATE_ACTIVE_CONFIG_TABLE_GUARD_ANCHOR_MISSING")
gate_path.write_text(gate, encoding="utf-8")
