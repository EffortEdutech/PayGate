# Phase 4 - Production Hardening Sprint Plan

**Status:** started - Tracks 1, 2, 3, 4, 5, and 6 completed  
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

- [x] Inspect recent Stripe Checkout Sessions for the provider customer.
- [x] Inspect Stripe Customer linkage through the Hub provider customer reference.
- [x] Inspect recent Stripe Subscriptions when present.
- [x] Inspect recent Invoices and expandable PaymentIntent references when relevant.
- [x] Inspect subscription item Price IDs and lookup keys.
- [x] Explain mismatch classes: missing provider subscription, one-time payment mode, wrong customer/user metadata, delayed provider state, inactive subscription, or missing plan metadata.
- [x] Keep returned reconciliation output provider-neutral for app callers.
- [x] Store detailed provider evidence only in server-side reconciliation audit records.
- [x] Add tests for mismatch classification.

Implementation notes:

- Reconciliation now inspects recent Stripe subscriptions, checkout sessions, and invoices for the Hub-owned provider customer.
- Stored evidence includes safe summaries only: provider object IDs, statuses, payment mode, payment status, amount fields, currency, expected app/user/provider account, and whitelisted `cph_*` metadata.
- Evidence classification now distinguishes `in_sync_candidate`, `no_provider_subscription`, `checkout_payment_mode_without_subscription`, `checkout_completed_subscription_missing`, `inactive_subscription_only`, `missing_plan_metadata`, and `provider_customer_app_metadata_mismatch`.
- The public reconciliation response remains provider-neutral and still returns only Hub state/status to callers.


### Track 3 - Audit/Admin Console

Goal: give the operator a safe view of payment state without using raw database queries.

Checklist:

- [x] Add authenticated operator console route.
- [x] View registered apps.
- [x] View registry plans and provider account mapping.
- [x] View payment customers.
- [x] View checkout intents/sessions.
- [x] View subscription state.
- [x] View entitlement state.
- [x] View recent webhook inbox status.
- [x] View reconciliation runs and outcomes.
- [x] Add filters by app and environment; deeper provider/user/status filters deferred until console search UI expands.
- [x] Avoid exposing provider secrets or unsafe raw provider objects.

Implementation notes:

- `GET /admin` serves a minimal read-only operator console shell.
- `GET /admin/summary` returns the safe operator dashboard snapshot and requires `Authorization: Bearer <OPERATOR_DIAGNOSTICS_TOKEN>`.
- The summary includes apps, registry plans, provider account mapping, payment customers, checkout sessions, webhook inbox status, subscription state, entitlement state, and reconciliation runs.
- The browser shell does not embed the operator token; the token is held only in tab memory when typed by the operator.
- The summary intentionally excludes provider secrets, webhook secrets, database credentials, raw JWTs, and raw Stripe SDK objects.


### Track 4 - Multi-App Onboarding Checklist

Goal: prepare for app #2 after AIntern without weakening the architecture.

Checklist:

- [x] Create a repeatable app onboarding runbook.
- [x] Define required registry fields for each new app.
- [x] Define required Stripe/Product/Price setup steps.
- [x] Define required Supabase/JWT/auth setup steps for app-owned users.
- [x] Define allowed return contexts and app URLs.
- [x] Define entitlement naming conventions.
- [x] Define provider account assignment checklist.
- [x] Require `npm run validate:registry` for every registry change.
- [x] Add a dry-run checklist before any new app can create checkout sessions.

Implementation notes:

- The repeatable onboarding runbook is recorded in `docs/MULTI_APP_ONBOARDING_RUNBOOK.md`.
- App #2 must pass operator intake, registry validation, provider account assignment, Stripe sandbox price lookup setup, app authentication setup, thin client guardrails, deployed sandbox proof, and pre-live hold gates.
- New apps must remain provider-neutral: no Stripe SDK in the app, no provider price IDs from the app, no arbitrary return URLs, no browser-visible PayGate static token, and no entitlement grants from redirects.


### Track 5 - Live-Mode Readiness Checklist

Goal: prepare for live Stripe use without accidentally activating it.

Checklist:

- [x] Separate test and live provider account configuration.
- [x] Separate test and live webhook endpoints.
- [x] Separate test and live provider price IDs.
- [x] Separate test and live data/idempotency scope.
- [x] Confirm live return URL/domain checklist exists; final production domain remains operator-confirmed before live test.
- [x] Confirm company/legal owner checklist exists for each live Stripe account.
- [x] Confirm tax, invoice, receipt, statement descriptor, refund policy, and support email settings checklist exists.
- [x] Confirm database backup and restore plan is required before live test.
- [x] Confirm operator access controls are required before live test.
- [x] Confirm no browser-visible static app token is allowed.
- [x] Require explicit operator approval before the first live transaction.

Implementation notes:

- The live-mode readiness gate is recorded in `docs/LIVE_MODE_READINESS_CHECKLIST.md`.
- Track 5 prepares live readiness only; it does not authorize live credentials, live checkout, live webhook processing, or live refunds.
- The current Stripe adapter remains sandbox-first and rejects `sk_live_` keys, so live charges remain blocked until a future explicit live-mode implementation and approval window.
- Live payment/refund testing waits for Track 6 monitoring, Track 7 provider isolation tests, and explicit operator approval.


### Track 6 - Monitoring and Alerting

Goal: surface failures before users report them.

Checklist:

- [x] Log failed webhook/runtime verification failures safely through existing server logs; aggregate persisted webhook failure states in monitoring summary.
- [x] Track unprocessed or failed webhook inbox events.
- [x] Track failed reconciliation runs.
- [x] Track database connection failures through protected diagnostics and monitoring runtime readiness.
- [x] Track Stripe API failures and rate-limit responses through provider error translation and operator-visible failed reconciliation/webhook outcomes.
- [x] Add operator-visible failure summary at `/admin/monitoring` and in the `/admin` console.
- [x] Decide alert channel baseline: protected admin dashboard now; external email/messaging alert channel deferred until operator chooses provider.
- [x] Document retry and escalation steps.

Implementation notes:

- The monitoring runbook is recorded in `docs/MONITORING_AND_ALERTING_RUNBOOK.md`.
- `GET /admin/monitoring` returns safe aggregate checks and alerts behind `OPERATOR_DIAGNOSTICS_TOKEN`.
- `/admin` now includes a Monitoring panel that calls `/admin/monitoring` using the token typed by the operator.
- Current alert channel is operator dashboard/manual review. External push alerts remain a future choice before live payments.


### Track 7 - Provider Account Isolation Tests

Goal: prove multiple Stripe/company accounts cannot bleed into each other.

Checklist:

- [x] Add fixture for at least two named Stripe provider accounts.
- [x] Prove an app can only use the provider account declared in its registry package.
- [x] Prove webhook endpoint account scope is enforced.
- [x] Prove reconciliation account scope is enforced.
- [x] Prove portal session account scope is enforced.
- [x] Prove provider customer/idempotent provider records are environment/app/account scoped.
- [x] Prove unknown provider accounts fail closed.
- [x] Run registry validation and full test suite.


Implementation notes:

- Added two-account test fixtures for `stripe:nhl_global_solution` and `stripe:bina_jaya` without using real Stripe credentials.
- Verified checkout, webhook verification, portal session, and reconciliation calls route only to the account declared by the app registry.
- Verified provider customer mappings are isolated by app, user, provider, provider account, and environment.
- Verified named Stripe account configuration does not borrow secrets from another named account; incomplete named accounts are not configured.
- Verified unknown provider accounts fail closed through `ProviderAccountNotConfiguredError`.
- Verification command: `npm run check` passed with registry validation, TypeScript, and 48 tests.
### Track 8 - Controlled Live Stripe Payment and Refund Test

Goal: define when and how live payments/refunds will be tested without authorizing live execution yet.

Live Stripe payments and refunds may run only after Tracks 1, 5, 6, and 7 are complete, the remaining live account/business settings are reviewed, and the operator explicitly approves a narrow live test window.

Checklist:

- [x] Define controlled live payment/refund gate.
- [x] Define required approval record outside source control.
- [x] Define pre-live checklist.
- [x] Define controlled live test sequence.
- [x] Define refund decision points.
- [x] Define safe evidence checklist.
- [x] Define stop conditions.
- [x] Confirm live execution remains deferred until explicit operator approval.

Minimum gate before first live payment:

- [x] Operator diagnostics protected.
- [ ] Live-mode readiness checklist completed by operator.
- [x] Monitoring/alerting baseline in place.
- [x] Provider account isolation tests passed.
- [ ] Live Stripe account settings reviewed by operator.
- [ ] Live Product/Price created intentionally, not copied blindly from sandbox.
- [ ] Live webhook endpoint configured and verified.
- [ ] Small controlled live amount selected.
- [ ] Real payment method and refund path approved by operator.
- [x] Rollback/support plan template written.
- [ ] Explicit operator approval recorded outside source control.

Implementation notes:

- The controlled live payment/refund gate is recorded in `docs/CONTROLLED_LIVE_PAYMENT_REFUND_GATE.md`.
- Track 8 closes the planning gate only. Live credentials, live checkout, live webhook processing, live payment, and refund execution remain blocked until explicit operator approval.
- Current code still rejects `sk_live_` keys in the sandbox Stripe adapter, so live execution cannot happen accidentally through the current adapter path.

## Phase 4 Exit Criteria

- [x] Diagnostics are protected.
- [x] Reconciliation gives useful mismatch diagnostics.
- [x] Operator can inspect payment state safely.
- [x] App #2 onboarding can follow a documented checklist.
- [x] Live-mode readiness checklist exists and is reviewed.
- [x] Monitoring/alerting baseline exists.
- [x] Multi-provider-account isolation tests pass.
- [x] Live payment/refund test gate is defined; execution explicitly deferred.
