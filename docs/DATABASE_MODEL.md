# Database Model

PostgreSQL is the Phase 1 target. The executable baseline is in `payment-hub/database/migrations`.

Core aggregates:

- applications and registry versions;
- payment customers and provider-customer mappings;
- plans and provider-price mappings;
- checkout sessions, payments, refunds, and subscriptions;
- immutable entitlement grants and revocations plus read projections;
- webhook inbox, normalized events, idempotency ledger, transactional outbox;
- reconciliation runs and audit log.

Every provider mapping includes provider, provider account, and environment. Financial records use integer minor units and uppercase currency. Mutable projections do not replace immutable source history.

