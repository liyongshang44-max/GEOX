// Purpose: complete the S4 production read adapter where Runtime Health authorities must remain independently reachable.
// Boundary: GET-only read orchestration inside one S2 snapshot; no canonical/projection writes, migration, activation, approval, or dispatch authority.

import type { Pool } from "pg";
import type { McftFieldTwinReadRequestV1 } from "./mcft_field_twin_read_api_v1.js";
import { PostgresMcftFieldTwinReadApiV1 } from "./mcft_field_twin_read_api_v1.js";
import { S4RuntimeHealthComposerV1 } from "./mcft_field_twin_s4_health_composer_v1.js";
import { PostgresFieldTwinSnapshotRepositoryV1 } from "../repositories/field_twin_read_model/postgres_field_twin_snapshot_repository_v1.js";
import { PostgresFieldTwinS4HealthRepositoryV1 } from "../repositories/field_twin_read_model/postgres_field_twin_s4_health_repository_v1.js";

export class PostgresMcftFieldTwinS4ReadApiV1 extends PostgresMcftFieldTwinReadApiV1 {
  private readonly healthSnapshots: PostgresFieldTwinSnapshotRepositoryV1;
  private readonly healthRepository = new PostgresFieldTwinS4HealthRepositoryV1();
  private readonly independentHealthComposer = new S4RuntimeHealthComposerV1();

  constructor(pool: Pool) {
    super(pool);
    this.healthSnapshots = new PostgresFieldTwinSnapshotRepositoryV1(pool);
  }

  override async readHealth(request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> {
    return this.healthSnapshots.withReadOnlyRequestSnapshot(request.scope, async (context) => {
      const terminal = await this.healthRepository.readOptionalTerminalHealthContext(context);
      const operational = await this.healthRepository.readLatestOperationalHealth(context, terminal);
      return this.independentHealthComposer.compose({
        request_scope: context.scope,
        response_started_at: context.response_started_at,
        terminal_record_set_health: terminal?.object ?? null,
        terminal_role_resolution: terminal?.resolution ?? null,
        latest_operational_runtime_health: operational.object,
        operational_role_resolution: operational.resolution,
        health_pointer_validation_summary: operational.pointer_validation ? [operational.pointer_validation] : [],
      }) as unknown as Record<string, unknown>;
    });
  }
}
