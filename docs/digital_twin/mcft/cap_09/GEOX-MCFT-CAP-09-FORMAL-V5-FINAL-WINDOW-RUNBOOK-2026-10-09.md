# GEOX MCFT CAP-09 — Formal-v5 Final Real-Clock Window Operator Runbook

Status: **PREPARED / OFF-MAIN / NON-EFFECTFUL**

Design/readback base:

```text
0e4cd036fdbebfe8118d6b7c1978572859d5a652
```

Target epoch:

```text
Fresh DT02/A18 boundary = 2026-10-09T04:00:00.000Z
A0                      = 2026-10-09T05:00:00.000Z
O00                     = 2026-10-09T06:00:00.000Z
O23                     = 2026-10-10T05:00:00.000Z
```

This runbook does not authorize an action merely by containing its command.
Effectful commands are explicitly marked. During preparation on 2026-10-07:

- DO NOT merge;
- DO NOT deploy/recreate production containers;
- DO NOT mutate Runtime;
- DO NOT mutate the Formal-v5 database;
- DO NOT change schema/ACL;
- DO NOT execute A0;
- DO NOT start O00.

The final-window operator must stop on the first failed gate.

---

## 0. Frozen identities and paths

PowerShell, from a clean GEOX repository:

```powershell
$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($Tool in @("git","gh","node","pnpm","psql","docker")) {
  if ($null -eq (Get-Command $Tool -ErrorAction SilentlyContinue)) {
    throw "REQUIRED_TOOL_NOT_FOUND:$Tool"
  }
}

$Repo = "liyongshang44-max/GEOX"
$ArmSubject = "0e4cd036fdbebfe8118d6b7c1978572859d5a652"
$A0  = "2026-10-09T05:00:00.000Z"
$O00 = "2026-10-09T06:00:00.000Z"
$O23 = "2026-10-10T05:00:00.000Z"
$FreshBoundary = "2026-10-09T04:00:00.000Z"

$Cap09Dir = "docs/digital_twin/mcft/cap_09"
$Registry = "$Cap09Dir/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json"
$Cert = "$Cap09Dir/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json"
$PreviousAuthority = "$Cap09Dir/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-06T04Z-V1.json"
$TargetAuthority = "$Cap09Dir/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-09T04Z-V1.json"

$FormalRoot = Join-Path $HOME ".geox/mcft-cap09/formal-v5"
$WindowRoot = Join-Path $FormalRoot "final-window-20261009"
New-Item -ItemType Directory -Force $WindowRoot | Out-Null

$CandidateDir = Join-Path $WindowRoot "rolling-candidate"
$ArtifactZip = Join-Path $WindowRoot "rolling-candidate-artifact.zip"
$RequestPath = Join-Path $WindowRoot "current-crop-refresh-request-20261009.json"
$ContinuityPath = Join-Path $FormalRoot "post-arm-authority-continuity-v1.json"
$BootstrapContinuityPath = Join-Path $FormalRoot "post-arm-authority-continuity-bootstrap-v1.json"

# IMPORTANT: current successful re-arm artifacts. Do not use runner defaults.
$ArmPath = Join-Path $FormalRoot "arm-rearm-0e4cd036-v1.json"
$SchemaProofPath = Join-Path $FormalRoot "schema-acl-revalidation-0e4cd036-v1.json"
$PromotionPath = Join-Path $FormalRoot "a0-production-replay-promotion-v1.json"
$ManifestPath = Join-Path $FormalRoot "formal-window-manifest-v1.json"
$BootstrapPath = Join-Path $FormalRoot "a0-bootstrap-v1.json"

$ExpectedArmIdentity = "sha256:cadbe9c5e228f95621625e26b82117f6ca9edb799221667ce5ce192069d1f9e5"
$ExpectedRuntimeImageId = "sha256:52b82bd8237511bf3e0e8ba20b90b6a91c83d719f6926252951938ebbf42f222"

$OwnerEvidenceDir = Join-Path $FormalRoot "pre-arm-evidence-0e4cd036"
$OwnerAttestationPath = Join-Path $OwnerEvidenceDir "MCFT_CAP_09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_V1_RESULT.json"
$OwnerLiveProofPath = Join-Path $OwnerEvidenceDir "MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1_RESULT.json"
$OwnerWorktree = Join-Path $WindowRoot "owner-arm-subject-worktree"
```

Never place downloaded candidate evidence under repository `acceptance-output/**`.
The repository worktree must remain clean until the exact two-file authority
materialization step.

---

## 1. Read-only freeze gate — run before every effectful step

### 1.1 Protected main

```powershell
$RemoteMain = (gh api "repos/$Repo/git/ref/heads/main" --jq ".object.sha").Trim()
$RemoteMain
if ($RemoteMain -ne $ArmSubject) {
  throw "PRE_WINDOW_MAIN_DRIFT:$RemoteMain"
}
```

Before the post-arm authority-only adoption, main MUST still equal the arm
subject. Any unrelated main movement invalidates the arm.

### 1.2 Product/successor side lanes

```powershell
$P3658 = gh pr view 3658 --repo $Repo --json state,isDraft,mergedAt,headRefOid,baseRefOid | ConvertFrom-Json
$P3659 = gh pr view 3659 --repo $Repo --json state,isDraft,mergedAt,headRefOid,baseRefOid | ConvertFrom-Json

if ($P3658.state -ne "OPEN" -or -not $P3658.isDraft -or $null -ne $P3658.mergedAt) {
  throw "PR3658_WINDOW_ISOLATION_VIOLATION"
}
if ($P3659.state -ne "OPEN" -or -not $P3659.isDraft -or $null -ne $P3659.mergedAt) {
  throw "PR3659_WINDOW_ISOLATION_VIOLATION"
}
```

Expected during prep:

```text
#3658 Draft / Open / Unmerged
#3659 Draft / Open / Unmerged
```

### 1.3 Local repository

```powershell
if (@(git status --porcelain).Count -ne 0) {
  throw "LOCAL_WORKTREE_NOT_CLEAN"
}

git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main
$LocalOriginMain = (git rev-parse origin/main).Trim()
if ($LocalOriginMain -ne $RemoteMain) {
  throw "LOCAL_ORIGIN_MAIN_NOT_REMOTE_MAIN:$LocalOriginMain:$RemoteMain"
}
```

Do not use a stale PowerShell object from a prior failed command as evidence.

---

## 2. 2026-10-09 04:00Z — fresh rolling candidate

Do not use the scheduled cron. The workflow schedule is 05:17Z and is too late
for A0. Use `workflow_dispatch`.

Wait until the real boundary has occurred:

```powershell
$Now = (Get-Date).ToUniversalTime()
if ($Now -lt [datetime]::Parse($FreshBoundary).ToUniversalTime()) {
  throw "FRESH_BOUNDARY_NOT_REACHED:$($Now.ToString('o'))"
}
```

Capture a dispatch fence, dispatch exact main, then resolve exactly one new run
instead of trusting an ambiguous `gh run list` result:

```powershell
$DispatchFence = (Get-Date).ToUniversalTime()
$Subject = (gh api "repos/$Repo/git/ref/heads/main" --jq ".object.sha").Trim()
if ($Subject -ne $ArmSubject) { throw "CANDIDATE_SUBJECT_DRIFT:$Subject" }

gh workflow run mcft-cap-09-t4r1-rolling-current-crop-candidate-v1.yml --repo $Repo --ref main

$Run = $null
for ($i = 0; $i -lt 30 -and $null -eq $Run; $i++) {
  Start-Sleep -Seconds 4
  $Rows = gh run list --repo $Repo --workflow mcft-cap-09-t4r1-rolling-current-crop-candidate-v1.yml --event workflow_dispatch --branch main --limit 30 --json databaseId,headSha,status,conclusion,createdAt | ConvertFrom-Json
  $Run = $Rows |
    Where-Object {
      $_.headSha -eq $Subject -and
      ([datetime]$_.createdAt).ToUniversalTime() -ge $DispatchFence.AddSeconds(-5)
    } |
    Sort-Object { [datetime]$_.createdAt } -Descending |
    Select-Object -First 1
}
if ($null -eq $Run) { throw "FRESH_CANDIDATE_RUN_NOT_RESOLVED" }

$RunId = [int64]$Run.databaseId
"RUN_ID=$RunId SUBJECT=$Subject"
gh run watch $RunId --repo $Repo --exit-status
```

Then re-read the exact run, never infer SUCCESS from a neighboring run:

```powershell
$RunJson = gh run view $RunId --repo $Repo --json databaseId,event,headSha,status,conclusion,workflowName | ConvertFrom-Json
if ($RunJson.headSha -ne $Subject) { throw "CANDIDATE_RUN_HEAD_MISMATCH" }
if ($RunJson.event -ne "workflow_dispatch") { throw "CANDIDATE_RUN_EVENT_MISMATCH" }
if ($RunJson.conclusion -ne "success") { throw "CANDIDATE_RUN_NOT_SUCCESS:$($RunJson.conclusion)" }
```

Preserve the exact GitHub artifact ZIP as immutable qualification evidence.
Do not rely only on `gh run download`, because the Oct-06 governed authority
also embedded the exact artifact archive, artifact id, archive digest, and
per-file digests.

```powershell
Remove-Item -Recurse -Force $CandidateDir -ErrorAction SilentlyContinue
Remove-Item -Force $ArtifactZip -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $CandidateDir | Out-Null

$ArtifactName = "mcft-cap09-t4r1-rolling-current-crop-candidate-$Subject"
$ArtifactList = gh api "repos/$Repo/actions/runs/$RunId/artifacts?per_page=100" | ConvertFrom-Json
$ArtifactRows = @($ArtifactList.artifacts | Where-Object {
  $_.name -eq $ArtifactName -and $_.expired -eq $false
})
if ($ArtifactRows.Count -ne 1) {
  throw "CANDIDATE_ARTIFACT_CARDINALITY:$($ArtifactRows.Count)"
}
$ArtifactId = [int64]$ArtifactRows[0].id

# Capture raw ZIP bytes without PowerShell native-output redirection ambiguity.
$env:MCFT_ARTIFACT_API = "repos/$Repo/actions/artifacts/$ArtifactId/zip"
$env:MCFT_ARTIFACT_ZIP = $ArtifactZip
node -e @'
const cp=require("node:child_process"),fs=require("node:fs");
const b=cp.execFileSync("gh",["api",process.env.MCFT_ARTIFACT_API],{
  encoding:null,maxBuffer:64*1024*1024
});
if(!Buffer.isBuffer(b)||b.length===0)throw new Error("ARTIFACT_ZIP_EMPTY");
fs.writeFileSync(process.env.MCFT_ARTIFACT_ZIP,b,{flag:"wx"});
'@

Expand-Archive -LiteralPath $ArtifactZip -DestinationPath $CandidateDir -Force
$ArtifactSha = "sha256:" + ((Get-FileHash $ArtifactZip -Algorithm SHA256).Hash.ToLower())

$RequiredEvidenceFiles = @(
  "MCFT_CAP09_T4R1_CURRENT_CROP_AUTHORITY_COMPOSITION_RESULT.json",
  "MCFT_CAP09_T4R1_PROTECTED_MAIN_SUCCESSOR_CHAIN_RESULT.json",
  "MCFT_CAP09_T4R1_ROLLING_THERMAL_SNAPSHOT_OVERLAY_PROOF.json",
  "MCFT_CAP09_T4R1_THERMAL_BIOLOGICAL_STAGE_PROBE_RESULT.json",
  "MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_GOVERNANCE_RESULT.json",
  "MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_RESULT.json"
)

$EvidencePaths = @{}
foreach ($Name in $RequiredEvidenceFiles) {
  $Matches = @(Get-ChildItem -Path $CandidateDir -Recurse -File -Filter $Name)
  if ($Matches.Count -ne 1) { throw "CANDIDATE_EVIDENCE_FILE_CARDINALITY:$Name:$($Matches.Count)" }
  $EvidencePaths[$Name] = $Matches[0].FullName
}

$Candidate = $EvidencePaths["MCFT_CAP09_T4R1_CURRENT_CROP_AUTHORITY_COMPOSITION_RESULT.json"]
$C = Get-Content $Candidate -Raw | ConvertFrom-Json
if ($C.status -ne "PASS") { throw "CANDIDATE_STATUS_NOT_PASS" }
if ($C.qualification_outcome -ne "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED") {
  throw "CANDIDATE_OUTCOME_INVALID"
}
if ($C.subject_head_sha -ne $Subject) { throw "CANDIDATE_SUBJECT_MISMATCH" }
if ($C.biological_stage.authority_as_of -ne $FreshBoundary) {
  throw "CANDIDATE_NOT_FRESH_04Z:$($C.biological_stage.authority_as_of)"
}
if ([int]$C.biological_stage.forward_stability_hours -ne 30) {
  throw "CANDIDATE_FORWARD_STABILITY_NOT_30H"
}
if ($C.architecture_effective -ne $false -or $C.runtime_consumption_authorized -ne $false) {
  throw "CANDIDATE_PREMATURE_EFFECT"
}
```

At this point it is still **candidate only**.

---

## 3. Materialization rehearsal and exact future materialization

The known-good Oct-06 adoption (#3656) changed exactly two paths:

1. one immutable effective-current-crop authority artifact;
2. one exact-single append to the registry.

The Oct-09 materialization MUST have the same shape.

### 3.1 Build refresh request outside the repository

Use the latest effective authority's embedded request only as a structural
template. Bind the new request to the fresh candidate and current protected
main.

```powershell
$Latest = Get-Content $PreviousAuthority -Raw | ConvertFrom-Json
$Req = ($Latest.refresh_request | ConvertTo-Json -Depth 100 | ConvertFrom-Json)

$Req.request_id = "GEOX-MCFT-CAP-09-T4R1-CURRENT-CROP-REFRESH-2026-10-09T04Z-V1"
$Req.protected_main_base_sha = $Subject
$Req.scope = $C.scope
$Req.qualification_snapshot.as_of_logical_time = $FreshBoundary
$Req.qualification_snapshot.local_day_complete_boundary_utc = $FreshBoundary
$Req.qualification_snapshot.last_complete_temperature_local_date = "2026-10-08"
$Req.qualification_snapshot.future_observations_authorized = $false
$Req.qualification_time = $C.lifecycle.evaluated_at
$Req.forward_stability_hours = [int]$C.biological_stage.forward_stability_hours

$CertSha = "sha256:" + ((Get-FileHash $Cert -Algorithm SHA256).Hash.ToLower())
$Req.architecture_effectiveness.ref = $Cert
$Req.architecture_effectiveness.sha256 = $CertSha

$RegistryJson = Get-Content $Registry -Raw | ConvertFrom-Json
$PriorEntry = @($RegistryJson.entries)[-1]
if ($PriorEntry.authority_ref -ne $PreviousAuthority) {
  throw "REGISTRY_PREVIOUS_AUTHORITY_REF_MISMATCH:$($PriorEntry.authority_ref)"
}
$Req.previous_effective_current_crop_authority.ref = $PriorEntry.authority_ref
$Req.previous_effective_current_crop_authority.sha256 = $PriorEntry.authority_sha256
$Req.previous_effective_current_crop_authority.overwrite_forbidden = $true
$Req.target_artifact.ref = $TargetAuthority
$Req.target_artifact.must_be_immutable = $true
$Req.target_artifact.must_not_replace_running_preformal_mount = $true

[IO.File]::WriteAllText(
  [IO.Path]::GetFullPath($RequestPath),
  ($Req | ConvertTo-Json -Depth 100) + "`n",
  $Utf8NoBom
)
```

### 3.2 Future effect: create an authority-only branch

**Do not execute during preparation.**

At the final window, only after Section 2 PASS:

```powershell
$Branch = "qualification/mcft-cap09-current-crop-refresh-20261009-final-v1"

git switch --detach $Subject
git switch -c $Branch

node scripts/runtime_acceptance/BUILD_MCFT_CAP_09_EFFECTIVE_CURRENT_CROP_AUTHORITY_REFRESH_V1.cjs --candidate $Candidate --architecture-effectiveness $Cert --refresh-request $RequestPath --subject $Subject --out $TargetAuthority

# The builder creates the governed effective authority core. Reproduce the
# already-proven #3656 envelope exactly: embed refresh_request + immutable
# qualification_evidence archive metadata before calculating registry digest.
$A = Get-Content $TargetAuthority -Raw | ConvertFrom-Json
$EmbeddedRequest = Get-Content $RequestPath -Raw | ConvertFrom-Json
$RequestSha = "sha256:" + ((Get-FileHash $RequestPath -Algorithm SHA256).Hash.ToLower())
if ($A.graduation.refresh_request_sha256 -ne $RequestSha) {
  throw "AUTHORITY_REFRESH_REQUEST_DIGEST_MISMATCH"
}

$FileMap = [ordered]@{}
foreach ($Name in $RequiredEvidenceFiles) {
  $FileMap[$Name] = [ordered]@{
    sha256 = "sha256:" + ((Get-FileHash $EvidencePaths[$Name] -Algorithm SHA256).Hash.ToLower())
  }
}
$QualificationEvidence = [ordered]@{
  run_id = $RunId
  run_url = "https://github.com/$Repo/actions/runs/$RunId"
  artifact_id = $ArtifactId
  artifact_sha256 = $ArtifactSha
  subject_sha = $Subject
  files = $FileMap
  archive_encoding = "base64"
  archive_bytes = [Convert]::ToBase64String([IO.File]::ReadAllBytes($ArtifactZip))
}

$A | Add-Member -NotePropertyName refresh_request -NotePropertyValue $EmbeddedRequest -Force
$A | Add-Member -NotePropertyName qualification_evidence -NotePropertyValue $QualificationEvidence -Force
[IO.File]::WriteAllText(
  [IO.Path]::GetFullPath($TargetAuthority),
  ($A | ConvertTo-Json -Depth 100) + "`n",
  $Utf8NoBom
)
```

Validate the final envelope before touching the registry:

```powershell
$A = Get-Content $TargetAuthority -Raw | ConvertFrom-Json
if ($A.status -ne "PASS") { throw "EFFECTIVE_AUTHORITY_NOT_PASS" }
if ($A.subject_head_sha -ne $Subject) { throw "EFFECTIVE_AUTHORITY_SUBJECT_MISMATCH" }
if ($A.biological_stage.authority_as_of -ne $FreshBoundary) { throw "EFFECTIVE_AUTHORITY_AS_OF_MISMATCH" }
if ($A.biological_stage.authority_valid_until -ne "2026-10-10T10:00:00.000Z") {
  throw "EFFECTIVE_AUTHORITY_VALIDITY_NOT_O23_COVERING:$($A.biological_stage.authority_valid_until)"
}
if ($A.architecture_effective -ne $true -or $A.runtime_consumption_authorized -ne $true) {
  throw "EFFECTIVE_AUTHORITY_NOT_GRADUATED"
}
if ($A.refresh_request.request_id -ne "GEOX-MCFT-CAP-09-T4R1-CURRENT-CROP-REFRESH-2026-10-09T04Z-V1") {
  throw "EFFECTIVE_AUTHORITY_REFRESH_REQUEST_NOT_EMBEDDED"
}
if ([int64]$A.qualification_evidence.run_id -ne $RunId -or
    [int64]$A.qualification_evidence.artifact_id -ne $ArtifactId -or
    $A.qualification_evidence.artifact_sha256 -ne $ArtifactSha -or
    $A.qualification_evidence.subject_sha -ne $Subject -or
    $A.qualification_evidence.archive_encoding -ne "base64" -or
    [string]::IsNullOrWhiteSpace([string]$A.qualification_evidence.archive_bytes)) {
  throw "EFFECTIVE_AUTHORITY_QUALIFICATION_EVIDENCE_ENVELOPE_INVALID"
}
if (@($A.qualification_evidence.files.PSObject.Properties.Name | Sort-Object).Count -ne 6) {
  throw "EFFECTIVE_AUTHORITY_QUALIFICATION_EVIDENCE_FILE_COUNT_NOT_6"
}
foreach ($k in @(
  "runtime_config_write_authorized","database_write_authorized","scheduler_write_authorized",
  "formal_evidence_write_authorized","production_runtime_start_authorized",
  "production_owner_activation_authorized","formal_v5_authorized","a0_authorized",
  "o00_o23_authorized","mcft_cap09_completed"
)) {
  if ($A.$k -ne $false) { throw "EFFECTIVE_AUTHORITY_CEILING_DRIFT:$k" }
}
```

### 3.3 Registry exact-single append

Save the pre-image:

```powershell
$RegistryBefore = Join-Path $WindowRoot "registry-before.json"
Copy-Item $Registry $RegistryBefore -Force

$AuthoritySha = "sha256:" + ((Get-FileHash $TargetAuthority -Algorithm SHA256).Hash.ToLower())
$env:MCFT_REGISTRY_PATH = (Resolve-Path $Registry).Path
$env:MCFT_REGISTRY_BEFORE = (Resolve-Path $RegistryBefore).Path
$env:MCFT_AUTHORITY_REF = $TargetAuthority
$env:MCFT_AUTHORITY_SHA = $AuthoritySha
$env:MCFT_AUTHORITY_AS_OF = $A.biological_stage.authority_as_of
$env:MCFT_AUTHORITY_VALID_UNTIL = $A.biological_stage.authority_valid_until
$env:MCFT_AUTHORITY_STATUS = $A.graduation.status

node -e @'
const fs=require("fs");
const p=process.env.MCFT_REGISTRY_PATH;
const before=JSON.parse(fs.readFileSync(process.env.MCFT_REGISTRY_BEFORE,"utf8"));
const r=JSON.parse(fs.readFileSync(p,"utf8"));
if(JSON.stringify(r.entries)!==JSON.stringify(before.entries)) throw new Error("REGISTRY_CHANGED_BEFORE_APPEND");
r.entries.push({
  authority_ref:process.env.MCFT_AUTHORITY_REF,
  authority_sha256:process.env.MCFT_AUTHORITY_SHA,
  authority_as_of:process.env.MCFT_AUTHORITY_AS_OF,
  authority_valid_until:process.env.MCFT_AUTHORITY_VALID_UNTIL,
  graduation_status:process.env.MCFT_AUTHORITY_STATUS
});
if(r.entries.length!==before.entries.length+1) throw new Error("REGISTRY_APPEND_COUNT_INVALID");
if(JSON.stringify(r.entries.slice(0,-1))!==JSON.stringify(before.entries)) throw new Error("REGISTRY_HISTORY_REWRITE_FORBIDDEN");
fs.writeFileSync(p,JSON.stringify(r,null,2)+"\n");
'@
```

Verify exact changed paths, including untracked files:

```powershell
$Tracked = @(git diff --name-only)
$Untracked = @(git ls-files --others --exclude-standard)
$Changed = @($Tracked + $Untracked | Sort-Object -Unique)

$Expected = @($Registry,$TargetAuthority) | Sort-Object
if (($Changed | ConvertTo-Json -Compress) -ne ($Expected | ConvertTo-Json -Compress)) {
  throw "AUTHORITY_ONLY_CHANGED_PATH_BOUNDARY_VIOLATION:$($Changed -join ',')"
}
```

Commit only those two paths:

```powershell
git add -- $Registry $TargetAuthority
git diff --cached --name-status
git commit -m "docs(mcft-cap09): append Oct 09 final-window current-crop authority"
$AuthorityCommit = (git rev-parse HEAD).Trim()
```

### 3.4 Future effect: protected-main authority-only adoption

**Do not execute during preparation.**

The final window requires this authority-only commit to be adopted before A0.

```powershell
git push -u origin $Branch

$PrUrl = gh pr create --repo $Repo --base main --head $Branch --title "docs(mcft-cap09): append Oct 09 final-window current-crop authority" --body "Formal-v5 post-arm authority-only advancement. Exactly one immutable authority artifact + exact-single registry append. No Runtime/QCP/workflow/database change."

$PrNumber = [int](($PrUrl -split "/")[-1])

# main-strict-delivery-v1 has no merge queue and only permits merge commits.
# All eight required contexts must have an explicit SUCCESS on this exact head.
gh pr checks $PrNumber --repo $Repo --required --watch --fail-fast

$RequiredChecks = @(
  "acceptance",
  "build-test",
  "mcft-delivery-policy-v2-contract",
  "mcft-candidate-integrity-pr-selftest",
  "mcft-release-lane-pr-selftest",
  "mcft-main-ruleset-readiness-v1",
  "mcft-candidate-integrity-enforce-current-pr",
  "mcft-release-lane-enforce-current-pr"
)
$CheckRuns = (gh api "repos/$Repo/commits/$AuthorityCommit/check-runs?per_page=100" | ConvertFrom-Json).check_runs
foreach ($Name in $RequiredChecks) {
  $Succeeded = @($CheckRuns | Where-Object { $_.name -eq $Name -and $_.conclusion -eq "success" })
  if ($Succeeded.Count -lt 1) { throw "REQUIRED_CHECK_NOT_SUCCESS:$Name" }
}

$Pr = gh pr view $PrNumber --repo $Repo --json state,isDraft,mergeable,mergeStateStatus,headRefOid,baseRefOid,files | ConvertFrom-Json
if ($Pr.headRefOid -ne $AuthorityCommit) { throw "AUTHORITY_PR_HEAD_MOVED" }
if ($Pr.baseRefOid -ne $Subject) { throw "AUTHORITY_PR_BASE_MOVED" }
if (@($Pr.files).Count -ne 2) { throw "AUTHORITY_PR_NOT_EXACT_TWO_FILES" }

# OPERATOR AUTHORIZATION REQUIRED HERE.
# This is the only merge planned inside the final window.
gh pr merge $PrNumber --repo $Repo --merge --match-head-commit $AuthorityCommit
```

After adoption, re-read protected main and never assume the merge completed:

```powershell
$PostAuthorityMain = (gh api "repos/$Repo/git/ref/heads/main" --jq ".object.sha").Trim()
if ($PostAuthorityMain -eq $Subject) { throw "AUTHORITY_ADOPTION_NOT_VISIBLE_ON_MAIN" }

git switch main
git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main
git reset --hard origin/main
if (@(git status --porcelain).Count -ne 0) { throw "POST_ADOPTION_WORKTREE_NOT_CLEAN" }
```

---

## 4. Post-arm authority continuity gate

This gate is mandatory after the authority-only main movement and again at A0.

```powershell
node scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_POST_ARM_AUTHORITY_CONTINUITY_V1.cjs --arm-subject=$ArmSubject --logical-time=$A0 --out=$ContinuityPath

$Continuity = Get-Content $ContinuityPath -Raw | ConvertFrom-Json
if ($Continuity.status -ne "PASS") { throw "POST_ARM_CONTINUITY_NOT_PASS" }
```

The verifier itself audits first-parent commits after the arm subject. Every
allowed commit must be only:

- one immutable effective-current-crop authority artifact add; and/or
- one exact-single registry append.

Any Runtime, QCP, workflow, schema, Product, handoff, or unrelated main change
invalidates the arm.

---

## 5. A0 preflight — fixed read-only checklist

**No A0 write may occur until every gate below is PASS.**

### 5.1 Required secret bindings are present

Do not print secret values.

```powershell
$RequiredEnv = @(
  "GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_V5_ADMIN_DATABASE_URL",
  "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_REGION",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY",
  # live owner readback-only dependencies
  "GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL",
  "GEOX_MCFT_CAP09_DURABLE_LOG_ROOT"
)
foreach ($n in $RequiredEnv) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($n))) {
    throw "REQUIRED_ENV_MISSING:$n"
  }
}
if ($env:GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET -ne "geox-mcft-cap09-evidence-runtime-v1") {
  throw "EVIDENCE_BUCKET_IDENTITY_MISMATCH"
}
if ($env:GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET -ne "geox-mcft-cap09-formal-raw-v1") {
  throw "FORMAL_RAW_BUCKET_IDENTITY_MISMATCH"
}
```

### 5.2 Formal DB identity + exact 29 tables / 2 routines / zero rows

This is read-only. Do not rerun schema materialization merely for reassurance.

```powershell
$Psql = (Get-Command psql -ErrorAction Stop).Source
$FormalUrl = $env:GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL

$Identity = & $Psql $FormalUrl -X -AtF "|" -v ON_ERROR_STOP=1 -c "SELECT current_database(),current_setting('transaction_read_only'),transaction_timestamp() AT TIME ZONE 'UTC';"
$Parts = $Identity -split "\|"
if ($Parts[0] -ne "geox_mcft_cap09_s6_formal_t4r1_24h_v5") {
  throw "FORMAL_DB_IDENTITY_MISMATCH:$($Parts[0])"
}
if ($Parts[1] -ne "on") { throw "FORMAL_READBACK_CREDENTIAL_NOT_READ_ONLY" }

$Tables = @(& $Psql $FormalUrl -X -At -v ON_ERROR_STOP=1 -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")
if ($Tables.Count -ne 29) { throw "FORMAL_TABLE_COUNT_NOT_29:$($Tables.Count)" }

$RoutineCount = [int](& $Psql $FormalUrl -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'")
if ($RoutineCount -ne 2) { throw "FORMAL_ROUTINE_COUNT_NOT_2:$RoutineCount" }

$Union = ($Tables | ForEach-Object {
  $safe = $_.Replace('"','""')
  "SELECT count(*)::bigint AS n FROM public.`"$safe`""
}) -join " UNION ALL "
$TotalRows = [int64](& $Psql $FormalUrl -X -At -v ON_ERROR_STOP=1 -c "SELECT COALESCE(sum(n),0) FROM ($Union) q")
if ($TotalRows -ne 0) { throw "FORMAL_PRE_A0_ROWS_NOT_ZERO:$TotalRows" }
```

### 5.3 Current arm/schema proof identity

The A0 runners' built-in defaults still point to the historical
`arm-v1.json` and `schema-acl-v1.json`. They MUST NOT be used for this
re-armed epoch.

```powershell
foreach ($Path in @($ArmPath,$SchemaProofPath)) {
  if (-not (Test-Path $Path)) { throw "CURRENT_FORMAL_PROOF_MISSING:$Path" }
}
$ArmProof = Get-Content $ArmPath -Raw | ConvertFrom-Json
if ($ArmProof.status -ne "PASS" -or $ArmProof.subject_sha -ne $ArmSubject) {
  throw "CURRENT_REARM_PROOF_SUBJECT_INVALID"
}
if ($ArmProof.arm_identity_hash -ne $ExpectedArmIdentity) {
  throw "CURRENT_REARM_IDENTITY_MISMATCH:$($ArmProof.arm_identity_hash)"
}
if ($ArmProof.a0 -ne $A0 -or $ArmProof.o00 -ne $O00 -or $ArmProof.o23 -ne $O23) {
  throw "CURRENT_REARM_EPOCH_MISMATCH"
}
if ($ArmProof.formal_v5_arm -ne $true -or $ArmProof.a0_bootstrap -ne $false -or $ArmProof.o00_started -ne $false) {
  throw "CURRENT_REARM_STAGE_INVALID"
}

$SchemaProof = Get-Content $SchemaProofPath -Raw | ConvertFrom-Json
if ($SchemaProof.schema_version -ne "geox_mcft_cap09_formal_v5_schema_acl_materialization_v1" -or
    @("PASS","PASS_ALREADY_MATERIALIZED_IDEMPOTENT") -notcontains $SchemaProof.status -or
    $SchemaProof.subject_sha -ne $ArmSubject -or
    [int]$SchemaProof.public_table_count -ne 29 -or
    [int]$SchemaProof.public_routine_count -ne 2 -or
    $SchemaProof.all_table_rows_zero -ne $true) {
  throw "CURRENT_SCHEMA_ACL_REVALIDATION_PROOF_INVALID"
}
```

### 5.4 Production exact-one live owner proof

Do not depend on the old temporary attestation path from the earlier arm. Build
a fresh read-only artifact attestation in a detached worktree at the immutable
Runtime subject, then use that attestation for the live T1/T2 proof. This does
not restart containers or mutate the database.

```powershell
New-Item -ItemType Directory -Force $OwnerEvidenceDir | Out-Null
git worktree prune
if (Test-Path $OwnerWorktree) {
  throw "OWNER_ATTESTATION_WORKTREE_ALREADY_EXISTS:$OwnerWorktree"
}
git worktree add --detach $OwnerWorktree $ArmSubject

try {
  Push-Location $OwnerWorktree

  if (@(git status --porcelain).Count -ne 0) { throw "OWNER_ATTESTATION_WORKTREE_DIRTY" }
  if ((git rev-parse HEAD).Trim() -ne $ArmSubject) { throw "OWNER_ATTESTATION_HEAD_MISMATCH" }

  $env:GEOX_DEPLOYMENT_SUBJECT_COMMIT = $ArmSubject
  $env:GEOX_MCFT_CAP09_RUNTIME_IMAGE_TAG = "geox-mcft-cap09-runtime:$ArmSubject"

  node scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs --attest-image
  $AttestLocal = "acceptance-output/MCFT_CAP_09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_V1_RESULT.json"
  $Attest = Get-Content $AttestLocal -Raw | ConvertFrom-Json
  if ($Attest.status -ne "PASS" -or
      $Attest.subject_main_sha -ne $ArmSubject -or
      $Attest.authorized_image_id -ne $ExpectedRuntimeImageId) {
    throw "OWNER_FRESH_ARTIFACT_ATTESTATION_INVALID"
  }
  Copy-Item $AttestLocal $OwnerAttestationPath -Force

  $env:GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_PATH = $OwnerAttestationPath
  node scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs --live

  $OwnerLocal = "acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1_RESULT.json"
  $OwnerProof = Get-Content $OwnerLocal -Raw | ConvertFrom-Json
  if ($OwnerProof.status -ne "PASS" -or
      $OwnerProof.subject_main_sha -ne $ArmSubject -or
      $OwnerProof.authorized_image_id -ne $ExpectedRuntimeImageId) {
    throw "LIVE_OWNER_PROOF_NOT_PASS"
  }
  Copy-Item $OwnerLocal $OwnerLiveProofPath -Force
}
finally {
  Pop-Location
  git worktree remove --force $OwnerWorktree
}
```

Required result:

```text
Evidence live owner count = exactly 1
Twin live owner count     = exactly 1
same exact deployment subject/image
lease renewal observed
```

### 5.5 Production pre-A0 state is still empty for the target scope

Read-only against the Twin production database:

```powershell
$TwinUrl = $env:GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL
if ([string]::IsNullOrWhiteSpace($TwinUrl)) { throw "TWIN_RUNTIME_DATABASE_URL_MISSING" }

$ScopeWhere = "tenant_id='tenant_mcft_external' AND project_id='project_mcft_cap09' AND group_id='group_public_research' AND field_id='field_kbs_mcse_t4r1' AND season_id='season_2026_corn' AND zone_id='zone_kbs_mcse_t4r1_crop_formal_v1'"

$Active = [int](& $Psql $TwinUrl -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.twin_active_lineage_index_v1 WHERE $ScopeWhere")
$LatestState = [int](& $Psql $TwinUrl -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.twin_state_latest_index_v1 WHERE $ScopeWhere")
if ($Active -ne 0) { throw "PRODUCTION_PRE_A0_ACTIVE_LINEAGE_NOT_ZERO:$Active" }
if ($LatestState -ne 0) { throw "PRODUCTION_PRE_A0_LATEST_STATE_NOT_ZERO:$LatestState" }
```

### 5.6 Post-adoption main / continuity re-read

Do **not** repeat the pre-adoption `main == ArmSubject` assertion after the
authority-only merge. A legal post-arm authority adoption intentionally moves
protected main.

Immediately before A0:

```powershell
$MainBeforeA0 = (gh api "repos/$Repo/git/ref/heads/main" --jq ".object.sha").Trim()
if ($MainBeforeA0 -ne $PostAuthorityMain) {
  throw "POST_AUTHORITY_MAIN_MOVED_AGAIN:$PostAuthorityMain:$MainBeforeA0"
}

$P3658 = gh pr view 3658 --repo $Repo --json state,isDraft,mergedAt | ConvertFrom-Json
$P3659 = gh pr view 3659 --repo $Repo --json state,isDraft,mergedAt | ConvertFrom-Json
if ($P3658.state -ne "OPEN" -or -not $P3658.isDraft -or $null -ne $P3658.mergedAt) {
  throw "PR3658_WINDOW_ISOLATION_VIOLATION"
}
if ($P3659.state -ne "OPEN" -or -not $P3659.isDraft -or $null -ne $P3659.mergedAt) {
  throw "PR3659_WINDOW_ISOLATION_VIOLATION"
}

git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main
if ((git rev-parse HEAD).Trim() -ne $PostAuthorityMain -or
    (git rev-parse origin/main).Trim() -ne $PostAuthorityMain -or
    @(git status --porcelain).Count -ne 0) {
  throw "A0_CURRENT_MAIN_CHECKOUT_INVALID"
}

node scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_POST_ARM_AUTHORITY_CONTINUITY_V1.cjs --arm-subject=$ArmSubject --logical-time=$A0 --out=$ContinuityPath
$Continuity = Get-Content $ContinuityPath -Raw | ConvertFrom-Json
if ($Continuity.status -ne "PASS" -or
    $Continuity.arm_runtime_semantic_subject_sha -ne $ArmSubject -or
    $Continuity.authority_continuity_head_sha -ne $PostAuthorityMain -or
    $Continuity.selected_current_crop_authority_ref -ne $TargetAuthority) {
  throw "A0_POST_ARM_CONTINUITY_INVALID"
}
```

---

## 6. CURRENT FIRST-RED — hard stop before A0

The 2026-10-07 exact-main audit found that the Formal-v5 **active production
process routing is not yet demonstrably productized**.

Current exact-main facts:

- `docker-compose.mcft-cap09-production.yml` launches
  `mcft_cap09_twin_runtime_v2.js`;
- that entrypoint calls
  `runMcftCap09TwinRuntimeProcessV2`;
- `mcft_cap09_twin_runtime_process_v2.ts` declares
  `runner: "ExternalFormalV4Amendment19RunnerV2"`;
- the Formal-v5 authority explicitly declares:
  `frontier = FORMAL_V5_ACTIVATION_SUCCESSOR_NOT_YET_PRODUCTIZED`;
- the same authority requires
  `THIN_V5_STAGE_AWARE_RUNNER_AND_DEDICATED_PRODUCTION_PROCESS_COMPOSITION`;
- the V5 runner exists and is acceptance-qualified as
  `ExternalFormalV5Amendment19RunnerV2`, but no effectful production
  entrypoint/compose binding to it was found on exact main;
- `mcft_cap09_v13_forcing_production_process_v1.ts` exposes a process factory
  but no production entrypoint invocation was found.

Therefore:

```text
O00_ACTIVE_PRODUCTION_ROUTE = NOT_PROVEN
A0 EXECUTION                = HOLD
O00                         = HOLD
O00-O23                     = HOLD
```

Do **not** substitute any of the following:

- the V4 production process;
- an acceptance/selftest runner;
- a historical Formal-v3/v4 production runner;
- an ad-hoc `tsx` invocation;
- GitHub Actions as a production clock;
- a manual per-hour rescue loop.

This is a pre-A0 blocker because a successful one-shot A0 must not be followed
by an unstartable O00.

Under the current instruction set this runbook records the blocker but does not
modify Runtime or production routing.

---

## 7. A0 commands — armed but HOLD until Section 6 is adjudicated

Only when the O00 active-production-route gate is separately proven PASS, and
real UTC is at/after A0 but before O00:

```powershell
$Now = (Get-Date).ToUniversalTime()
if ($Now -lt [datetime]::Parse($A0).ToUniversalTime()) { throw "A0_NOT_REACHED" }
if ($Now -ge [datetime]::Parse($O00).ToUniversalTime()) { throw "A0_WINDOW_MISSED" }

node scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_POST_ARM_AUTHORITY_CONTINUITY_V1.cjs --arm-subject=$ArmSubject --logical-time=$A0 --out=$ContinuityPath

pnpm exec tsx scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_A0_PRODUCTION_REPLAY_PROMOTION_V1.ts --operator-authorized --arm=$ArmPath --schema-proof=$SchemaProofPath --continuity-proof=$ContinuityPath --out=$PromotionPath

$Promotion = Get-Content $PromotionPath -Raw | ConvertFrom-Json
if ($Promotion.status -ne "PASS") { throw "A0_REPLAY_PROMOTION_NOT_PASS" }
if ([int]$Promotion.formal_fact_count -ne 3) { throw "A0_REPLAY_PROMOTION_FACT_COUNT_NOT_3" }

pnpm exec tsx scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_A0_BOOTSTRAP_V1.ts --operator-authorized --arm=$ArmPath --schema-proof=$SchemaProofPath --promotion-proof=$PromotionPath --continuity-proof=$BootstrapContinuityPath --manifest-out=$ManifestPath --out=$BootstrapPath

$Bootstrap = Get-Content $BootstrapPath -Raw | ConvertFrom-Json
if ($Bootstrap.status -ne "PASS") { throw "A0_BOOTSTRAP_NOT_PASS" }
if ($Bootstrap.formal_a0_bootstrapped -ne $true) { throw "A0_BOOTSTRAP_FLAG_FALSE" }
if ($Bootstrap.formal_o00_started -ne $false) { throw "A0_BOOTSTRAP_PREMATURE_O00" }
if ($Bootstrap.next_tick_logical_time -ne $O00) { throw "A0_NEXT_TICK_NOT_O00" }
```

If A0 bootstrap performs partial mutation and fails, the store/epoch is
non-reusable. Do not truncate and retry.

---

## 8. O00 cutover — intentionally not executable in this runbook yet

The governance sequence after A0 is:

```text
A0 PASS
-> activate V13 forcing process on non-GitHub Evidence host
-> release Twin PRE_FORMAL_OWNER_STANDBY lease
-> claim new Twin fencing token under FORMAL_V5_ACTIVE process
-> run O00 at 2026-10-09T06:00Z
-> O01 ... O23 real UTC
```

No command is provided here until the exact-main production binding for the V5
runner and V13 forcing process is machine-proven. Providing a V4 or ad-hoc
substitute would violate the frozen authority.

---

## 9. O00-O23 and terminal closure requirements

Once the Section 6 blocker is separately closed, the final lane remains:

- actual UTC O00 through O23;
- exactly 24 terminal slots;
- zero routine manual rescue;
- restart/backfill only under the already-qualified semantics;
- exact predecessor forcing-base viability;
- final automatic readback;
- downstream zero-action assertions;
- final read-only completion adjudication;
- no CAP-09 completion claim before that adjudication.

Historical v4 final-readback workflows/scripts are reference evidence only and
must not be reused as a V5 production substitute unless a later governed V5
binding explicitly authorizes them.

---

## 10. Preparation-time conclusion

As of the design base:

```text
protected main                            PASS / unchanged
#3658                                    PASS / Draft Open Unmerged
#3659                                    PASS / Draft Open Unmerged
Formal-v5 arm                            PASS
post-arm schema/ACL                      PASS
materialized zero state                  PASS
exact-one preformal owners               PASS
fresh candidate rehearsal                PASS
candidate -> authority builder            READY
qualification evidence envelope            FIXED / now mirrors #3656 shape
registry exact-single append pattern      PROVEN by #3656
main ruleset / required checks             VERIFIED / 8 exact contexts
post-arm continuity verifier              READY
current re-arm/schema proof paths          FIXED / explicit, no stale defaults
fresh owner attestation/live proof         FIXED / detached arm-subject worktree
A0 replay/bootstrap executors             READY with explicit artifact paths
V5 active production route                FIRST-RED / NOT PROVEN
A0                                        HOLD
O00-O23                                   HOLD
```

No preparation step in this document authorizes merge, deploy, Runtime change,
schema change, database mutation, A0, or O00.
