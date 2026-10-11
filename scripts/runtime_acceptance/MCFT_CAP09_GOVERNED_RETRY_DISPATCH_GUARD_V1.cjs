"use strict";
// Explicit dispatcher for the governed retry lineage. No implicit fallthrough
// to the old (>6h) ARM and no grant from a candidate proposal.
const assert=require("node:assert/strict");
function selectAuthorizationLane(args) {
  assert(Array.isArray(args),"ARGUMENTS_REQUIRED");
  const retry=args.includes("--governed-retry");
  if (!retry) return {lane:"LEGACY",execute_authorized:false,old_authorizer_required:true};
  assert(args.filter(x=>x==="--governed-retry").length===1,"DUPLICATE_RETRY_FLAG_FORBIDDEN");
  assert(args.includes("--operator-authorized"),"OPERATOR_ACK_REQUIRED");
  assert(args.includes("--preflight-only") !== args.includes("--execute"),"SELECT_ONE_MODE");
  // #3692 is still a candidate. New isolated retry MUST NEVER route through
  // the old authorize("ISOLATED_QUALIFICATION")/six-hour ARM.
  return {lane:"GOVERNED_RETRY_UNADOPTED",execute_authorized:false,
    old_authorizer_required:false,reason:"RETRY_ACTIVATION_NOT_ADOPTED"};
}
function rejectUnadoptedRetry(args) {
 const lane=selectAuthorizationLane(args);
 if(lane.lane==="GOVERNED_RETRY_UNADOPTED")
   throw new Error("EXECUTE_HOLD: GOVERNED_RETRY_ACTIVATION_NOT_ADOPTED");
 return lane;
}
module.exports={selectAuthorizationLane,rejectUnadoptedRetry};
