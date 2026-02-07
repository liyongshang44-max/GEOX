#!/usr/bin/env bash  # Use env bash for portability.
# DEPLOY_GEOX_SYSTEM_COMMERCIAL_V0.sh  # File identity for audit.
# Sprint 24: Commercial system one-click deploy (v0).  # Versioned purpose.
# Contract: MUST start the whole system (Apple I–IV) and MUST NOT expose single-layer start switches.  # Non-splittable entry.
# Safety: MUST NOT execute AO actions; only starts services and validates health endpoints.  # Default-safe deploy.

set -euo pipefail  # Fail fast, treat unset vars as errors, and fail on pipeline errors.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"  # Resolve repo root (scripts/..).

require_cmd() {  # Helper: require a command to exist.
  command -v "$1" >/dev/null 2>&1 || { echo "[FAIL] Missing command: $1" >&2; exit 1; }  # Exit if missing.
}  # End require_cmd.

info() { echo "[INFO] $1"; }  # Info log helper.
ok() { echo "[OK]   $1"; }  # Success log helper.
fail() { echo "[FAIL] $1" >&2; exit 1; }  # Fail helper.

require_cmd docker  # Docker is required.

compose_cmd=(docker compose)  # Prefer `docker compose`.
if ! docker compose version >/dev/null 2>&1; then  # Probe docker compose.
  if command -v docker-compose >/dev/null 2>&1; then  # Check legacy binary.
    compose_cmd=(docker-compose)  # Use legacy binary.
  else  # No compose available.
    fail "Docker Compose not available (need docker compose or docker-compose)"  # Hard fail.
  fi  # End compose check.
fi  # End compose probe.

base_url="http://127.0.0.1:3000"  # Commercial default backend base URL.
health_url="${base_url}/api/health"  # Backend health endpoint.
admin_healthz_url="${base_url}/api/admin/healthz"  # Backend DB+bootstrap health endpoint.

compose_files=(  # Compose file stack.
  -f "${repo_root}/docker-compose.yml"  # Base services.
  -f "${repo_root}/docker-compose.delivery.yml"  # Delivery overlay.
  -f "${repo_root}/docker-compose.commercial_v0.yml"  # Commercial overlay.
)  # End compose_files.

info "repoRoot=${repo_root}"  # Print repo root.
info "compose=${compose_cmd[*]}"  # Print compose command.

(  # Subshell to run compose from repo root.
  cd "${repo_root}"  # Ensure relative volume mounts resolve correctly.
  "${compose_cmd[@]}" "${compose_files[@]}" up -d --remove-orphans --force-recreate  # Start whole system.
)  # End compose run.

info "Waiting for ${health_url}"  # Log wait.
for i in {1..180}; do  # Wait up to ~90s (180 * 0.5s).
  if curl -fsS "${health_url}" >/dev/null 2>&1; then break; fi  # Break when health is 2xx.
  sleep 0.5  # Backoff.
  if [[ "$i" -eq 180 ]]; then fail "Timeout waiting for /api/health"; fi  # Timeout failure.
done  # End wait loop.

info "Waiting for ${admin_healthz_url} (ok=true)"  # Log wait.
for i in {1..200}; do  # Wait up to ~150s (200 * 0.75s).
  if curl -fsS "${admin_healthz_url}" | grep -q '"ok":true'; then break; fi  # Require ok=true.
  sleep 0.75  # Backoff.
  if [[ "$i" -eq 200 ]]; then fail "Timeout waiting for /api/admin/healthz ok=true"; fi  # Timeout failure.
done  # End wait loop.

compose_hash_base="$(sha256sum "${repo_root}/docker-compose.yml" | awk '{print $1}')"  # Hash base compose for fingerprint.
compose_hash_delivery="$(sha256sum "${repo_root}/docker-compose.delivery.yml" | awk '{print $1}')"  # Hash delivery compose for fingerprint.
compose_hash_commercial="$(sha256sum "${repo_root}/docker-compose.commercial_v0.yml" | awk '{print $1}')"  # Hash commercial compose for fingerprint.

git_commit="$(cd "${repo_root}" && git rev-parse HEAD 2>/dev/null || echo "NO_GIT")"  # Resolve git commit if available.

ok "System up: backend=${base_url} web=http://127.0.0.1:5173"  # Print endpoints.
ok "Fingerprint: commit=${git_commit} compose_base=${compose_hash_base} compose_delivery=${compose_hash_delivery} compose_commercial=${compose_hash_commercial}"  # Print fingerprint.