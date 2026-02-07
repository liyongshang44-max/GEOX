# DEPLOY_GEOX_SYSTEM_COMMERCIAL_V0.ps1  # File identity for audit.
# Sprint 24: Commercial system one-click deploy (v0).  # Versioned purpose.
# Contract: This script MUST start the whole system (Apple I–IV) and MUST NOT expose single-layer start switches.  # Non-splittable entry.
# Safety: This script MUST NOT execute AO actions; it only starts services and validates health.  # No execution semantics.

$ErrorActionPreference = "Stop"  # Fail fast on any unhandled error.

function Info([string]$m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }  # Info log helper.
function Ok([string]$m){ Write-Host "[OK]   $m" -ForegroundColor Green }  # Success log helper.
function Fail([string]$m){ Write-Host "[FAIL] $m" -ForegroundColor Red; throw $m }  # Fail log helper + throw.

function Require-Command([string]$name){  # Enforce required external commands.
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { Fail "Missing command: $name" }  # Hard fail if command is absent.
}  # End Require-Command.

function Find-RepoRoot([string]$startDir) {  # Locate repo root by sentinel files.
  $p = (Resolve-Path $startDir).Path  # Resolve starting directory to absolute path.
  while ($true) {  # Walk up until we find the root.
    $hasPkg  = Test-Path (Join-Path $p "package.json")  # Root sentinel: package.json.
    $hasApps = Test-Path (Join-Path $p "apps")  # Root sentinel: apps directory.
    $hasTs   = Test-Path (Join-Path $p "tsconfig.json")  # Root sentinel: tsconfig.json.
    if ($hasPkg -and $hasApps -and $hasTs) { return $p }  # Return repo root if all sentinels exist.
    $parent = Split-Path $p -Parent  # Compute parent directory.
    if ($parent -eq $p) { Fail "Cannot find GEOX repo root from startDir=$startDir" }  # Stop at filesystem root.
    $p = $parent  # Continue walking upward.
  }  # End while.
}  # End Find-RepoRoot.

function Wait-HttpOk([string]$url, [int]$timeoutSec = 90){  # Wait until HTTP 2xx is returned.
  $start = Get-Date  # Record start time.
  while ($true){  # Poll loop.
    try {  # Best-effort request.
      $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 3  # Request URL with short timeout.
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { return $true }  # Succeed on any 2xx.
    } catch {  # Ignore transient failures.
      Start-Sleep -Milliseconds 500  # Backoff before retry.
    }  # End try/catch.
    if (((Get-Date) - $start).TotalSeconds -gt $timeoutSec) { return $false }  # Fail after timeout.
  }  # End while.
}  # End Wait-HttpOk.

function Wait-AdminHealthzOk([string]$url, [int]$timeoutSec = 120){  # Wait until /api/admin/healthz returns ok=true.
  $start = Get-Date  # Record start time.
  while ($true){  # Poll loop.
    try {  # Best-effort JSON request.
      $r = Invoke-RestMethod -Method Get -Uri $url -TimeoutSec 5  # Request JSON endpoint.
      if ($null -ne $r -and ($r.PSObject.Properties.Name -contains "ok") -and ($r.ok -eq $true)) { return $true }  # Succeed only on ok=true.
    } catch {  # Ignore transient failures.
      Start-Sleep -Milliseconds 750  # Backoff before retry.
    }  # End try/catch.
    if (((Get-Date) - $start).TotalSeconds -gt $timeoutSec) { return $false }  # Fail after timeout.
  }  # End while.
}  # End Wait-AdminHealthzOk.

function Sha256-File([string]$path){  # Compute SHA-256 of a file for fingerprint output.
  if (-not (Test-Path $path)) { return "" }  # Return empty hash if file does not exist.
  $h = Get-FileHash -Algorithm SHA256 -Path $path  # Compute SHA-256 via built-in cmdlet.
  return ($h.Hash.ToLowerInvariant())  # Normalize to lowercase hex string.
}  # End Sha256-File.

# -------------------------  # Section divider.
# Resolve repo root  # Human explanation.
# -------------------------  # Section divider.
$repoRoot = Find-RepoRoot $PSScriptRoot  # Derive repo root from script location.

# -------------------------  # Section divider.
# Preconditions  # Human explanation.
# -------------------------  # Section divider.
Require-Command "docker"  # Require Docker CLI.
Require-Command "docker"  # Keep explicit: docker is required (compose is subcommand in newer installs).

# NOTE: Docker Compose may exist as `docker compose` (preferred) or `docker-compose` (legacy).  # Compatibility note.
$composeCmd = "docker compose"  # Default to modern docker compose subcommand.
try {  # Probe whether docker compose works.
  docker compose version | Out-Null  # Try calling docker compose.
} catch {  # Fall back to legacy docker-compose if needed.
  if (Get-Command "docker-compose" -ErrorAction SilentlyContinue) { $composeCmd = "docker-compose" } else { Fail "Docker Compose not available (need docker compose or docker-compose)" }  # Choose fallback or fail.
}  # End compose probe.

$baseUrl = "http://127.0.0.1:3000"  # Commercial default backend base URL.
$healthUrl = "$baseUrl/api/health"  # Backend health URL.
$adminHealthzUrl = "$baseUrl/api/admin/healthz"  # Backend DB/bootstrap health URL.

Info "repoRoot=$repoRoot"  # Print repo root.
Info "composeCmd=$composeCmd"  # Print compose command used.
Info "profile=commercial_v0 (execution default-disabled)"  # Declare commercial profile (enforcement in code comes later).

# -------------------------  # Section divider.
# Pre-clean known container name conflicts (legacy runs)  # Human explanation.
# -------------------------  # Section divider.
Info "Pre-clean: removing legacy container name conflict if present (geox-web)"  # Explain why we might delete a leftover container.
try {  # Best-effort cleanup; do not fail if container does not exist.
  $legacyWebRaw = (docker ps -a --filter "name=^/geox-web$" --format "{{.Names}}" 2>$null)  # Detect an exact-name container called geox-web (may be empty).
  $legacyWeb = ($legacyWebRaw -as [string]).Trim()  # Normalize (empty -> "").
  if ($legacyWeb -eq "geox-web") {  # If present, remove it to avoid docker name conflicts.
    Info "Removing legacy container: geox-web"  # Log the destructive action for audit.
    docker rm -f geox-web | Out-Null  # Force remove the container (safe: it is a derived artifact).
  }  # End if.
} catch {  # Ignore cleanup errors (e.g., docker not ready) because compose up will fail anyway.
  Info "Pre-clean skipped (non-fatal): $($_.Exception.Message)"  # Emit reason but continue.
}  # End try/catch.


# -------------------------  # Section divider.
# Compose up (whole system only)  # Human explanation.
# -------------------------  # Section divider.
$composeA = Join-Path $repoRoot "docker-compose.yml"  # Base compose file path.
$composeB = Join-Path $repoRoot "docker-compose.delivery.yml"  # Delivery overlay path.
$composeC = Join-Path $repoRoot "docker-compose.commercial_v0.yml"  # Commercial overlay path.

if (-not (Test-Path $composeC)) { Fail "Missing commercial overlay: $composeC" }  # Ensure overlay exists.

$cmdLine = "$composeCmd -f `"$composeA`" -f `"$composeB`" -f `"$composeC`" up -d --remove-orphans --force-recreate"  # Compose command string.
Info "RUN: $cmdLine"  # Log the exact command for audit.

Push-Location $repoRoot  # Change directory to repo root for relative mounts.
try {  # Run compose.
  if ($composeCmd -eq "docker-compose") {  # Legacy docker-compose branch.
    docker-compose -f $composeA -f $composeB -f $composeC up -d --remove-orphans --force-recreate  # Start services (do not suppress output).
    if ($LASTEXITCODE -ne 0) { Fail "docker-compose up failed with exit code $LASTEXITCODE" }  # Fail fast on compose error.
  } else {  # Modern docker compose branch.
    docker compose -f $composeA -f $composeB -f $composeC up -d --remove-orphans --force-recreate  # Start services (do not suppress output).
    if ($LASTEXITCODE -ne 0) { Fail "docker compose up failed with exit code $LASTEXITCODE" }  # Fail fast on compose error.
  }  # End branch.
} finally {  # Always restore working directory.
  Pop-Location  # Restore previous directory.
}  # End try/finally.

# -------------------------  # Section divider.
# Wait for readiness  # Human explanation.
# -------------------------  # Section divider.
Info "Waiting for backend health: $healthUrl"  # Log wait target.
if (-not (Wait-HttpOk $healthUrl 120)) {  # Fail if not ready.
  Info "Diagnostics: backend health timed out; dumping geox-server logs (tail=200)."  # Explain diagnostic action.
  try { docker logs --tail 200 geox-server 2>$null | ForEach-Object { Write-Host "[geox-server] $_" } } catch { Info "Diagnostics skipped: $($_.Exception.Message)" }  # Best-effort server logs.
  try { docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | ForEach-Object { Write-Host "[docker-ps] $_" } } catch { }  # Best-effort container status snapshot.
  Fail "Backend health check timed out: $healthUrl"  # Hard fail after diagnostics.
}
Ok "Backend /api/health OK"  # Confirm backend HTTP readiness.

Info "Waiting for admin healthz (DB/bootstrap): $adminHealthzUrl"  # Log wait target.
if (-not (Wait-AdminHealthzOk $adminHealthzUrl 180)) { Fail "Admin healthz timed out or not ok=true: $adminHealthzUrl" }  # Fail if DB/bootstrap not ready.
Ok "Backend /api/admin/healthz ok=true"  # Confirm DB/bootstrap readiness.

# -------------------------  # Section divider.
# Emit minimal system fingerprint (temporary; replaced by Manifest in Task 4)  # Human explanation.
# -------------------------  # Section divider.
$commit = ""  # Placeholder for git commit.
try { $commit = (git -C $repoRoot rev-parse HEAD 2>$null).Trim() } catch { $commit = "(git unavailable)" }  # Best-effort commit detection.
$hA = Sha256-File $composeA  # Hash base compose.
$hB = Sha256-File $composeB  # Hash delivery overlay.
$hC = Sha256-File $composeC  # Hash commercial overlay.

Info "fingerprint.git_commit=$commit"  # Emit commit.
Info "fingerprint.compose.docker-compose.yml.sha256=$hA"  # Emit compose hash.
Info "fingerprint.compose.docker-compose.delivery.yml.sha256=$hB"  # Emit overlay hash.
Info "fingerprint.compose.docker-compose.commercial_v0.yml.sha256=$hC"  # Emit commercial overlay hash.

Ok "Commercial system deploy v0 completed (services up, health OK)."  # Final success message.
