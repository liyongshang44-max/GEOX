CREATE OR REPLACE FUNCTION geox_variable_task_no_auto_acked_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  record_type text;
  transition_reason text;
BEGIN
  record_type := NEW.record_json::jsonb ->> 'type';
  transition_reason := NEW.record_json::jsonb #>> '{payload,reason}';

  IF record_type = 'operation_plan_v1'
     AND (NEW.record_json::jsonb #>> '{payload,source}') = 'variable_prescription_contract_v1'
     AND (NEW.record_json::jsonb #>> '{payload,status}') = 'ACKED'
  THEN
    NEW.record_json := jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(NEW.record_json::jsonb, '{payload,status}', '"READY_TO_DISPATCH"'::jsonb, true),
          '{payload,dispatch_status}', '"NOT_DISPATCHED"'::jsonb, true
        ),
        '{payload,ack_status}', '"ACK_REQUIRED"'::jsonb, true
      ),
      '{payload,meta,status_contract}', '"TASK_CREATED_READY_TO_DISPATCH_NOT_ACKED"'::jsonb, true
    );
  END IF;

  IF record_type = 'operation_plan_transition_v1'
     AND transition_reason = 'VARIABLE_ACTION_TASK_CREATED'
     AND (NEW.record_json::jsonb #>> '{payload,to_status}') = 'ACKED'
  THEN
    NEW.record_json := jsonb_set(
      jsonb_set(
        jsonb_set(NEW.record_json::jsonb, '{payload,to_status}', '"READY_TO_DISPATCH"'::jsonb, true),
        '{payload,reason}', '"VARIABLE_ACTION_TASK_READY_TO_DISPATCH"'::jsonb, true
      ),
      '{payload,ack_source_required}', '"executor acknowledgement"'::jsonb, true
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_variable_task_no_auto_acked_v1 ON facts;
CREATE TRIGGER trg_variable_task_no_auto_acked_v1
BEFORE INSERT ON facts
FOR EACH ROW
EXECUTE FUNCTION geox_variable_task_no_auto_acked_v1();
