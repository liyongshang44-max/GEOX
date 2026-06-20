const fs=require("fs"), path=require("path"); const ROOT=path.resolve(__dirname,"..",".."); const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8"); const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)]):[]; const assert=(c,m,d)=>{if(!c)throw new Error(m+(d?"\n"+JSON.stringify(d,null,2):""));};
const rel=p=>path.relative(ROOT,p).replace(/\\/g,"/"); const src=(dir)=>walk(path.join(ROOT,dir)).filter(f=>/\.(tsx?|jsx?)$/.test(f)).map(f=>[rel(f),fs.readFileSync(f,"utf8")]);
src("apps/web/src/features/customer").forEach(([f,t])=>assert(!/features\/admin|AdminControlPlane|admin\/components/.test(t),"customer imports admin "+f));
src("apps/web/src/features/operator").forEach(([f,t])=>assert(!/features\/admin|AdminControlPlane|admin\/components/.test(t),"operator imports admin "+f));
src("apps/web/src/features/admin").forEach(([f,t])=>assert(!/features\/customer|components\/customer|features\/operator|SubmitScenarioToRecommendationPanel/.test(t),"admin imports customer/operator "+f));
const api=read("apps/server/src/routes/v1/admin_control_plane.ts")+read("apps/server/src/routes/v1/admin_control_plane_boundary.ts");
[/from .*customer.*report.*builder/i,/from .*operator.*scenario.*submit/i,/submitOperatorScenarioRecommendation/].forEach(rx=>assert(!rx.test(api),"Admin API boundary violation "+rx));
console.log("ACCEPTANCE_THREE_SURFACE_ADMIN_BOUNDARY_V1 passed");
