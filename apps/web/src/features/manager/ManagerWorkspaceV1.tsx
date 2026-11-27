import React from 'react';
import HistoricalForecastPanelV1 from './HistoricalForecastPanelV1';
import {ProductPageShell,ProductPageHeader,ProductSectionCard} from '../../design-system/product';
import {managerApi,ManagerApiError,parsePolygon,csvBase64,documentRef,type ManagerTransport,type ManagedField,type ScientificResult,type HistoricalForecast,type ObservationPage,type Boundary,type SoilDoc,type Review,type Assessment,type Followup} from '../../api/managerWorkspaceV1';
type Language='zh'|'en';
type Props={language:Language;sessionKey:string;transport:ManagerTransport};
// Explicit composition only. sessionKey MUST change at logout, principal or tenant
// change. No legacy AuthProvider, fake session or default route registration.
export default function ManagerWorkspaceV1(props:Props){return <Workspace key={props.sessionKey} {...props}/>;}
function Workspace({language,transport}:Props){
 const tr=(zh:string,en:string)=>language==='zh'?zh:en;
 const api=React.useMemo(()=>managerApi(transport),[transport]);
 const [lands,setLands]=React.useState<ManagedField[]|null>(null);
 const [tab,setTab]=React.useState<'land'|'soil'|'questions'|'history'>('land');
 const [fieldInput,setFieldInput]=React.useState(''),[name,setName]=React.useState(''),[area,setArea]=React.useState('');
 const [field,setField]=React.useState(''),[boundary,setBoundary]=React.useState<Boundary|null>(null),[polygon,setPolygon]=React.useState('');
 const [docs,setDocs]=React.useState<SoilDoc[]>([]),[reviews,setReviews]=React.useState<Review[]>([]),[more,setMore]=React.useState(false);
 const [docId,setDocId]=React.useState(''),[source,setSource]=React.useState(''),[file,setFile]=React.useState<File|null>(null);
 const [selected,setSelected]=React.useState<string[]>([]),[reviewId,setReviewId]=React.useState(''),[start,setStart]=React.useState(''),[end,setEnd]=React.useState('');
 const [review,setReview]=React.useState(''),[assessment,setAssessment]=React.useState<Assessment|null>(null),[followups,setFollowups]=React.useState<Followup[]>([]),[followupId,setFollowupId]=React.useState(''),[successor,setSuccessor]=React.useState('');
 const [scientific,setScientific]=React.useState<ScientificResult|null>(null),[observations,setObservations]=React.useState<ObservationPage|null>(null);
 const [forecast,setForecast]=React.useState<HistoricalForecast|null>(null),[forecastRun,setForecastRun]=React.useState('');
 const [busy,setBusy]=React.useState(false),[notice,setNotice]=React.useState(''),[error,setError]=React.useState(''),[detail,setDetail]=React.useState('');
 const locked=React.useRef(false),alive=React.useRef(true);
 React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const status=(s:string):string=>{
  const labels:Record<string,[string,string]>={
   HISTORICAL:['历史版本','Historical revision'],BOUNDARY_CHANGED_REVIEW_REQUIRED:['边界已变更，需重新核对','Boundary changed; review required'],MANAGER_CONFIRMED_ASSERTION:['经理已确认资料（非科学认证）','Manager-confirmed assertion (not scientific qualification)'],PENDING_CONFIRMATION:['待确认','Awaiting confirmation'],PENDING_NATIVE_ASSESSMENT:['问题已保存，待评价','Question saved; awaiting assessment'],NOT_REQUESTED:['未申请评价','Assessment not requested'],NATIVE_ASSESSMENTS_RECORDED:['已记录原生评价引用，尚未获内容展示资格','Native assessment references recorded; content display not authorized'],NO_RETRIEVED_KNOWLEDGE:['未检索到匹配候选知识','No knowledge candidates retrieved'],NATIVE_RETRIEVAL_RECORDED_CONTEXT_REQUIRED:['已取得原生知识检索回执，缺少土壤上下文，未执行科学适用性评价','Native retrieval recorded; soil context missing; applicability not assessed'],HOLD_RETRIEVAL_CANDIDATE_LIMIT:['知识候选超出本次处理上限','Candidate limit exceeded'],OUTCOME_RECONCILIATION_REQUIRED:['结果需核对，禁止重复提交','Outcome requires reconciliation; do not resubmit'],HOLD_BEFORE_INVOCATION:['评价未启动','Assessment not invoked'],SUCCESSOR_CONTEXT_LINKED:['补充资料已关联','Supplemental evidence linked']
  };const pair=labels[s];return pair?tr(pair[0],pair[1]):tr('状态待核对','Status requires verification');
 };
 const scientificLabel=(s:string)=>{
 const l:Record<string,[string,string]>={DIRECTLY_APPLICABLE:['直接适用','Directly applicable'],APPLICABLE_WITH_GOVERNED_TRANSFORM:['需要已治理转换','Governed transformation required'],CALIBRATION_REQUIRED:['需要校准','Calibration required'],BOUNDED_EXTRAPOLATION:['有界外推','Bounded extrapolation'],UNRESOLVED:['适用性未确定','Applicability unresolved'],CONFLICT:['存在条件冲突','Conflicting conditions'],NOT_RELEVANT:['不相关','Not relevant'],QUALIFIED:['科学用途已具资格','Scientific use qualified'],UNQUALIFIED:['科学用途未具资格','Scientific use unqualified'],PROHIBITED:['禁止科学使用','Scientific use prohibited'],REVOKED:['资格已撤销','Qualification revoked'],MATERIAL:['与问题相关','Material to question'],ALLOWED:['允许原生运行用途','Native runtime use allowed'],CONDITIONAL:['有条件使用','Conditional use'],BLOCKED:['使用受阻','Use blocked'],MATCH:['匹配','Match'],MISMATCH:['不匹配','Mismatch'],UNKNOWN:['未知','Unknown'],AMBIGUOUS:['有歧义','Ambiguous'],TRANSFORMABLE:['可转换','Transformable'],INVALID:['无效','Invalid']};
 const pair=l[s];return pair?tr(pair[0],pair[1]):tr('待核对','Requires verification');
 };
 const run=async(fn:()=>Promise<void>)=>{
  if(locked.current)return;locked.current=true;setBusy(true);setError('');setDetail('');setNotice('');
  try{await fn();}catch(e){if(!alive.current)return;const x=e instanceof ManagerApiError?e:null;if(x?.status===401){setLands(null);clearField();setField('');}setError(x?.unknownWrite?tr('提交结果不确定。请重新读取服务端记录，勿重复提交。','Write outcome unknown. Read server records before any resubmission.'):x?.status===401?tr('正式登录已失效，请重新登录。','Formal session expired; sign in again.'):x?.status===403?tr('当前身份缺少该操作的独立授权。','This operation requires an independent grant.'):x?.status===409?tr('资料或版本冲突，请重新读取后核对。','Evidence or version conflict; reload and verify.'):tr('操作未完成，请检查服务端状态。','Operation incomplete; inspect server state.'));setDetail(x?.code??(e instanceof Error?e.message:'UNKNOWN'));}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 };
 const clearField=()=>{setForecast(null);setForecastRun('');setScientific(null);setObservations(null);setBoundary(null);setPolygon('');setDocs([]);setReviews([]);setMore(false);setSelected([]);setReview('');setAssessment(null);setFollowups([]);setDocId('');setSource('');setFile(null);setReviewId('');setFollowupId('');setSuccessor('');};
 const loadLands=async()=>{setLands(null);try{const result=await api.lands();if(!alive.current)return;setLands(result.fields);if(field&&!result.fields.some(x=>x.field_id===field)){clearField();setField('');}}catch(e){if(alive.current){clearField();setField('');}throw e;}};
 const openLand=async(id:string)=>{clearField();setField('');const b=await api.boundary(id);if(alive.current){setField(b.field_id);setFieldInput(b.field_id);setBoundary(b);setPolygon(b.geometry?JSON.stringify(b.geometry,null,2):'');}};
 React.useEffect(()=>{void run(loadLands);},[]); // fresh server read for each sessionKey mount
 const loadBoundary=async(id:string)=>{const b=await api.boundary(id);if(!alive.current)return;setBoundary(b);setPolygon(b.geometry?JSON.stringify(b.geometry,null,2):'');};
 const loadDocs=async(id:string)=>{const d=await api.documents(id);if(!alive.current)return;setDocs(d.documents);setSelected([]);};
 const loadReviews=async(id:string)=>{const r=await api.reviews(id);if(!alive.current)return;setReviews(r.reviews);setMore(r.more_history_available);};
 const loadAssessment=async(id:string,r:string)=>{const a=await api.assessment(id,r);if(alive.current)setAssessment(a);};
 const eligible=docs.filter(d=>d.current_context_eligible);
 const key=(d:SoilDoc)=>d.document_id+':'+d.revision;
 const current=docs.find(d=>d.document_id===docId&&d.latest_revision);
 const docSelection=eligible.filter(d=>selected.includes(key(d))).map(documentRef);
 const guard=(event:React.FormEvent,fn:()=>Promise<void>)=>{event.preventDefault();void run(fn);};
 const button=(zh:string,en:string,fn:()=>Promise<void>,disabled=false)=><button className="customerButton" type="button" disabled={busy||disabled} onClick={()=>void run(fn)}>{tr(zh,en)}</button>;
 return <ProductPageShell surface="customer" ariaLabel={tr('农场经理工作台','Farm manager workspace')} top={<ProductPageHeader eyebrow="GEOX" title={tr('农场经理工作台','Farm manager workspace')} lead={tr('管理土地、核对资料和跟踪农业问题。','Manage land, verify evidence and track agronomic questions.')} nonclaim={tr('资料确认不代表科学资格；本工作台不产生作业授权。','Evidence confirmation is not scientific qualification; this workspace grants no execution authority.')}/>}>
  <nav aria-label={tr('经理业务导航','Manager navigation')} className="customerFilterRow">
   {([['land','我的土地','My land'],['soil','需要处理','Needs attention'],['questions','农业问题','Agronomic questions'],['history','历史观测','Historical observations']] as const).map(([id,zh,en])=><button key={id} type="button" className={`customerFilterButton ${tab===id?'isActive':''}`} aria-pressed={tab===id} disabled={busy} onClick={()=>setTab(id)}>{tr(zh,en)}</button>)}
  </nav>
  {busy&&<p role="status">{tr('正在等待服务端回执，请勿重复操作。','Waiting for server receipt. Do not repeat the operation.')}</p>}
  {notice&&<p role="status">{notice}</p>}{error&&<div role="alert"><p>{error}</p><details><summary>{tr('技术诊断','Technical diagnostic')}</summary><code>{detail}</code></details></div>}
  <p>{tr('当前田块','Current field')}: {field||tr('未选择','None')}</p>
  {tab==='land'&&<ProductSectionCard title={tr('登记或打开田块','Register or open land')} subtitle={tr('登记后须取得独立田块访问授权。','Registration does not issue subsequent land access grants.')}>
   {button('刷新我的土地','Refresh my land',loadLands)}
   {lands!==null&&lands.length===0&&<p>{tr('当前没有已授权田块。登记后须由目录权威授予访问。','No currently authorized fields. Registration requires a separate directory grant.')}</p>}
   {lands?.map(l=><article key={l.field_id}><h3>{l.name}</h3><p>{l.field_id}{l.area_ha!==null?' · '+l.area_ha+' ha':''}</p>{button('打开土地档案','Open land record',()=>openLand(l.field_id))}</article>)}
   <fieldset disabled={busy}><form onSubmit={e=>guard(e,async()=>{
    await api.create({field_id:fieldInput,name,...(area?{area_ha:Number(area)}:{})});if(alive.current){clearField();setField('');setLands(null);setNotice(tr('登记已获服务端回执，等待独立田块授权。','Registration acknowledged; independent land access grant required.'));}
   })}><label>{tr('田块标识','Field ID')} <input required value={fieldInput} onChange={e=>setFieldInput(e.target.value)}/></label><label>{tr('名称','Name')} <input required value={name} onChange={e=>setName(e.target.value)}/></label><label>{tr('面积（公顷，可选）','Area (ha, optional)')} <input type="number" min="0.000001" max="1000000" step="any" value={area} onChange={e=>setArea(e.target.value)}/></label><button type="submit" className="customerButton">{tr('登记土地','Register land')}</button></form>
   {button('打开已授权田块','Open authorized field',()=>openLand(fieldInput),!fieldInput)}
   </fieldset>
   {field&&boundary&&<form onSubmit={e=>guard(e,async()=>{const shape=parsePolygon(polygon);await api.updateBoundary(field,shape,boundary.field_updated_ts_ms);if(!alive.current)return;setNotice(tr('边界更新已获服务端回执。','Boundary update acknowledged.'));setDocs([]);setSelected([]);await loadBoundary(field);})}><fieldset disabled={busy}><p>{boundary.geometry?tr('已有确认边界','Confirmed boundary exists'):tr('尚无边界','No boundary yet')}</p><label>{tr('导入 WGS84 Polygon GeoJSON（经度、纬度）','Import WGS84 Polygon GeoJSON (longitude, latitude)')} <textarea rows={8} required value={polygon} onChange={e=>setPolygon(e.target.value)}/></label><button type="submit" className="customerButton">{tr('确认边界','Confirm boundary')}</button></fieldset></form>}
  </ProductSectionCard>}
  {tab==='soil'&&<ProductSectionCard title={tr('土壤检测资料','Soil test documents')} subtitle={tr('先读取原生记录，再上传或确认指定版本。仅接受原始 CSV。','Read native records, then upload or confirm exact revisions. Original CSV only.')}>
   {button('读取资料','Read documents',()=>loadDocs(field),!field)}
   <form onSubmit={e=>guard(e,async()=>{if(!file)throw Error('CSV_REQUIRED');await api.upload(field,{document_id:docId,original_name:file.name,source_label:source,original_base64:await csvBase64(file),previous_revision:current?.revision??0,previous_original_sha256:current?.original_sha256??null});if(!alive.current)return;setNotice(tr('上传已获回执；须核对提取资料。','Upload acknowledged; verify extracted assertions.'));await loadDocs(field);})}><fieldset disabled={busy||!field}><label>{tr('资料标识','Document ID')} <input required value={docId} onChange={e=>setDocId(e.target.value)}/></label><label>{tr('来源说明','Source description')} <input required value={source} onChange={e=>setSource(e.target.value)}/></label><label>CSV <input type="file" accept=".csv,text/csv" required onChange={e=>setFile(e.target.files?.[0]??null)}/></label><button type="submit" className="customerButton">{tr('上传原始资料','Upload original')}</button></fieldset></form>
   {docs.map(d=><article key={key(d)}><h3>{d.original_name} · {tr('版本','Revision')} {d.revision}</h3><p>{d.source_label} · {status(d.status)}</p><div style={{overflowX:'auto'}}><table><thead><tr>{[tr('样本','Sample'),tr('日期','Date'),tr('坐标','Point'),tr('深度 cm','Depth cm'),tr('指标','Analyte'),tr('数值','Value'),tr('单位','Unit'),tr('方法','Method')].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{d.candidates.map(row=><tr key={row.row_number}><td>{row.sample_id}</td><td>{row.sampled_on}</td><td>{row.longitude_deg}, {row.latitude_deg}</td><td>{row.depth_top_cm}–{row.depth_bottom_cm}</td><td>{row.analyte}</td><td>{row.value}</td><td>{row.unit}</td><td>{row.method}</td></tr>)}</tbody></table></div>
    {d.latest_revision&&d.status==='PENDING_CONFIRMATION'&&button('确认报告记录（不是科学认证）','Confirm report assertions (not scientific qualification)',async()=>{await api.confirm(field,documentRef(d));if(alive.current){setNotice(tr('资料确认已获回执。','Confirmation acknowledged.'));await loadDocs(field);}})}
   </article>)}
  </ProductSectionCard>}
  {tab==='questions'&&<ProductSectionCard title={tr('农业问题：作物适宜性','Agronomic questions: crop suitability')} subtitle={tr('首个业务场景：玉米与大豆比较。当前只提交问题，不自行给出结论。','First workflow: corn versus soybean. Submit a question without inventing conclusions.')}>
   {button('读取历史问题','Read question history',()=>loadReviews(field),!field)} {button('读取可用土检资料','Read eligible soil evidence',()=>loadDocs(field),!field)}
   <form onSubmit={e=>guard(e,async()=>{await api.createReview(field,{review_id:reviewId,crop_codes:['CORN','SOYBEAN'],target_start_date:start,target_end_date:end,documents:docSelection});if(!alive.current)return;setNotice(tr('问题已保存，尚未完成科学评价。','Question saved; scientific assessment not completed.'));await loadReviews(field);})}><fieldset disabled={busy||!field}>
    <label>{tr('问题标识','Question ID')} <input required value={reviewId} onChange={e=>setReviewId(e.target.value)}/></label><label>{tr('目标开始日期','Target start')} <input type="date" required value={start} onChange={e=>setStart(e.target.value)}/></label><label>{tr('目标结束日期','Target end')} <input type="date" required min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label>
    <p>{tr('选择已确认且仍适用于当前边界的资料：','Select confirmed evidence eligible for the current boundary:')}</p>{eligible.map(d=><label key={key(d)}><input type="checkbox" checked={selected.includes(key(d))} onChange={e=>setSelected(old=>e.target.checked?[...old,key(d)]:old.filter(k=>k!==key(d)))}/>{d.original_name} / {d.revision}</label>)}
    {!eligible.length&&<p>{tr('尚无已读取的合格资料；可以保存问题，但评价可能被阻断。','No eligible evidence loaded; a question may be saved but assessment may be blocked.')}</p>}
    <button type="submit" className="customerButton" disabled={docSelection.length>10}>{tr('保存问题','Save question')}</button></fieldset></form>
   {more&&<p>{tr('这里只列最近100条历史问题。','Only the most recent 100 questions are listed.')}</p>}
   {reviews.map(r=><article key={r.review_id}><h3>{r.review_id}</h3><p>{r.intent.target_start_date} – {r.intent.target_end_date} · {status(r.status)}</p>{button('查看评价进度','Read assessment status',async()=>{setReview(r.review_id);setAssessment(null);setScientific(null);setFollowups([]);await loadAssessment(field,r.review_id);})}</article>)}
   {review&&<article><h3>{tr('当前问题','Current question')}: {review}</h3>
    {assessment&&<><p>{status(assessment.status)}</p><p>{tr('原生评价引用数','Native assessment reference count')}: {assessment.assessment_refs.length}</p>{assessment.retrieval&&<p>{tr('知识候选数（非科学适用性结论）','Knowledge candidates (not a scientific applicability result)')}: {assessment.retrieval.candidate_count}</p>}<details><summary>{tr('原生引用及诊断','Native references and diagnostics')}</summary>{assessment.error_code&&<code>{assessment.error_code}</code>}<ul>{assessment.receipts.map(r=><li key={r.ref.logical_id}>{r.operation} · {r.ref.logical_id} · {r.ref.version} · {r.ref.semantic_hash}</li>)}{assessment.assessment_refs.map(ref=><li key={ref.semantic_hash}>{ref.logical_id} · {ref.version} · {ref.semantic_hash}</li>)}</ul></details></>}
    {button('申请原生科学评价','Request native scientific assessment',async()=>{setAssessment(null);setScientific(null);const a=await api.assess(field,review);if(alive.current)setAssessment(a);},!assessment||assessment.status!=='NOT_REQUESTED')}
    {button('查看科学适用性及证据缺口','Read scientific applicability and evidence gaps',async()=>{setScientific(null);const x=await api.scientificResult(field,review);if(alive.current)setScientific(x);})}
    {scientific&&<section aria-label={tr('科学评价','Scientific assessment')}>
     <p>{tr('以下为历史评价记录，不是当前资格证明、作物排名或种植建议。','Recorded assessment only; not current qualification, a crop ranking or planting advice.')}</p>
     {scientific.display_status==='DISPLAY_PERMISSION_NOT_ESTABLISHED'?<p>{tr('评价内容尚未获展示授权。','Assessment content display is not authorized.')}</p>:scientific.display_status==='NO_COMPLETED_ASSESSMENTS'?<p>{status(scientific.status)}</p>:scientific.display_status==='AUTHORIZED_RECORDED_RESULT'?scientific.assessments.map(a=><article key={a.assessment_ref.semantic_hash}>
      <h4>{tr('科学适用性','Scientific applicability')}: {scientificLabel(a.transport_status)}</h4>
      <p>{tr('科学使用状态','Scientific use')}: {scientificLabel(a.scientific_use_status)} · {tr('运行用途','Runtime use')}: {scientificLabel(a.runtime_use)} · {tr('问题相关性','Relevance')}: {scientificLabel(a.decision_relevance)}</p>
      <h5>{tr('条件匹配','Condition matching')}</h5><ul>{a.conditions.map((c,i)=><li key={c.semantic_id+':'+i}>{c.semantic_id}: {scientificLabel(c.status)}</li>)}</ul>
      <h5>{tr('缺失上下文','Missing context')}</h5>{a.missing_context_semantic_ids.length?<ul>{a.missing_context_semantic_ids.map(s=><li key={s}>{s}</li>)}</ul>:<p>{tr('此记录未列出缺失语义；不代表全部农业证据已齐备。','No missing semantics listed in this record; not proof that all agronomic evidence is complete.')}</p>}
      <details><summary>{tr('校准要求、未支持条件与证据引用','Calibration, unsupported constraints and evidence refs')}</summary><p>{a.required_calibration_codes.join(', ')}</p><p>{a.unsupported_constraint_codes.join(', ')}</p><code>{a.assessment_ref.logical_id} · {a.assessment_ref.semantic_hash}</code></details>
     </article>):<p>{tr('结果状态待核对。','Result status requires verification.')}</p>}
    </section>}
    {button('查看补充资料历史','Read follow-up history',async()=>{const f=await api.followups(field,review);if(alive.current)setFollowups(f.followups);})}
    <form onSubmit={e=>guard(e,async()=>{await api.linkFollowup(field,review,{followup_id:followupId,successor_review_id:successor});if(!alive.current)return;setNotice(tr('新问题已与前次证据基线关联。','Successor question linked to prior evidence basis.'));const f=await api.followups(field,review);if(alive.current)setFollowups(f.followups);})}><fieldset disabled={busy||!assessment||!['NATIVE_ASSESSMENTS_RECORDED','NO_RETRIEVED_KNOWLEDGE'].includes(assessment.status)}><p>{tr('先上传及确认补充资料，保存同一目标的新问题，再关联。','Upload and confirm additional evidence, save a new question with the same target, then link it.')}</p><label>{tr('补充记录标识','Follow-up ID')} <input required value={followupId} onChange={e=>setFollowupId(e.target.value)}/></label><label>{tr('新问题','Successor question')} <select required value={successor} onChange={e=>setSuccessor(e.target.value)}><option value="">{tr('请选择','Select')}</option>{reviews.filter(r=>r.review_id!==review).map(r=><option key={r.review_id} value={r.review_id}>{r.review_id}</option>)}</select></label><button type="submit" className="customerButton">{tr('关联补充资料','Link supplemental evidence')}</button></fieldset></form>
    {followups.map(f=><p key={f.followup_id}>{f.result.baseline_review_id} → {f.result.successor_review_id} · {status(f.result.status)}</p>)}
   </article>}
  </ProductSectionCard>}
  {tab==='history'&&<ProductSectionCard title={tr('历史土壤观测','Historical soil observations')} subtitle={tr('近站点位观测，不能当作目标田块根区平均含水量或当前状态。','Near-site point observations, not target field root-zone average or current state.')}>
   {button('读取历史观测','Read historical observations',async()=>{setObservations(null);const x=await api.observations(field);if(alive.current)setObservations(x);},!field)}
   {observations&&observations.status==='UNAVAILABLE'&&<p>{tr('历史数据或展示权限尚不可用。','Historical data or display permission is unavailable.')}</p>}
   {observations&&observations.status==='AVAILABLE'&&!observations.items.length&&<p>{tr('授权范围内没有观测记录。','No observation records in the authorized scope.')}</p>}
   {observations&&observations.items.length>0&&<><p>{tr('当前已读记录','Records loaded')}: {observations.items.length}</p><div style={{overflowX:'auto'}}><table><thead><tr>{[tr('观测时间','Observed at'),tr('含水量（体积分数）','Water content (fraction)'),tr('深度 mm','Depth mm'),tr('数据集','Dataset'),tr('质量','Quality'),tr('来源记录','Source record')].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{observations.items.map(o=><tr key={o.fact_id}><td>{o.time.observed_at}</td><td>{o.measurement.value}</td><td>{o.measurement.measurement_depth_mm}</td><td>{o.dataset_id}</td><td>{o.quality.status==='PASS'?tr('通过','Pass'):tr('受限','Limited')}</td><td>{o.source_record_id}</td></tr>)}</tbody></table></div></>}
   {observations?.next_cursor&&button('下一页','Next page',async()=>{const x=await api.observations(field,observations.next_cursor!);if(alive.current)setObservations(x);})}
   {button('读取历史72小时预测及情景','Read historical 72-hour forecasts and scenarios',async()=>{setForecast(null);setForecastRun('');const x=await api.historicalForecast(field);if(alive.current){setForecast(x);setForecastRun(x.runs[0]?.forecast_ref.object_id??'');}},!field)}
   {forecast&&<HistoricalForecastPanelV1 language={language} forecast={forecast} runId={forecastRun} onRunChange={setForecastRun}/>} 
  </ProductSectionCard>}
 </ProductPageShell>;
}
