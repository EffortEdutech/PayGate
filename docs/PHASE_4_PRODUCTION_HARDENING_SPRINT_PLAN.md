# Phase 4 - Production Hardening Sprint Plan

**Status:** started - Track 1 completed  
**Starts after:** Phase 3 AIntern deployed sandbox proof freeze  
**Live payments:** not authorized in this phase until the live-mode readiness gate is explicitly passed by the operator.

## Objective

Harden the Central Payment Hub from a successful deployed sandbox proof into an operator-ready payment platform that can safely support more apps, more company/provider accounts, diagnostics, audits, alerting, and eventually controlled live Stripe transactions.

Phase 4 is not a live launch by default. It prepares the system so that a future live-payment test can be deliberate, isolated, reversible, and auditable.

## Core Guardrail

The Hub remains the only payment authority. Applications submit `app_id`, `user_ref`, and `plan_key`; they do not control provider price IDs, amounts, currencies, provider customer IDs, webhook processing, or entitlement mutation.

## Sprint Tracks

### Track 1 - Operator Diagnostics Auth

Goal: protect operational diagnostics before production-style usage.

Checklist:

- [x] Require operator authentication for `/diagnostics/runtime`.
- [x] Require operator authentication for `/diagnostics/ready`.
- [x] Ensure diagnostics never reveal secrets, raw tokens, database passwords, Stripe keys, webhook secrets, or full JWT contents.
- [x] Keep `/health` safe for public liveness only.
- [x] Add tests proving diagnostics are blocked without operator auth.
- [x] Add docs for operator-only diagnostics access.

Implementation notes:

- `/diagnostics/runtime` and `/diagnostics/ready` now require `Authorization: Bearer <OPERATOR_DIAGNOSTICS_TOKEN>`.
- If `OPERATOR_DIAGNOSTICS_TOKEN` is missing, diagnostics fail closed with `DIAGNOSTICS_AUTH_NOT_CONFIGURED`.
- If the token is missing or wrong, diagnostics return `UNAUTHORIZED`.
- `/health` remains public and only returns minimal liveness data.
- Diagnostics return safe shape/status data only; secrets are represented by presence/prefix checks and sanitized error messages.

Vercel environment variable required after deployment:

```ini
OPERATOR_DIAGNOSTICS_TOKEN=<strong operator-only random token>
```

### Track 2 - Stripe Reconciliation Deep Inspection

Goal: make reconciliation explain provider state mismatches clearly.

Checklist:

- [ ] Inspect Stripe Checkout Session by provider session id when available.
- [ ] Inspect Stripe Customer linked to the Hub payment customer.
- [ ] Inspect Stripe Subscription when present.
- [ ] Inspect latest Invoice and PaymentIntent when relevant.
- [ ] Inspect Price/Product metadata and lookup keys.
- [ ] Explain mismatch classes: missing provider subscription, one-time payment mode, wrong customer, delayed provider state, canceled subscription, missing metadata, or registry mapping mismatch.
- [ ] Keep returned reconciliation output provider-neutral for app callers.
- [ ] Store detailed provider evidence only in server-side audit records.
- [ ] Add tests for mismatch classification.

### Track 3 - Audit/Admin Console

Goal: give the operator a safe view of payment state without using raw database queries.

Checklist:

- [ ] Add authenticated operator console route.
- [ ] View registered apps.
- [ ] View registry plans and provider account mapping.
- [ ] View payment customers.
- [ ] View checkout intents/sessions.
- [ ] View subscription state.
- [ ] View entitlement state.
- [ ] View recent webhook inbox status.
- [ ] View reconciliation runs and outcomes.
- [ ] Add filters by app, environment, provider account, user ref, and status.
- [ ] Avoid exposing provider secrets or unsafe raw provider objects.

### Track 4 - Multi-App Onboarding Checklist

Goal: prepare for app #2 after AIntern without weakening the architecture.

Checklist:

- [ ] Create a repeatable app onboarding runbook.
- [ ] Define required registry fields for each new app.
- [ ] Define required Stripe/Product/Price setup steps.
- [ ] Define required Supabase/JWT/auth setup steps for app-owned users.
- [ ] Define allowed return contexts and app URLs.
- [ ] Define entitlement naming conventions.
- [ ] Define provider account assignment checklist.
- [ ] Require `npm run validate:registry` for every registry change.
- [ ] Add a dry-run checklist before any new app can create checkout sessions.

### Track 5 - Live-Mode Readiness Checklist

Goal: prepare for live Stripe use without accidentally activating it.

Checklist:

- [ ] Separate test and live provider account configuration.
- [ ] Separate test and live webhook endpoints.
- [ ] Separate test and live provider price IDs.
- [ ] Separate test and live data/idempotency scope.
- [ ] Confirm live return URLs and production domain.
- [ ] Confirm company/legal owner for each live Stripe account.
- [ ] Confirm tax, invoice, receipt, statement descriptor, refund policy, and support email settings in Stripe.
- [ ] Confirm database backup and restore plan.
- [ ] Confirm operator access controls.
- [ ] Confirm no browser-visible static app token is used.
- [ ] Require explicit operator approval before the first live transaction.

### Track 6 - Monitoring and Alerting

Goal: surface failures before users report them.

Checklist:

- [ ] Log failed webhook verification attempts safely.
- [ ] Track unprocessed or failed webhook inbox events.
- [ ] Track failed reconciliation runs.
- [ ] Track database connection failures.
- [ ] Track Stripe API failures and rate-limit responses.
- [ ] Add operator-visible failure summary.
- [ ] Decide alert channel: email, dashboard, or future messaging integration.
- [ ] Document retry and escalation steps.

### Track 7 - Provider Account Isolation Tests

Goal: prove multiple Stripe/company accounts cannot bleed into each other.

Checklist:

- [ ] Add fixture for at least two named Stripe provider accounts.
- [ ] Prove an app can only use the provider account declared in its registry package.
- [ ] Prove webhook endpoint account scope is enforced.
- [ ] Prove reconciliation account scope is enforced.
- [ ] Prove portal session account scope is enforced.
- [ ] Prove idempotency keys are environment/app/account scoped.
- [ ] Prove unknown provider accounts fail closed.
- [ ] Run registry validation and full test suite.

### Track 8 - Controlled Live Stripe Payment and Refund Test

Goal: define when and how live payments/refunds will be tested.

Live Stripe payments and refunds should only run after Tracks 1, 5, 6, and 7 are complete, and after the operator explicitly approves a live test window.

Minimum gate before first live payment:

- [ ] Operator diagnostics protected.
- [ ] Live-mode readiness checklist completed.
- [ ] Monitoring/alerting baseline in place.
- [ ] Provider account isolation tests passed.
- [ ] Live Stripe account settings reviewed.
- [ ] Live Product/Price created intentionally, not copied blindly from sandbox.
- [ ] Live webhook endpoint configured and verified.
- [ ] Small controlled live amount selected.
- [ ] Real payment method and refund path approved by operator.
- [ ] Rollback/support plan written.
- [ ] Explicit operator approval recorded outside source control.

Live test sequence:

1. Create one low-value live checkout session from the production app.
2. Complete real payment.
3. Verify live webhook ingestion.
4. Verify live entitlement projection.
5. Verify receipt/invoice behavior.
6. Create billing portal session.
7. Perform partial or full refund in Stripe.
8. Verify refund webhook handling.
9. Verify entitlement/business-state decision after refund.
10. Record evidence and freeze live proof notes.

## Phase 4 Exit Criteria

- [x] Diagnostics are protected.
- [ ] Reconciliation gives useful mismatch diagnostics.
- [ ] Operator can inspect payment state safely.
- [ ] App #2 onboarding can follow a documented checklist.
- [ ] Live-mode readiness checklist exists and is reviewed.
- [ ] Monitoring/alerting baseline exists.
- [ ] Multi-provider-account isolation tests pass.
- [ ] Live payment/refund test gate is either completed or explicitly deferred.