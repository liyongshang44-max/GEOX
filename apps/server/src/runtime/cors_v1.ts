import type { FastifyCorsOptions } from "@fastify/cors";
import { isProductionLikeRuntimeV1 } from "./runtime_security_v1.js";

export function parseAllowedOriginsV1(raw: string | undefined): string[] {
  return String(raw ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function isOriginAllowedV1(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return !isProductionLikeRuntimeV1();

  if (
    !isProductionLikeRuntimeV1()
    && (origin.includes("localhost") || origin.includes("127.0.0.1"))
  ) {
    return true;
  }

  return allowed.includes(origin);
}

export function buildCorsOptionsV1(): FastifyCorsOptions {
  const allowed = parseAllowedOriginsV1(process.env.GEOX_ALLOWED_ORIGINS);
  const credentials = String(process.env.GEOX_CORS_ALLOW_CREDENTIALS ?? "1") === "1";

  return {
    credentials,
    origin(origin, callback) {
      if (isOriginAllowedV1(origin, allowed)) {
        callback(null, origin || true);
        return;
      }

      callback(null, false);
    },
  } as FastifyCorsOptions;
}
