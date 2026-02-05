import type { FastifyInstance } from "fastify"; // Fastify instance type for route registration.

// Sprint 21 discipline: keep server boot stable without introducing new semantics. // Scope note.
// This module is a no-op placeholder so existing imports in src/server.ts do not crash at runtime. // Rationale.
// IMPORTANT: Do not add business logic here without an explicit Sprint + contract + acceptance. // Governance guard.

export async function registerAgronomyInterpretationV1Routes(app: FastifyInstance): Promise<void> { // Register Agronomy Interpretation v1 routes (no-op).
  void app; // Explicitly mark parameter as used; no routes are registered by design.
} // End no-op registrar.
