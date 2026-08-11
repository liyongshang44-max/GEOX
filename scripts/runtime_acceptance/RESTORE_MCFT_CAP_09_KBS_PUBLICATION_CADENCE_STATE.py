#!/usr/bin/env python3
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import zipfile
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

ROOT = Path.cwd()
CONFIG_PATH = ROOT / "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-PUBLICATION-CADENCE-OBSERVER-V1.json"
USER_AGENT = "GEOX-MCFT-CAP09-KBS-CADENCE-STATE-RESTORE/1.0"
STATE_SCHEMA = "geox_mcft_cap09_kbs_publication_cadence_state_v1"


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


class StripCrossHostAuthorizationRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is None:
            return None
        old_host = (urlparse(req.full_url).hostname or "").lower()
        new_host = (urlparse(newurl).hostname or "").lower()
        if old_host != new_host:
            redirected.remove_header("Authorization")
        return redirected


def github_json(url: str, token: str):
    req = Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": USER_AGENT,
    })
    with urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def github_artifact_bytes(url: str, token: str) -> bytes:
    parsed = urlparse(url)
    require(parsed.scheme == "https" and parsed.hostname == "api.github.com", "KBS_CADENCE_RESTORE_GITHUB_API_URL_REQUIRED")
    req = Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": USER_AGENT,
    })
    opener = build_opener(StripCrossHostAuthorizationRedirect())
    with opener.open(req, timeout=60) as response:
        final = urlparse(response.geturl())
        require(final.scheme == "https", "KBS_CADENCE_RESTORE_FINAL_HTTPS_REQUIRED")
        return response.read()


def restore(output: Path) -> dict:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    repository = os.environ.get("GITHUB_REPOSITORY", "").strip()
    current_run_id = os.environ.get("GITHUB_RUN_ID", "").strip()
    require(token and repository and current_run_id, "KBS_CADENCE_RESTORE_GITHUB_CONTEXT_REQUIRED")

    workflow_file = "mcft-cap-09-kbs-publication-cadence-observer.yml"
    params = urlencode({"branch": "main", "status": "success", "per_page": 20})
    runs_url = f"https://api.github.com/repos/{repository}/actions/workflows/{workflow_file}/runs?{params}"
    runs = github_json(runs_url, token).get("workflow_runs", [])
    prefix = config["state_chain"]["artifact_name_prefix"]
    filename = config["state_chain"]["state_filename"]

    for run in runs:
        if str(run.get("id")) == current_run_id:
            continue
        artifacts_url = f"https://api.github.com/repos/{repository}/actions/runs/{run['id']}/artifacts?per_page=100"
        artifacts = github_json(artifacts_url, token).get("artifacts", [])
        matching = [
            item for item in artifacts
            if str(item.get("name", "")).startswith(prefix) and not item.get("expired")
        ]
        if not matching:
            continue
        artifact = sorted(matching, key=lambda item: item.get("created_at", ""), reverse=True)[0]
        archive = github_artifact_bytes(artifact["archive_download_url"], token)
        with zipfile.ZipFile(io.BytesIO(archive), "r") as zipped:
            require(filename in zipped.namelist(), "KBS_CADENCE_RESTORE_STATE_FILE_REQUIRED")
            state = json.loads(zipped.read(filename).decode("utf-8"))
        require(state.get("schema_version") == STATE_SCHEMA, "KBS_CADENCE_RESTORE_STATE_SCHEMA_INVALID")
        require(state.get("source_url") == config["source"]["url"], "KBS_CADENCE_RESTORE_SOURCE_DRIFT")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return {
            "status": "PASS",
            "predecessor_found": True,
            "run_id": run["id"],
            "artifact_id": artifact["id"],
            "artifact_digest": artifact.get("digest"),
            "predecessor_polled_at": state.get("polled_at"),
            "predecessor_latest_event_time": state.get("latest_event_time"),
            "authorization_forwarded_cross_host": False,
        }

    return {
        "status": "PASS",
        "predecessor_found": False,
        "authorization_forwarded_cross_host": False,
    }


def selftest() -> dict:
    handler = StripCrossHostAuthorizationRedirect()
    source = Request(
        "https://api.github.com/repos/example/repo/actions/artifacts/1/zip",
        headers={"Authorization": "Bearer secret", "User-Agent": USER_AGENT},
    )
    cross = handler.redirect_request(
        source,
        None,
        302,
        "Found",
        {},
        "https://signed-artifact.example.net/object?sig=abc",
    )
    require(cross is not None, "SELFTEST_CROSS_REDIRECT_REQUIRED")
    require(cross.get_header("Authorization") is None, "SELFTEST_CROSS_HOST_AUTH_NOT_STRIPPED")

    same = handler.redirect_request(
        source,
        None,
        302,
        "Found",
        {},
        "https://api.github.com/repos/example/repo/actions/artifacts/1/zip?retry=1",
    )
    require(same is not None, "SELFTEST_SAME_REDIRECT_REQUIRED")
    require(same.get_header("Authorization") == "Bearer secret", "SELFTEST_SAME_HOST_AUTH_NOT_PRESERVED")

    return {
        "status": "PASS",
        "cross_host_authorization_stripped": True,
        "same_host_authorization_preserved": True,
        "raw_provider_values_emitted": False,
        "write_count": 0,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()
    if args.selftest:
        print(json.dumps(selftest(), sort_keys=True))
        return
    require(bool(args.output), "KBS_CADENCE_RESTORE_OUTPUT_REQUIRED")
    print(json.dumps(restore(Path(args.output)), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        raise
