#!/usr/bin/env python3
"""Non-mutating offline regression for the retained c1f7dcc6d04d GFS TAR.

Requires the already retained local TAR: never calls the Provider, S3, or DB.
Fail closed on incorrect SHA, tar structure, multi-message parsing or drafts.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys
import tarfile
import tempfile

EXPECTED_SHA = "0cd08bd2cd6f4c92d86ab5133f1c6cd1a04c2474e63d4bbed9619f639594830c"
CORE = pathlib.Path("apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py")
DECODER = pathlib.Path("apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_raw_bundle_decoder_v1.py")

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tar", required=True)
    p.add_argument("--report", required=True)
    p.add_argument("--expected-sha256", default=EXPECTED_SHA)
    args = p.parse_args()
    raw_path = pathlib.Path(args.tar).resolve()
    report_path = pathlib.Path(args.report).resolve()
    if report_path.exists():
        raise RuntimeError("FORENSIC_REPORT_MUST_NOT_OVERWRITE")
    sha = hashlib.sha256()
    with raw_path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            sha.update(chunk)
    if sha.hexdigest() != args.expected_sha256:
        raise RuntimeError("FORENSIC_SOURCE_SHA256_MISMATCH")
    with tarfile.open(raw_path, "r") as archive:
        manifest = json.load(archive.extractfile("manifest.json"))
        leads = range(int(manifest["support_lead"]), int(manifest["lead_end"]) + 1)
        if len(leads) != 73:
            raise RuntimeError("FORENSIC_LEAD_COUNT_NOT_73")
        import importlib.util
        spec = importlib.util.spec_from_file_location("mcft_core_forensic", CORE)
        core = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = core
        spec.loader.exec_module(core)
        counts = []
        for lead in leads:
            pgrb = archive.extractfile(f"pgrb2/f{lead:03d}.grib2").read()
            sflux = archive.extractfile(f"sflux/f{lead:03d}.grib2").read()
            count = sum(1 for _ in core.grib_messages_v1(pgrb))
            solar_count = sum(1 for _ in core.grib_messages_v1(sflux))
            if count < 1 or solar_count != 1:
                raise RuntimeError(f"FORENSIC_MESSAGE_COUNT_INVALID:F{lead:03d}")
            counts.append({"lead": lead, "pgrb2_messages": count, "sflux_messages": solar_count})
    with tempfile.TemporaryDirectory(prefix="mcft-offline-decode-") as tmp:
        out = pathlib.Path(tmp) / "drafts.json"
        command = [sys.executable, str(DECODER), "decode-bundle",
                   "--target", manifest["target_logical_time"],
                   "--available-at", manifest["retrieved_at"],
                   "--input", str(raw_path), "--output", str(out), "--normalize-et0"]
        completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
        result = {"status": "PASS" if completed.returncode == 0 else "FAIL",
                  "run_id": "c1f7dcc6d04d", "source_sha256": sha.hexdigest(),
                  "pgrb2_files": len(counts), "sflux_files": len(counts),
                  "pgrb2_message_counts": counts, "decoder_exit_code": completed.returncode,
                  "decoder_stderr": completed.stderr[-16000:],
                  "provider_requests": 0, "s3_mutations": 0, "db_mutations": 0}
        if completed.returncode == 0:
            drafts = json.loads(out.read_text(encoding="utf-8"))["drafts"]
            if [d["role"] for d in drafts] != ["FUTURE_WEATHER_ASSUMPTION", "FUTURE_ET0_ASSUMPTION"]:
                raise RuntimeError("FORENSIC_DRAFT_ROLE_MISMATCH")
            result["point_counts"] = [len(d["canonical_payload"]["points"]) for d in drafts]
            if result["point_counts"] != [72, 72]:
                raise RuntimeError("FORENSIC_72H_OUTPUT_REQUIRED")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with report_path.open("x", encoding="utf-8") as output:
            json.dump(result, output, indent=2)
        print(json.dumps({k:v for k,v in result.items() if k not in ("pgrb2_message_counts","decoder_stderr")}))
        if completed.returncode != 0:
            sys.stderr.write(completed.stderr[-16000:])
            raise SystemExit(completed.returncode)

if __name__ == "__main__":
    main()
