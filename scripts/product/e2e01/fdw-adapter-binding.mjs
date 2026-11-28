import {hash} from './contract.mjs';
// Historical FDW Phase 4 fix accepted on 2026-11-17.
// Reverse precisely this one known replacement only to qualify the rest of the
// adapter against its original normalized reference. Never execute the reversal.
const original="if (!proof.groups.includes(group)) throw denied('MEMBERSHIP_DENIED');";
const accepted="if (!proof.groups.includes(group)) return {status:'DENIED'};";
export function qualifyAcceptedAdapter(source,originalDigest){
 const normalized=source.replace(/\r\n/g,'\n').trimEnd();
 if(normalized.split(accepted).length!==2||normalized.includes(original))return false;
 return hash(normalized.replace(accepted,()=>original))===originalDigest;
}
