param([Parameter(Mandatory=$true)][string]$Subject)
$Repo=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
if((git -C $Repo rev-parse HEAD) -cne $Subject -or @(git -C $Repo status --porcelain --untracked-files=no).Count){throw 'HOLD_EXACT_PRODUCT_SOURCE'}
$ErrorActionPreference='Stop'
$root=Join-Path $HOME 'GEOX-E2E01-LOCAL'
$cfg=Get-Content -LiteralPath (Join-Path $root 'config.json') -Raw | ConvertFrom-Json
$Pg='geox-product-e2e01-postgres'
if((docker inspect --format '{{.Id}}' $Pg) -cne $cfg.pgContainerId -or
   (docker inspect --format '{{.State.Status}}' $Pg) -cne 'running' -or
   (docker inspect --format '{{.State.Status}}' geox-v1-postgres) -cne 'exited' -or
   (docker port $Pg 5432/tcp) -cne '127.0.0.1:15435'){throw 'HOLD_DATABASE_IDENTITY'}
$old=@(docker inspect geox-v1-postgres | ConvertFrom-Json)[0]
$admin=@($old.Config.Env | Where-Object {$_ -like 'POSTGRES_USER=*'})
if($admin.Count -ne 1){throw 'HOLD_ADMIN_IDENTITY'}
$admin=$admin[0].Substring(14)
Remove-Variable old
$tables=@('public.facts','public.field_index_v1','public.field_polygon_v1','geox_manager_v1.field_soil_document_revision_p2_v1','geox_manager_v1.field_soil_document_confirmation_p2_v1','geox_manager_v1.field_crop_review_p3_v1','geox_manager_v1.field_native_assessment_p3p_v1','geox_manager_v1.field_context_followup_p4_v1','geox_manager_v1.migration_ledger_v1')

$policyFile=Join-Path $root 'owner-land-grants.json'
$before=[IO.File]::ReadAllText($policyFile)
$p=$before|ConvertFrom-Json
if($cfg.pgContainerId -cne '46af2e6fdd7be1a1b09ce641a7b311f99fb93c1b6ea201bd08edcc23d34d6179' -or $cfg.ownerPolicy -cne $policyFile -or $cfg.writeAdmitted -ne $true -or $cfg.subject -cne '2bb8822d-1b7f-4ad5-9cc7-9dd99aee2083' -or $p.subject -cne $cfg.subject -or $p.schema -cne 'geox.local-owner-land-grants.e2e01.v1' -or $p.decision -cne 'AUTHORIZE_BOUNDED_MANAGER_INTEGRATION' -or $p.phase -cne 'CREATE' -or $p.create_status -cne 'ACTIVE' -or $p.revision -ne 3 -or @($p.field_grants).Count){throw 'HOLD_CREATE_POLICY'}
$baseFile=Join-Path $root 'prewrite-db-before.json'
$base=[IO.File]::ReadAllText($baseFile)
$receipt=Join-Path $root 'field-creation-proof.json'
$tmp=$policyFile+'.field.new'
$bak=$policyFile+'.revision3.bak'
foreach($f in @($receipt,$tmp,$bak)){if(Test-Path -LiteralPath $f){throw 'HOLD_EXISTING_FIELD_TRANSITION'}}
$mgr=@(Get-NetTCPConnection -LocalPort 14175 -State Listen -ErrorAction SilentlyContinue)
if($mgr.Count -ne 1 -or $mgr[0].LocalAddress -cne '127.0.0.1'){throw 'HOLD_MANAGER_LISTENER'}
$proc=Get-CimInstance Win32_Process -Filter "ProcessId=$($mgr[0].OwningProcess)"
if($proc.Name -ne 'node.exe' -or $proc.CommandLine -notmatch 'scripts[/\\]product[/\\]e2e01[/\\]manager-local\.mjs'){throw 'HOLD_MANAGER_PROCESS'}
$Node=$proc.ExecutablePath
# Node hashes the same parsed policy serialization as the directory.
$policyHash=& $Node --input-type=module -e "import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';console.log(createHash('sha256').update(JSON.stringify(JSON.parse(readFileSync(process.argv[1],'utf8')))).digest('hex'))" $policyFile
if($LASTEXITCODE -ne 0 -or $policyHash -cnotmatch '^[a-f0-9]{64}$'){throw 'HOLD_POLICY_HASH'}
$fact="('field_'||encode(sha256(convert_to('field_created_v1|tenant_geox_e2e01|field_geox_e2e01_001','UTF8')),'hex'))"
$parts=@()
foreach($t in $tables){
 $where=''
 if($t -ceq 'public.facts'){$where=" WHERE fact_id IS DISTINCT FROM $fact"}
 if($t -ceq 'public.field_index_v1'){$where=" WHERE field_id IS DISTINCT FROM 'field_geox_e2e01_001'"}
 $parts+="SELECT '$t' AS relation,count(*) AS row_count,encode(sha256(convert_to(COALESCE(string_agg(h,'' ORDER BY h),''),'UTF8')),'hex') AS digest FROM (SELECT encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex') AS h FROM $t x$where) s"
}
# Only the exact field and its exact creation fact may differ from the original nine-table baseline.
$check=@"
SELECT json_build_object('creation_proof', COALESCE((
 SELECT (SELECT count(*) FROM public.field_index_v1 WHERE field_id='field_geox_e2e01_001')=1
 AND (SELECT count(*) FROM public.facts WHERE fact_id=$fact)=1
 AND f.tenant_id='tenant_geox_e2e01' AND f.project_id='project_geox_e2e01' AND f.group_id='group_geox_e2e01'
 AND f.name=U&'GEOX E2E-01 \9A8C\6536\7530\5757' AND f.field_name=f.name AND f.area_ha IS NULL AND f.status='ACTIVE'
 AND f.updated_ts_ms=f.created_ts_ms
 AND z.source='control' AND z.record_json::jsonb->>'type'='field_created_v1'
 AND z.record_json::jsonb->'entity'=jsonb_build_object('tenant_id',f.tenant_id,'project_id',f.project_id,'group_id',f.group_id,'field_id',f.field_id)
 AND z.record_json::jsonb#>>'{payload,name}'=f.name
 AND z.record_json::jsonb#>>'{payload,actor_id}'='fdw_2bb8822d-1b7f-4ad5-9cc7-9dd99aee2083'
 AND z.record_json::jsonb#>>'{payload,mapping_version}'='fdw-local-mapping-v1'
 AND z.record_json::jsonb#>>'{payload,grant_source_ref,issuer}'='urn:geox:local-owner:e2e01'
 AND z.record_json::jsonb#>>'{payload,grant_source_ref,id}'='explicit-land-grants'
 AND z.record_json::jsonb#>>'{payload,grant_source_ref,version}'='3:$policyHash'
 AND z.record_json::jsonb#>>'{payload,credential_ref}' ~ '^(sha256:)?[a-f0-9]{64}$'
 AND z.record_json::jsonb#>>'{payload,created_ts_ms}'=f.created_ts_ms::text
 AND z.record_json::jsonb#>'{payload,area_ha}'='null'::jsonb
 AND NOT EXISTS(SELECT 1 FROM public.field_polygon_v1 WHERE field_id=f.field_id)
 FROM public.field_index_v1 f JOIN public.facts z ON z.fact_id=$fact WHERE f.field_id='field_geox_e2e01_001'
),false),'creation_fact_id',$fact);
"@
$sql="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='30s'; SELECT row_to_json(q) FROM ("+($parts -join ' UNION ALL ')+") q ORDER BY relation; "+$check+" ROLLBACK;"
$raw=@(docker exec $Pg psql -X -w -qAt -U $admin -d landos -v ON_ERROR_STOP=1 -c $sql)
if($LASTEXITCODE -ne 0 -or $raw.Count -ne 10){throw 'HOLD_CREATION_SNAPSHOT'}
$rows=@(
 foreach($line in $raw[0..8]){
  $item=ConvertFrom-Json -InputObject ([string]$line) -ErrorAction Stop
  if($item.relation -cnotin $tables -or $item.digest -cnotmatch '^[a-f0-9]{64}$' -or [string]$item.row_count -notmatch '^(0|[1-9][0-9]*)$'){throw 'HOLD_SNAPSHOT_ROW_FORMAT'}
  [pscustomobject][ordered]@{relation=[string]$item.relation;row_count=[long]$item.row_count;digest=[string]$item.digest}
 }
)
$rows=@($rows|Sort-Object relation)
if((ConvertTo-Json -InputObject $rows -Depth 4 -Compress) -cne $base){throw 'HOLD_UNEXPECTED_DATABASE_DELTA'}
$result=ConvertFrom-Json -InputObject ([string]$raw[9])
if($result.creation_proof -ne $true -or $result.creation_fact_id -cnotmatch '^field_[a-f0-9]{64}$'){throw 'HOLD_EXACT_CREATION_FACT'}
Write-Host 'EXACT_FIELD_AND_CREATION_FACT=PASS'
Write-Host 'UNRELATED_NINE_TABLE_BASELINE=UNCHANGED'
Write-Host "CREATION_FACT_ID=$($result.creation_fact_id)"
if([IO.File]::ReadAllText($policyFile) -cne $before -or [IO.File]::ReadAllText($baseFile) -cne $base){throw 'HOLD_LOCAL_STATE_CHANGED'}
$now=@(Get-NetTCPConnection -LocalPort 14175 -State Listen -ErrorAction SilentlyContinue)
if($now.Count -ne 1 -or $now[0].OwningProcess -ne $proc.ProcessId){throw 'HOLD_MANAGER_PROCESS_CHANGED'}
$p.phase='FIELD'
$p.create_status='REVOKED'
$p.revision=4
$p.field_grants=@('UPDATE_FIELD','READ_FIELD_GEOMETRY','READ_SOIL_DOCUMENT','UPLOAD_SOIL_DOCUMENT','CONFIRM_SOIL_DOCUMENT','REQUEST_CROP_REVIEW','READ_CROP_REVIEW')
$utf8=New-Object Text.UTF8Encoding($false)
$proof=[ordered]@{subject=$Subject;field_id='field_geox_e2e01_001';creation_fact_id=$result.creation_fact_id;creation_policy_sha256=$policyHash;prior_baseline_unchanged_except_exact_creation=$true;observed_at_utc=[DateTime]::UtcNow.ToString('o')}
[IO.File]::WriteAllText($receipt,($proof|ConvertTo-Json -Depth 4 -Compress),$utf8)
[IO.File]::WriteAllText($tmp,($p|ConvertTo-Json -Depth 4 -Compress),$utf8)
[IO.File]::Replace($tmp,$policyFile,$bak)
Write-Host 'CREATE_AUTHORITY_REVOKED=PASS'
Write-Host 'INDEPENDENT_FIELD_GRANTS=7'
Write-Host 'FIELD_ACCESS_ADMITTED=PASS'
