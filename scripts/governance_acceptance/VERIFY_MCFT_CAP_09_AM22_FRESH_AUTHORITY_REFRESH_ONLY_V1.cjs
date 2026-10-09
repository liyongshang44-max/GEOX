"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../..");
const git=(args,options={})=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",...options}).trim();
const lines=value=>value.split(/\r?\n/).filter(Boolean);
const isAncestor=(a,b)=>{try{git(["merge-base","--is-ancestor",a,b]);return true;}catch{return false;}};
const fail=code=>{throw new Error(code);};
const BASE="84afa1f2fd14618860780275809a6a473761beca";
const SELF_REL="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs";
const GOV="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_START_CHAIN_ENGINEERING_ONLY_V2.cjs";
const SELF="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs";
const TEST="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs";
const WORKFLOW=".github/workflows/mcft-cap-09-am22-start-chain-v2-engineering.yml";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const REGISTRY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const AUTHORITY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-09T04Z-V1.json";
const POLICY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-EFFECTIVE-START-AUTHORITY-V2.json";
const PATHS=[SELF_REL,".github/workflows/mcft-cap-09-am22-start-chain-v2-engineering.yml","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-09T04Z-V1.json","scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs","scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs","scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_START_CHAIN_ENGINEERING_ONLY_V2.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs"].sort();
const ADDED=["scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs","scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-09T04Z-V1.json"];
const ROUTE=" if(fs.existsSync(path.join(ROOT,\"scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs\")))return require(\"./VERIFY_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs\").verifyRefreshOnly();\n";
const STEP="      - name: Fresh authority append negatives\n        run: |\n          node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs\n";
const CHECK={"check_id":"AM22_FRESH_AUTHORITY_APPEND_ONLY","owner":"MCFT_CAP09_AM22_FRESH_AUTHORITY","generation_scope":["FORMAL_V5","AM22_FRESH_AUTHORITY_APPEND_ONLY"],"authority_refs":["docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-EFFECTIVE-START-AUTHORITY-V2.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-09T04Z-V1.json"],"resolver_ids":["AM22_FRESH_AUTHORITY_APPEND_ONLY_V1"],"historical_evidence_policy":"NO_FORMAL_START_OR_ARM_CARRY_FORWARD","execution_workflow":".github/workflows/mcft-cap-09-am22-start-chain-v2-engineering.yml","execution_workflow_status":"QUALIFICATION_ONLY_NO_PRODUCTION_CREDENTIALS","fail_policy":"FAIL_CLOSED_REAL_ARCHIVE_EXACT_SCOPE_AND_DISABLED_START_POLICY","carry_forward_policy":"NONE","requalification_triggers":["AM22_FRESH_AUTHORITY_APPEND_ONLY_V1"],"applicable_stages":["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION"],"carry_forward_evidence_id":null,"diagnostic_command":"node scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs"};
function verifyFormalV5AuthorityContinuity(headRef = "HEAD", historicalReplay = false) {
  const assert = require("node:assert/strict");
  const crypto = require("node:crypto");
  const zlib = require("node:zlib");
  const baseline = BASE;
  const head = git(["rev-parse", headRef]);
  if (head === baseline || !isAncestor(baseline, head)) return null;
  const registryRel = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
  const prefix = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-";
  const governance = new Set([
    SELF_REL,
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_R6_ADMISSION_V1.cjs",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_V1.cjs",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_COMPLETION_ADJUDICATION_V1.cjs",
  ]);
  const changes = lines(git(["diff", "--name-status", baseline, head])).map(row => {
    const [status, rel] = row.split("\t");
    return {status, rel};
  });
  const added = [];
  for (const {status, rel} of changes) {
    if (PATHS.includes(rel) && status === (ADDED.includes(rel) ? "A" : "M") && rel !== AUTHORITY) continue;
    if (rel === registryRel && status === "M") continue;
    if (status === "A" && rel.startsWith(prefix)
        && /^\d{4}-\d{2}-\d{2}T\d{2}Z-V1\.json$/.test(rel.slice(prefix.length))) {
      added.push(rel);
      continue;
    }
    fail("FORMAL_V5_AUTHORITY_CONTINUITY_PATH_FORBIDDEN", {status, rel});
  }
  const before = JSON.parse(git(["show", baseline + ":" + registryRel]));
  const after = JSON.parse(fs.readFileSync(path.join(ROOT, registryRel), "utf8"));
  const {entries: oldEntries, ...oldContract} = before;
  const {entries: newEntries, ...newContract} = after;
  assert.deepEqual(newContract, oldContract, "FORMAL_V5_AUTHORITY_REGISTRY_CONTRACT_CHANGED");
  assert.deepEqual(newEntries.slice(0, oldEntries.length), oldEntries, "FORMAL_V5_AUTHORITY_REGISTRY_HISTORY_CHANGED");
  const appended = newEntries.slice(oldEntries.length);
  assert.equal(appended.length, added.length, "FORMAL_V5_AUTHORITY_REGISTRY_APPEND_COUNT");
  assert.deepEqual(appended.map(x => x.authority_ref).sort(), added.sort(), "FORMAL_V5_AUTHORITY_REGISTRY_APPEND_REFS");
  const observedProtectedMain = git(["rev-parse", "origin/main"]);
  if (historicalReplay) {
    assert.notEqual(headRef, "HEAD", "FORMAL_V5_HISTORICAL_REPLAY_EXPLICIT_HEAD_REQUIRED");
    assert.ok(isAncestor(head, observedProtectedMain), "FORMAL_V5_HISTORICAL_REPLAY_NOT_ADOPTED_BY_CURRENT_MAIN");
  }
  const protectedMain = historicalReplay ? head : observedProtectedMain;
  assert.ok(isAncestor(protectedMain, head), "FORMAL_V5_AUTHORITY_BASE_NOT_CURRENT_MAIN_ANCESTOR");
  for (const commit of lines(git(["rev-list", "--first-parent", baseline + ".." + protectedMain]))) {
    for (const row of lines(git(["diff", "--name-status", commit + "^1", commit]))) {
      const [status, rel] = row.split("\t");
      if (rel.startsWith(prefix)) assert.equal(status, "A", "FORMAL_V5_AUTHORITY_PROTECTED_HISTORY_MUTATION");
    }
  }
  const expectedScope = JSON.parse(git(["show", baseline + ":" + oldEntries.at(-1).authority_ref])).scope;
  const digest = bytes => "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
  const expectedFiles = [
    "MCFT_CAP09_T4R1_ROLLING_THERMAL_SNAPSHOT_OVERLAY_PROOF.json",
    "MCFT_CAP09_T4R1_THERMAL_BIOLOGICAL_STAGE_PROBE_RESULT.json",
    "MCFT_CAP09_T4R1_PROTECTED_MAIN_SUCCESSOR_CHAIN_RESULT.json",
    "MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_GOVERNANCE_RESULT.json",
    "MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_RESULT.json",
    "MCFT_CAP09_T4R1_CURRENT_CROP_AUTHORITY_COMPOSITION_RESULT.json",
  ].sort();
  for (const entry of appended) {
    let protectedBlob = null;
    try { protectedBlob = git(["rev-parse", protectedMain + ":" + entry.authority_ref], {stdio: ["ignore", "pipe", "ignore"]}); } catch {}
    if (protectedBlob) assert.equal(git(["rev-parse", head + ":" + entry.authority_ref]), protectedBlob, "FORMAL_V5_AUTHORITY_ALREADY_ADOPTED_MUTATION");
    const bytes = fs.readFileSync(path.join(ROOT, entry.authority_ref));
    assert.equal(digest(bytes), entry.authority_sha256, "FORMAL_V5_AUTHORITY_DIGEST");
    const authority = JSON.parse(bytes);
    assert.deepEqual(authority.scope, expectedScope, "FORMAL_V5_AUTHORITY_EXACT_SCOPE");
    const evidence = authority.qualification_evidence;
    assert.equal(authority.status, "PASS");
    assert.equal(authority.architecture_effective, true);
    assert.equal(authority.runtime_consumption_authorized, true);
    assert.equal(authority.graduation.status, "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH");
    assert.equal(entry.graduation_status, authority.graduation.status);
    assert.equal(entry.authority_as_of, authority.biological_stage.authority_as_of);
    assert.equal(entry.authority_valid_until, authority.biological_stage.authority_valid_until);
    assert.equal(Date.parse(entry.authority_valid_until) - Date.parse(entry.authority_as_of), 30 * 3600000);
    const qualificationMs = Date.parse(authority.refresh.qualification_time);
    assert.ok(qualificationMs >= Date.parse(entry.authority_as_of) && qualificationMs <= Date.parse(entry.authority_valid_until), "FORMAL_V5_AUTHORITY_STALE_AT_QUALIFICATION");
    assert.equal(authority.biological_stage.epistemic_class, "THERMAL_MODEL_DERIVED");
    assert.equal(authority.biological_stage.observed_biological_stage_claimed, false);
    assert.equal(evidence.subject_sha, authority.subject_head_sha);
    assert.ok(isAncestor(evidence.subject_sha, head), "FORMAL_V5_AUTHORITY_SUBJECT_NOT_ANCESTOR");
    assert.equal(evidence.archive_encoding, "base64");
    assert.ok(Number.isSafeInteger(evidence.run_id) && Number.isSafeInteger(evidence.artifact_id));
    assert.equal(evidence.run_url, "https://github.com/liyongshang44-max/GEOX/actions/runs/" + evidence.run_id);
    assert.deepEqual(Object.keys(evidence.files).sort(), expectedFiles, "FORMAL_V5_AUTHORITY_SIX_FILE_ENVELOPE");
    const zip = Buffer.from(evidence.archive_bytes, "base64");
    assert.equal(digest(zip), evidence.artifact_sha256, "FORMAL_V5_AUTHORITY_ARCHIVE_DIGEST");
    const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    assert.ok(end >= 0, "FORMAL_V5_AUTHORITY_ZIP_DIRECTORY_REQUIRED");
    assert.equal(zip.readUInt16LE(end + 10), 6, "FORMAL_V5_AUTHORITY_ZIP_FILE_COUNT");
    let cursor = zip.readUInt32LE(end + 16);
    const files = {};
    for (let i = 0; i < 6; i++) {
      assert.equal(zip.readUInt32LE(cursor), 0x02014b50);
      const nameLength = zip.readUInt16LE(cursor + 28);
      const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
      assert.ok(expectedFiles.includes(name) && !files[name], "FORMAL_V5_AUTHORITY_ZIP_FILE_IDENTITY");
      const offset = zip.readUInt32LE(cursor + 42);
      assert.equal(zip.readUInt32LE(offset), 0x04034b50);
      const start = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
      const compressed = zip.subarray(start, start + zip.readUInt32LE(cursor + 20));
      const method = zip.readUInt16LE(cursor + 10);
      assert.ok(method === 0 || method === 8, "FORMAL_V5_AUTHORITY_ZIP_COMPRESSION");
      const data = method === 8 ? zlib.inflateRawSync(compressed, {maxOutputLength: 16 * 1024 * 1024}) : compressed;
      assert.equal(data.length, zip.readUInt32LE(cursor + 24));
      assert.equal(digest(data), evidence.files[name].sha256, "FORMAL_V5_AUTHORITY_EVIDENCE_FILE_DIGEST");
      files[name] = JSON.parse(data);
      cursor += 46 + nameLength + zip.readUInt16LE(cursor + 30) + zip.readUInt16LE(cursor + 32);
    }
    for (const file of Object.values(files)) assert.equal(file.status, "PASS");
    const candidate = files["MCFT_CAP09_T4R1_CURRENT_CROP_AUTHORITY_COMPOSITION_RESULT.json"];
    const lifecycle = files["MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_RESULT.json"];
    const gov = files["MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_GOVERNANCE_RESULT.json"];
    const chain = files["MCFT_CAP09_T4R1_PROTECTED_MAIN_SUCCESSOR_CHAIN_RESULT.json"];
    assert.equal(candidate.subject_head_sha, evidence.subject_sha);
    assert.equal(lifecycle.subject_sha, evidence.subject_sha);
    assert.equal(gov.subject_sha, evidence.subject_sha);
    assert.equal(chain.admitted_base_sha, evidence.subject_sha);
    assert.equal(gov.subject_is_current_protected_main, true);
    assert.equal(gov.successor_chain_effectiveness_adjudicated, true);
    assert.equal(lifecycle.qualification_outcome, "ACTIVE_CANDIDATE");
    assert.equal(lifecycle.protected_main_authority_context.live_result_eligible_for_protected_main_adoption, true);
    assert.equal(candidate.architecture_effective, false);
    assert.equal(candidate.runtime_consumption_authorized, false);
    assert.deepEqual(authority.scope, candidate.scope);
    assert.deepEqual(authority.lifecycle, candidate.lifecycle);
    assert.deepEqual(authority.crop_model_parameter, candidate.crop_model_parameter);
    assert.equal(authority.crop_water_use_stage, candidate.crop_water_use_stage);
    const {authority_valid_until, ...bio} = authority.biological_stage;
    assert.deepEqual(bio, candidate.biological_stage);
    assert.equal(authority.evidence_digest, candidate.evidence_digest);
    const request = authority.refresh_request;
    assert.equal(digest(Buffer.from(JSON.stringify(request, null, 2) + "\n")), authority.graduation.refresh_request_sha256);
    assert.equal(request.target_artifact.ref, entry.authority_ref);
    assert.equal(request.protected_main_base_sha, evidence.subject_sha);
    assert.equal(request.qualification_time, authority.refresh.qualification_time);
    const previous = request.previous_effective_current_crop_authority;
    assert.equal(previous.overwrite_forbidden, true);
    assert.equal(digest(fs.readFileSync(path.join(ROOT, previous.ref))), previous.sha256);
    const certificate = request.architecture_effectiveness;
    assert.equal(digest(fs.readFileSync(path.join(ROOT, certificate.ref))), certificate.sha256);
    assert.equal(certificate.sha256, authority.graduation.architecture_effectiveness_sha256);
    for (const key of ["database_write_authorized", "runtime_config_write_authorized", "scheduler_write_authorized", "formal_evidence_write_authorized", "production_runtime_start_authorized", "production_owner_activation_authorized", "formal_v5_authorized", "a0_authorized", "o00_o23_authorized", "mcft_cap09_completed"]) {
      assert.equal(authority[key], false, "FORMAL_V5_AUTHORITY_CEILING:" + key);
      assert.equal(candidate[key], false, "FORMAL_V5_CANDIDATE_CEILING:" + key);
    }
  }
  return {baseline, changedPaths: changes.map(x => x.rel), authorityCount: added.length};
}


function validateBoundary(changes,before,after,rootPolicy,baselinePolicy){
 assert.deepEqual(changes.map(x=>x.rel).sort(),PATHS,"AM22_REFRESH_EXACT_PATHS_REQUIRED");
 for(const x of changes)assert.equal(x.status,ADDED.includes(x.rel)?"A":"M","AM22_REFRESH_DESTRUCTIVE_CHANGE_FORBIDDEN");
 assert.equal(rootPolicy,baselinePolicy,"AM22_REFRESH_ROOT_POLICY_OR_TRUST_KEY_CHANGED");
 assert.equal(after.checks.length,before.checks.length+1);assert.deepEqual(after.checks.at(-1),CHECK,"AM22_REFRESH_CHECK_CHANGED");
 assert.deepEqual(after.dependency_resolvers.AM22_FRESH_AUTHORITY_APPEND_ONLY_V1,{kind:"EXACT_PATH_SET",paths:PATHS});
 const normalized=structuredClone(after);normalized.checks.pop();delete normalized.dependency_resolvers.AM22_FRESH_AUTHORITY_APPEND_ONLY_V1;assert.deepEqual(normalized,before,"AM22_REFRESH_PREDECESSOR_QCP_CHANGED");
}
function verifyRefreshOnly(){
 const bootstrap=require("./VERIFY_MCFT_CAP_09_AM22_START_CHAIN_ENGINEERING_ONLY_V2.cjs").verifyGfsBootstrapOnly();if(bootstrap)return bootstrap;
 assert.ok(isAncestor(BASE,"HEAD")&&isAncestor(BASE,"origin/main"),"AM22_REFRESH_ADOPTED_BASE_REQUIRED");
 assert.deepEqual(lines(git(["status","--porcelain","--untracked-files=normal"])).filter(x=>x!=="?? acceptance-output/"),[],"AM22_REFRESH_DIRTY_SOURCE");
 const at=rel=>cp.execFileSync("git",["show",BASE+":"+rel],{cwd:ROOT,encoding:"utf8"}),read=rel=>fs.readFileSync(path.join(ROOT,rel),"utf8");
 const changes=lines(git(["diff","--name-status",BASE,"HEAD"])).map(x=>{const [status,rel]=x.split("\t");return {status,rel};});
 validateBoundary(changes,JSON.parse(at(QCP)),JSON.parse(read(QCP)),read(POLICY),at(POLICY));
 assert.equal(read(GOV).replace(ROUTE,""),at(GOV),"AM22_REFRESH_MEASUREMENT_CHECKER_CHANGED");
 assert.equal(read(WORKFLOW).replace(STEP,""),at(WORKFLOW),"AM22_REFRESH_PREDECESSOR_WORKFLOW_CHANGED");
 const replayBefore = at(SELF_REL);
 const replayBlock = "  const observedProtectedMain = git([\"rev-parse\", \"origin/main\"]);\n  if (historicalReplay) {\n    assert.notEqual(headRef, \"HEAD\", \"FORMAL_V5_HISTORICAL_REPLAY_EXPLICIT_HEAD_REQUIRED\");\n    assert.ok(isAncestor(head, observedProtectedMain), \"FORMAL_V5_HISTORICAL_REPLAY_NOT_ADOPTED_BY_CURRENT_MAIN\");\n  }\n  const protectedMain = historicalReplay ? head : observedProtectedMain;\n  assert.ok(isAncestor(protectedMain, head), \"FORMAL_V5_AUTHORITY_BASE_NOT_CURRENT_MAIN_ANCESTOR\");\n";
 const replayHelper = "  // Historical replay reads one immutable commit, never the current checkout.\n  const readEvidence = rel => historicalReplay\n    ? cp.execFileSync(\"git\", [\"show\", head + \":\" + rel], {cwd: ROOT, maxBuffer: 64 * 1024 * 1024})\n    : fs.readFileSync(path.join(ROOT, rel));\n";
 const replayNeedle = "  const registryRel = \"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json\";";
 let replayExpected = replayBefore.replace(replayBlock, "").replace(replayNeedle, replayBlock + replayHelper + replayNeedle);
 for (const [before,after] of [
  ['fs.readFileSync(path.join(ROOT, registryRel), "utf8")','readEvidence(registryRel)'],
  ['fs.readFileSync(path.join(ROOT, entry.authority_ref))','readEvidence(entry.authority_ref)'],
  ['fs.readFileSync(path.join(ROOT, previous.ref))','readEvidence(previous.ref)'],
  ['fs.readFileSync(path.join(ROOT, certificate.ref))','readEvidence(certificate.ref)'],
 ]) replayExpected = replayExpected.replace(before, after);
 assert.equal(read(SELF_REL), replayExpected, "AM22_REFRESH_HISTORICAL_REPLAY_ONLY_CORRECTION_REQUIRED");
 const predecessor=at(SELF_REL);const start=predecessor.indexOf("function verifyFormalV5AuthorityContinuity(");const end=predecessor.indexOf("\nmodule.exports = {verifyFormalV5AuthorityContinuity};");
 const expected=predecessor.slice(start,end).trim().replace('const baseline = "f97bb9b9f29dc276c382e8d02c4644aa9ae2ca0b";','const baseline = BASE;').replace('if (governance.has(rel) && status === "M") continue;','if (PATHS.includes(rel) && status === (ADDED.includes(rel) ? "A" : "M") && rel !== AUTHORITY) continue;');
 assert.equal(verifyFormalV5AuthorityContinuity.toString(),expected,"AM22_REFRESH_FROZEN_ARCHIVE_VERIFIER_CHANGED");
 assert.equal(read("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs").replace("after=JSON.parse(cp.execFileSync(\"git\",[\"show\",\"84afa1f2fd14618860780275809a6a473761beca:\"+gov.QCP],{cwd:m.ROOT,encoding:\"utf8\"}))","after=JSON.parse(fs.readFileSync(path.join(m.ROOT,gov.QCP),\"utf8\"))"),at("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs"),"AM22_REFRESH_ORIGINAL_NEGATIVES_CHANGED");
 const result=verifyFormalV5AuthorityContinuity();assert.equal(result.authorityCount,1,"AM22_REFRESH_EXACT_ONE_REAL_AUTHORITY_REQUIRED");
 const stage=JSON.parse(read(AUTHORITY));assert.equal(stage.biological_stage.authority_as_of,"2026-10-09T04:00:00.000Z");assert.equal(stage.biological_stage.resolved_biological_stage,"R6_OR_LATER_MODEL_ESTIMATE");assert.equal(stage.crop_water_use_stage,"LATE");assert.equal(stage.crop_model_parameter.value,0.6);
 const actual=stage.qualification_evidence;assert.equal(actual.run_id,37882128562);assert.equal(actual.artifact_id,11595440672);assert.equal(actual.artifact_sha256,"sha256:e6e66991f71a35d2ac421a0692b9777ac836403c047cad66b310d66047347561");assert.equal(actual.subject_sha,BASE);
 const m=require("../runtime_acceptance/MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs");let a0=Math.ceil(Date.parse(stage.refresh.qualification_time)/3600000)*3600000;if(a0-Date.parse(stage.refresh.qualification_time)<m.TIMEOUT_MS)a0+=3600000;const covered=m.stageCoverage(stage,new Date(a0).toISOString(),stage.refresh.qualification_time);
 return {status:"PASS",baseline:BASE,changedPaths:[...new Set([...lines(git(["diff","--name-only","f97bb9b9f29dc276c382e8d02c4644aa9ae2ca0b",BASE])),...changes.map(x=>x.rel)])],qualification_scope:"AM22_DISABLED_START_CHAIN_ENGINEERING_ONLY",current_delta_scope:"REAL_FRESH_AUTHORITY_APPEND_ONLY",authority_as_of:stage.biological_stage.authority_as_of,authority_valid_until:stage.biological_stage.authority_valid_until,qualification_window:covered,current_database_clock_revalidation_still_required:true,production_preparation_qualified:false,production_runtime_start_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,mcft_cap09_completed:false};
}
module.exports={verifyRefreshOnly,validateBoundary,verifyFormalV5AuthorityContinuity,BASE,PATHS,ADDED,CHECK,QCP,POLICY,AUTHORITY,ROOT};
if(require.main===module)console.log(JSON.stringify(verifyRefreshOnly(),null,2));
