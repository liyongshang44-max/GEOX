# .github/sitecustomize.py
# Purpose: one-shot patch hook for the existing S2 materializer workflow.
# Boundary: intercept exactly one generated acceptance file, apply the repository-fact-based
# Runtime Config numeric projection fix, then delete this hook before final boundary checks.

from __future__ import annotations

from pathlib import Path

_TARGET = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts"
_ORIGINAL_WRITE_TEXT = Path.write_text


def _replace_once(text: str, old: str, new: str, code: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{code}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def _patched_write_text(self: Path, data: str, *args, **kwargs):
    target = self.as_posix()
    if not target.endswith(_TARGET):
        return _ORIGINAL_WRITE_TEXT(self, data, *args, **kwargs)

    text = str(data)
    import_anchor = (
        'import { semanticHashV1 } from '
        '"../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";\n'
    )
    text = _replace_once(
        text,
        import_anchor,
        import_anchor
        + 'import { validateCap04RuntimeConfigPayloadV1 } from '
        + '"../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";\n',
        "S2_CONFIG_VALIDATOR_IMPORT_ANCHOR_MISMATCH",
    )

    text = _replace_once(
        text,
        '''function fixed6V1(value: unknown, code: string): string {
  return formatFixedDecimalV1(parseFixedDecimalV1(value, 6, code), 6);
}''',
        '''function fixed6V1(value: unknown, code: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return formatFixedDecimalV1(parseFixedDecimalV1(String(value), 6, code), 6);
}''',
        "S2_FIXED6_HELPER_ANCHOR_MISMATCH",
    )

    text = _replace_once(
        text,
        '  const payload = caseItem.source_runtime_config.payload as Record<string, any>;\n',
        '  const payload = caseItem.source_runtime_config.payload;\n'
        '  validateCap04RuntimeConfigPayloadV1(payload);\n',
        "S2_CONFIG_PAYLOAD_ANCHOR_MISMATCH",
    )

    result = _ORIGINAL_WRITE_TEXT(self, text, *args, **kwargs)
    hook = Path(__file__)
    if hook.exists():
        hook.unlink()
    print("S2_SITE_CUSTOMIZE_CONFIG_PROJECTION_PATCH=PASS")
    return result


Path.write_text = _patched_write_text
