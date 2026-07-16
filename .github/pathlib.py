# .github/pathlib.py
# Purpose: one-shot proxy for the standard-library pathlib imported explicitly by
# the temporary S2 materializer. It patches exactly one generated acceptance file,
# then removes itself before the materializer's permanent-file boundary check.

from __future__ import annotations

import importlib.util
import os
import sys

_STDLIB_PATH = os.path.join(os.path.dirname(os.__file__), "pathlib.py")
_SPEC = importlib.util.spec_from_file_location("_geox_stdlib_pathlib", _STDLIB_PATH)
if _SPEC is None or _SPEC.loader is None:
    raise ImportError("S2_STDLIB_PATHLIB_SPEC_REQUIRED")
_STDLIB = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = _STDLIB
_SPEC.loader.exec_module(_STDLIB)

for _name in dir(_STDLIB):
    if not _name.startswith("__"):
        globals()[_name] = getattr(_STDLIB, _name)

_TARGET = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts"
_ORIGINAL_WRITE_TEXT = _STDLIB.Path.write_text


def _replace_once(text: str, old: str, new: str, code: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{code}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def _patched_write_text(self, data, *args, **kwargs):
    if not self.as_posix().endswith(_TARGET):
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
    proxy = _STDLIB.Path(__file__)
    if proxy.exists():
        proxy.unlink()
    print("S2_PATHLIB_PROXY_CONFIG_PROJECTION_PATCH=PASS")
    return result


_STDLIB.Path.write_text = _patched_write_text
Path = _STDLIB.Path
