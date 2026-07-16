# .github/scripts/run_mcft_cap06_s3_target_finalizer.py
# Purpose: execute the already-reviewed Python materialization block stored in the target S3 finalizer workflow.
# Boundary: helper-PR tooling only; this file is never pushed into the S3 implementation branch or merged into main.

from __future__ import annotations

import textwrap
from pathlib import Path

WORKFLOW = Path(".github/workflows/mcft-cap-06-s3-validation.yml")
START = "          python - <<'PY'\n"
END = "          PY\n"

text = WORKFLOW.read_text(encoding="utf-8")
start_count = text.count(START)
end_count = text.count(END)
if start_count != 1 or end_count != 1:
    raise RuntimeError(f"S3_FINALIZER_EMBEDDED_PYTHON_BOUNDARY_INVALID:{start_count}:{end_count}")

start = text.index(START) + len(START)
end = text.index(END, start)
source = textwrap.dedent(text[start:end])
if "EXPECTED_FILES" not in source or "S3_D_PERSISTENCE_CANDIDATE" not in source:
    raise RuntimeError("S3_FINALIZER_EMBEDDED_PYTHON_CONTENT_INVALID")

exec(compile(source, str(WORKFLOW), "exec"), {"__name__": "__main__"})
