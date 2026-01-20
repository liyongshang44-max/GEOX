import path from "node:path";

import type { AppleIReader } from "./applei_reader";
import { newRunId, nowMs, stableStringify } from "./util";
import { JudgePipelineV1, type JudgeRunInput, type JudgeRunOutput } from "./pipeline";
import { JudgeSqliteStore } from "./store/sqlite_store";
import type { ProblemStateV1 } from "./problem_state";
import type { AoSenseV1 } from "./ao_sense";
import type { LBCandidateV1 } from "./lb_candidate";
import type { ReferenceViewV1 } from "./reference/reference_builder";
import { referenceNaturalKey } from "./reference/reference_builder";

const REPO_ROOT = path.resolve(process.cwd());

export class JudgeRuntime {
  private pipeline: JudgePipelineV1;
  private store: JudgeSqliteStore;

  constructor(reader: AppleIReader) {
    this.pipeline = new JudgePipelineV1(reader);
    const filePath = process.env.JUDGE_DB_PATH ?? path.join(REPO_ROOT, "apps", "judge", "data", "judge.sqlite");
    this.store = new JudgeSqliteStore({ filePath });
  }

  async run(input: JudgeRunInput): Promise<JudgeRunOutput> {
    const run_id = newRunId();
    const created_at_ts = nowMs();

    const { output, input_bundle, produced_reference_views, produced_lb_candidates } = await this.pipeline.run(run_id, input);

    // NOTE (apple_i_judge_acceptance_v1): Judge must remain stateless.
    // It must NOT persist runs / problem states / AO-SENSE / reference views to any local store.
    // Even if callers provide `options.persist=true`, we ignore it to keep Judge behavior
    // reproducible and free of side effects.
    const persist = false;
    if (persist) {
      this.store.insertRun({
        run_id,
        created_at_ts,
        determinism_hash: output.determinism_hash,
        input_bundle_json: stableStringify(input_bundle),
      });

      if (output.problem_states.length) {
        const ps = output.problem_states[0] as ProblemStateV1;
        this.store.insertProblemState({
          run_id,
          problem_state_id: ps.problem_state_id,
          created_at_ts: ps.created_at_ts,
          record_json: JSON.stringify(ps),
        });

        for (const ao of output.ao_sense as AoSenseV1[]) {
          this.store.insertAoSense({
            run_id,
            ao_sense_id: ao.ao_sense_id,
            created_at_ts: ao.created_at_ts,
            record_json: JSON.stringify(ao),
          });
        }

        const lb = produced_lb_candidates as LBCandidateV1[];
        for (const c of lb) {
          this.store.insertLBCandidate({
            run_id,
            lb_candidate_id: c.lb_candidate_id,
            created_at_ts: c.created_at_ts,
            record_json: JSON.stringify(c),
          });
        }
      }

      const rvs = produced_reference_views as ReferenceViewV1[];
      for (const rv of rvs) {
        this.store.insertReferenceView({
          run_id,
          reference_view_id: rv.reference_view_id,
          created_at_ts: rv.created_at_ts,
          natural_key: referenceNaturalKey(rv),
          record_json: JSON.stringify(rv),
        });
      }
    }

    return { run_id, ...output };
  }

  listProblemStates(limit = 100): any[] {
    return this.store.listProblemStates(limit);
  }
  listReferenceViews(limit = 100): any[] {
    return this.store.listReferenceViews(limit);
  }
  listAoSense(limit = 100): any[] {
    return this.store.listAoSense(limit);
  }
}
