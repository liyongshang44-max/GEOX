ALTER TABLE roi_ledger_v1 ADD COLUMN IF NOT EXISTS trust_level text NOT NULL DEFAULT 'INTERIM_SUPPORTED';
ALTER TABLE roi_ledger_v1 ADD COLUMN IF NOT EXISTS source_lane text NOT NULL DEFAULT 'AS_EXECUTED_SIGNAL';
ALTER TABLE roi_ledger_v1 ADD COLUMN IF NOT EXISTS formal_acceptance_id text NULL;
ALTER TABLE roi_ledger_v1 ADD COLUMN IF NOT EXISTS formal_evidence_passed boolean NOT NULL DEFAULT false;
ALTER TABLE roi_ledger_v1 ADD COLUMN IF NOT EXISTS chain_validation_passed boolean NOT NULL DEFAULT false;
ALTER TABLE roi_ledger_v1 ADD COLUMN IF NOT EXISTS customer_visible_value boolean NOT NULL DEFAULT false;
ALTER TABLE roi_ledger_v1 ADD COLUMN IF NOT EXISTS trust_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_trust_level ON roi_ledger_v1(trust_level);
CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_source_lane ON roi_ledger_v1(source_lane);
CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_customer_visible ON roi_ledger_v1(customer_visible_value);
CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_formal_acceptance ON roi_ledger_v1(formal_acceptance_id);
