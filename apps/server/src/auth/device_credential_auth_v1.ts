import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

export type DeviceCredentialAuthContextV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  device_id: string;
  credential_id: string;
  principal_type: "device";
};

function bearerSecret(req: FastifyRequest): string | null {
  const raw=String((req.headers as any)?.authorization??"").trim();
  const m=/^Bearer\s+(.+)$/i.exec(raw);
  return m?.[1]?.trim()||null;
}

function sha256Hex(value:string):string {
  return crypto.createHash("sha256").update(value,"utf8").digest("hex");
}

export async function requireDeviceCredentialAuthV1(
  pool: Pool,
  req: FastifyRequest,
  reply: FastifyReply,
  input: { device_id: string; credential_id?: string | null },
): Promise<DeviceCredentialAuthContextV1|null> {
  const device_id=String(input.device_id??"").trim();
  if(!device_id){ reply.status(400).send({ok:false,error:"DEVICE_ID_REQUIRED"}); return null; }
  const secret=bearerSecret(req);
  if(!secret){ reply.status(401).send({ok:false,error:"DEVICE_AUTH_MISSING"}); return null; }
  const credential_hash=sha256Hex(secret);
  const q=await pool.query(
    `SELECT c.tenant_id,c.device_id,c.credential_id,b.field_id,
            NULLIF(TRIM(f.project_id),'') AS project_id,
            NULLIF(TRIM(f.group_id),'') AS group_id
       FROM device_credential_index_v1 c
       JOIN device_index_v1 d
         ON d.tenant_id=c.tenant_id AND d.device_id=c.device_id
       JOIN device_binding_index_v1 b
         ON b.tenant_id=c.tenant_id AND b.device_id=c.device_id
       JOIN field_index_v1 f
         ON f.tenant_id=b.tenant_id AND f.field_id=b.field_id
      WHERE c.device_id=$1
        AND c.credential_hash=$2
        AND c.status='ACTIVE'
        AND c.revoked_ts_ms IS NULL
      ORDER BY c.issued_ts_ms DESC
      LIMIT 2`,
    [device_id,credential_hash],
  ).catch(()=>({rows:[] as any[]}));
  if(q.rows.length!==1){ reply.status(401).send({ok:false,error:q.rows.length>1?"DEVICE_AUTH_AMBIGUOUS":"DEVICE_AUTH_INVALID"}); return null; }
  const row=q.rows[0]??{};
  const credential_id=String(row.credential_id??"").trim();
  if(input.credential_id!=null && String(input.credential_id).trim()!==credential_id){
    reply.status(401).send({ok:false,error:"DEVICE_CREDENTIAL_ID_MISMATCH"}); return null;
  }
  const project_id=String(row.project_id??"").trim(),group_id=String(row.group_id??"").trim(),field_id=String(row.field_id??"").trim();
  if(!project_id||!group_id||!field_id){ reply.status(403).send({ok:false,error:"DEVICE_BINDING_REQUIRED"}); return null; }
  return {
    tenant_id:String(row.tenant_id),
    project_id,
    group_id,
    field_id,
    device_id:String(row.device_id),
    credential_id,
    principal_type:"device",
  };
}
