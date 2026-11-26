// P1-R1 bounded simple WGS84 polygon validation; no geometry repair.
export function validManagerPolygonV1(v:any):boolean{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['type','coordinates'].includes(k))||v.type!=='Polygon'||!Array.isArray(v.coordinates)||v.coordinates.length!==1)return false;
 const p=v.coordinates[0];if(!Array.isArray(p)||p.length<4||p.length>501)return false;
 for(const x of p)if(!Array.isArray(x)||x.length!==2||x.some(n=>typeof n!=='number'||!Number.isFinite(n))||Math.abs(x[0])>180||Math.abs(x[1])>90)return false;
 const eq=(a:number[],b:number[])=>a[0]===b[0]&&a[1]===b[1];
 if(!eq(p[0],p[p.length-1])||new Set(p.slice(0,-1).map(x=>JSON.stringify(x))).size!==p.length-1)return false;
 const xs=p.map(x=>x[0]);if(Math.max(...xs)-Math.min(...xs)>=180)return false;
 const cross=(a:number[],b:number[],c:number[]) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const on=(a:number[],b:number[],c:number[])=>Math.min(a[0],b[0])<=c[0]&&c[0]<=Math.max(a[0],b[0])&&Math.min(a[1],b[1])<=c[1]&&c[1]<=Math.max(a[1],b[1]);
 let s=0;const n=p.length-1;
 for(let i=0;i<n;i++){
  s+=cross(p[0],p[i],p[i+1]);if(cross(p[(i+n-1)%n],p[i],p[(i+1)%n])===0)return false;
  for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;const a=p[i],b=p[i+1],c=p[j],d=p[j+1];const u=cross(a,b,c),w=cross(a,b,d),x=cross(c,d,a),y=cross(c,d,b);if((u*w<0&&x*y<0)||(u===0&&on(a,b,c))||(w===0&&on(a,b,d))||(x===0&&on(c,d,a))||(y===0&&on(c,d,b)))return false;}
 }
 return Math.abs(s)>1e-14;
}
