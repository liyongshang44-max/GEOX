# scripts/remediation/APPLY_MCFT_CAP_05_FORMAL_REPLAY_BINDING_AUTHORITY.py
# Purpose: align the formal CAP-05 PostgreSQL regression runner input with the frozen binding IDs carried by the canonical Replay weather and ET0 records.
# Boundary: acceptance-source transformation only; no production selector change, fallback relaxation, Replay fixture mutation, database access, canonical write, Model Activation, calibration, or CAP-06 authority.

from pathlib import Path


PATH = Path("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.ts")
OLD = 'authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],'
NEW = (
    'authorized_future_forcing_binding_ids: '
    '["weather_assumption_c8_replay_v1", "et0_future_assumption_c8_v1"],'
)

text = PATH.read_text()
if NEW in text:
    raise SystemExit(0)
if text.count(OLD) != 1:
    raise SystemExit(f"FORMAL_REPLAY_BINDING_AUTHORITY_MARKER_COUNT:{text.count(OLD)}")
PATH.write_text(text.replace(OLD, NEW, 1))
