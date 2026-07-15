# scripts/remediation/APPLY_MCFT_CAP_05_REPLAY_METADATA_ACCEPTANCE_AUTHORIZED_BINDING.py
# Purpose: make the generated Replay execution-metadata acceptance use the frozen authorized CAP-03 soil-observation binding so selection, not only classification, is proven.
# Boundary: acceptance-source transformation only; no production selector, binding matrix, Replay Evidence, Runtime, database, canonical write, calibration, Model Activation, or CAP-06 authority change.

from pathlib import Path

PATH = Path("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_REPLAY_BINDING_EXECUTION_METADATA.ts")
OLD = "soil_obs_cap05_binding_metadata_v1"
NEW = "soil_obs_c8_20cm_v1"

text = PATH.read_text()
if NEW in text and OLD not in text:
    raise SystemExit(0)
if OLD not in text:
    raise SystemExit("AUTHORIZED_BINDING_PATCH_MARKER_MISSING")
PATH.write_text(text.replace(OLD, NEW))
