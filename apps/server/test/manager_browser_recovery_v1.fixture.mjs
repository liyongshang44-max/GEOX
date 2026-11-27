// TEST_ONLY: real product web build + real manager API/PG, injected identity and ADR wire.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';

export async function exerciseManagerBrowserRecovery(app,field,nativePath){
 assert.equal(process.env.P6_TEST_ONLY,'1');
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
 assert.equal(process.env.GITHUB_EVENT_NAME,'pull_request');
 assert.equal(field,'p6_native_f');
 const dist=resolve('apps/web/.local-manager-e2e01/dist');
 const sessions=new Map();
 const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   const path=url.pathname,method=req.method;
   const sid=(req.headers.cookie??'').split(/; */).find(s=>s.startsWith('p6sid='))?.slice(6);
   const csrf=sessions.get(sid);
   if(method==='GET'&&path==='/api/session')return json(res,200,csrf?{authenticated:true,csrf}:{authenticated:false});
   if(method==='GET'&&path==='/auth/login'){
    if(sid)sessions.delete(sid);
    const next=randomUUID();sessions.set(next,randomUUID());
    res.writeHead(303,{'set-cookie':'p6sid='+next+'; HttpOnly; SameSite=Strict; Path=/','location':'/manager'});return res.end();
   }
   if(method==='POST'&&path==='/auth/logout'){
    if(!csrf||req.headers['x-fdw-csrf']!==csrf)return json(res,403,{error:'TEST_SESSION_REQUIRED'});
    sessions.delete(sid);res.writeHead(200,{'content-type':'application/json','set-cookie':'p6sid=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/','cache-control':'no-store'});return res.end('{}');
   }
   if(path.startsWith('/api/v1/manager/')){
    if(!csrf)return json(res,401,{error:'TEST_SESSION_REQUIRED'});
    if(method!=='GET'&&req.headers['x-fdw-csrf']!==csrf)return json(res,403,{error:'TEST_CSRF_REQUIRED'});
    if(!['GET','POST'].includes(method))return json(res,405,{error:'TEST_METHOD_DENIED'});
    let payload; if(method==='POST'){const chunks=[];for await(const chunk of req)chunks.push(chunk);payload=Buffer.concat(chunks).toString('utf8');}
    const response=await app.inject({method,url:path+url.search,headers:{authorization:'Bearer fixture-native',...(method==='POST'?{'content-type':'application/json'}:{})},...(payload===undefined?{}:{payload})});
    res.writeHead(response.statusCode,{'content-type':'application/json','cache-control':'no-store'});return res.end(response.body);
   }
   if(method==='GET'&&(path==='/manager'||path==='/')){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end(await readFile(resolve(dist,'index.html')));}
   if(method==='GET'&&/^\/manager-assets\/assets\/[A-Za-z0-9_.-]+\.(js|css)$/.test(path)){
    const name=path.split('/').at(-1);const bytes=await readFile(resolve(dist,'assets',name));
    res.writeHead(200,{'content-type':name.endsWith('.js')?'text/javascript':'text/css'});return res.end(bytes);
   }
   return json(res,404,{error:'TEST_ROUTE_DENIED'});
  }catch{if(!res.headersSent)json(res,500,{error:'TEST_BRIDGE_FAILURE'});else res.end();}
 });
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const open=async()=>{
   await page.getByRole('link',{name:'经理登录'}).click();
   await page.getByRole('button',{name:'打开土地档案',exact:true}).click();
   await page.getByText('已有确认边界',{exact:true}).waitFor();
   await page.getByRole('button',{name:'农业问题',exact:true}).click();
  };
  const selectReview=()=>page.locator('article').filter({has:page.getByRole('heading',{name:'review-no-soil',exact:true})}).getByRole('button',{name:'查看评价进度'}).click();
  const receipt=async()=>{
   await page.getByText('已取得原生知识检索回执，缺少土壤上下文，未执行科学适用性评价',{exact:true}).waitFor();
   await page.getByText('原生评价引用数: 0',{exact:true}).waitFor();
   await page.getByText('知识候选数（非科学适用性结论）: 1',{exact:true}).waitFor();
   await page.getByText('原生引用及诊断',{exact:true}).click();
   const a=await page.getByText(/^createDecisionProblem · /).innerText();
   const b=await page.getByText(/^executeKnowledgeRetrieval · /).innerText();
   assert.equal(await page.getByRole('button',{name:'申请原生科学评价'}).isDisabled(),true);
   await page.getByRole('button',{name:'查看农业知识证据'}).click();
   await page.getByRole('heading',{name:'TEST_ONLY soybean source'}).waitFor();
   await page.getByText('TEST_ONLY bounded source assertion',{exact:true}).waitFor();
   await page.getByText('TEST_ONLY regional model limitation',{exact:true}).waitFor();
   await page.getByText('玉米知识尚未纳入本次发布；双作物证据不完整。',{exact:true}).waitFor();
   return [a,b];
  };
  await page.goto(origin+'/manager');
  await open();
  const firstSession=await page.evaluate(()=>fetch('/api/session').then(r=>r.json()));
  await page.getByLabel('问题标识').fill('review-no-soil');
  await page.getByLabel('目标开始日期').fill('2027-04-01');
  await page.getByLabel('目标结束日期').fill('2027-10-01');
  await page.getByRole('button',{name:'保存问题',exact:true}).click();
  await selectReview();
  await page.getByText('未申请评价',{exact:true}).waitFor();
  const nativeResponse=page.waitForResponse(r=>r.url()===origin+nativePath&&r.request().method()==='POST');
  await page.getByRole('button',{name:'申请原生科学评价'}).click();
  const response=await nativeResponse;assert.equal(response.status(),200);
  const persisted=await response.json();assert.equal(persisted.action_authority,false);assert.equal(persisted.receipts.length,2);
  const first=await receipt();
  await page.getByRole('button',{name:'退出登录'}).click();
  await page.getByRole('link',{name:'经理登录'}).waitFor();
  assert.equal(await page.getByText(/^createDecisionProblem · /).count(),0);
  const denied=await page.evaluate(p=>fetch(p).then(r=>r.status),nativePath);assert.equal(denied,401);
  await page.reload();await open();
  const secondSession=await page.evaluate(()=>fetch('/api/session').then(r=>r.json()));
  assert.equal(firstSession.authenticated,true);assert.equal(secondSession.authenticated,true);assert.notEqual(firstSession.csrf,secondSession.csrf);
  await page.getByRole('button',{name:'读取历史问题'}).click();await selectReview();
  assert.deepEqual(await receipt(),first);
  const recovered=await page.evaluate(p=>fetch(p).then(r=>r.json()),nativePath);
  assert.deepEqual(recovered,persisted);
  console.log('PASS A07_CUSTOMER_EVIDENCE_BROWSER_FRESH_SESSION_TEST_ONLY');
  console.log('PASS P3P_BROWSER_NATIVE_NO_SOIL_SUBMISSION_LOGOUT_FRESH_SESSION_HISTORY_TEST_ONLY');
 }finally{await browser?.close();await new Promise(ok=>server.close(ok));}
}
