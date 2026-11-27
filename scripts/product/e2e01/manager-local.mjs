// Local-only composition. Never imported by Commercial Server, MCFT or a deployment entry.
import Fastify from 'fastify';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createDatabasePool} from '../../../apps/server/src/infra/database.ts';
import {registerManagerPilotModuleV1} from '../../../apps/server/src/modules/product/registerManagerPilotModuleV1.ts';
import {managerRoute,createBodyAllowed,directory,validatePolicy,field,scope,tenant,issuer} from './contract.mjs';
const must=(v,c)=>{if(!v)throw Error(c)};
const root=resolve(process.cwd());
const cfg=JSON.parse(readFileSync(process.env.GEOX_E2E01_CONFIG,'utf8'));
const kit=resolve(cfg.fdwKit), policyPath=resolve(cfg.ownerPolicy);
const fdw=JSON.parse(readFileSync(join(kit,'.local','runtime-config.json'),'utf8'));
const expected='526138b81d35688b28c9184d665b6e972899a0c0';
must(fdw.expectedHead===expected&&fdw.keycloakUserAndGroupsConfirmed===true&&fdw.revocationEvidenceConfirmed===true&&fdw.keycloakClientSecret,'FDW_CONFIG');
must(execFileSync('git',['-C',fdw.fdwCheckout,'rev-parse','HEAD'],{encoding:'utf8'}).trim()===expected,'FDW_SUBJECT');
must(execFileSync('git',['-C',fdw.fdwCheckout,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim()==='','FDW_TRACKED_DRIFT');
const {createIdentity}=await import(pathToFileURL(join(kit,'keycloak-identity.mjs')).href);
const identity=await createIdentity({formalIdentityModuleUrl:pathToFileURL(join(fdw.fdwCheckout,'src','formal-identity.mjs')).href,issuer,audience:'fdw-business',siteClientId:'fdw-site',siteClientSecret:fdw.keycloakClientSecret,providerConfigVersion:'fdw-local-mapping-v1',mode:'customer',tenants:{acceptance:{canonicalTenantRef:tenant,organizationRef:{issuer,id:'fdw-local-organization-a',version:'1'},requiredGroup:'/fdw-manager-a',resourceGrants:[],capabilities:['CREATE_FIELD']}}});
const url=new URL(process.env.GEOX_E2E01_DATABASE_URL);
must(['postgres:','postgresql:'].includes(url.protocol)&&url.hostname==='127.0.0.1'&&url.port==='15435'&&url.pathname==='/landos'&&url.username==='geox_runtime_v1'&&url.password&&!url.search&&!url.hash,'DATABASE_BINDING');
const pool=createDatabasePool(url.toString());
const readPolicy=()=>JSON.parse(readFileSync(policyPath,'utf8'));
validatePolicy(readPolicy(),cfg.subject);
const check=await pool.query("SELECT current_database() db,session_user::text AS session_id,current_user::text AS current_id, NOT (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls) safe, NOT pg_has_role(rolname,'geox_product_migration_owner_v1','MEMBER') separated, NOT has_schema_privilege(rolname,'geox_manager_v1','CREATE') no_create FROM pg_roles WHERE rolname=current_user");
const c=check.rows[0];
must(c?.db==='landos'&&c.session_id==='geox_runtime_v1'&&c.current_id===c.session_id&&c.safe&&c.separated&&c.no_create,'DATABASE_ROLE');
const ledger=await pool.query("SELECT migration_id,source_sha256,physical_sha256,subject_commit FROM geox_manager_v1.migration_ledger_v1");
must(ledger.rowCount===1&&ledger.rows[0].migration_id==='geox.manager.p2-p4.persistence.v1'&&ledger.rows[0].source_sha256===cfg.migrationSource&&ledger.rows[0].physical_sha256===cfg.migrationPhysical&&ledger.rows[0].subject_commit===cfg.migrationSubject,'DATABASE_LEDGER');
const acl=await pool.query("SELECT c.relname, has_table_privilege(current_user,c.oid,'SELECT') r, has_table_privilege(current_user,c.oid,'INSERT') i, (has_table_privilege(current_user,c.oid,'UPDATE') OR has_any_column_privilege(current_user,c.oid,'UPDATE') OR has_table_privilege(current_user,c.oid,'DELETE') OR has_table_privilege(current_user,c.oid,'TRUNCATE') OR has_table_privilege(current_user,c.oid,'TRIGGER') OR has_any_column_privilege(current_user,c.oid,'REFERENCES')) forbidden FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='geox_manager_v1' AND c.relkind='r'");
must(acl.rowCount===6&&acl.rows.every(x=>x.r&&!x.forbidden&&x.i===(x.relname!=='migration_ledger_v1')),'DATABASE_ACL');
const exists=async()=>{const r=await pool.query('SELECT field_id FROM public.field_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4',[scope.tenant_id,scope.project_id,scope.group_id,field]);return r.rowCount===1};
const grants=directory(readPolicy,cfg.subject,exists);
const app=Fastify({logger:false,bodyLimit:100000,exposeHeadRoutes:false});
app.addHook('onRequest',async(req,reply)=>{
 if(req.headers.host!=='127.0.0.1:14175')return reply.code(403).send({ok:false,error:'LOCAL_HOST_REQUIRED'});
 if(!managerRoute(req.method,req.raw.url))return reply.code(403).send({ok:false,error:'E2E01_ROUTE_OR_SCOPE_DENIED'});
});
app.addHook('preHandler',async(req,reply)=>{
 if(req.method==='POST'&&req.raw.url==='/api/v1/manager/fields'&&!createBodyAllowed(req.body))return reply.code(403).send({ok:false,error:'E2E01_CREATE_TARGET_DENIED'});
});
registerManagerPilotModuleV1(app,pool,{identity,issuer,canonicalTenantRef:tenant,...grants});
// No ADR credentials/plan synthesized. A07/A08 remains unavailable until supplied by its Owner.
await app.listen({host:'127.0.0.1',port:14175});
console.log('E2E01_MANAGER_LOCAL_READY / DB_ROLE_AND_LEDGER_ACL_PASS / ADR_NOT_CONFIGURED');
for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>{void app.close().then(()=>pool.end()).then(()=>process.exit(0));});
