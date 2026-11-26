// P6-C3 transport only, ADR @ d63c3058d6b95873e811445920f7302ded980ef3.
// P02 SDK and pilot-host wire contract. No local scientific authority.
import type {ManagerAuthorizerV1,ManagerAuthorityV1} from '../../auth/manager_authority_v1.js';
import {digest} from '../field/soil_csv_p2_v1.js';

const operations = {
 createDecisionProblem:['/v1/decision-problems','adr.decision-problem.v1','DecisionProblem'],
 createContextDatum:['/v1/context-data','adr.context-datum.v1','ContextDatum'],
 createContextManifest:['/v1/context-manifests','adr.context-manifest.v1','ContextManifest'],
 executeKnowledgeRetrieval:['/v1/knowledge-retrieval-results','adr.knowledge-retrieval-result.v1','KnowledgeRetrievalResult'],
 createApplicabilityAssessment:['/v1/applicability-assessments','adr.applicability-assessment.v1','ApplicabilityAssessment'],
} as const;
export type AdrReviewOperationV1=keyof typeof operations;
export type AdrRefV1={kind:string;logical_id:string;version:string;semantic_hash:string};
type Principal={principal_id:string;type:'USER'|'SERVICE_ACCOUNT';organization_id:string;tenant_id:string;program_ids:string[]};
type Resource=Record<string,unknown>&{contract_version:string};
export type AdrReviewBindingV1={
 authority_scope:{actor_id:string;tenant_id:string;project_id:string;group_id:string;field_id:string;mapping_version:string;credential_ref:string};
 request_sha256:string;principal:Principal;authorization_ref:AdrRefV1;credential_ref:string;valid_until_ms:number;
};
export type AdrWriteInputV1={logical_id:string;version:string;resource:Resource;idempotency_key:string};
export type AdrWriteReceiptV1={ref:AdrRefV1;resource:Resource;request_sha256:string;response_sha256:string};
export class AdrReviewConsumerErrorV1 extends Error{
 constructor(public readonly code:string,public readonly httpStatus:number|null=null){super(code);}
}
function fail(code:string,status:number|null=null):never{throw new AdrReviewConsumerErrorV1(code,status);}
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const exact=(x:unknown,keys:string[])=>record(x)&&Object.keys(x).sort().join('|')===keys.sort().join('|');
const str=(x:unknown):x is string=>typeof x==='string'&&x.length>0&&x.length<=512&&x.trim()===x&&!/[\x00-\x1f\x7f]/.test(x);
function ref(x:unknown,kind:string):x is AdrRefV1{
 return exact(x,['kind','logical_id','version','semantic_hash'])&&record(x)&&x.kind===kind&&str(x.logical_id)&&str(x.version)&&typeof x.semantic_hash==='string'&&/^sha256:[a-f0-9]{64}$/.test(x.semantic_hash);
}
function validPrincipal(x:unknown):x is Principal{
 return exact(x,['principal_id','type','organization_id','tenant_id','program_ids'])&&record(x)&&str(x.principal_id)&&str(x.organization_id)&&str(x.tenant_id)&&(x.type==='USER'||x.type==='SERVICE_ACCOUNT')&&Array.isArray(x.program_ids)&&x.program_ids.length>0&&x.program_ids.length<=64&&x.program_ids.every(str)&&new Set(x.program_ids).size===x.program_ids.length;
}
export function createAdrReviewConsumerV1(config:{
 baseUrl:string;authority:ManagerAuthorizerV1;
 resolveBinding(input:{manager:ManagerAuthorityV1;operation:AdrReviewOperationV1;request_sha256:string}):Promise<AdrReviewBindingV1|null>;
 getCredential(ref:string):Promise<string>;timeoutMs?:number;transport?:typeof fetch;
}){
 const origin=new URL(config.baseUrl);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)fail('ADR_HTTPS_ORIGIN_REQUIRED');
 const timeout=config.timeoutMs??5000;
 if(!Number.isSafeInteger(timeout)||timeout<1||timeout>30000||typeof config.resolveBinding!=='function'||typeof config.getCredential!=='function')fail('ADR_CONSUMER_CONFIG_INVALID');
 const transport=config.transport??fetch;
 return Object.freeze({
  async write(manager:ManagerAuthorityV1,operation:AdrReviewOperationV1,input:AdrWriteInputV1):Promise<AdrWriteReceiptV1>{
   const field=manager.field_id;
   if(!field)fail('ADR_FIELD_REQUIRED');
   config.authority.assertCurrent(manager,field,'REQUEST_CROP_REVIEW');
   if(!Object.hasOwn(operations,operation))fail('ADR_OPERATION_DENIED');
   const [path,contract,kind]=operations[operation];
   if(!exact(input,['logical_id','version','resource','idempotency_key'])||!str(input.logical_id)||!str(input.version)||!str(input.idempotency_key)||!record(input.resource)||input.resource.contract_version!==contract)fail('ADR_REQUEST_CONTRACT_INVALID');
   const request=structuredClone(input),request_sha256=digest({operation,request});
   const found=await config.resolveBinding({manager,operation,request_sha256});
   if(!found)fail('ADR_AUTHORITY_BINDING_REQUIRED');
   const binding=structuredClone(found);
   const scope={actor_id:manager.actor_id,tenant_id:manager.tenant_id,project_id:manager.project_id,group_id:manager.group_id,field_id:field,mapping_version:manager.mapping_version,credential_ref:manager.credential_ref};
   const current=()=>{
    config.authority.assertCurrent(manager,field,'REQUEST_CROP_REVIEW');
    if(!Number.isFinite(binding.valid_until_ms)||binding.valid_until_ms<=Date.now()||binding.valid_until_ms>manager.valid_until_ms||
     binding.request_sha256!==request_sha256||digest(binding.authority_scope)!==digest(scope)||!validPrincipal(binding.principal)||!ref(binding.authorization_ref,'AuthorizationDecisionAudit')||!str(binding.credential_ref))fail('ADR_AUTHORITY_BINDING_DENIED');
   };
   current();
   const token=await config.getCredential(binding.credential_ref);
   if(typeof token!=='string'||!token||token.length>32768||/\s/.test(token))fail('ADR_CREDENTIAL_REQUIRED');
   current();
   const body={logical_id:request.logical_id,version:request.version,principal:binding.principal,authorization_decision_ref:binding.authorization_ref,resource:request.resource};
   const wireDigest=digest(body);
   let response:Response;
   try{
    response=await transport(new URL(path,origin),{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeout),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':request.idempotency_key},body:JSON.stringify(body)});
   }catch{fail('ADR_WRITE_OUTCOME_UNKNOWN');}
   // A failed response does not necessarily mean the remote write did not commit.
   if(response.status!==201){
    if([400,401,403,404,409,422].includes(response.status))fail('ADR_WRITE_REJECTED',response.status);
    fail('ADR_WRITE_OUTCOME_UNKNOWN',response.status);
   }
   try{
    const raw=await response.text();
    if(raw.length>2_000_000)fail('ADR_RESPONSE_TOO_LARGE');
    const value:unknown=JSON.parse(raw);
    if(!record(value)||!ref(value.ref,kind)||value.ref.logical_id!==request.logical_id||value.ref.version!==request.version||!record(value.resource)||value.resource.contract_version!==contract)fail('ADR_RESPONSE_CONTRACT_INVALID');
    current();
    return {ref:value.ref,resource:value.resource as Resource,request_sha256:wireDigest,response_sha256:digest(value)};
   }catch{fail('ADR_WRITE_OUTCOME_UNKNOWN',201);}
  }
 });
}
