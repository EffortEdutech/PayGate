BEGIN;

CREATE TABLE reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES payment_applications(id),
  payment_customer_id uuid NULL REFERENCES payment_customers(id),
  provider_id varchar(32) NOT NULL,
  provider_account varchar(64) NOT NULL,
  environment payment_environment NOT NULL,
  status varchar(48) NOT NULL,
  evidence jsonb NOT NULL,
  request_id varchar(128) NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reconciliation_runs_customer_idx ON reconciliation_runs (payment_customer_id, completed_at DESC);
CREATE INDEX reconciliation_runs_provider_idx ON reconciliation_runs (provider_id, provider_account, environment, completed_at DESC);

COMMIT;
