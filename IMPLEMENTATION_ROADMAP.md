# Implementation Roadmap

## Phase 0 — Frozen

- Architecture and authority boundaries.
- Security and trust boundaries.
- Versioned API and provider contracts.
- Registry schemas and executable validation.
- Database and event-processing specification.

## Phase 1 — Foundation (frozen)

- TypeScript workspace and shared contracts.
- Registry loader with structural and semantic validation.
- Provider-neutral adapter interfaces and capability model.
- Hub configuration, health, readiness, authentication, and idempotency foundations.
- PostgreSQL migration baseline.
- Stripe adapter skeleton without live operations.

## Phase 2 — Stripe sandbox vertical slice (frozen)

- Authenticated catalog and checkout endpoints.
- Stripe Checkout Session creation by lookup key.
- Raw-body webhook verification and durable inbox processing.
- Customer, subscription, and entitlement projections.
- Customer Portal sessions and reconciliation jobs.
- Real Stripe sandbox proof completed and recorded in `PHASE_2_COMPLETION.md` and `PHASE_2_FREEZE.md`.

## Phase 3 — First application integration (current: AIntern)

- First app: AIntern at `C:\Users\user\Documents\00 aWL_platform\AIntern`.
- Generate or hand-write only a thin application adapter from the frozen Hub contract.
- Register AIntern plans, entitlements, and company/provider-account mapping in the Hub registry.
- Add AIntern checkout, portal, and entitlement consumption without direct Stripe ownership.
- Introduce named provider accounts so each app can bill through the correct company Stripe account.
- Sandbox checkout, renewal, failure, cancellation, replay, and reconciliation tests.
- Operational runbooks and observability gates.
