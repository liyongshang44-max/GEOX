# .github/scripts/run_mcft_cap06_s3_integrity_correction.py
# Purpose: execute the reviewed Python materialization block stored in the target S3 integrity-correction workflow.
# Boundary: helper-PR tooling only; never copied into the correction branch or main.

from __future__ import annotations

from pathlib import Path

WORKFLOW = Path(".github/workflows/mcft-cap-06-s3-candidate-integrity-correction.yml")
START_LINE = "python - <<'PY'"
END_LINE = "PY"
YAML_BLOCK_INDENT = "          "

lines = WORKFLOW.read_text(encoding="utf-8").splitlines()
starts = [index for index, line in enumerate(lines) if line.strip() == START_LINE]
if len(starts) != 1:
    raise RuntimeError(f"S3_CORRECTION_START_BOUNDARY_INVALID:{len(starts)}")
start = starts[0]
ends = [
    index
    for index, line in enumerate(lines[start + 1 :], start=start + 1)
    if line.strip() == END_LINE
]
if len(ends) != 1:
    raise RuntimeError(f"S3_CORRECTION_END_BOUNDARY_INVALID:{len(ends)}")

raw = lines[start + 1 : ends[0]]
source = "\n".join(
    line[len(YAML_BLOCK_INDENT) :] if line.startswith(YAML_BLOCK_INDENT) else line
    for line in raw
) + "\n"
if not source.startswith("import json\n"):
    raise RuntimeError(f"S3_CORRECTION_SOURCE_START_INVALID:{source[:80]!r}")
for token in [
    "verifyEvaluationCandidateWithClientV1",
    "CAP06_EVALUATION_CANDIDATE_NOT_CANONICAL",
    "concurrent same-key different-hash Candidate",
]:
    if token not in source:
        raise RuntimeError(f"S3_CORRECTION_SOURCE_TOKEN_MISSING:{token}")

exec(compile(source, str(WORKFLOW), "exec"), {"__name__": "__main__"})
