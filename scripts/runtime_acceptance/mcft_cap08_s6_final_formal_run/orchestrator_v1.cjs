#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {loadFinalRunContractsV1}=require('./contract_loader_v1.cjs');
const {buildOneRunPlanV1}=require('./plan_v1.cjs');
const {buildRecoveryPlanV1}=require('./recovery_plan_v1.cjs');
const {buildCap07ReadbackPlanV1}=require('./cap07_readback_plan_v1.cjs');
const {buildClosureMemberManifestV1}=require('./closure_member_manifest_v1.cjs');
const {buildOperationalEventManifestV1}=require('./operational_event_manifest_v1.cjs');
const {normalizeFinalClosureSourceV1,rejectSliceAcceptanceSourceV1}=require('./source_v1.cjs');
const {invokePerRunWitnessesV1}=require('./witness_invocation_v1.cjs');
const {buildSyntheticOrchestratorInputV1}=require('./synthetic_adapter_v1.cjs');
function compileOneRunArtifactsV1({runLabel,operationalRunInstanceId,exactSubjectSha,input,synthetic=false,executionAuthority=null}){const contracts=loadFinalRunContractsV1();if(!synthetic){assert.equal(executionAuthority?.record_status,'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED','DATABASE_EXECUTION_AUTHORITY_REQUIRED');assert.equal(executionAuthority?.exact_subject_sha,exactSubjectSha,'EXECUTION_AUTHORITY_SUBJECT');}const plan=buildOneRunPlanV1({contracts,runLabel,operationalRunInstanceId,exactSubjectSha});const closureManifest=buildClosureMemberManifestV1({contracts,plan,canonicalMembers:input.canonicalMembers,sourceClassification:synthetic?'SYNTHETIC_ORCHESTRATOR_CONTRACT_FIXTURE':'FINAL_FORMAL_CLOSURE_SOURCE_V1',canonicalReadbackVerified:!synthetic});const operationalManifest=buildOperationalEventManifestV1({plan,events:input.events,databaseInstanceDigest:input.databaseInstanceDigest,artifactDigest:input.artifactDigest,synthetic});const source=normalizeFinalClosureSourceV1({plan,closureManifest,operationalManifest,selectorData:input.selectorData,artifactRef:input.artifactRef,artifactDigest:input.artifactDigest,synthetic});rejectSliceAcceptanceSourceV1(source);const witnessBundle=invokePerRunWitnessesV1({plan,source,artifactRef:input.artifactRef,artifactDigest:input.artifactDigest,synthetic});return{schema_version:'geox_mcft_cap08_s6_compiled_single_run_bundle_v1',classification:synthetic?'SYNTHETIC_ORCHESTRATOR_CONTRACT_TEST_NOT_EXECUTION':'FINAL_FORMAL_CLOSURE_SINGLE_RUN_ARTIFACT_BUNDLE',plan,recovery_plan:buildRecoveryPlanV1(contracts),cap07_readback_plan:buildCap07ReadbackPlanV1(contracts),closure_member_manifest:closureManifest,operational_event_manifest:operationalManifest,source,witness_bundle:witnessBundle,database_execution_authorized:!synthetic,hard_acceptance_eligible:!synthetic&&witnessBundle.hard_acceptance_eligible};}
function compileSyntheticOneRunV1({runLabel,operationalRunInstanceId,exactSubjectSha}){const contracts=loadFinalRunContractsV1();const plan=buildOneRunPlanV1({contracts,runLabel,operationalRunInstanceId,exactSubjectSha});return compileOneRunArtifactsV1({runLabel,operationalRunInstanceId,exactSubjectSha,input:buildSyntheticOrchestratorInputV1(plan),synthetic:true});}
function executeDatabaseRunV1(){throw new Error('FINAL_FORMAL_RUN_DATABASE_EXECUTION_NOT_AUTHORIZED');}
function compareRunsV1(){throw new Error('CROSS_RUN_COMPARATOR_NOT_AUTHORIZED');}
function finalizeLedgerV1(){throw new Error('FINAL_LEDGER_SETTLEMENT_NOT_AUTHORIZED');}
module.exports={compileOneRunArtifactsV1,compileSyntheticOneRunV1,executeDatabaseRunV1,compareRunsV1,finalizeLedgerV1};
