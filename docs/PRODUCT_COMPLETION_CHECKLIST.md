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

Status: frozen and accepted by operator on 2026-09-07.

- [x] Phase 5 sprint plan documented.
- [x] Operator approves Phase 5 start.
- [x] Live adapter boundary implemented.
- [x] Live provider account config model implemented.
- [x] Live registry strategy implemented.
- [x] Live webhook boundary implemented.
- [x] Refund policy/event mapping implemented.
- [x] Live operator diagnostics implemented.
- [x] Phase 6 entry gate prepared.
- [x] Phase 5 freeze note created.

## Phase 6 - Controlled Live Pilot

Status: approved to enter Track 1 documentation/preflight; live execution not authorized until detailed approval record is complete.

- [x] Phase 6 sprint plan documented.
- [x] Controlled live payment/refund gate documented.
- [ ] Operator approval packet completed outside source control.
- [x] Preflight verification passed.
  - [x] Public health/protection/registry checks recorded.
  - [x] Operator-side Vercel/Stripe/token checks completed.
- [x] One approved live checkout completed or pilot explicitly aborted.
- [x] Live webhook and entitlement proof complete.
- [x] Portal/reconciliation proof complete or intentionally deferred.
- [ ] Refund proof complete if approved.
- [ ] Evidence recorded safely.
- [ ] Phase 6 freeze note created.

## Phase 7 - Operator Console and Multi-App Scale-Out

Status: started; pageCast provider/Stripe setup created; provider account alias confirmed.

- [x] Phase 7 sprint plan documented.
- [x] Multi-app onboarding runbook documented.
- [x] Operator console UX plan documented.
- [x] Operator console prototype slices built.
- [x] Operator console UX blueprint documented.
- [x] Operator accepts operator console UX blueprint.
- [x] Operator console rebuilt around dashboard/sidebar/workspace blueprint.
- [x] Operator identity UX clarifies PayGate operator token vs app user JWT vs Stripe provider account.
- [x] App Workspace tabs and better app detail cards implemented.
- [x] Draft Add/Edit App Wizard preview implemented without registry mutation.
- [x] Operator visually approves Draft Add App workflow in deployed admin console.
- [ ] Operator approves app #2 intake.
- [x] App #2 draft registry package created: `registry/apps/pagecast`.
- [x] pageCast per-book checkout item/SKU contract decision recorded as future PayGate extension.
- [x] pageCast provider/Stripe setup prep documented for `pagecast_cast_pass_monthly`.
- [x] App #2 Stripe sandbox Product/Price created for `pagecast_cast_pass_monthly`.
- [x] App #2 provider account alias confirmed for Stripe account used by pageCast Product/Price: `acct_1U4N5nDzGAfRwUx9`.
- [x] App #2 Cast Pass registry plan activated for `cast_pass_monthly`.
- [ ] App #2 thin payment client integrated in pageCast reader app.
- [x] App #2 Supabase JWT auth boundary implemented in PayGate for project `zdlbcvscytujdomxzwei`.
- [x] App #2 Supabase JWT Vercel env vars configured and verified on deployment.
- [ ] App #2 Cast Pass sandbox E2E proof complete.
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
