// Patch a separate copy of the existing FDW gateway, preserving original login/CSRF/session/revocation.
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {managerRoute} from './contract.mjs';
const kit=resolve(process.argv[2]), root=process.cwd(), dist=resolve(root,'apps/web/.local-manager-e2e01/dist');
const src=join(kit,'oidc-session-gateway.mjs'), dst=join(kit,'oidc-session-gateway-e2e01.mjs');
if(existsSync(dst))throw Error('GATEWAY_COPY_EXISTS');
let s=readFileSync(src,'utf8').replace(/\r\n/g,'\n');
function once(a,b){if(s.split(a).length!==2)throw Error('GATEWAY_SOURCE_ANCHOR_MISMATCH');s=s.replace(a,b);}
const assets=readdirSync(join(dist,'assets')).filter(x=>/^[A-Za-z0-9_.-]+\.(js|css|woff2?|png|svg)$/.test(x));
if(!assets.some(x=>x.endsWith('.js'))||!existsSync(join(dist,'index.html')))throw Error('WEB_BUILD_REQUIRED');
const map=Object.fromEntries([['/manager',join(dist,'index.html')],...assets.map(x=>['/manager-assets/assets/'+x,join(dist,'assets',x)])]);
once("const fdwService='http://127.0.0.1:14174';","const fdwService='http://127.0.0.1:14174';\nconst managerService='http://127.0.0.1:14175';\nconst managerAssets="+JSON.stringify(map)+";\nconst managerRoute="+managerRoute.toString()+";\n");
// The route function closes over its lexical constants; reproduce exact fixed values.
once("const managerRoute="+managerRoute.toString()+";","const managerField='field_geox_e2e01_001';\nconst field=managerField,basePath='/api/v1/manager/fields',f=basePath+'/'+field,soil='/api/v1/fields/'+field+'/soil-documents',id='[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}';\nconst managerRoute="+managerRoute.toString().replaceAll('path===base','path===basePath')+";");
once("const url=new URL(req.url,gatewayBase),path=url.pathname,method=req.method;","const url=new URL(req.url,gatewayBase),path=url.pathname,method=req.method;\n  if(method==='GET'&&Object.hasOwn(managerAssets,path)&&!url.search){const file=managerAssets[path];const mime=path==='/manager'?'text/html; charset=utf-8':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/octet-stream';res.writeHead(200,{'content-type':mime,...noCache,'content-security-policy':\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'\"});return res.end(readFileSync(file));}\n  const isManager=managerRoute(method,req.url);\n  const managerNamespace=path.startsWith('/api/v1/manager/')||path.startsWith('/api/v1/fields/');\n  if(managerNamespace&&!isManager)return abort(res,'E2E01_ROUTE_OR_SCOPE_DENIED',403);");
once("location:'/auth/complete'","location:'/manager'");
once("!safeForward(path,method)","!(isManager||safeForward(path,method))");
// Extend existing CSRF and content checks to PUT. Require exact origin for manager writes.
s=s.replaceAll("['POST','PATCH'].includes(method)","['POST','PATCH','PUT'].includes(method)");
once("const headers={authorization:'Bearer '+item.session.token,'x-fdw-tenant-ref':JSON.stringify({issuer,id:'fdw-local-tenant-a',version:'1'})};","if(isManager&&method!=='GET'&&req.headers.origin!==gatewayBase)return abort(res,'CSRF_OR_ORIGIN_INVALID');\n  const headers={authorization:'Bearer '+item.session.token,...(isManager?{}:{'x-fdw-tenant-ref':JSON.stringify({issuer,id:'fdw-local-tenant-a',version:'1'})})};");
once("fetch(fdwService+path+url.search,","fetch((isManager?managerService:fdwService)+path+url.search,");
writeFileSync(dst,s,{flag:'wx'});
console.log('GATEWAY_COPY_PREPARED');
