import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { requireAoActAnyScopeV0 } from '../auth/ao_act_authz_v0.js';
import { tenantFromBodyOrAuthV1, tenantFromQueryOrAuthV1, requireTenantMatchOr404V1 } from '../auth/tenant_scope_v1.js';
import { acknowledgeManualTakeoverV1, completeManualTakeoverV1, resolveFailSafeEventV1 } from '../services/fail_safe_service_v1.js';

export function registerFailSafeV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get('/api/v1/fail-safe/events', async (req, reply) => {
    const auth=requireAoActAnyScopeV0(req, reply, ['security.audit.read','action.read']); if(!auth) return;
    const tenant=tenantFromQueryOrAuthV1((req as any).query??{}, auth); if(!requireTenantMatchOr404V1(reply, auth, tenant)) return;
    const r=await pool.query(`SELECT * FROM fail_safe_event_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 ORDER BY created_at DESC LIMIT 200`,[tenant.tenant_id,tenant.project_id,tenant.group_id]);
    return reply.send({ok:true,items:r.rows??[]});
  });
  app.get('/api/v1/manual-takeovers', async (req, reply)=>{const auth=requireAoActAnyScopeV0(req,reply,['security.audit.read','action.read']); if(!auth) return; const tenant=tenantFromQueryOrAuthV1((req as any).query??{}, auth); if(!requireTenantMatchOr404V1(reply,auth,tenant)) return; const r=await pool.query(`SELECT * FROM manual_takeover_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 ORDER BY created_at DESC LIMIT 200`,[tenant.tenant_id,tenant.project_id,tenant.group_id]); return reply.send({ok:true,items:r.rows??[]});});
  app.post('/api/v1/manual-takeovers/:takeover_id/ack', async (req, reply)=>{const auth=requireAoActAnyScopeV0(req,reply,['action.task.dispatch','security.admin']); if(!auth) return; const body:any=req.body??{}; const p:any=req.params??{}; const tenant=tenantFromBodyOrAuthV1(body, auth); if(!requireTenantMatchOr404V1(reply,auth,tenant)) return; await acknowledgeManualTakeoverV1(pool,{...tenant,takeover_id:String(p.takeover_id??'')}); return reply.send({ok:true});});
  app.post('/api/v1/manual-takeovers/:takeover_id/complete', async (req, reply)=>{const auth=requireAoActAnyScopeV0(req,reply,['security.admin','action.task.dispatch']); if(!auth) return; const body:any=req.body??{}; const p:any=req.params??{}; const tenant=tenantFromBodyOrAuthV1(body, auth); if(!requireTenantMatchOr404V1(reply,auth,tenant)) return; await completeManualTakeoverV1(pool,{...tenant,takeover_id:String(p.takeover_id??''),completed_by_actor_id:auth.actor_id,completed_by_token_id:auth.token_id,completion_note:body.completion_note??null}); return reply.send({ok:true});});
  app.post('/api/v1/fail-safe/events/:fail_safe_event_id/resolve', async (req, reply)=>{const auth=requireAoActAnyScopeV0(req,reply,['security.admin','action.task.dispatch']); if(!auth) return; const body:any=req.body??{}; const p:any=req.params??{}; const tenant=tenantFromBodyOrAuthV1(body, auth); if(!requireTenantMatchOr404V1(reply,auth,tenant)) return; await resolveFailSafeEventV1(pool,{...tenant,fail_safe_event_id:String(p.fail_safe_event_id??''),resolved_by_actor_id:auth.actor_id,resolved_by_token_id:auth.token_id,resolution_note:body.resolution_note??null}); return reply.send({ok:true});});
}
