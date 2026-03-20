export type FieldProgramNoteV1 = {
  type: "field_program_note_v1";
  payload: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    note_id: string;
    program_id: string;
    field_id: string;
    season_id?: string | null;
    title?: string | null;
    note: string;
    tags?: string[];
    author_id?: string | null;
    created_ts: number;
    updated_ts?: number | null;
  };
};
