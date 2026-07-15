# scripts/remediation/APPLY_MCFT_CAP_05_TERMINAL_CHAIN_VALIDATORS.py
# Purpose: make the formal CAP-05 terminal-chain regression validate continuation members with semantic member hashes and the CAP-04 Forecast contract instead of the CAP-01 A0-only canonical validator.
# Boundary: acceptance-source transformation only; no production contract relaxation, persistence change, Runtime execution change, canonical write, calibration, Model Activation, or CAP-06 authority.

from pathlib import Path


PATH = Path("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.ts")


def replace_once(text: str, old: str, new: str) -> str:
    if new in text:
        return text
    if text.count(old) != 1:
        raise SystemExit(f"TERMINAL_VALIDATOR_MARKER_COUNT:{text.count(old)}:{old[:80]}")
    return text.replace(old, new, 1)


text = PATH.read_text()
text = replace_once(
    text,
    'import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";',
    'import { computeMemberDeterminismHashV1, semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";\n'
    'import { validateCap04ForecastRunPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";',
)
text = replace_once(
    text,
    '''  for (const object of [...states, ...checkpoints, ...forecasts]) {
    validateCanonicalObjectV1(object);
    assert.equal(typeof object.runtime_config_ref, "string", `${object.object_type}:RUNTIME_CONFIG_REF_REQUIRED`);''',
    '''  for (const object of [...states, ...checkpoints, ...forecasts]) {
    assert.equal(
      computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>),
      object.determinism_hash,
      `${object.object_type}:SEMANTIC_HASH_MISMATCH`,
    );
    assert.equal(typeof object.runtime_config_ref, "string", `${object.object_type}:RUNTIME_CONFIG_REF_REQUIRED`);''',
)
text = replace_once(
    text,
    '''  for (const forecast of forecasts) {
    assert.equal(forecast.payload.status, "COMPLETED");''',
    '''  for (const forecast of forecasts) {
    validateCap04ForecastRunPayloadV1(forecast.payload as any);
    assert.equal(forecast.payload.status, "COMPLETED");''',
)
PATH.write_text(text)
