BEGIN;

CREATE TABLE checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES payment_applications(id),
  payment_customer_id uuid NOT NULL REFERENCES payment_customers(id),
  provider_id varchar(32) NOT NULL,
  provider_account varchar(64) NOT NULL,
  environment payment_environment NOT NULL,
  plan_key varchar(120) NOT NULL,
  provider_checkout_session_ref varchar(255) NOT NULL,
  redirect_url text NOT NULL,
  status varchar(32) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, provider_account, environment, provider_checkout_session_ref)
);

CREATE TABLE subscription_projection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_customer_id uuid NOT NULL REFERENCES payment_customers(id),
  state varchar(32) NOT NULL,
  plan_key varchar(120) NULL,
  current_period_end timestamptz NULL,
  source_provider_id varchar(32) NOT NULL,
  source_provider_account varchar(64) NOT NULL,
  source_environment payment_environment NOT NULL,
  source_reference varchar(255) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_customer_id, source_provider_id, source_provider_account, source_environment)
);

CREATE INDEX checkout_sessions_customer_idx ON checkout_sessions (payment_customer_id, created_at DESC);
CREATE INDEX subscription_projection_customer_idx ON subscription_projection (payment_customer_id, updated_at DESC);

COMMIT;
