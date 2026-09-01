"use strict";

const fs=require("node:fs");
const path=require("node:path");
const os=require("node:os");
const cp=require("node:child_process");
const ROOT=process.cwd();
const AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json");
const OWNER=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json");
const ROUTE=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md");
const OWNER_ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_ARM_V1.json");
const HOST_ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_ARM_V1.json");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_PREFLIGHT_V1_RESULT.json");
const j=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const req=(v,c)=>{if(!v)throw new Error(c)};
const write=v=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));};
const LOCAL_OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_LOCAL_OPERATOR_HOST_MACHINE_PREFLIGHT_V1_RESULT.json");
const run=(exe,args)=>cp.execFileSync(exe,args,{encoding:"utf8",windowsHide:true}).trim();
const safeRun=(exe,args)=>{
  try{return {ok:true,stdout:run(exe,args),error:null};}
  catch(error){return {ok:false,stdout:String(error?.stdout||"").trim(),error:error instanceof Error?error.message:String(error)};}
};
function runLocalMachineProbe(){
  const expectedArg=process.argv.find((x)=>x.startsWith("--expected-subject="));
  const expected=String(expectedArg?.slice("--expected-subject=".length)||"").trim().toLowerCase();
  const blockers=[];
  const add=(ok,code)=>{if(!ok)blockers.push(code);};

  add(/^[0-9a-f]{40}$/.test(expected),"LOCAL_PREFLIGHT_EXPECTED_SUBJECT_SHA_REQUIRED");

  const a=j(AUTH);
  const local=a.local_operator_managed_host_contract||{};
  const machineContract=local.machine_preflight_contract||{};
  const boundHostId=String(local.host_id||"").trim().toLowerCase();
  add(machineContract.schema_version==="geox_mcft_cap09_local_operator_host_machine_preflight_contract_v1","LOCAL_PREFLIGHT_MACHINE_CONTRACT_REQUIRED");
  add(machineContract.classification==="PRE_RUNTIME_STATIC_MACHINE_ADMISSION","LOCAL_PREFLIGHT_MACHINE_CLASSIFICATION_REQUIRED");
  add(a.status==="LOCAL_OPERATOR_MANAGED_DOCKER_HOST_IDENTITIES_BOUND","LOCAL_PREFLIGHT_BOUND_HOST_AUTHORITY_REQUIRED");
  add(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(boundHostId),"LOCAL_PREFLIGHT_BOUND_HOST_UUID_REQUIRED");

  const hostFile=path.join(os.homedir(),".geox","mcft-cap09","local-host-id-v1");
  let observedHostId="";
  try{observedHostId=fs.readFileSync(hostFile,"utf8").trim().toLowerCase();}
  catch{}
  add(observedHostId===boundHostId,"LOCAL_PREFLIGHT_HOST_ID_FILE_MISMATCH");

  const gitHead=safeRun("git",["rev-parse","HEAD"]);
  const gitBranch=safeRun("git",["branch","--show-current"]);
  const gitStatus=safeRun("git",["status","--porcelain=v1","--untracked-files=all"]);
  const gitStatusLines=gitStatus.ok?gitStatus.stdout.split(/\r?\n/).map((line)=>line.trimEnd()).filter(Boolean):[];
  const ignoredMachineEvidence=gitStatusLines.filter((line)=>/^\?\? acceptance-output\//.test(line));
  const governedWorktreeLines=gitStatusLines.filter((line)=>!/^\?\? acceptance-output\//.test(line));
  add(gitHead.ok&&gitHead.stdout===expected,"LOCAL_PREFLIGHT_EXACT_SUBJECT_REQUIRED");
  add(gitStatus.ok&&governedWorktreeLines.length===0,"LOCAL_PREFLIGHT_WORKTREE_MUST_BE_CLEAN");

  const dockerVersion=safeRun("docker",["version","--format","{{json .Server}}"]);
  let dockerServer=null;
  if(dockerVersion.ok){try{dockerServer=JSON.parse(dockerVersion.stdout);}catch{}}
  add(Boolean(dockerServer),"LOCAL_PREFLIGHT_DOCKER_DAEMON_REQUIRED");

  const dockerInfoRaw=safeRun("docker",["info","--format","{{json .}}"]);
  let dockerInfo=null;
  if(dockerInfoRaw.ok){try{dockerInfo=JSON.parse(dockerInfoRaw.stdout);}catch{}}
  add(Boolean(dockerInfo),"LOCAL_PREFLIGHT_DOCKER_INFO_REQUIRED");
  add(!dockerInfo||String(dockerInfo.OSType||dockerInfo.OperatingSystem||"").toLowerCase().includes("linux"),"LOCAL_PREFLIGHT_LINUX_CONTAINER_ENGINE_REQUIRED");

  const compose=safeRun("docker",["compose","version","--short"]);
  add(compose.ok&&compose.stdout.length>0,"LOCAL_PREFLIGHT_DOCKER_COMPOSE_REQUIRED");

  let power=null;
  if(process.platform==="win32"){
    const ps=[
      "$ErrorActionPreference='Stop'",
      "$m=[regex]::Match((powercfg /getactivescheme | Out-String),'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}')",
      "if(-not $m.Success){throw 'ACTIVE_POWER_SCHEME_NOT_FOUND'}",
      "$g=$m.Value",
      "$k='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\User\\PowerSchemes\\'+$g+'\\238C9FA8-0AAD-41ED-83F4-97BE242C8F20\\29f6c1db-86da-48c5-9fdb-f2b67b1f44da'",
      "$v=Get-ItemProperty -LiteralPath $k",
      "[pscustomobject]@{active_scheme=$g.ToLowerInvariant();ac_sleep_seconds=[int64]$v.ACSettingIndex;dc_sleep_seconds=[int64]$v.DCSettingIndex}|ConvertTo-Json -Compress"
    ].join(";");
    const p=safeRun("powershell.exe",["-NoProfile","-NonInteractive","-Command",ps]);
    if(p.ok){try{power=JSON.parse(p.stdout);}catch{}}
    add(Boolean(power),"LOCAL_PREFLIGHT_POWER_POLICY_READ_REQUIRED");
    add(!power||Number(power.ac_sleep_seconds)===0,"LOCAL_PREFLIGHT_AC_SLEEP_MUST_BE_DISABLED");
  }else{
    blockers.push("LOCAL_PREFLIGHT_WINDOWS_HOST_REQUIRED");
  }

  let timeService=null;
  if(process.platform==="win32"){
    const ts=safeRun("powershell.exe",["-NoProfile","-NonInteractive","-Command",
      "$s=Get-CimInstance Win32_Service -Filter \"Name='W32Time'\"; if($null -eq $s){throw 'W32TIME_SERVICE_NOT_FOUND'}; [pscustomobject]@{state=[string]$s.State;start_mode=[string]$s.StartMode}|ConvertTo-Json -Compress"
    ]);
    if(ts.ok){try{timeService=JSON.parse(ts.stdout);}catch{}}
    add(Boolean(timeService),"LOCAL_PREFLIGHT_WINDOWS_TIME_SERVICE_READ_REQUIRED");
    add(String(timeService?.state||"").toLowerCase()==="running","LOCAL_PREFLIGHT_WINDOWS_TIME_SERVICE_RUNNING_REQUIRED");
  }
  const timeSource=process.platform==="win32"?safeRun("w32tm",["/query","/source"]):{ok:false,stdout:"",error:"WINDOWS_ONLY"};
  const timeStatus=process.platform==="win32"?safeRun("w32tm",["/query","/status"]):{ok:false,stdout:"",error:"WINDOWS_ONLY"};
  const source=String(timeSource.stdout||"").trim();
  const sourceLower=source.toLowerCase();
  add(timeSource.ok&&source.length>0,"LOCAL_PREFLIGHT_TIME_SOURCE_REQUIRED");
  add(timeStatus.ok,"LOCAL_PREFLIGHT_TIME_STATUS_REQUIRED");
  add(!sourceLower.includes("local cmos clock")&&!sourceLower.includes("free-running system clock"),"LOCAL_PREFLIGHT_NETWORK_TIME_SOURCE_REQUIRED");

  let diskFreeGiB=null;
  try{
    if(typeof fs.statfsSync==="function"){
      const s=fs.statfsSync(ROOT);
      diskFreeGiB=Number((Number(s.bavail)*Number(s.bsize)/1024/1024/1024).toFixed(2));
    }
  }catch{}

  const hostCpuCount=os.cpus().length;
  const hostTotalMemoryGiB=Number((os.totalmem()/1024/1024/1024).toFixed(2));
  const dockerCpuCount=dockerInfo?.NCPU==null?null:Number(dockerInfo.NCPU);
  const dockerMemoryGiB=dockerInfo?.MemTotal==null?null:Number((Number(dockerInfo.MemTotal)/1024/1024/1024).toFixed(2));
  add(hostCpuCount>=Number(machineContract.minimum_logical_cpu_count),"LOCAL_PREFLIGHT_HOST_CPU_FLOOR_REQUIRED");
  add(hostTotalMemoryGiB>=Number(machineContract.minimum_host_total_memory_gib),"LOCAL_PREFLIGHT_HOST_MEMORY_FLOOR_REQUIRED");
  add(dockerCpuCount!==null&&dockerCpuCount>=Number(machineContract.minimum_docker_cpu_count),"LOCAL_PREFLIGHT_DOCKER_CPU_FLOOR_REQUIRED");
  add(dockerMemoryGiB!==null&&dockerMemoryGiB>=Number(machineContract.minimum_docker_memory_gib),"LOCAL_PREFLIGHT_DOCKER_MEMORY_FLOOR_REQUIRED");
  add(diskFreeGiB!==null&&diskFreeGiB>=Number(machineContract.minimum_repo_disk_free_gib),"LOCAL_PREFLIGHT_REPO_DISK_FLOOR_REQUIRED");

  const expandHome=(value)=>String(value||"").replace(/^~(?=[\\/]|$)/,os.homedir());
  const durableLogRoot=path.resolve(expandHome(machineContract.durable_log_root));
  const tempRoot=path.resolve(os.tmpdir());
  let durableLogRootExists=false,durableLogRootWritable=false,durableLogRootOutsideTemp=false;
  try{
    const stat=fs.statSync(durableLogRoot);
    durableLogRootExists=stat.isDirectory();
    if(durableLogRootExists){fs.accessSync(durableLogRoot,fs.constants.W_OK);durableLogRootWritable=true;}
    const relativeToTemp=path.relative(tempRoot,durableLogRoot);
    durableLogRootOutsideTemp=relativeToTemp!==""&&!relativeToTemp.startsWith(".."+path.sep)&&!path.isAbsolute(relativeToTemp)?false:true;
  }catch{}
  add(durableLogRootExists,"LOCAL_PREFLIGHT_DURABLE_LOG_ROOT_REQUIRED");
  add(durableLogRootWritable,"LOCAL_PREFLIGHT_DURABLE_LOG_ROOT_WRITABLE_REQUIRED");
  add(durableLogRootOutsideTemp,"LOCAL_PREFLIGHT_DURABLE_LOG_ROOT_OUTSIDE_TEMP_REQUIRED");

  let network=null;
  if(process.platform==="win32"){
    const ps=[
      "$ErrorActionPreference='Stop'",
      "$c=Get-NetIPConfiguration | Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4DefaultGateway -ne $null } | Select-Object -First 1",
      "if($null -eq $c){throw 'ACTIVE_IPV4_DEFAULT_ROUTE_NOT_FOUND'}",
      "$dns=@((Get-DnsClientServerAddress -InterfaceIndex $c.InterfaceIndex -AddressFamily IPv4).ServerAddresses | Where-Object { $_ -and $_.Trim() })",
      "if($dns.Count -eq 0){throw 'IPV4_DNS_NOT_CONFIGURED'}",
      "[pscustomobject]@{interface_alias=$c.InterfaceAlias;interface_index=[int]$c.InterfaceIndex;ipv4_default_gateway=[string]$c.IPv4DefaultGateway.NextHop;ipv4_dns=@($dns)}|ConvertTo-Json -Compress"
    ].join(";");
    const n=safeRun("powershell.exe",["-NoProfile","-NonInteractive","-Command",ps]);
    if(n.ok){try{network=JSON.parse(n.stdout);}catch{}}
  }
  add(Boolean(network),"LOCAL_PREFLIGHT_ACTIVE_IPV4_ROUTE_AND_DNS_REQUIRED");

  const out={
    schema_version:"geox_mcft_cap09_local_operator_host_machine_preflight_v1",
    status:blockers.length===0?"PASS":"FAIL",
    expected_subject_sha:expected||null,
    observed_subject_sha:gitHead.ok?gitHead.stdout:null,
    exact_subject_match:gitHead.ok&&gitHead.stdout===expected,
    git_branch:gitBranch.ok?(gitBranch.stdout||"DETACHED"):null,
    git_worktree_clean:gitStatus.ok&&governedWorktreeLines.length===0,
    git_worktree_observed_changes:governedWorktreeLines,
    ignored_machine_evidence_paths:ignoredMachineEvidence.map((line)=>line.slice(3)),
    local_host_id_state_file:hostFile,
    bound_host_id:boundHostId||null,
    observed_host_id:observedHostId||null,
    host_id_match:Boolean(boundHostId)&&observedHostId===boundHostId,
    platform:process.platform,
    architecture:process.arch,
    os_release:os.release(),
    cpu_count:hostCpuCount,
    host_total_memory_gib:hostTotalMemoryGiB,
    host_free_memory_gib:Number((os.freemem()/1024/1024/1024).toFixed(2)),
    repo_disk_free_gib:diskFreeGiB,
    docker_daemon_available:Boolean(dockerServer),
    docker_server_version:dockerServer?.Version??dockerServer?.VersionString??null,
    docker_server_os:dockerInfo?.OSType??null,
    docker_server_architecture:dockerInfo?.Architecture??null,
    docker_server_cpu_count:dockerCpuCount,
    docker_server_memory_gib:dockerMemoryGiB,
    docker_compose_available:compose.ok&&compose.stdout.length>0,
    docker_compose_version:compose.ok?compose.stdout:null,
    active_power_scheme:power?.active_scheme??null,
    ac_sleep_seconds:power?.ac_sleep_seconds??null,
    dc_sleep_seconds:power?.dc_sleep_seconds??null,
    windows_time_service_state:timeService?.state??null,
    windows_time_service_start_mode:timeService?.start_mode??null,
    windows_time_source:source||null,
    windows_time_status_readable:timeStatus.ok,
    system_utc_now:new Date().toISOString(),
    machine_preflight_classification:machineContract.classification??null,
    resource_floor_basis:machineContract.resource_floor_basis??null,
    resource_floor_pass:hostCpuCount>=Number(machineContract.minimum_logical_cpu_count)&&hostTotalMemoryGiB>=Number(machineContract.minimum_host_total_memory_gib)&&dockerCpuCount!==null&&dockerCpuCount>=Number(machineContract.minimum_docker_cpu_count)&&dockerMemoryGiB!==null&&dockerMemoryGiB>=Number(machineContract.minimum_docker_memory_gib)&&diskFreeGiB!==null&&diskFreeGiB>=Number(machineContract.minimum_repo_disk_free_gib),
    durable_log_root:durableLogRoot,
    durable_log_root_exists:durableLogRootExists,
    durable_log_root_writable:durableLogRootWritable,
    durable_log_root_outside_os_temp:durableLogRootOutsideTemp,
    active_network_interface:network?.interface_alias??null,
    active_ipv4_default_gateway:network?.ipv4_default_gateway??null,
    configured_ipv4_dns:Array.isArray(network?.ipv4_dns)?network.ipv4_dns:[],
    network_readiness_pass:Boolean(network),
    provider_request_count:0,
    actual_24h_uptime_proven:false,
    actual_24h_network_continuity_proven:false,
    actual_runtime_restart_policy_proven:false,
    later_runtime_window_required_proofs:Array.isArray(machineContract.later_runtime_window_must_prove)?machineContract.later_runtime_window_must_prove:[],
    blockers,
    runtime_secret_read:false,
    database_connection_attempted:false,
    container_start_count:0,
    runtime_process_start:false,
    production_owner_activation:false,
    formal_v5_arm:false,
    a0_bootstrap:false,
    o00_started:false
  };
  fs.mkdirSync(path.dirname(LOCAL_OUT),{recursive:true});
  fs.writeFileSync(LOCAL_OUT,JSON.stringify(out,null,2)+"\n");
  console.log(JSON.stringify(out,null,2));
  process.exitCode=blockers.length===0?0:1;
}

if(process.argv.includes("--local-machine-probe")){
  runLocalMachineProbe();
  return;
}
try{
  const subject=String(process.env.SUBJECT_SHA||"");
  req(/^[0-9a-f]{40}$/.test(subject),"HOST_BINDING_SUBJECT_SHA_REQUIRED");
  const a=j(AUTH),owner=j(OWNER),ownerArm=j(OWNER_ARM),hostArm=j(HOST_ARM),route=fs.readFileSync(ROUTE,"utf8");
  req(a.schema_version==="geox_mcft_cap09_production_non_github_host_binding_authority_v1","HOST_BINDING_SCHEMA_REQUIRED");
  req(a.authority_id==="GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1","HOST_BINDING_AUTHORITY_ID_REQUIRED");
  req(owner.status==="RUNTIME_CREDENTIAL_BINDING_COMPLETE_NON_GITHUB_HOST_NOT_BOUND"&&owner.current_stage==="RUNTIME_CREDENTIAL_BINDING_COMPLETE_PRE_HOST_BINDING","HOST_BINDING_RUNTIME_CREDENTIAL_CLOSURE_REQUIRED");
  req(owner.runtime_credential_binding_evidence?.status==="IMMUTABLE_SUCCESS"&&owner.runtime_credential_post_binding_readiness_evidence?.status==="IMMUTABLE_SUCCESS","HOST_BINDING_RUNTIME_CREDENTIAL_EVIDENCE_REQUIRED");
  req(owner.target_database?.database_name==="geox_mcft_cap09_production_runtime_v1"&&owner.target_database?.status==="BOUND","HOST_BINDING_PRODUCTION_DATABASE_REQUIRED");
  req(a.production_execution_host_class==="NON_GITHUB_LONG_RUNNING_SERVICE","HOST_BINDING_HOST_CLASS_REQUIRED");
  req(a.github_actions?.production_execution_host_allowed===false,"HOST_BINDING_GITHUB_EXECUTION_HOST_FORBIDDEN");
  for(const m of ["GitHub Actions is not a production execution host","GEOX Evidence Runtime","GEOX Twin Runtime"])req(route.includes(m),"HOST_BINDING_FROZEN_ROUTE_MARKER_REQUIRED:"+m);
  const cp=a.pre_platform_checkpoint_evidence;
  req(cp?.status==="IMMUTABLE_SUCCESS_UNBOUND"&&cp?.host_binding_readiness?.run_id===33424840577&&cp?.owner_provisioning_readiness?.run_id===33424840821,"HOST_BINDING_PRE_PLATFORM_CHECKPOINT_REQUIRED");
  const local=a.local_operator_managed_host_contract;
  req(local?.platform_provider==="LOCAL_OPERATOR_MANAGED_DOCKER"&&local?.region_or_location==="OPERATOR_LOCAL_MACHINE","LOCAL_HOST_CONTRACT_REQUIRED");
  const machineContract=local?.machine_preflight_contract;
  req(machineContract?.schema_version==="geox_mcft_cap09_local_operator_host_machine_preflight_contract_v1"&&machineContract?.classification==="PRE_RUNTIME_STATIC_MACHINE_ADMISSION","LOCAL_MACHINE_PREFLIGHT_CONTRACT_REQUIRED");
  req(machineContract.minimum_logical_cpu_count===2&&machineContract.minimum_host_total_memory_gib===4&&machineContract.minimum_docker_cpu_count===2&&machineContract.minimum_docker_memory_gib===3.5&&machineContract.nominal_docker_memory_class_gib===4&&machineContract.minimum_repo_disk_free_gib===5,"LOCAL_MACHINE_RESOURCE_FLOOR_REQUIRED");
  req(machineContract.durable_log_root==="~/.geox/mcft-cap09/logs"&&machineContract.network_provider_request_forbidden===true&&machineContract.network_database_connection_forbidden===true&&machineContract.runtime_secret_read_forbidden===true&&machineContract.container_start_forbidden===true,"LOCAL_MACHINE_PREFLIGHT_NON_EFFECT_CONTRACT_REQUIRED");
  req(local?.host_id_scheme==="GEOX_LOCAL_HOST_UUID_V1"&&local?.host_id_state_file==="~/.geox/mcft-cap09/local-host-id-v1","LOCAL_HOST_ID_SCHEME_REQUIRED");
  req(local?.container_id_is_authority===false&&local?.compose_project_name==="geox-mcft-cap09-production-v1","LOCAL_HOST_STABLE_IDENTITY_CONTRACT_REQUIRED");
  req(local?.evidence_runtime?.service_name==="geox-mcft-cap09-evidence-runtime-v1"&&local?.evidence_runtime?.runtime_role==="EVIDENCE_RUNTIME"&&local?.evidence_runtime?.execution_class==="LONG_RUNNING_SERVICE","LOCAL_EVIDENCE_SERVICE_CONTRACT_REQUIRED");
  req(local?.evidence_runtime?.compiled_entrypoint==="apps/server/dist/runtime/mcft_cap09_evidence_runtime.js"&&local?.evidence_runtime?.compiled_entrypoint_status==="PACKAGED_FAIL_CLOSED_TARGET_PLANNER_UNBOUND"&&local?.evidence_runtime?.compiled_entrypoint_fail_closed_code==="MCFT_CAP09_EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND"&&local?.evidence_runtime?.target_planner_status==="NOT_BOUND","LOCAL_EVIDENCE_PACKAGING_BOUNDARY_REQUIRED");
  req(local?.twin_runtime?.service_name==="geox-mcft-cap09-twin-runtime-v1"&&local?.twin_runtime?.runtime_role==="TWIN_RUNTIME"&&local?.twin_runtime?.execution_class==="LONG_RUNNING_SERVICE","LOCAL_TWIN_SERVICE_CONTRACT_REQUIRED");
  req(local?.lifecycle_contract?.continuous_operator_window_hours===24&&local?.lifecycle_contract?.host_sleep_forbidden===true&&local?.lifecycle_contract?.docker_engine_must_remain_running===true&&local?.lifecycle_contract?.restart_policy_required==="unless-stopped","LOCAL_24H_LIFECYCLE_CONTRACT_REQUIRED");
  const render=a.render_candidate_binding_contract;
  req(render?.status==="RETIRED_HTTP_402_PAYMENT_REQUIRED_NO_SERVICE_CREATED"&&render?.external_resource_count===0&&render?.retirement_evidence?.http_status===402&&render?.retirement_evidence?.exact_service_id_count===0,"RENDER_RETIREMENT_EVIDENCE_REQUIRED");
  req(a.platform_evaluation?.selected_candidate?.platform_provider==="LOCAL_OPERATOR_MANAGED_DOCKER"&&a.platform_evaluation?.platform_selected===true,"LOCAL_HOST_SELECTION_REQUIRED");
  req(a.external_platform_authorization?.platform_provider==="LOCAL_OPERATOR_MANAGED_DOCKER"&&a.external_platform_authorization?.runtime_process_start_authorized===false,"LOCAL_HOST_AUTHORIZATION_BOUNDARY_REQUIRED");
  req(
    hostArm.platform_provider==="LOCAL_OPERATOR_MANAGED_DOCKER" &&
    hostArm.region_or_location==="OPERATOR_LOCAL_MACHINE" &&
    (
      hostArm.platform_account_or_project_id===null ||
      (
        typeof local?.host_id==="string" &&
        local.host_id.length>0 &&
        hostArm.platform_account_or_project_id==="local-host:"+local.host_id
      )
    ),
    "LOCAL_HOST_ARM_SELECTION_REQUIRED",
  );
  req(hostArm.armed===false&&hostArm.runtime_secret_injection_authorized===false&&hostArm.deployment_authorized===false&&hostArm.runtime_process_start_authorized===false&&hostArm.production_owner_activation_authorized===false&&hostArm.formal_v5_arm_authorized===false&&hostArm.a0_authorized===false&&hostArm.o00_authorized===false,"LOCAL_HOST_ARM_NON_EFFECT_REQUIRED");
  req(ownerArm.armed===false&&ownerArm.runtime_process_start_authorized===false&&ownerArm.production_owner_activation_authorized===false&&ownerArm.formal_v5_arm_authorized===false&&ownerArm.a0_authorized===false&&ownerArm.o00_authorized===false,"OWNER_ARM_MUST_REMAIN_FALSE");
  const unbound=a.status==="LOCAL_OPERATOR_MANAGED_DOCKER_HOST_AUTHORIZED_IDENTITIES_UNBOUND";
  const bound=a.status==="LOCAL_OPERATOR_MANAGED_DOCKER_HOST_IDENTITIES_BOUND";
  req(unbound||bound,"LOCAL_HOST_AUTHORITY_STATUS_REQUIRED");
  if(unbound){
    req(a.binding_state?.platform_selected===true&&a.binding_state?.local_host_id_bound===false&&a.binding_state?.evidence_host_identity_bound===false&&a.binding_state?.twin_host_identity_bound===false&&a.binding_state?.exact_two_runtime_service_identities_bound===false&&a.binding_state?.binding_authorized===false,"LOCAL_HOST_UNBOUND_STATE_REQUIRED");
    req(local.status==="AUTHORIZED_HOST_IDENTITY_UNBOUND"&&local.host_id===null&&local.evidence_runtime.service_id===null&&local.twin_runtime.service_id===null,"LOCAL_HOST_IDENTITIES_MUST_REMAIN_UNBOUND");
  }else{
    req(a.binding_state?.local_host_id_bound===true&&a.binding_state?.evidence_host_identity_bound===true&&a.binding_state?.twin_host_identity_bound===true&&a.binding_state?.exact_two_runtime_service_identities_bound===true&&a.binding_state?.binding_authorized===true,"LOCAL_HOST_BOUND_STATE_REQUIRED");
    req(local.status==="HOST_AND_SERVICE_IDENTITIES_BOUND","LOCAL_HOST_BOUND_CONTRACT_REQUIRED");
  }
  write({
    schema_version:"geox_mcft_cap09_production_non_github_host_binding_preflight_v1",
    status:"PASS",
    stage:unbound?"LOCAL_OPERATOR_MANAGED_HOST_AUTHORIZED_IDENTITIES_UNBOUND":"LOCAL_OPERATOR_MANAGED_HOST_IDENTITIES_BOUND_PRE_RUNTIME_START",
    subject_sha:subject,
    production_execution_host_class:a.production_execution_host_class,
    platform_selected:true,
    platform_provider:"LOCAL_OPERATOR_MANAGED_DOCKER",
    local_host_id_bound:!unbound,
    evidence_host_identity_bound:!unbound,
    twin_host_identity_bound:!unbound,
    exact_two_runtime_service_identities_bound:!unbound,
    binding_authorized:!unbound,
    remaining_blockers:unbound?[
      "LOCAL_OPERATOR_HOST_ID_NOT_BOUND",
      "LOCAL_EVIDENCE_LONG_RUNNING_SERVICE_IDENTITY_NOT_BOUND",
      "LOCAL_TWIN_LONG_RUNNING_SERVICE_IDENTITY_NOT_BOUND",
      "LOCAL_24H_HOST_PREFLIGHT_NOT_PROVEN",
      "NON_GITHUB_HOST_BINDING_NOT_COMPLETE"
    ]:[
      "EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND",
      "LOCAL_24H_HOST_PREFLIGHT_NOT_PROVEN"
    ],
    external_host_provisioning:false,
    deployment:false,
    runtime_process_start:false,
    production_owner_activation:false,
    provider_request_count:0,
    formal_v5_arm:false,
    a0_bootstrap:false,
    o00_started:false
  });
}catch(e){
  write({status:"FAIL",error:e instanceof Error?e.message:String(e),external_host_provisioning:false,deployment:false,runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
  process.exitCode=1;
}
