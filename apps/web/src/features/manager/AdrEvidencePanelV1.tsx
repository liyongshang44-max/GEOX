import React from 'react';
import type {AdrEvidence,NativeRef} from '../../api/managerWorkspaceV1';
const refText=(r:NativeRef)=>r.kind+' · '+r.logical_id+' · '+r.version+' · '+r.semantic_hash;
export default function AdrEvidencePanelV1({language,evidence}:{language:'zh'|'en';evidence:AdrEvidence}){
 const tr=(zh:string,en:string)=>language==='zh'?zh:en;
 const [expired,setExpired]=React.useState(false);
 React.useEffect(()=>{setExpired(false);if(!evidence.valid_until)return;const ms=Date.parse(evidence.valid_until)-Date.now();if(!Number.isFinite(ms)||ms<=0){setExpired(true);return;}const t=setTimeout(()=>setExpired(true),ms);return()=>clearTimeout(t);},[evidence]);
 const crop=(x:string)=>x==='CORN'?tr('玉米','Corn'):x==='SOYBEAN'?tr('大豆','Soybean'):x;
 if(expired||evidence.display_status!=='AUTHORIZED_RECORDED_EVIDENCE')return <p>{evidence.display_status==='NO_COMPLETED_RETRIEVAL'?tr('尚无完成的检索回执。','No completed retrieval.'):evidence.display_status==='NO_RETRIEVED_KNOWLEDGE'?tr('本次没有检索到候选知识。','No knowledge candidates retrieved.'):tr('知识内容展示权限尚未建立或已失效，请重新读取。','Evidence display permission is absent or expired; reload.')}</p>;
 return <section aria-label={tr('农业知识证据','Agricultural knowledge evidence')}>
 <h3>{tr('农业知识证据','Agricultural knowledge evidence')}</h3>
 <p>{tr('以下是经许可的原生检索证据，不是田块适用性、作物排名、预测或经营建议。','Authorized native retrieval evidence, not field applicability, crop ranking, forecast or advice.')}</p>
 <p>{tr('本次知识覆盖：','Evidence coverage: ')}{evidence.coverage_crops.map(crop).join(' / ')}</p>
 {evidence.missing_crops.length>0&&<p>{evidence.missing_crops.map(crop).join(' / ')}{tr('知识尚未纳入本次发布；双作物证据不完整。',' evidence is not admitted to this release; cross-crop coverage is incomplete.')}</p>}
 {evidence.items.map(i=><article key={i.knowledge_ref.semantic_hash}><h4>{i.source_title}</h4><p>{crop(i.crop_code)} · {Object.entries(i.publication).map(([k,v])=>k+': '+v).join(' · ')}</p><h5>{tr('来源支持的知识摘要','Source-supported summary')}</h5><p>{i.summary}</p><p>{tr('允许科学用途（非田块适用性）','Qualified use (not field applicability)')}: {i.allowed_use}</p><h5>{tr('研究限制','Research limitations')}</h5>{i.limitations.length?<ul>{i.limitations.map((v,n)=><li key={n}>{v}</li>)}</ul>:<p>{tr('此知识记录未列出限制，不代表没有限制。','No limitations listed; not proof of unrestricted use.')}</p>}<h5>{tr('适用条件（尚未与当前田块匹配）','Conditions (not matched to this field)')}</h5>{i.conditions.length?<ul>{i.conditions.map((v,n)=><li key={n}>{v}</li>)}</ul>:<p>{tr('未列出条件，不代表适用性已成立。','No conditions listed; applicability is not established.')}</p>}<details><summary>{tr('知识来源及授权引用','Source and authorization references')}</summary><ul>{[i.knowledge_ref,i.source_ref,i.artifact_ref,i.claim_ref,i.qualification_ref,i.inspection_ref,i.rights_policy_ref,...i.rights_grant_refs].map(r=><li key={r.kind+':'+r.semantic_hash}><code>{refText(r)}</code></li>)}</ul><code>{i.artifact_sha256}</code></details></article>)}
 <details><summary>{tr('检索及展示授权','Retrieval and display authorization')}</summary>{evidence.retrieval_ref&&<p>{refText(evidence.retrieval_ref)}</p>}{evidence.knowledge_release_ref&&<p>{refText(evidence.knowledge_release_ref)}</p>}<p>{evidence.approval_ref}</p></details>
 <p>{tr('未产生田间作业权限。','No field execution authority.')}</p></section>;
}
