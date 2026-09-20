# PayGate Product Plan

Status: governing product plan for Payment Hub work.
Last updated: 2026-09-21.

## Product Objective

Build PayGate as a provider-neutral payment gateway that lets multiple apps accept payments through the correct company-owned payment provider account while keeping commercial authority, provider secrets, entitlement decisions, webhooks, reconciliation, monitoring, and operator audit controls inside the Hub.

Stripe is the first provider and the expansion driver. The architecture must stay ready for additional Stripe accounts, additional apps, and future providers without allowing application code to own provider-specific payment logic.

## Product Outcomes

PayGate is successful when all of these are true:

- Apps can start checkout, open billing management, and read payment/entitlement state through stable Hub APIs.
- Apps never control amount, currency, provider price IDs, provider customer IDs, provider account aliases, entitlements, or arbitrary return URLs.
- Each app is mapped to the correct company/provider account by registry and server-side configuration.
- Stripe test and live modes are isolated in credentials, webhook endpoints, data, idempotency scope, and operator evidence.
- Verified provider webhooks and explicit reconciliation are the only financial sources that can mutate entitlement state.
- Operators can safely inspect apps, plans, customers, checkout sessions, webhooks, entitlements, reconciliation runs, and monitoring state without exposing secrets.
- Adding app #2 follows a checklist rather than custom improvisation.
- Live payments and refunds happen only inside an explicit operator-approved live test window.

## Non-Negotiable Product Boundaries

- PayGate is the payment authority; apps are payment consumers.
- Registry files are the commercial authority for app, plan, amount, currency, provider lookup key, entitlement, and return URL mapping.
- Provider credentials live only in server-side secret storage.
- Browser redirects never grant access.
- Provider SDKs stay inside provider adapters, not the provider-neutral domain.
- All monetary values use integer minor units and uppercase ISO currency.
- Every provider record includes provider, provider account, and environment.
- Live-mode work is blocked until the live-mode sprint plan and operator approval gate are complete.

## Finite Product Roadmap

This roadmap is intentionally finite. We do not create new phases unless a new product objective is approved and documented here first.

| Phase | Name | Status | Purpose | Exit condition |
|---|---|---|---|---|
| 0 | Contract and authority freeze | Frozen | Define boundary rules, API contracts, registry authority, event trust model, and database model. | Phase 0 freeze recorded and verification passes. |
| 1 | Executable foundation | Frozen | Build TypeScript workspace, registry validation, provider interfaces, config, auth/idempotency foundations, and DB baseline. | Foundation compiles and registry validation passes. |
| 2 | Stripe sandbox vertical slice | Frozen | Prove checkout, verified webhooks, entitlements, portal, and reconciliation using Stripe sandbox. | Real sandbox proof recorded and Phase 2 freeze complete. |
| 3 | First app integration - AIntern | Frozen | Connect AIntern to PayGate through a thin client and named provider account, without app-owned Stripe logic. | AIntern deployed sandbox checkout, webhook, entitlement, portal, and reconciliation proof complete. |
| 4 | Production hardening | Frozen | Protect diagnostics, improve reconciliation inspection, admin console, onboarding, live readiness, monitoring, account isolation, and live-test gate. | Phase 4 checklist complete and freeze note recorded. |
| 5 | Live-mode implementation readiness | Frozen | Design and implement explicit live-mode boundaries only after Phase 4 freeze. | Sandbox/live separation tests pass; live credentials still not used without approval. |
| 6 | Controlled live pilot | Frozen; refund deferred | Run one approved low-value real payment/refund test. | AIntern live checkout/webhook/entitlement evidence recorded; refund deferred by operator decision. |
| 7 | Operator console and multi-app scale-out | Current governance cleanup | Build a clean operator console, then onboard app #2 and later apps using the multi-app runbook. | UI-driven app onboarding exists; pageCast sandbox scope is frozen or explicitly advanced; monitoring and isolation gates pass. |


## Documentation Set Through Product Finish

- Master product plan: `docs/PRODUCT_PLAN.md`.
- Master completion checklist: `docs/PRODUCT_COMPLETION_CHECKLIST.md`.
- Product roadmap graph: `docs/PRODUCT_ROADMAP_GRAPH.md`.
- Implementation roadmap: `IMPLEMENTATION_ROADMAP.md`.
- Phase 4 freeze: `PHASE_4_FREEZE.md`.
- Phase 5 sprint plan: `docs/PHASE_5_LIVE_MODE_IMPLEMENTATION_READINESS_SPRINT_PLAN.md`.
- Phase 6 sprint plan: `docs/PHASE_6_CONTROLLED_LIVE_PILOT_SPRINT_PLAN.md`.
- Phase 6 freeze with refund deferred: `docs/PHASE_6_FREEZE_REFUND_DEFERRED.md`.
- Phase 7 sprint plan: `docs/PHASE_7_MULTI_APP_SCALE_OUT_SPRINT_PLAN.md`.
- Phase 7 governance cleanup/freeze prep: `docs/PHASE_7_GOVERNANCE_CLEANUP_FREEZE_PREP.md`.
- Controlled live payment/refund gate: `docs/CONTROLLED_LIVE_PAYMENT_REFUND_GATE.md`.
- Multi-app onboarding runbook: `docs/MULTI_APP_ONBOARDING_RUNBOOK.md`.
## Current Sprint Authority

Current sprint: Phase 7 - Operator Console and Multi-App Scale-Out.

Current governance decision:

- Phase 6 is frozen with refund deferred.
- pageCast Stripe/live mode is not active.
- App onboarding must become UI-driven before PayGate can be considered product-complete.

Phase 7 no longer proceeds automatically into Track 5K. Track 5K is only a possible Single Cast live-readiness gate and remains blocked until explicit operator approval.

The next product step is Phase 7 Track 6A: UI-driven App Onboarding Workspace Plan.

## Stop Creating New Phases Rule

A new phase can be created only when all are true:

1. The current phase is frozen or explicitly deferred.
2. The new phase maps to one of the finite roadmap rows above.
3. The new phase has objective, tracks, checklist, acceptance gates, stop conditions, and non-authorized actions documented before implementation.
4. The operator approves proceeding into that documented phase.

If these are not true, work must continue inside the current phase or stop for planning.

## What Is Not Authorized Now

- No live refund execution while refund is deferred.
- No pageCast live Stripe checkout/payment while pageCast live mode is not approved.
- No Single Cast live payment or broad item rollout without a new explicit operator approval record.
- No new app onboarding that bypasses the UI-driven onboarding requirement.
- No new payment provider implementation before Stripe multi-app operations are stable.
- No direct app-owned Stripe implementation.

## Immediate Next Action

Proceed to Phase 7 Track 6A - UI-driven App Onboarding Workspace Plan. This replaces automatic Track 5K/live-readiness work as the next product step.
