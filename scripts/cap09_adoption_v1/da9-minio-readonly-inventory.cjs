'use strict';
// Read-only, exact-run MinIO S3 inventory. All HTTP requests are signed GETs.
// Never mutates a bucket, leaks credentials, or asserts execution authority.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const RUN='da9db7129607';
const BUCKET='mcft-cap09-requal-'+RUN;
const HOST='127.0.0.1';
const PORT=59005;
const ENDPOINT='http://'+HOST+':'+PORT;
const LIMIT=1000;
const SHA256=x=>crypto.createHash('sha256').update(x).digest('hex');
const hex=x=>encodeURIComponent(x).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
function encodeQuery(args) {
 return Object.keys(args).sort().map(k=>hex(k)+'='+hex(String(args[k]))).join('&');
}
function signHeaders(query,credentials,now=new Date()) {
 const access=credentials.access,secret=credentials.secret,region=credentials.region||'us-east-1',token=credentials.token;
 assert(/^[A-Za-z0-9/+=_-]{3,128}$/.test(access),'ACCESS_KEY_INVALID');
 assert(typeof secret==='string'&&secret.length>8,'SECRET_KEY_INVALID');
 assert(/^[a-z0-9-]{1,40}$/.test(region),'REGION_INVALID');
 const date=now.toISOString().replace(/[-:]|\.\d{3}/g,'').slice(0,15)+'Z',ymd=date.slice(0,8);
 const scope=ymd+'/'+region+'/s3/aws4_request';
 const h={'host':HOST+':'+PORT,'x-amz-content-sha256':SHA256(''),'x-amz-date':date};
 if(token)h['x-amz-security-token']=token;
 const names=Object.keys(h).sort(),canonHeaders=names.map(k=>k+':'+h[k].trim()+'\n').join('');
 const canonical='GET\n/'+BUCKET+'\n'+query+'\n'+canonHeaders+'\n'+names.join(';')+'\n'+SHA256('');
 const toSign='AWS4-HMAC-SHA256\n'+date+'\n'+scope+'\n'+SHA256(canonical);
 const hmac=(key,msg)=>crypto.createHmac('sha256',key).update(msg).digest();
 const kDate=hmac('AWS4'+secret,ymd),kRegion=hmac(kDate,region),kService=hmac(kRegion,'s3'),kSigning=hmac(kService,'aws4_request');
 h.authorization='AWS4-HMAC-SHA256 Credential='+access+'/'+scope+', SignedHeaders='+names.join(';')+', Signature='+hmac(kSigning,toSign).toString('hex');
 return h;
}
function readGet(query,credentials,now=new Date()) {
 return new Promise((resolve,reject)=>{
  const headers=signHeaders(query,credentials,now);
  const req=http.request({hostname:HOST,port:PORT,path:'/'+BUCKET+'?'+query,method:'GET',headers,timeout:15000},res=>{
   let body='',bytes=0;res.setEncoding('utf8');
   res.on('data',chunk=>{bytes+=Buffer.byteLength(chunk);if(bytes>2*1024*1024){req.destroy(Error('INVENTORY_RESPONSE_TOO_LARGE'));return;}body+=chunk;});
   res.on('end',()=>res.statusCode===200?resolve(body):reject(Error('INVENTORY_HTTP_'+res.statusCode)));
  });
  req.on('timeout',()=>req.destroy(Error('INVENTORY_TIMEOUT')));
  req.on('error',reject);req.end();
 });
}
function xmlOne(chunk,name) {
 const match=new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>').exec(chunk);
 if(!match)return null;
 return match[1].replace(/&(?:amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#\d+);/g,x=>{
  if(x==='&amp;')return '&';if(x==='&lt;')return '<';if(x==='&gt;')return '>';
  if(x==='&quot;')return '"';if(x==='&apos;')return "'";
  const n=x.startsWith('&#x')?parseInt(x.slice(3,-1),16):parseInt(x.slice(2,-1),10);
  assert(Number.isSafeInteger(n)&&n>=0&&n<=0x10ffff,'INVENTORY_XML_ENTITY_INVALID');return String.fromCodePoint(n);
 });
}
function xmlEntries(xml,name,fields) {
 const re=new RegExp('<'+name+'(?:\\s[^>]*)?>[\\s\\S]*?<\\/'+name+'>','g');
 const found=xml.match(re)||[];
 return found.map(s=>Object.fromEntries(fields.map(k=>[k,xmlOne(s,k)])));
}
function parsePage(kind,xml) {
 assert(typeof xml==='string'&&xml.length<2*1024*1024,'INVENTORY_XML_SIZE_INVALID');
 assert(/<List(?:BucketResult|VersionsResult|MultipartUploadsResult)\b/.test(xml),'INVENTORY_S3_LIST_ROOT_INVALID');
 const expectedRoot=kind==='current'?'ListBucketResult':kind==='versions'?'ListVersionsResult':kind==='multipart'?'ListMultipartUploadsResult':null;
 assert(expectedRoot,'INVENTORY_KIND_INVALID');
 assert(new RegExp('^\\s*(?:<\\?xml[^>]*>\\s*)?<' + expectedRoot + '(?:\\s[^>]*)?>[\\s\\S]*<\\/' + expectedRoot + '>\\s*$').test(xml),'INVENTORY_S3_LIST_DOCUMENT_INCOMPLETE');
 assert(!/<!DOCTYPE|<!ENTITY/i.test(xml),'INVENTORY_XML_ENTITY_DECLARATION_FORBIDDEN');
 assert(!/<(?:Error|Exception)\b/.test(xml),'INVENTORY_S3_ERROR');
 const truncated=xmlOne(xml,'IsTruncated');
 assert(truncated==='true'||truncated==='false','INVENTORY_TRUNCATION_UNKNOWN');
 let items=[],next={};
 if(kind==='current') {
  assert(/<ListBucketResult\b/.test(xml),'INVENTORY_WRONG_LIST_KIND');
  items=xmlEntries(xml,'Contents',['Key','Size','ETag','LastModified']);
  next={'continuation-token':xmlOne(xml,'NextContinuationToken')};
 } else if(kind==='versions') {
  assert(/<ListVersionsResult\b/.test(xml),'INVENTORY_WRONG_LIST_KIND');
  items=[...xmlEntries(xml,'Version',['Key','VersionId','IsLatest']),...xmlEntries(xml,'DeleteMarker',['Key','VersionId','IsLatest']).map(x=>({...x,delete_marker:true}))];
  next={'key-marker':xmlOne(xml,'NextKeyMarker'),'version-id-marker':xmlOne(xml,'NextVersionIdMarker')};
 } else if(kind==='multipart') {
  assert(/<ListMultipartUploadsResult\b/.test(xml),'INVENTORY_WRONG_LIST_KIND');
  items=xmlEntries(xml,'Upload',['Key','UploadId','Initiated']);
  next={'key-marker':xmlOne(xml,'NextKeyMarker'),'upload-id-marker':xmlOne(xml,'NextUploadIdMarker')};
 } else throw Error('INVENTORY_KIND_INVALID');
 if(truncated==='true') {
  assert(next[Object.keys(next)[0]],'INVENTORY_PAGINATION_MARKER_REQUIRED');
 }
 for(const item of items)assert(typeof item.Key==='string'&&item.Key.length>0,'INVENTORY_OBJECT_KEY_MISSING');
 if(kind==='versions')for(const item of items)assert(typeof item.VersionId==='string'&&item.VersionId.length>0,'INVENTORY_VERSION_ID_REQUIRED');
 if(kind==='multipart')for(const item of items)assert(typeof item.UploadId==='string'&&item.UploadId.length>0,'INVENTORY_UPLOAD_ID_REQUIRED');
 return {truncated:truncated==='true',items,next};
}
function classify(inventory) {
 assert(inventory&&Object.keys(inventory).length===3,'INVENTORY_INCOMPLETE');
 const count=(key)=>{assert(Array.isArray(inventory[key]),'INVENTORY_MISSING:'+key);return inventory[key].length;};
 const current=count('current'),versionRows=count('versions'),multipart=count('multipart');
 const deleteMarkers=inventory.versions.filter(x=>x.delete_marker===true).length;
 const versions=versionRows-deleteMarkers;
 return {current,versions,delete_markers:deleteMarkers,multipart,
  status:current+versions+deleteMarkers+multipart===0?'EMPTY_READBACK_CANDIDATE_ONLY':'BUCKET_NOT_EMPTY_HOLD',
  test_only_admission:'HOLD',production_admission:'HOLD'};
}
async function snapshot(credentials,read=readGet) {
 const results={};const started_at=new Date().toISOString();
 for(const kind of ['current','versions','multipart']) {
  const all=[],visited=new Set();
  let cursor={};
  for(let i=0;i<1000;i++) {
   const query={...(kind==='current'?{'list-type':2,'max-keys':LIMIT}:kind==='versions'?{'versions':'','max-keys':LIMIT}:{'uploads':'','max-uploads':LIMIT}),...cursor};
   const canonical=encodeQuery(query);
   assert(!visited.has(canonical),'INVENTORY_PAGINATION_LOOP');visited.add(canonical);
   const page=parsePage(kind,await read(canonical,credentials));
   all.push(...page.items);assert(all.length<=100000,'INVENTORY_TOO_MANY_ITEMS');
   if(!page.truncated){results[kind]=all;break;}
   cursor=Object.fromEntries(Object.entries(page.next).filter(([,v])=>v!==null));
   if(i===999)throw Error('INVENTORY_PAGE_LIMIT');
  }
 }
 const completed_at=new Date().toISOString();
 const counts=classify(results);
 return {schema_version:'MCFT_CAP09_DA9_MINIO_READONLY_INVENTORY_V1',run_id:RUN,bucket:BUCKET,endpoint:ENDPOINT,
  started_at,completed_at,counts,entries:results,
  note:'Read-only GET inventory; not a signed independent review, atomic snapshot, or TEST_ONLY admission receipt.'};
}
async function main() {
 assert(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'WINDOWS_OPERATOR_ONLY');
 assert(process.argv.length===3&&path.win32.isAbsolute(process.argv[2]),'OUTPUT_ABSOLUTE_PATH_REQUIRED');
 const output=path.resolve(process.argv[2]);
 assert(!fs.existsSync(output),'OUTPUT_ALREADY_EXISTS');
 const access=process.env.MCFT_CAP09_DA9_MINIO_ACCESS_KEY,secret=process.env.MCFT_CAP09_DA9_MINIO_SECRET_KEY;
 assert(access&&secret,'SCOPED_MINIO_CREDENTIALS_REQUIRED');
 const receipt=await snapshot({access,secret,region:process.env.MCFT_CAP09_DA9_MINIO_REGION||'us-east-1',
  token:process.env.MCFT_CAP09_DA9_MINIO_SESSION_TOKEN});
 const fd=fs.openSync(output,'wx',0o600);
 try{fs.writeFileSync(fd,JSON.stringify(receipt,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 const sha=SHA256(fs.readFileSync(output));
 console.log(JSON.stringify({status:receipt.counts.status,counts:receipt.counts,receipt_sha256:sha,
  execution_authorized:false,production_authorized:false}));
 if(receipt.counts.status!=='EMPTY_READBACK_CANDIDATE_ONLY')process.exitCode=2;
}
module.exports={RUN,BUCKET,ENDPOINT,encodeQuery,signHeaders,parsePage,classify,snapshot};
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({status:'INVENTORY_FAILED_HOLD',error_code:String(e.message).replace(/[^\w:-]/g,'_').slice(0,120),execution_authorized:false}));process.exitCode=1;});
