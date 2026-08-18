#!/usr/bin/env python3
from importlib.metadata import version

EXPECTED = {
    "eccodes": "2.47.0",
    "eccodeslib": "2.47.3.23",
    "numpy": "1.26.4",
    "refet": "0.4.2",
}

import eccodes  # noqa: E402
from eccodes import codes_get, codes_grib_new_from_file, codes_release  # noqa: E402,F401
import numpy  # noqa: E402,F401
import refet  # noqa: E402,F401

actual = {name: version(name) for name in EXPECTED}
if actual != EXPECTED:
    raise SystemExit(f"MCFT_CAP09_GFS_DECODER_STACK_DRIFT:{actual}")

required_symbols = ["codes_get", "codes_grib_new_from_file", "codes_release"]
missing = [name for name in required_symbols if not hasattr(eccodes, name)]
if missing:
    raise SystemExit(f"MCFT_CAP09_ECCODES_SYMBOLS_MISSING:{','.join(missing)}")

print({
    "status": "PASS",
    "decoder_stack": actual,
    "production_provider_import_smoke": True,
    "provider_request_count": 0,
    "database_write_count": 0,
    "formal_effect": False,
})
