import assert from "node:assert/strict";
import type {Pool} from "pg";
import {ExternalFormalBootstrapPersistenceServiceV1} from "../../apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.js";
import {PostgresRuntimeRepositoryV1} from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {PostgresNextTickRepositoryV1} from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import type {ExternalFormalBootstrapAuthorityBundleV1} from "../../apps/server/src/domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.js";
import type {ReplayEvidenceSourcePortV1,BootstrapPersistencePortV1} from "../../apps/server/src/runtime/twin_runtime/ports.js";
// Qualification database only. The frozen service builds the actual A0 graph,
// but its commit port is deliberately never called. This is not A0 execution.
export async function probePrewrite(pool:Pool,bundle:ExternalFormalBootstrapAuthorityBundleV1,evidence:ReplayEvidenceSourcePortV1,createdAt:string){
 const connection=(pool as any).options.connectionString;assert.ok(connection,"AM22_PREWRITE_LOCAL_CONNECTION_REQUIRED");
 assert.ok(["127.0.0.1","localhost","[::1]"].includes(new URL(connection).hostname),"AM22_PREWRITE_LOCAL_CONNECTION_REQUIRED");
 const target=String((await pool.query("SELECT current_database() AS name")).rows[0].name);
 assert.ok(/^am22_measure_[a-f0-9]{12}$/.test(target)||target==="am22_o00"&&process.env.CI==="true","AM22_PREWRITE_ISOLATED_DATABASE_REQUIRED");
 const repo=new PostgresRuntimeRepositoryV1(pool);let prepared:Parameters<BootstrapPersistencePortV1["commitBootstrapState"]>[0]|undefined;
 const stop=new Error("AM22_PREWRITE_BOUNDARY_REACHED");
 const service=new ExternalFormalBootstrapPersistenceServiceV1({runtime_config_repository:repo,authority_snapshot_repository:new PostgresNextTickRepositoryV1(pool),evidence_source:evidence,bootstrap_persistence:{acquireLease:claim=>repo.acquireLease(claim),async commitBootstrapState(input){prepared=input;throw stop;},lookupA0RecordSet:key=>repo.lookupA0RecordSet(key),readBootstrapRecordSet:key=>repo.readBootstrapRecordSet(key)}});
 try{await service.execute({bundle,created_at:createdAt,lease_owner:"am22-measurement-prewrite",lease_duration_seconds:300});assert.fail("AM22_PREWRITE_COMMIT_MUST_NOT_RETURN");}catch(e){assert.equal(e,stop);}
 assert.ok(prepared);assert.deepEqual(prepared.expected,{active_lineage_ref:null,checkpoint_ref:null,state_ref:null,forecast_result_ref:null,successful_forecast_ref:null});
 const lease=(await pool.query("SELECT lease_owner,fencing_token,expires_at>clock_timestamp() AS valid FROM twin_runtime_lease_v1")).rows;assert.equal(lease.length,1);assert.equal(lease[0].lease_owner,prepared.lease.lease_owner);assert.equal(BigInt(lease[0].fencing_token),prepared.lease.fencing_token);assert.equal(lease[0].valid,true);
 for(const table of ["twin_active_lineage_index_v1","twin_state_history_projection_v1","twin_state_latest_index_v1","twin_forecast_result_latest_index_v1","twin_runtime_checkpoint_latest_index_v1","twin_runtime_health_latest_index_v1"])assert.equal(Number((await pool.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n),0,"AM22_PREWRITE_NO_BOOTSTRAP_PROJECTION_REQUIRED");
 const released=await pool.query("UPDATE twin_runtime_lease_v1 SET expires_at=clock_timestamp() WHERE lease_owner=$1 AND fencing_token=$2",[prepared.lease.lease_owner,String(prepared.lease.fencing_token)]);assert.equal(released.rowCount,1);
 return {status:"PASS",frozen_bootstrap_service_used:true,actual_record_set_prepared:true,isolated_runtime_config_and_reality_binding_persisted:true,lease_fencing_verified:true,isolated_lease_released:true,bootstrap_commit_called:false,production_database_write_count:0,a0_execution:false};
}
