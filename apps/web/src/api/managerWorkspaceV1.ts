// P6-E candidate. Formal manager transport is injected by the admitted session
// composition. Never reads legacy Commercial token or stores credentials.
export type ManagerTransport=(path:string,init:RequestInit)=>Promise<Response>;
export type Geometry={type:'Polygon';coordinates:number[][][]};
export type Boundary={field_id:string;geometry:Geometry|null;geometry_updated_ts_ms:number|null;field_updated_ts_ms:number};
export type SoilRow={row_number:number;sample_id:string;sampled_on:string;latitude_deg:number;longitude_deg:number;depth_top_cm:number;depth_bottom_cm:number;analyte:string;value:number;unit:string;method:string};
export type SoilDoc={document_id:string;revision:number;original_name:string;source_label:string;original_sha256:string;candidate_sha256:string;candidates:SoilRow[];latest_revision:boolean;current_context_eligible:boolean;status:string};
export type DocumentRef=Pick<SoilDoc,'document_id'|'revision'|'candidate_sha256'>;
export type ReviewIntent={review_id:string;crop_codes:string[];target_start_date:string;target_end_date:string;documents:DocumentRef[]};
export type Review={review_id:string;created_at:string;intent:ReviewIntent;status:string;action_authority:false};
export type NativeRef={kind:string;logical_id:string;version:string;semantic_hash:string};
export type Assessment={attempt_id:string;status:string;error_code:string|null;assessment_refs:NativeRef[];receipts:{operation:string;ref:NativeRef;response_sha256:string}[];action_authority:false;scientific_result_content_display_authority:string};
export type Followup={followup_id:string;result:{baseline_review_id:string;successor_review_id:string;status:string;action_authority:false}};
const ident=(x:string)=>{if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x))throw new Error('INVALID_IDENTIFIER');return encodeURIComponent(x);};
export class ManagerApiError extends Error{constructor(readonly code:string,readonly status:number,readonly unknownWrite:boolean){super(code);}}
export function managerApi(transport:ManagerTransport){
 const call=async<T>(method:string,path:string,body?:unknown):Promise<T>=>{
  const write=method!=='GET';let response:Response;
  try{response=await transport(path,{method,cache:'no-store',redirect:'error',headers:{accept:'application/json',...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});}catch{throw new ManagerApiError('TRANSPORT_UNAVAILABLE',0,write);}
  let x:any;try{x=await response.json();}catch{throw new ManagerApiError('RESPONSE_INVALID',response.status,write);}
  if(!response.ok||x?.ok!==true)throw new ManagerApiError(typeof x?.error==='string'?x.error:'REQUEST_REJECTED',response.status,write&&response.status>=500);
  return x as T;
 };
 const field=(id:string)=>'/api/v1/manager/fields/'+ident(id);
 const soil=(id:string)=>'/api/v1/fields/'+ident(id)+'/soil-documents';
 const reviews=(id:string)=>field(id)+'/crop-reviews';
 const review=(id:string,r:string)=>reviews(id)+'/'+ident(r);
 return {
  create:(body:{field_id:string;name:string;area_ha?:number})=>call<{field_id:string;field_access_grant_issued:false}>('POST','/api/v1/manager/fields',body),
  boundary:(id:string)=>call<Boundary>('GET',field(id)+'/geometry'),
  updateBoundary:(id:string,geometry:Geometry,expected_updated_ts_ms:number)=>call<{updated_ts_ms:number}>('PUT',field(id),{polygon_geojson:geometry,expected_updated_ts_ms}),
  documents:(id:string)=>call<{documents:SoilDoc[]}>('GET',soil(id)),
  upload:(id:string,body:{document_id:string;original_name:string;source_label:string;original_base64:string;previous_revision:number;previous_original_sha256:string|null})=>call<unknown>('POST',soil(id),body),
  confirm:(id:string,d:DocumentRef)=>call<unknown>('POST',soil(id)+'/'+ident(d.document_id)+'/confirm',{revision:d.revision,candidate_sha256:d.candidate_sha256,confirm:true}),
  reviews:(id:string)=>call<{reviews:Review[];more_history_available:boolean}>('GET',reviews(id)),
  createReview:(id:string,body:ReviewIntent)=>call<unknown>('POST',reviews(id),body),
  assessment:(id:string,r:string)=>call<Assessment>('GET',review(id,r)+'/native-assessment'),
  assess:(id:string,r:string)=>call<Assessment>('POST',review(id,r)+'/native-assessment',{}),
  followups:(id:string,r:string)=>call<{followups:Followup[];more_history_available:boolean}>('GET',review(id,r)+'/followups'),
  linkFollowup:(id:string,r:string,body:{followup_id:string;successor_review_id:string})=>call<unknown>('POST',review(id,r)+'/followups',body)
 };
}
export type ManagerApi=ReturnType<typeof managerApi>;
export function parsePolygon(text:string):Geometry {
 const x=JSON.parse(text);
 if(x?.type!=='Polygon'||!Array.isArray(x.coordinates)||x.coordinates.length!==1||!Array.isArray(x.coordinates[0]))throw Error('POLYGON_REQUIRED');
 const ring=x.coordinates[0];if(ring.length<4||ring.length>5000||!ring.every((p:unknown)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90)||JSON.stringify(ring[0])!==JSON.stringify(ring.at(-1)))throw Error('POLYGON_REQUIRED');
 return {type:'Polygon',coordinates:[ring]};
}
export function documentRef(d:SoilDoc):DocumentRef{return {document_id:d.document_id,revision:d.revision,candidate_sha256:d.candidate_sha256};}
export async function csvBase64(file:File):Promise<string>{if(!/\.csv$/i.test(file.name)||file.size===0||file.size>65536)throw Error('CSV_REQUIRED');const bytes=new Uint8Array(await file.arrayBuffer());let raw='';for(const b of bytes)raw+=String.fromCharCode(b);return btoa(raw);}
