# PayGate Product Completion Checklist

Status: master checklist through Phase 7.
Parent product plan: `docs/PRODUCT_PLAN.md`.

## Product Objective Checklist

- [x] Provider-neutral payment hub objective documented.
- [x] Stripe selected as first provider and expansion driver.
- [x] Multi-app and multi-company provider account model documented.
- [x] Apps remain consumers; PayGate remains payment authority.
- [x] Live execution requires explicit operator approval.

## Phase 0 - Contract and Authority Freeze

- [x] Authority boundaries frozen.
- [x] API/provider contracts frozen.
- [x] Registry commercial authority frozen.
- [x] Webhook trust model frozen.
- [x] Database model baseline frozen.

## Phase 1 - Executable Foundation

- [x] TypeScript workspace created.
- [x] Shared contracts and types created.
- [x] Registry loader and validation created.
- [x] Provider adapter interface created.
- [x] Config/auth/idempotency foundation created.
- [x] PostgreSQL migration baseline created.

## Phase 2 - Stripe Sandbox Vertical Slice

- [x] Authenticated checkout API.
- [x] PostgreSQL persistence.
- [x] Stripe sandbox checkout.
- [x] Raw-body signed webhook verification.
- [x] Entitlement projection.
- [x] Portal session.
- [x] Reconciliation.
- [x] Phase 2 freeze evidence recorded.

## Phase 3 - AIntern Integration

- [x] AIntern selected as first app.
- [x] AIntern plans/prices configured in sandbox.
- [x] AIntern registry package maps to `stripe:nhl_global_solution`.
- [x] Thin AIntern payment client integrated.
- [x] Deployed sandbox checkout proof.
- [x] Webhook proof.
- [x] Entitlement proof.
- [x] Portal proof.
- [x] Reconciliation proof.
- [x] Phase 3 integration plan closed.

## Phase 4 - Production Hardening

- [x] Operator diagnostics auth.
- [x] Stripe reconciliation deep inspection.
- [x] Audit/admin console.
- [x] Multi-app onboarding checklist.
- [x] Live-mode readiness checklist.
- [x] Monitoring and alerting baseline.
- [x] Provider account isolation tests.
- [x] Controlled live payment/refund planning gate.
- [x] Phase 4 freeze note created.
- [x] Operator accepts Phase 4 freeze.

## Phase 5 - Live-Mode Implementation Readiness

Status: planned, not started.

- [x] Phase 5 sprint plan documented.
- [x] Operator approves Phase 5 start.
- [x] Live adapter boundary implemented.
- [x] Live provider account config model implemented.
- [x] Live registry strategy implemented.
- [x] Live webhook boundary implemented.
- [ ] Refund policy/event mapping implemented.
- [ ] Live operator diagnostics implemented.
- [ ] Phase 6 entry gate prepared.
- [ ] Phase 5 freeze note created.

## Phase 6 - Controlled Live Pilot

Status: planned, not authorized.

- [x] Phase 6 sprint plan documented.
- [x] Controlled live payment/refund gate documented.
- [ ] Operator approval packet completed outside source control.
- [ ] Preflight verification passed.
- [ ] One approved live checkout completed or pilot explicitly aborted.
- [ ] Live webhook and entitlement proof complete.
- [ ] Portal/reconciliation proof complete or intentionally deferred.
- [ ] Refund proof complete if approved.
- [ ] Evidence recorded safely.
- [ ] Phase 6 freeze note created.

## Phase 7 - Multi-App Scale-Out

Status: planned, not started.

- [x] Phase 7 sprint plan documented.
- [x] Multi-app onboarding runbook documented.
- [ ] Operator approves app #2 intake.
- [ ] App #2 registry package created.
- [ ] App #2 provider account and Stripe sandbox setup complete.
- [ ] App #2 thin payment client integrated.
- [ ] App #2 auth boundary verified.
- [ ] App #2 sandbox E2E proof complete.
- [ ] Multi-app admin/monitoring verified.
- [ ] Onboarding runbook updated from app #2 evidence.
- [ ] Phase 7 freeze note created.

## Permanent Stop Conditions

Stop and re-plan if any work would:

- make apps payment authorities;
- expose secrets to browser/app code;
- let apps submit amounts, currencies, provider price IDs, customer IDs, provider account aliases, or entitlement keys;
- grant entitlements from redirects;
- mix sandbox and live mode;
- run live payments/refunds without explicit approval;
- add new providers or apps outside the documented roadmap.
