param([Parameter(Mandatory=$true)][string]$Subject)
$ErrorActionPreference='Stop'
$Repo=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$root=Join-Path $HOME 'GEOX-E2E01-LOCAL'
$cfgFile=Join-Path $root 'config.json'
$cfg=Get-Content -LiteralPath $cfgFile -Raw|ConvertFrom-Json
$policy=Get-Content -LiteralPath $cfg.ownerPolicy -Raw|ConvertFrom-Json
$Kit='D:\gptdown\FDW-LOCAL-KEYCLOAK-POSTGRES-20261117\FDW-LOCAL-KEYCLOAK-POSTGRES-20261117'
$Ca=Join-Path $Kit '.local\secrets\fdw-idp.pem'
if((git -C $Repo rev-parse HEAD) -cne $Subject -or @(git -C $Repo status --porcelain --untracked-files=no).Count){throw 'HOLD_EXACT_PRODUCT_SOURCE'}
if($cfg.fdwKit -cne $Kit -or $cfg.ownerPolicy -cne (Join-Path $root 'owner-land-grants.json') -or $cfg.writeAdmitted -ne $false -or $cfg.subject -cne '2bb8822d-1b7f-4ad5-9cc7-9dd99aee2083' -or $policy.subject -cne $cfg.subject -or $policy.phase -cne 'PREWRITE' -or $policy.create_status -cne 'ACTIVE' -or $policy.revision -ne 1 -or @($policy.field_grants).Count){throw 'HOLD_PREWRITE_POLICY'}
& (Join-Path $PSScriptRoot 'Read-DatabaseProof.ps1') -Stage After
$gw=@(Get-NetTCPConnection -LocalPort 14173 -State Listen -ErrorAction SilentlyContinue)
$api=@(Get-NetTCPConnection -LocalPort 14174 -State Listen -ErrorAction SilentlyContinue)
$mgr=@(Get-NetTCPConnection -LocalPort 14175 -State Listen -ErrorAction SilentlyContinue)
if($gw.Count -ne 1 -or $api.Count -ne 1 -or $mgr.Count -ne 1 -or @($gw+$api+$mgr|Where-Object{$_.LocalAddress -cne '127.0.0.1'}).Count){throw 'HOLD_RUNTIME_LISTENERS'}
$g=Get-CimInstance Win32_Process -Filter "ProcessId=$($gw[0].OwningProcess)"
$p=Get-CimInstance Win32_Process -Filter "ProcessId=$($mgr[0].OwningProcess)"
if($g.Name -ne 'node.exe' -or $g.CommandLine -notmatch 'oidc-session-gateway-e2e01\.mjs' -or $p.Name -ne 'node.exe' -or $p.CommandLine -notmatch 'scripts[/\\]product[/\\]e2e01[/\\]manager-local\.mjs'){throw 'HOLD_PROCESS_IDENTITY'}
$Node=$p.ExecutablePath
if((& $Node --version) -notmatch '^v24\.'){throw 'HOLD_NODE24'}
$cert=New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($Ca)
if($cert.Thumbprint -cne '9DDB1DE78D7FFE64A78C8FF70AD48696F8569400'){throw 'HOLD_CA_IDENTITY'}
$old=@(docker inspect geox-v1-server | ConvertFrom-Json)[0]
if($old.State.Status -cne 'exited'){throw 'HOLD_OLD_SERVER'}
$urls=@($old.Config.Env|Where-Object{$_ -like 'GEOX_RUNTIME_DATABASE_URL=*'})
if($urls.Count -ne 1){throw 'HOLD_RUNTIME_CREDENTIAL'}
$u=[Uri]$urls[0].Substring('GEOX_RUNTIME_DATABASE_URL='.Length)
if($u.Scheme -notin @('postgres','postgresql') -or $u.Host -cne 'postgres' -or $u.Port -ne 5432 -or $u.AbsolutePath -cne '/landos' -or $u.UserInfo -notmatch '^geox_runtime_v1:.+' -or $u.Query -or $u.Fragment){throw 'HOLD_RUNTIME_CREDENTIAL_BINDING'}
$runtimeUrl=$u.Scheme+'://'+$u.UserInfo+'@127.0.0.1:15435/landos'
Remove-Variable old,urls,u
Push-Location $Repo
try{
 & $Node --test scripts/product/e2e01/contract.test.mjs
 if($LASTEXITCODE -ne 0){throw 'HOLD_TEST'}
 & $Node --check scripts/product/e2e01/manager-local.mjs
 if($LASTEXITCODE -ne 0){throw 'HOLD_MANAGER_SYNTAX'}
 $now=@(Get-NetTCPConnection -LocalPort 14175 -State Listen -ErrorAction SilentlyContinue)
 if($now.Count -ne 1 -or $now[0].OwningProcess -ne $p.ProcessId){throw 'HOLD_MANAGER_PROCESS_CHANGED'}
 Stop-Process -Id $p.ProcessId -ErrorAction Stop
 $keys=@('GEOX_E2E01_CONFIG','GEOX_E2E01_DATABASE_URL','NODE_EXTRA_CA_CERTS')
 $backup=@{}
 try{
  foreach($k in $keys){$backup[$k]=[Environment]::GetEnvironmentVariable($k,'Process')}
  $env:GEOX_E2E01_CONFIG=$cfgFile
  $env:GEOX_E2E01_DATABASE_URL=$runtimeUrl
  $env:NODE_EXTRA_CA_CERTS=$Ca
  $cmd='Set-Location -LiteralPath ''{0}''; $Host.UI.RawUI.WindowTitle=''GEOX MANAGER AUTHORITY TRACE - KEEP OPEN''; & ''{1}'' --import tsx ''scripts/product/e2e01/manager-local.mjs''; Write-Host (''MANAGER_EXIT=''+$LASTEXITCODE)' -f $Repo,$Node
  $enc=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
  Start-Process powershell.exe -ArgumentList @('-NoProfile','-NoExit','-EncodedCommand',$enc)
 }finally{
  foreach($k in $backup.Keys){[Environment]::SetEnvironmentVariable($k,$backup[$k],'Process')}
  Remove-Variable runtimeUrl -ErrorAction SilentlyContinue
 }
 for($i=0;$i -lt 15;$i++){
  $status=curl.exe -s --noproxy '*' --connect-timeout 1 --max-time 2 -o NUL -w '%{http_code}' http://127.0.0.1:14175/api/v1/manager/fields
  if($LASTEXITCODE -eq 0 -and $status -ceq '401'){Write-Host 'MANAGER_PREWRITE_DIAGNOSTIC_READY=PASS';return}
  Start-Sleep -Seconds 1
 }
 throw 'HOLD_MANAGER_READINESS'
}finally{Pop-Location;Remove-Variable runtimeUrl -ErrorAction SilentlyContinue}
