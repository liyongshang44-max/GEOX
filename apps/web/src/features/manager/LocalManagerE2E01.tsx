import React from 'react';
import {createRoot} from 'react-dom/client';
import ManagerWorkspaceV1 from './ManagerWorkspaceV1';
import '../../styles.css';
type Session={authenticated:boolean;csrf?:string;expiresAt?:string};
function LocalManager(){
 const [session,setSession]=React.useState<Session|null>(null),[err,setErr]=React.useState(''),[proof,setProof]=React.useState('');
 const refresh=React.useCallback(async()=>{try{const r=await fetch('/api/session',{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error();setSession(await r.json());}catch{setErr('会话服务不可用');}},[]);
 React.useEffect(()=>{void refresh();},[refresh]);
 const transport=React.useCallback((path:string,init:RequestInit)=>{
  const headers=new Headers(init.headers);
  if(init.method!=='GET'){headers.set('x-fdw-csrf',session?.csrf??'');headers.set('idempotency-key',crypto.randomUUID());}
  return fetch(path,{...init,headers,credentials:'same-origin'});
 },[session?.csrf]);
 async function negative(){
  setProof('');
  try{
   const paths=[
    {body:{field_id:'field_e2e01_forbidden',name:'DENY ONLY'},code:'E2E01_CREATE_TARGET_DENIED'},
    {body:{field_id:'field_geox_e2e01_001',tenant_id:'tenant_forbidden',name:'DENY ONLY'},code:'E2E01_CREATE_TARGET_DENIED'}
   ];
   // Both target and caller-supplied scope are denied before native write.
   const out=[];
   for(const p of paths){const r=await transport('/api/v1/manager/fields',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p.body)});const x=await r.json();out.push(r.status+':'+String(x.error??'UNEXPECTED'));if(r.status!==403||x.error!==p.code)break;}
   setProof(out.join(' / '));
  }catch{setProof('TRANSPORT_ERROR');}
 }
 async function logout(){try{const r=await transport('/auth/logout',{method:'POST'});const x=await r.json();setSession({authenticated:false});if(r.ok&&typeof x.endSessionUrl==='string'){const u=new URL(x.endSessionUrl);if(u.origin==='https://auth.fdw.localhost:18443')location.assign(u.toString());}}catch{setErr('退出失败');}}
 if(err)return <p>{err}</p>;
 if(!session)return <p>正在读取会话</p>;
 if(!session.authenticated)return <main><h1>GEOX 本地经理验收</h1><a href="/auth/login">经理登录</a></main>;
 return <><header style={{padding:12}}><strong>GEOX 本地经理验收 · 非生产</strong> <button onClick={()=>void logout()}>退出登录</button><p>唯一授权目标：field_geox_e2e01_001。科学状态 UNKNOWN，直至真实 ADR 回执。</p><button onClick={()=>void negative()}>越权目标及租户注入拒绝验证</button><p aria-live="polite">{proof}</p></header><ManagerWorkspaceV1 language="zh" sessionKey={session.csrf??'session'} transport={transport}/></>;
}
createRoot(document.getElementById('root')!).render(<LocalManager/>);
