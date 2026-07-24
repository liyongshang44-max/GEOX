param(
  [string]$BaseSha = "13e3e1260c70b9c2b6dd1fd6b8d57fd50fb3202e",
  [string]$AdminUrl = "postgres://postgres:postgres@127.0.0.1:5433/postgres",
  [string]$RunnerHost = "127.0.0.1",
  [int]$RunnerPort = 5433,
  [string]$PostgresContainer = "geox-v1-postgres"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$PositiveDb = "geox_mcft_cap08_s3_preflight_positive"
$NegativeDb = "geox_mcft_cap08_s3_preflight_negative"
$PositiveRunnerPassword = "cap08-s3-preflight-positive-runner-password"
$NegativeRunnerPassword = "cap08-s3-preflight-negative-runner-password"

function Invoke-Step([string]$Name, [scriptblock]$Action) {
  Write-Host "`n=== $Name ==="
  & $Action
  if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit code $LASTEXITCODE" }
}

function Remove-Database([string]$DatabaseName) {
  docker exec $PostgresContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DatabaseName' AND pid<>pg_backend_pid();" | Out-Host
  docker exec $PostgresContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DatabaseName;" | Out-Host
}

function Bootstrap-Database([string]$DatabaseName, [string]$RunnerPassword, [string]$Prefix) {
  $env:MCFT_CAP08_ADMIN_DATABASE_URL = $AdminUrl
  $env:MCFT_CAP08_TARGET_DATABASE_NAME = $DatabaseName
  $env:MCFT_CAP08_RUNNER_PASSWORD = $RunnerPassword
  $env:MCFT_CAP08_MIGRATOR_PASSWORD = "$Prefix-migrator-password"
  $env:MCFT_CAP08_LEGACY_RUNTIME_PASSWORD = "$Prefix-legacy-password"
  $env:MCFT_CANDIDATE_SHA = (git rev-parse HEAD).Trim()
  pnpm -w exec tsx scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_PLATFORM_SECURITY_BOOTSTRAP_DB.ts
  if ($LASTEXITCODE -ne 0) { throw "Bootstrap $DatabaseName failed" }
}

$InitialStatus = git status --porcelain
if ($LASTEXITCODE -ne 0) { throw "Unable to read git status" }
if ($InitialStatus) { throw "Working tree must be clean before S3 preflight" }
if ((git rev-parse HEAD).Trim() -eq $BaseSha) { throw "S3 preflight requires an implementation tree above the trusted base" }

New-Item -ItemType Directory -Force acceptance-output | Out-Null
Remove-Item acceptance-output/MCFT_CAP_08_S3_* -Force -ErrorAction SilentlyContinue

try {
  Invoke-Step "Derived development boundary" {
    $env:MCFT_BASE_SHA = $BaseSha
    node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S3_DEVELOPMENT_BOUNDARY.cjs
  }

  Invoke-Step "Server typecheck" {
    pnpm --filter @geox/server typecheck
  }

  Remove-Database $PositiveDb
  Bootstrap-Database $PositiveDb $PositiveRunnerPassword "cap08-s3-preflight-positive"
  $env:DATABASE_URL = "postgres://geox_mcft_cap08_runner_v1:$PositiveRunnerPassword@$RunnerHost`:$RunnerPort/$PositiveDb"
  $env:MCFT_CAP08_ADMIN_DATABASE_URL = "postgres://postgres:postgres@$RunnerHost`:$RunnerPort/$PositiveDb"
  $env:MCFT_CAP08_S2_G3_DESTRUCTIVE_ACCEPTANCE = "1"
  $env:MCFT_CAP08_S3_DESTRUCTIVE_ACCEPTANCE = "1"
  Invoke-Step "Fresh positive PostgreSQL run and exact completed rerun" {
    pnpm -w exec tsx scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S3_DECISION_ACTION_DB.ts
  }

  $env:MCFT_CAP08_S3_COMPLETED_RERUN_NEGATIVE_DESTRUCTIVE_ACCEPTANCE = "1"
  Invoke-Step "Completed-rerun persisted semantic corruption suite" {
    pnpm -w exec tsx scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S3_COMPLETED_RERUN_NEGATIVE_DB.ts
  }
  Remove-Database $PositiveDb

  Remove-Database $NegativeDb
  Bootstrap-Database $NegativeDb $NegativeRunnerPassword "cap08-s3-preflight-negative"
  $env:DATABASE_URL = "postgres://geox_mcft_cap08_runner_v1:$NegativeRunnerPassword@$RunnerHost`:$RunnerPort/$NegativeDb"
  $env:MCFT_CAP08_ADMIN_DATABASE_URL = "postgres://postgres:postgres@$RunnerHost`:$RunnerPort/$NegativeDb"
  $env:MCFT_CAP08_S2_G3_DESTRUCTIVE_ACCEPTANCE = "1"
  $env:MCFT_CAP08_S3_NEGATIVE_DESTRUCTIVE_ACCEPTANCE = "1"
  Invoke-Step "S3-N01 through S3-N22 and S3-P01 through S3-P06" {
    pnpm -w exec tsx scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S3_NEGATIVE_DB.ts
  }

  $env:MCFT_CAP08_S3_EDGE_DESTRUCTIVE_ACCEPTANCE = "1"
  Invoke-Step "Deferred-result and exact-pointer edge semantics" {
    pnpm -w exec tsx scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S3_EDGE_SEMANTICS_DB.ts
  }
  Remove-Database $NegativeDb

  Invoke-Step "Preflight artifact finalization" {
    node scripts/governance_acceptance/mcft_cap08_s3_preflight_finalize.cjs
  }

  $Artifact = Get-Content acceptance-output/MCFT_CAP_08_S3_PREFLIGHT_ARTIFACT.json -Raw | ConvertFrom-Json
  if ($Artifact.status -ne "PASS") { throw "S3 preflight artifact did not pass" }
  Write-Host "`nS3 PREFLIGHT PASS"
  Write-Host "implementation_head_sha=$($Artifact.implementation_head_sha)"
  Write-Host "implementation_tree_sha=$($Artifact.implementation_tree_sha)"
  Write-Host "semantic_artifact_digest=$($Artifact.semantic_artifact_digest)"
  Write-Host "formal candidate declaration remains unauthorized until clean-tree reconstruction"
}
finally {
  Remove-Database $PositiveDb
  Remove-Database $NegativeDb
  Remove-Item Env:MCFT_CAP08_S3_DESTRUCTIVE_ACCEPTANCE -ErrorAction SilentlyContinue
  Remove-Item Env:MCFT_CAP08_S3_COMPLETED_RERUN_NEGATIVE_DESTRUCTIVE_ACCEPTANCE -ErrorAction SilentlyContinue
  Remove-Item Env:MCFT_CAP08_S3_NEGATIVE_DESTRUCTIVE_ACCEPTANCE -ErrorAction SilentlyContinue
  Remove-Item Env:MCFT_CAP08_S3_EDGE_DESTRUCTIVE_ACCEPTANCE -ErrorAction SilentlyContinue
}
