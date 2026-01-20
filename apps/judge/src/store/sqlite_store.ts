import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

export type JudgeStoreConfig = {
  filePath: string;
};

export class JudgeSqliteStore {
  private db: Database.Database;

  constructor(cfg: JudgeStoreConfig) {
    const dir = path.dirname(cfg.filePath);
    fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(cfg.filePath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init(): void {
    // append-only tables
    this.db.exec(`
      create table if not exists judge_runs (
        run_id text primary key,
        created_at_ts integer not null,
        determinism_hash text not null,
        input_bundle_json text not null
      );

      create table if not exists judge_problem_states (
        run_id text not null,
        problem_state_id text not null,
        created_at_ts integer not null,
        record_json text not null,
        primary key (run_id, problem_state_id)
      );

      create table if not exists judge_reference_views (
        run_id text not null,
        reference_view_id text not null,
        created_at_ts integer not null,
        natural_key text not null,
        record_json text not null,
        primary key (run_id, reference_view_id)
      );

      create table if not exists judge_ao_sense (
        run_id text not null,
        ao_sense_id text not null,
        created_at_ts integer not null,
        record_json text not null,
        primary key (run_id, ao_sense_id)
      );

      create table if not exists judge_lb_candidates (
        run_id text not null,
        lb_candidate_id text not null,
        created_at_ts integer not null,
        record_json text not null,
        primary key (run_id, lb_candidate_id)
      );

      create index if not exists idx_ps_created on judge_problem_states(created_at_ts);
      create index if not exists idx_rv_created on judge_reference_views(created_at_ts);
      create index if not exists idx_ao_created on judge_ao_sense(created_at_ts);
      create index if not exists idx_lb_created on judge_lb_candidates(created_at_ts);
    `);
  }

  insertRun(args: { run_id: string; created_at_ts: number; determinism_hash: string; input_bundle_json: string }): void {
    const stmt = this.db.prepare(
      `insert into judge_runs (run_id, created_at_ts, determinism_hash, input_bundle_json) values (?, ?, ?, ?)`
    );
    stmt.run(args.run_id, args.created_at_ts, args.determinism_hash, args.input_bundle_json);
  }

  insertProblemState(args: { run_id: string; problem_state_id: string; created_at_ts: number; record_json: string }): void {
    const stmt = this.db.prepare(
      `insert into judge_problem_states (run_id, problem_state_id, created_at_ts, record_json) values (?, ?, ?, ?)`
    );
    stmt.run(args.run_id, args.problem_state_id, args.created_at_ts, args.record_json);
  }

  insertReferenceView(args: {
    run_id: string;
    reference_view_id: string;
    created_at_ts: number;
    natural_key: string;
    record_json: string;
  }): void {
    const stmt = this.db.prepare(
      `insert into judge_reference_views (run_id, reference_view_id, created_at_ts, natural_key, record_json) values (?, ?, ?, ?, ?)`
    );
    stmt.run(args.run_id, args.reference_view_id, args.created_at_ts, args.natural_key, args.record_json);
  }

  insertAoSense(args: { run_id: string; ao_sense_id: string; created_at_ts: number; record_json: string }): void {
    const stmt = this.db.prepare(
      `insert into judge_ao_sense (run_id, ao_sense_id, created_at_ts, record_json) values (?, ?, ?, ?)`
    );
    stmt.run(args.run_id, args.ao_sense_id, args.created_at_ts, args.record_json);
  }

  insertLBCandidate(args: { run_id: string; lb_candidate_id: string; created_at_ts: number; record_json: string }): void {
    const stmt = this.db.prepare(
      `insert into judge_lb_candidates (run_id, lb_candidate_id, created_at_ts, record_json) values (?, ?, ?, ?)`
    );
    stmt.run(args.run_id, args.lb_candidate_id, args.created_at_ts, args.record_json);
  }

  listProblemStates(limit: number): any[] {
    const stmt = this.db.prepare(`select record_json from judge_problem_states order by created_at_ts desc limit ?`);
    return stmt.all(limit).map((r: any) => JSON.parse(r.record_json));
  }

  listReferenceViews(limit: number): any[] {
    const stmt = this.db.prepare(`select record_json from judge_reference_views order by created_at_ts desc limit ?`);
    return stmt.all(limit).map((r: any) => JSON.parse(r.record_json));
  }

  listAoSense(limit: number): any[] {
    const stmt = this.db.prepare(`select record_json from judge_ao_sense order by created_at_ts desc limit ?`);
    return stmt.all(limit).map((r: any) => JSON.parse(r.record_json));
  }
}
