// Patch a separate copy of the existing FDW gateway, preserving original login/CSRF/session/revocation.
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {hash} from './contract.mjs';
const kit=resolve(process.argv[2]), root=process.cwd(), dist=resolve(root,'apps/web/.local-manager-e2e01/dist');
const src=join(kit,'oidc-session-gateway.mjs'), dst=join(kit,'oidc-session-gateway-e2e01.mjs');
if(existsSync(dst))throw Error('GATEWAY_COPY_EXISTS');
let s=readFileSync(src,'utf8').replace(/\r\n/g,'\n');
const expected=JSON.parse(readFileSync(new URL('./fdw-source-digests.json',import.meta.url),'utf8'));
if(hash(s.trimEnd())!==expected.gateway)throw Error('GATEWAY_SOURCE_DIGEST_MISMATCH');
import {deriveGateway} from './gateway-derive.mjs';
const assets=readdirSync(join(dist,'assets')).filter(x=>/^[A-Za-z0-9_.-]+\.(js|css|woff2?|png|svg)$/.test(x));
if(!assets.some(x=>x.endsWith('.js'))||!existsSync(join(dist,'index.html')))throw Error('WEB_BUILD_REQUIRED');
const map=Object.fromEntries([['/manager',join(dist,'index.html')],...assets.map(x=>['/manager-assets/assets/'+x,join(dist,'assets',x)])]);
s=deriveGateway(s,map,new URL('./contract.mjs',import.meta.url).href);
writeFileSync(dst,s,{flag:'wx'});
console.log('GATEWAY_COPY_PREPARED');
