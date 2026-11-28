export function deriveGateway(source,map,contractUrl){
 let s=source;
 function once(a,b){if(s.split(a).length!==2)throw Error('GATEWAY_SOURCE_ANCHOR_MISMATCH:'+a.slice(0,80));s=s.replace(a,()=>b);}
once("const fdwService='http://127.0.0.1:14174';","const fdwService='http://127.0.0.1:14174';\nconst managerService='http://127.0.0.1:14175';\nconst managerAssets="+JSON.stringify(map)+";\nimport {managerRoute} from "+JSON.stringify(contractUrl)+";\n");
once("const url=new URL(req.url,gatewayBase),path=url.pathname,method=req.method;","const url=new URL(req.url,gatewayBase),path=url.pathname,method=req.method;\n  if(method==='GET'&&Object.hasOwn(managerAssets,path)&&!url.search){const file=managerAssets[path];const mime=path==='/manager'?'text/html; charset=utf-8':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/octet-stream';res.writeHead(200,{'content-type':mime,...noCache,'content-security-policy':\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'\"});return res.end(readFileSync(file));}\n  const isManager=managerRoute(method,req.url);\n  const managerNamespace=path.startsWith('/api/v1/manager/')||path.startsWith('/api/v1/fields/');\n  if(managerNamespace&&!isManager)return abort(res,'E2E01_ROUTE_OR_SCOPE_DENIED',403);");
once("location:'/auth/complete'","location:'/manager'");
once("!safeForward(path,method)","!(isManager||safeForward(path,method))");
// Extend existing CSRF and content checks to PUT. Require exact origin for manager writes.
const writes="['POST','PATCH'].includes(method)";
if(s.split(writes).length!==3)throw Error('GATEWAY_WRITE_ANCHOR_COUNT');
s=s.replaceAll(writes,()=> "['POST','PATCH','PUT'].includes(method)");
once("const headers={authorization:'Bearer '+item.session.token,'x-fdw-tenant-ref':JSON.stringify({issuer,id:'fdw-local-tenant-a',version:'1'})};","if(isManager&&method!=='GET'&&req.headers.origin!==gatewayBase)return abort(res,'CSRF_OR_ORIGIN_INVALID');\n  const headers={authorization:'Bearer '+item.session.token,...(isManager?{}:{'x-fdw-tenant-ref':JSON.stringify({issuer,id:'fdw-local-tenant-a',version:'1'})})};");
once("fetch(fdwService+path+url.search,","fetch((isManager?managerService:fdwService)+path+url.search,");
 return s;
}
