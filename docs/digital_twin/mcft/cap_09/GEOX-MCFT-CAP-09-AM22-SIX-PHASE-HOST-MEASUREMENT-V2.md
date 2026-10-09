# Six-phase host measurement — bounded qualification collection

The entry executes six ordered operations on the actual Windows/Docker host, using the actual candidate main/image, adopted current-crop bytes, already-visible real source facts and retained raw GET, live existing owner renewal, the real Formal-v5 schema/ACL/whole-store readback, and an independent localhost qualification database. It never stops or replaces production Evidence/Twin, writes Formal-v5, PUTs formal raw, calls bootstrap commit, issues a certificate, or authorizes ARM/A0.

The outer CJS entry enforces a ten-minute overall collection timeout; individual SQL and native commands are bounded. Partial execution preserves STARTED/failed records and cannot be retried in the same directory/database. Trace, each phase's evidence, source fact/raw identities, exact main/image/profile, and monotonic durations are immutable. Credentials remain environment-only. No child command or effective policy may be supplied in the input.

| Phase | Actual operation |
| --- | --- |
| Exact main/image/owner | Fetch and require clean current main; inspect immutable candidate image; preserve existing two production containers; reobserve their actual deployed-image T1/T2 owner proof |
| Fresh stage/causal seed | Require source-adopted registry digest, current R6/independent lifecycle and full 25-context coverage; require exact A0 same-cycle GFS pair and selected soil already visible at database now; verify retained raw bytes/provenance through GET |
| Manifest/promotion preparation | Use existing Formal-v5 manifest/config builders for 25 contexts and bind exact real source fact identities; do not perform formal raw PUT or promotion |
| Schema/ACL/pristine | Read all 29 Formal tables and two routine principal boundaries; materialize existing schema/ACL only in a distinct localhost database |
| Handoff/fencing | Emit a non-authoritative future epoch handoff plan; acquire/renew actual isolated PostgreSQL lease, prove conflicting owner rejected and fencing advances |
| A0 prewrite | Call the frozen bootstrap service with actual source evidence and real isolated config/reality persistence; capture its prepared A0 write set before the commit port; prove six projection surfaces remain zero; release isolated lease through owner/token CAS; reverify unchanged production containers and Formal zero state |

## Deliberate admission boundary

This collection closes the missing *measurement entry*, not the initial complete production-equivalence qualification. Production Docker owner activation latency, formal raw PUT, redecoding/retention and formal promotion latency remain unmeasured. The trace names these limitations and uses `geox_mcft_cap09_six_phase_host_measurement_trace_v2`, which the existing complete-production envelope verifier rejects. There is no conversion to a complete envelope, signed certificate or true qualification flag. Independent qualification must resolve those exact residuals with actual governed observations before production admission. A numerical margin alone cannot resolve missing workload.

The local PostgreSQL prewrite probe is separately covered inside the existing isolated A0→O00 regression. Controlled CI fixtures cannot be reported as an actual host trace. The production policy, public trust key, retired ARM guard, frozen Runtime, schema, provider and principal boundaries remain unchanged.

## Host inputs and prerequisites

Use the exact protected main after this candidate is adopted, build its image, and choose a *measurement-only* future A0 hour covered through A0+24h by the newly graduated registry authority. Input JSON permits only `subject_sha`, `image_id`, `stage_ref`, `a0_planning_time`.

Restore the previously DPAPI-saved host environment; preserve the actual deployed-image attestation path and durable log path. Add `GEOX_MCFT_CAP09_MEASUREMENT_DATABASE_URL` pointing to a fresh `am22_measure_<12 lowercase hex>` database on localhost. Run the CJS entry with `--operator-authorized --input=<file> --out=<new directory>`. Local qualification resources and immutable receipts remain for readback; cleanup must target only that explicitly named qualification container.

Fresh authority must come from an actual rolling workflow run at/after the new 04Z snapshot boundary, successful scientific and persistent-lifecycle qualification, then protected-main graduation/registry adoption. The 30-hour validity is unchanged. Candidate artifacts, an older snapshot, future timestamps and hand-entered R6 are inadmissible. Full 24T coverage is checked again at collection database time; this entry does not freeze a production epoch.

## Windows entry after adoption and fresh authority

Run this whole block in the existing PowerShell session containing the restored credentials. It deliberately fails before creating a measurement database if current main lacks this entry or the registry lacks an adopted authority covering the next measurement A0 through A0+24h. An image build happens before timing; image preparation remains a separate measurement. The six-phase collector cannot qualify unmeasured production cutover/raw promotion. This command does not issue an execution certificate or activate the start policy.

```powershell
& {
    $ErrorActionPreference = "Stop"
    function Invoke-Cap09MeasureNative {
        param([string]$Program, [string[]]$Arguments)
        & $Program @Arguments
        if ($LASTEXITCODE -ne 0) { throw "Measurement prerequisite or operation failed; no A0 authorized." }
    }
    foreach ($Cap09MeasureAlias in @("EVIDENCE_RUNTIME_DATABASE_URL", "TWIN_RUNTIME_DATABASE_URL")) {
        if (-not [Environment]::GetEnvironmentVariable($Cap09MeasureAlias, "Process")) {
            [Environment]::SetEnvironmentVariable($Cap09MeasureAlias, [Environment]::GetEnvironmentVariable("GEOX_MCFT_CAP09_$Cap09MeasureAlias", "Process"), "Process")
        }
    }
    $Cap09MeasureRequired = @(
        "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL",
        "GEOX_MCFT_CAP09_FORMAL_V5_ADMIN_DATABASE_URL",
        "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT",
        "GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET",
        "GEOX_MCFT_CAP09_EVIDENCE_S3_REGION",
        "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID",
        "GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY",
        "GEOX_MCFT_CAP09_DURABLE_LOG_ROOT",
        "EVIDENCE_RUNTIME_DATABASE_URL", "TWIN_RUNTIME_DATABASE_URL"
    )
    $Cap09MeasureMissing = @($Cap09MeasureRequired | Where-Object {
        -not [Environment]::GetEnvironmentVariable($_, "Process")
    })
    if ($Cap09MeasureMissing.Count) { throw "Missing configuration names: $($Cap09MeasureMissing -join ', ')" }
    if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
        if (-not (Test-Path "D:\pdsl\bin\psql.exe")) { throw "psql binary not found." }
        $env:PATH = "D:\pdsl\bin;$env:PATH"
    }
    $Cap09MeasureAttestation = Join-Path $HOME "AppData\Local\Temp\geox-mcft-cap09-a60aa685-fresh\acceptance-output\MCFT_CAP_09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_V1_RESULT.json"
    if (-not $env:GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_PATH) {
        if (-not (Test-Path $Cap09MeasureAttestation)) { throw "Preserved deployed-image attestation not found." }
        $env:GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_PATH = $Cap09MeasureAttestation
    }
    $Cap09MeasureGitIndex = 0
    if ($env:GIT_CONFIG_COUNT) { $Cap09MeasureGitIndex = [int]$env:GIT_CONFIG_COUNT }
    foreach ($Cap09MeasureOption in @(
        @{ Key="http.version"; Value="HTTP/1.1" },
        @{ Key="http.sslBackend"; Value="openssl" },
        @{ Key="http.sslVerify"; Value="true" }
    )) {
        [Environment]::SetEnvironmentVariable("GIT_CONFIG_KEY_$Cap09MeasureGitIndex", $Cap09MeasureOption.Key, "Process")
        [Environment]::SetEnvironmentVariable("GIT_CONFIG_VALUE_$Cap09MeasureGitIndex", $Cap09MeasureOption.Value, "Process")
        $Cap09MeasureGitIndex++
    }
    $env:GIT_CONFIG_COUNT = "$Cap09MeasureGitIndex"
    Invoke-Cap09MeasureNative git @("fetch", "--no-tags", "origin", "main")
    $Cap09MeasureSha = (& git rev-parse origin/main).Trim()
    if ($LASTEXITCODE -ne 0 -or $Cap09MeasureSha -notmatch '^[a-f0-9]{40}$') { throw "Current main identity unavailable." }
    $Cap09MeasureSuffix = [Guid]::NewGuid().ToString("N").Substring(0,12)
    $Cap09MeasureWorktree = Join-Path $env:TEMP "geox-cap09-measure-$Cap09MeasureSuffix"
    $Cap09MeasureRoot = Join-Path $HOME ".geox\mcft-cap09\preparation-measurements\six-phase-$Cap09MeasureSuffix"
    Invoke-Cap09MeasureNative git @("worktree", "add", "--detach", $Cap09MeasureWorktree, $Cap09MeasureSha)
    Push-Location $Cap09MeasureWorktree
    try {
        if (-not (Test-Path "scripts/runtime_acceptance/MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs")) { throw "Six-phase entry has not been adopted on current main." }
        $Cap09MeasureWindowCode = @'
const fs=require('fs'),m=require('./scripts/runtime_acceptance/MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs');
const registry=JSON.parse(fs.readFileSync('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json','utf8'));
const now=Date.now();let a0=Math.ceil(now/3600000)*3600000;if(a0-now<m.TIMEOUT_MS)a0+=3600000;
const entry=registry.entries.filter(x=>Date.parse(x.authority_as_of)<=now&&Date.parse(x.authority_valid_until)>=a0+24*3600000).sort((a,b)=>Date.parse(b.authority_as_of)-Date.parse(a.authority_as_of))[0];
if(!entry)throw Error('FRESH_ADOPTED_FULL_24T_AUTHORITY_REQUIRED');
m.stageCoverage(JSON.parse(fs.readFileSync(entry.authority_ref,'utf8')),new Date(a0).toISOString(),new Date(now).toISOString());
process.stdout.write(JSON.stringify({stage_ref:entry.authority_ref,a0_planning_time:new Date(a0).toISOString()}));
'@
        $Cap09MeasureWindowJson = & node -e $Cap09MeasureWindowCode
        if ($LASTEXITCODE -ne 0) { throw "Fresh full-24T authority prerequisite failed." }
        $Cap09MeasureWindow = ($Cap09MeasureWindowJson -join "`n") | ConvertFrom-Json
        Invoke-Cap09MeasureNative pnpm @("install", "--frozen-lockfile")
        Invoke-Cap09MeasureNative docker @("build", "--progress=plain", "-f", "docker/mcft-cap09-runtime.Dockerfile", "-t", "geox-mcft-cap09-runtime:$Cap09MeasureSha", ".")
        $Cap09MeasureImage = (& docker image inspect --format '{{.Id}}' "geox-mcft-cap09-runtime:$Cap09MeasureSha").Trim()
        if ($LASTEXITCODE -ne 0 -or $Cap09MeasureImage -notmatch '^sha256:[a-f0-9]{64}$') { throw "Immutable image unavailable." }
        # Recompute the measurement-only window after the possibly slow image build.
        $Cap09MeasureWindowJson = & node -e $Cap09MeasureWindowCode
        if ($LASTEXITCODE -ne 0) { throw "Authority no longer covers a complete fresh measurement window." }
        $Cap09MeasureWindow = ($Cap09MeasureWindowJson -join "`n") | ConvertFrom-Json
        New-Item -ItemType Directory -Path $Cap09MeasureRoot | Out-Null
        $Cap09MeasureDb = "am22_measure_$Cap09MeasureSuffix"
        $Cap09MeasureContainer = "geox-am22-measure-$Cap09MeasureSuffix"
        $Cap09MeasurePassword = [Guid]::NewGuid().ToString("N")
        Invoke-Cap09MeasureNative docker @("run", "--detach", "--name", $Cap09MeasureContainer, "--label", "geox.am22.qualification=$Cap09MeasureSuffix", "--publish", "127.0.0.1::5432", "--env", "POSTGRES_DB=$Cap09MeasureDb", "--env", "POSTGRES_PASSWORD=$Cap09MeasurePassword", "postgres:16")
        $Cap09MeasureReady = $false
        for ($Cap09MeasureAttempt=0; $Cap09MeasureAttempt -lt 30; $Cap09MeasureAttempt++) {
            & docker exec $Cap09MeasureContainer pg_isready -U postgres -d $Cap09MeasureDb *> $null
            if ($LASTEXITCODE -eq 0) { $Cap09MeasureReady=$true; break }
            Start-Sleep -Seconds 1
        }
        if (-not $Cap09MeasureReady) { throw "Isolated measurement PostgreSQL is not ready." }
        $Cap09MeasurePort = (& docker port $Cap09MeasureContainer 5432/tcp).Trim()
        if ($LASTEXITCODE -ne 0 -or $Cap09MeasurePort -notmatch '^127\.0\.0\.1:(\d+)$') { throw "Local-only qualification port required." }
        $env:GEOX_MCFT_CAP09_MEASUREMENT_DATABASE_URL = "postgresql://postgres:$Cap09MeasurePassword@127.0.0.1:$($Matches[1])/$Cap09MeasureDb"
        $Cap09MeasureInput = Join-Path $Cap09MeasureRoot "input.json"
        [IO.File]::WriteAllText($Cap09MeasureInput, (@{
            subject_sha=$Cap09MeasureSha; image_id=$Cap09MeasureImage
            stage_ref=$Cap09MeasureWindow.stage_ref; a0_planning_time=$Cap09MeasureWindow.a0_planning_time
        } | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
        Write-Host "Qualification container: $Cap09MeasureContainer"
        Write-Host "Immutable receipts: $Cap09MeasureRoot"
        Invoke-Cap09MeasureNative node @("scripts/runtime_acceptance/MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs", "--operator-authorized", "--input=$Cap09MeasureInput", "--out=$(Join-Path $Cap09MeasureRoot 'collection')")
    } finally {
        Pop-Location
        Remove-Variable Cap09MeasurePassword -ErrorAction SilentlyContinue
    }
}
```

The wrapper is provided for Windows host execution, not claimed as a measured host result. Do not retry a partial receipt directory or qualification database. Keep its named container for evidence readback. The preserved Compose production project is never a cleanup target. Paste only `summary.json` or `failed.json` and the phase label; credentials, raw objects, complete database URLs and private keys are not needed for diagnosis.
