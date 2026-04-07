import { z } from "zod";

/**
 * StatePayloadV1（Week 2 预留）
 * - 版本注释：v1.0.0 仅定义最小可交换字段，不携带业务特化键。
 * - 设计目标：可独立校验，并可与既有 fertility/salinity 字段并存。
 */
export const StatePayloadLevelV1Schema = z.string().min(1);

export const StatePayloadV1Schema = z.object({
  level: StatePayloadLevelV1Schema,
  explanation: z.string().min(1),
  confidence: z.number().min(0).max(1),
  ts: z.string().min(1),
}).strict();

export type StatePayloadLevelV1 = z.infer<typeof StatePayloadLevelV1Schema>;
export type StatePayloadV1 = z.infer<typeof StatePayloadV1Schema>;
