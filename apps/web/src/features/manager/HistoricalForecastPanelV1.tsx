import React from 'react';
import type {HistoricalForecast,ForecastPoint} from '../../api/managerWorkspaceV1';
// All chart coordinates are view transforms of native returned values.
// No interpolated/missing points, smoothing, or extrapolation.
export default function HistoricalForecastPanelV1({language,forecast,runId,onRunChange}:{language:'zh'|'en';forecast:HistoricalForecast;runId:string;onRunChange:(id:string)=>void}){
 const tr=(a:string,b:string)=>language==='zh'?a:b;
 if(forecast.status==='UNAVAILABLE')return <p>{tr('历史预测尚无可用展示许可或数据接线。','Historical forecast display permission or data connection is unavailable.')}</p>;
 const run=forecast.runs.find(r=>r.forecast_ref.object_id===runId);
 const optionName=(s:string)=>s==='NO_ACTION'?tr('不新增灌溉','No new irrigation'):s==='IRRIGATE_NOW_15MM'?tr('模拟灌溉15 mm','Simulated 15 mm irrigation'):s==='IRRIGATE_NOW_25MM'?tr('模拟灌溉25 mm','Simulated 25 mm irrigation'):s;
 const lines:{name:string;points:ForecastPoint[];color:string}[]=run?.status==='COMPLETED'?[{name:tr('原生预测','Native forecast'),points:run.points,color:'#222222'},...(run.scenarios?.options??[]).map((o,i)=>({name:optionName(o.option_id),points:o.points,color:['#64748b','#0284c7','#0f766e'][i]??'#777777'}))]:[];
 const values=lines.flatMap(l=>l.points.map(p=>Number(p.storage_mean_mm)));
 const valid=lines.length>0&&lines.every(l=>l.points.length===72&&l.points.every((p,i)=>p.horizon_hour===i+1&&Number.isFinite(Number(p.storage_mean_mm))));
 const min=valid?Math.min(...values):0,max=valid?Math.max(...values):1,span=max===min?1:max-min;
 const x=(h:number)=>48+(h-1)*552/71,y=(v:number)=>180-(v-min)*150/span;
 return <section aria-label={tr('历史模型预测','Historical model forecast')}>
 <h3>{tr('历史72小时预测与灌溉情景','Historical 72-hour forecast and irrigation scenarios')}</h3>
 <p>{tr('历史模型估计、未经真实根区验证；情景未执行，不是灌溉记录、当前状态或行动建议。','Historical model estimates, not validated against actual root-zone state; scenarios not executed and not irrigation records, current state, or advice.')}</p>
 <label>{tr('预测发布时间（UTC）','Forecast issue time (UTC)')} <select value={runId} onChange={e=>onRunChange(e.target.value)}>{forecast.runs.map(r=><option key={r.forecast_ref.object_id} value={r.forecast_ref.object_id}>{r.issued_at} · {r.status==='BLOCKED'?tr('未生成','Blocked'):tr('已生成','Completed')}</option>)}</select></label>
 {run?.status==='BLOCKED'&&<p>{tr('原生预测受阻，没有预测点。','Native forecast blocked; no forecast points.')} <code>{run.reason_codes.join(', ')}</code></p>}
 {run?.status==='COMPLETED'&&valid&&<>
 <svg viewBox="0 0 630 215" role="img" aria-label={tr('原生模型储水量，横轴预测小时，纵轴毫米','Native model water storage, forecast hours on x-axis and millimeters on y-axis')} style={{width:'100%',maxWidth:850}}>
 <path d="M48 20 V180 H600" fill="none" stroke="currentColor"/>
 <text x="4" y="35" fontSize="10" fill="currentColor">{max.toFixed(2)}</text><text x="4" y="184" fontSize="10" fill="currentColor">{min.toFixed(2)}</text><text x="10" y="12" fontSize="10" fill="currentColor">mm</text>
 {[1,12,24,36,48,60,72].map(h=><text key={h} x={x(h)} y="197" textAnchor="middle" fontSize="10" fill="currentColor">{h}h</text>)}
 {lines.map((l,i)=><polyline key={i} fill="none" stroke={l.color} strokeWidth={2} strokeDasharray={i===1?'4 3':undefined} points={l.points.map(p=>x(p.horizon_hour)+','+y(Number(p.storage_mean_mm))).join(' ')}/>)}
 </svg><div>{lines.map((l,i)=><p key={i}><span style={{display:'inline-block',width:18,borderTop:'2px solid '+l.color,marginRight:6}}/>{l.name} · {l.points.length} {tr('点','points')}</p>)}</div>
 {!run.scenarios&&<p>{tr('此运行未提供经授权的情景集合。','No authorized scenario set for this run.')}</p>}
 <details><summary>{tr('逐小时原始数值及来源','Original hourly values and provenance')}</summary><p><code>{run.forecast_ref.fact_id} · {run.forecast_ref.determinism_hash}</code></p>
 {lines.map((l,i)=><div key={i}><h4>{l.name}</h4><div style={{overflowX:'auto'}}><table><thead><tr><th>{tr('目标时间 UTC','Target time UTC')}</th><th>{tr('模型储水量 mm','Model storage mm')}</th><th>{tr('方差 mm²','Variance mm²')}</th><th>{tr('有效水分比例','Available water fraction')}</th></tr></thead><tbody>{l.points.map(p=><tr key={p.horizon_hour}><td>{p.target_time}</td><td>{p.storage_mean_mm}</td><td>{p.storage_variance_mm2}</td><td>{p.available_water_fraction}</td></tr>)}</tbody></table></div></div>)}</details></>}
 {run?.status==='COMPLETED'&&!valid&&<p>{tr('原始序列未通过完整性检查。','Original series failed integrity checks.')}</p>}
 </section>;
}
