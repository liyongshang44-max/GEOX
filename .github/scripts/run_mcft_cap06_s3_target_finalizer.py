# .github/scripts/run_mcft_cap06_s3_target_finalizer.py
# Purpose: execute the already-reviewed Python materialization block stored in the target S3 finalizer workflow.
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
