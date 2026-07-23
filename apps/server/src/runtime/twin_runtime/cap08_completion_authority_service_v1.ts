// apps/server/src/runtime/twin_runtime/cap08_completion_authority_service_v1.ts
// Purpose: adjudicate CAP-08 NOT_STARTED, RESUMABLE, and ALREADY_COMPLETE only from one persisted completion authority plus an exact terminal graph.
// Boundary: orchestration/validation only; no canonical writes, lease mutation, routes, scheduler, production Runtime authority, or S2 provider implementation.

import {
  buildCap08CompletionAuthorityV1,
  cap08CompletionAuthorityStorageRefV1,
  sameCap08CompletionScopeV1,
  validateInspectCap08CompletionAuthorityInputV1,
  type Cap08CompletionAuthorityRepositoryPortV1,
  type Cap08CompletionAuthorityV1,
  type Cap08CompletionGraphV1,
  type Cap08CompletionDispositionV1,
  type EstablishCap08CompletionAuthorityResultV1,
  type InspectCap08CompletionAuthorityInputV1,
  type InspectCap08CompletionAuthorityResultV1,
} from "../../domain/twin_runtime/cap08_completion_authority_contracts_v1.js";

function failV1(code: string): never {
  throw new Error(code);
}

function assertAuthorityInputV1(
  authority: Cap08CompletionAuthorityV1,
  input: InspectCap08CompletionAuthorityInputV1,
): void {
  if (authority.formal_run_id !== input.formal_run_id) failV1("CAP08_COMPLETION_FORMAL_RUN_MISMATCH");
  if (!sameCap08CompletionScopeV1(authority.scope, input.scope)) failV1("CAP08_COMPLETION_SCOPE_MISMATCH");
  if (authority.run_contract_id !== input.run_contract_id) failV1("CAP08_COMPLETION_FOREIGN_RUN");
  if (authority.initial_logical_time !== input.initial_logical_time
    || authority.terminal_logical_time !== input.terminal_logical_time
    || authority.expected_next_logical_time !== input.expected_next_logical_time) {
    failV1("CAP08_COMPLETION_TERMINAL_GRAPH_INCOMPLETE");
  }
  if (authority.phase_engine_contract_digest !== input.phase_engine_contract_digest) {
    failV1("CAP08_COMPLETION_CONTRACT_DIGEST_MISMATCH");
  }
  if (authority.phase_engine_source_digest !== input.phase_engine_source_digest) {
    failV1("CAP08_COMPLETION_SOURCE_DIGEST_MISMATCH");
  }
  if (authority.expected_tick_count !== input.expected_tick_count
    || authority.expected_state_count !== input.expected_state_count
    || authority.expected_forecast_count !== input.expected_forecast_count
    || authority.expected_scenario_set_count !== input.expected_scenario_set_count) {
    failV1("CAP08_COMPLETION_CARDINALITY_MISMATCH");
  }
}

function requiredTerminalGraphV1(graph: Cap08CompletionGraphV1): void {
  if (!graph.present
    || graph.checkpoint_pointer_count !== 1
    || graph.state_pointer_count !== 1
    || graph.forecast_pointer_count !== 1
    || !graph.active_lineage_ref
    || !graph.active_lineage_id
    || !graph.active_revision_id
    || !graph.terminal_checkpoint_ref
    || !graph.terminal_checkpoint_hash
    || !graph.terminal_tick_ref
    || !graph.terminal_tick_hash
    || !graph.terminal_state_ref
    || !graph.terminal_state_hash
    || !graph.terminal_forecast_ref
    || !graph.terminal_forecast_hash) {
    failV1("CAP08_COMPLETION_TERMINAL_GRAPH_INCOMPLETE");
  }
}

function assertGraphV1(
  graph: Cap08CompletionGraphV1,
  authority: Cap08CompletionAuthorityV1,
  input: InspectCap08CompletionAuthorityInputV1,
): void {
  requiredTerminalGraphV1(graph);

  if (graph.lineage_fact_count !== 1) failV1("CAP08_COMPLETION_LINEAGE_MISMATCH");
  const lineages = [
    graph.active_lineage_id,
    graph.checkpoint_pointer_lineage_id,
    graph.state_pointer_lineage_id,
    graph.terminal_checkpoint_lineage_id,
    graph.terminal_tick_lineage_id,
    graph.terminal_state_lineage_id,
    graph.terminal_forecast_lineage_id,
  ];
  if (lineages.some((value) => value !== authority.lineage_id)) failV1("CAP08_COMPLETION_LINEAGE_MISMATCH");

  const revisions = [
    graph.active_revision_id,
    graph.checkpoint_pointer_revision_id,
    graph.state_pointer_revision_id,
    graph.terminal_checkpoint_revision_id,
    graph.terminal_tick_revision_id,
    graph.terminal_state_revision_id,
    graph.terminal_forecast_revision_id,
  ];
  if (revisions.some((value) => value !== authority.revision_id)) failV1("CAP08_COMPLETION_REVISION_MISMATCH");

  if (graph.terminal_checkpoint_ref !== authority.terminal_checkpoint_ref
    || graph.terminal_checkpoint_hash !== authority.terminal_checkpoint_hash
    || graph.checkpoint_pointer_hash !== graph.terminal_checkpoint_hash
    || graph.terminal_tick_ref !== authority.terminal_tick_ref
    || graph.terminal_tick_hash !== authority.terminal_tick_hash
    || graph.state_pointer_ref !== graph.terminal_state_ref
    || graph.forecast_pointer_ref !== graph.terminal_forecast_ref
    || graph.forecast_pointer_hash !== graph.terminal_forecast_hash
    || graph.terminal_checkpoint_logical_time !== input.terminal_logical_time
    || graph.terminal_tick_logical_time !== input.terminal_logical_time
    || graph.expected_next_logical_time !== input.expected_next_logical_time
    || graph.terminal_tick_sequence !== input.expected_tick_count
    || graph.terminal_forecast_status !== "COMPLETED") {
    failV1("CAP08_COMPLETION_TERMINAL_GRAPH_INCOMPLETE");
  }

  if (graph.tick_count !== input.expected_tick_count
    || graph.state_count !== input.expected_state_count
    || graph.forecast_count !== input.expected_forecast_count
    || graph.scenario_set_count !== input.expected_scenario_set_count
    || graph.scenario_projection_count !== input.expected_scenario_set_count) {
    failV1("CAP08_COMPLETION_CARDINALITY_MISMATCH");
  }
}

export class Cap08CompletionAuthorityServiceV1 {
  constructor(private readonly repository: Cap08CompletionAuthorityRepositoryPortV1) {
    if (!repository) throw new Error("CAP08_COMPLETION_AUTHORITY_REPOSITORY_REQUIRED");
  }

  async inspect(input: InspectCap08CompletionAuthorityInputV1): Promise<InspectCap08CompletionAuthorityResultV1> {
    const exactInput = validateInspectCap08CompletionAuthorityInputV1(input);
    const authorityRef = cap08CompletionAuthorityStorageRefV1(exactInput);
    const authority = await this.repository.readAuthority(authorityRef);
    if (!authority) {
      const foreign = await this.repository.readAuthoritiesForScope({
        run_contract_id: exactInput.run_contract_id,
        scope: exactInput.scope,
      });
      if (foreign.length > 0) failV1("CAP08_COMPLETION_FOREIGN_RUN");
      const graph = await this.repository.inspectCompletionGraph(exactInput);
      if (!graph.present) return { disposition: "NOT_STARTED", authority: null, graph };
      if (graph.expected_next_logical_time === exactInput.expected_next_logical_time
        || graph.terminal_tick_sequence === exactInput.expected_tick_count) {
        failV1("CAP08_COMPLETION_TERMINAL_GRAPH_INCOMPLETE");
      }
      return { disposition: "RESUMABLE", authority: null, graph };
    }

    assertAuthorityInputV1(authority, exactInput);
    const graph = await this.repository.inspectCompletionGraph(exactInput);
    assertGraphV1(graph, authority, exactInput);
    return { disposition: "ALREADY_COMPLETE_EXACT", authority, graph };
  }

  async establish(input: InspectCap08CompletionAuthorityInputV1): Promise<EstablishCap08CompletionAuthorityResultV1> {
    const exactInput = validateInspectCap08CompletionAuthorityInputV1(input);
    const existing = await this.repository.readAuthority(cap08CompletionAuthorityStorageRefV1(exactInput));
    if (existing) {
      const inspected = await this.inspect(exactInput);
      return { ...inspected, write_status: "EXISTING_IDEMPOTENT_SUCCESS" };
    }
    const foreign = await this.repository.readAuthoritiesForScope({ run_contract_id: exactInput.run_contract_id, scope: exactInput.scope });
    if (foreign.length > 0) failV1("CAP08_COMPLETION_FOREIGN_RUN");

    const graph = await this.repository.inspectCompletionGraph(exactInput);
    requiredTerminalGraphV1(graph);
    const provisional = buildCap08CompletionAuthorityV1({ inspection: exactInput, graph });
    assertGraphV1(graph, provisional, exactInput);
    const committed = await this.repository.commitAuthority(provisional);
    const inspected = await this.inspect(exactInput);
    return { ...inspected, write_status: committed.status };
  }

  static dispositionRequiresExecutionV1(disposition: Cap08CompletionDispositionV1): boolean {
    return disposition === "NOT_STARTED" || disposition === "RESUMABLE";
  }
}
