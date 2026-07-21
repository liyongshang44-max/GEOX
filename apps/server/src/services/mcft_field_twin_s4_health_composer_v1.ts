// Purpose: expose the S4 transport adapter for the frozen Runtime Health composer contract.
// Boundary: pure delegation to the S3 domain composer; no query, role inference, persistence, or write authority.

import {
  RuntimeHealthComposerV1,
  type RuntimeHealthComposerInputV1,
} from "../domain/field_twin_read_model/runtime_health_composer_v1.js";
import type { FieldTwinRuntimeHealthReadModelV1 } from "../domain/field_twin_read_model/composer_contracts_v1.js";

export type S4RuntimeHealthComposerInputV1 = RuntimeHealthComposerInputV1;

export class S4RuntimeHealthComposerV1 {
  private readonly composer = new RuntimeHealthComposerV1();

  compose(input: S4RuntimeHealthComposerInputV1): FieldTwinRuntimeHealthReadModelV1 {
    return this.composer.compose(input);
  }
}
