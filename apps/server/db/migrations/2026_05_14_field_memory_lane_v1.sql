ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS memory_lane text NOT NULL DEFAULT 'TECHNICAL_EXECUTION_MEMORY';
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS trust_level text NOT NULL DEFAULT 'TECHNICAL_SIGNAL';
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS formal_acceptance_id text NULL;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS source_lane text NULL;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS customer_visible_memory boolean NOT NULL DEFAULT false;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS learning_eligible boolean NOT NULL DEFAULT false;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS trust_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_field_memory_v1_memory_lane ON field_memory_v1(memory_lane);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_trust_level ON field_memory_v1(trust_level);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_customer_visible ON field_memory_v1(customer_visible_memory);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_learning_eligible ON field_memory_v1(learning_eligible);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_formal_acceptance ON field_memory_v1(formal_acceptance_id);
