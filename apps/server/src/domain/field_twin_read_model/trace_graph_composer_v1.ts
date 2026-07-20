// Purpose: compose an exact, deterministic MCFT-CAP-07 trace graph from S2-validated nodes and explicit edges.
// Boundary: no inferred edges, graph search, database access, cross-database stitching, persistence, or mutation.

import type {
  FieldTwinCanonicalObjectRefV1,
  FieldTwinLimitationV1,
  FieldTwinRecordSetValidationV1,
  FieldTwinRuntimeHealthRoleResolutionV1,
  FieldTwinScopeV1,
  FieldTwinSourceValidationResultV1,
  FieldTwinTraceEdgeV1,
  FieldTwinTraceGraphV1,
  FieldTwinTraceNodeV1,
} from "./contracts_v1.js";
import { FIELD_TWIN_TRACE_EDGE_KINDS_V1 } from "./contracts_v1.js";
import { buildResponseInstanceHashV1, buildTraceGraphContentHashV1 } from "./hash_contracts_v1.js";
import { sortTraceEdgesV1, sortTraceNodesV1 } from "./ordering_v1.js";
import {
  assertScopeExactForComposerV1,
  composerFailV1,
  normalizeComposerEvidenceRefsV1,
  normalizeComposerLimitationsV1,
} from "./composer_contracts_v1.js";

export type FieldTwinTraceGraphComposerInputV1 = {
  request_scope: FieldTwinScopeV1;
  response_started_at: import("./contracts_v1.js").CanonicalUtcInstantV1;
  nodes: readonly FieldTwinTraceNodeV1[];
  exact_edges: readonly FieldTwinTraceEdgeV1[];
  unattached_objects: readonly FieldTwinCanonicalObjectRefV1[];
  missing_diagnostics: readonly FieldTwinLimitationV1[];
  record_set_validation: FieldTwinRecordSetValidationV1 | null;
  health_role_resolutions: readonly FieldTwinRuntimeHealthRoleResolutionV1[];
  active_lineage_authority_validation: FieldTwinSourceValidationResultV1 | null;
};

export class FieldTwinTraceGraphComposerV1 {
  compose(input: FieldTwinTraceGraphComposerInputV1): FieldTwinTraceGraphV1 {
    const nodeRefs = new Set<string>();
    for (const node of input.nodes) {
      if (!node.node_id || !node.object_ref || !node.object_hash.startsWith("sha256:")) composerFailV1("MCFT_TRACE_NODE_INVALID", node.object_ref);
      if (node.validation_status !== "PASS") composerFailV1("MCFT_TRACE_NODE_NOT_EXACT", node.object_ref);
      assertScopeExactForComposerV1(node.scope, input.request_scope, "MCFT_TRACE_NODE_SCOPE_MISMATCH");
      if (nodeRefs.has(node.object_ref)) composerFailV1("MCFT_TRACE_NODE_DUPLICATE", node.object_ref);
      nodeRefs.add(node.object_ref);
    }

    const edgeKeys = new Set<string>();
    const exactEdges = input.exact_edges.map((edge) => {
      if (!FIELD_TWIN_TRACE_EDGE_KINDS_V1.includes(edge.edge_kind)) composerFailV1("MCFT_TRACE_EDGE_KIND_INVALID", edge.edge_kind);
      if (!nodeRefs.has(edge.from_ref) || !nodeRefs.has(edge.to_ref)) composerFailV1("MCFT_TRACE_EDGE_ENDPOINT_UNRESOLVED", `${edge.from_ref}->${edge.to_ref}`);
      const key = `${edge.edge_kind}|${edge.from_ref}|${edge.to_ref}`;
      if (edgeKeys.has(key)) composerFailV1("MCFT_TRACE_EDGE_DUPLICATE", key);
      edgeKeys.add(key);
      if (edge.evidence_refs.length === 0) composerFailV1("MCFT_TRACE_EDGE_EVIDENCE_REQUIRED", key);
      return Object.freeze({ ...edge, evidence_refs: normalizeComposerEvidenceRefsV1(edge.evidence_refs) });
    });

    const unattachedRefs = new Set<string>();
    for (const object of input.unattached_objects) {
      if (!object.object_ref || !object.object_hash.startsWith("sha256:")) composerFailV1("MCFT_TRACE_UNATTACHED_OBJECT_INVALID");
      if (nodeRefs.has(object.object_ref) || unattachedRefs.has(object.object_ref)) composerFailV1("MCFT_TRACE_UNATTACHED_OBJECT_DUPLICATE", object.object_ref);
      unattachedRefs.add(object.object_ref);
    }
    if (input.record_set_validation && input.record_set_validation.validation_status !== "PASS") composerFailV1("MCFT_TRACE_RECORD_SET_INVALID");
    if (input.active_lineage_authority_validation && input.active_lineage_authority_validation.validation_status !== "PASS") composerFailV1("MCFT_ACTIVE_LINEAGE_AUTHORITY_INVALID");

    const nodes = Object.freeze(sortTraceNodesV1(input.nodes));
    const edges = Object.freeze(sortTraceEdgesV1(exactEdges));
    const missingDiagnostics = normalizeComposerLimitationsV1(input.missing_diagnostics);
    const traceHash = buildTraceGraphContentHashV1({
      scope: input.request_scope,
      nodes,
      edges,
      unattached_objects: input.unattached_objects,
      missing_diagnostics: missingDiagnostics,
      record_set_validation: input.record_set_validation,
      health_role_resolutions: input.health_role_resolutions,
      active_lineage_authority_validation: input.active_lineage_authority_validation,
    });
    const responseHash = buildResponseInstanceHashV1({
      endpoint_id: "trace",
      endpoint_version: "v1",
      scope: input.request_scope,
      response_started_at: input.response_started_at,
      request_filter_hash: null,
      request_cursor_boundary: null,
      canonical_visibility_snapshot_hash: null,
      endpoint_content_hashes: { trace_graph_content_hash: traceHash },
      next_cursor_envelope_digest: null,
    });
    return Object.freeze({
      schema_version: "field_twin_trace_graph_v1",
      request_scope: Object.freeze({ ...input.request_scope }),
      nodes,
      edges,
      unattached_objects: Object.freeze([...input.unattached_objects]),
      missing_diagnostics: missingDiagnostics,
      record_set_validation: input.record_set_validation,
      health_role_resolutions: Object.freeze([...input.health_role_resolutions]),
      active_lineage_authority_validation: input.active_lineage_authority_validation,
      trace_graph_content_hash: traceHash,
      response_started_at: input.response_started_at,
      response_instance_hash: responseHash,
    });
  }
}
