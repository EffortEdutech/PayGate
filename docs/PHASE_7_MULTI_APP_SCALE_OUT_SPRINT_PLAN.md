# Phase 7 - Operator Console and Multi-App Scale-Out Sprint Plan

Status: started; pageCast Track 4 provider/Stripe setup prepared; Stripe sandbox Product/Price pending operator.
Parent product plan: `docs/PRODUCT_PLAN.md`.
Related runbook: `docs/MULTI_APP_ONBOARDING_RUNBOOK.md`.
Current UX blueprint: `docs/PHASE_7_TRACK_1F_OPERATOR_CONSOLE_UX_BLUEPRINT.md`.

## Objective

Scale PayGate from the first proven app, AIntern, to a repeatable multi-app payment platform where the operator can onboard, verify, monitor, and support each app through a clear UI-backed workflow with correct company/provider account routing, registry-owned commercial authority, app-owned authentication, sandbox proof, monitoring, and production readiness gates.

## Core Guardrail

Phase 7 starts after the controlled live pilot is accepted or explicitly deferred by the operator. New apps must never copy AIntern-specific assumptions blindly. Every app must declare its own app ID, user identity strategy, provider account owner, return URL allowlist, plan catalog, entitlements, and deployment evidence.

The operator console is not allowed to weaken PayGate authority. It may guide, validate, display, and generate controlled changes, but apps must still submit only `app_id`, `user_ref`, `plan_key`, `return_context`, and `environment`.

## Track 1 - Operator Console UX Plan and Checklist

Goal: define the clean operator UI before adding app #2 deeply, so PayGate can be managed without PowerShell-first workflows or unsafe manual file edits.

Operator promise:

- The console tells the operator what is configured, what is missing, what is safe to test, and what must not be touched yet.
- The console never exposes Stripe secret keys, webhook secrets, JWT secrets, raw app tokens, or database credentials.
- The console uses provider-neutral PayGate language first and provider details only where the operator needs evidence.
- The console separates sandbox and live clearly on every app, plan, provider account, webhook, checkout, portal, reconciliation, and refund screen.
- The console makes the next safe action obvious, but it does not bypass approval gates for live payments, refunds, provider changes, or registry authority.

Primary screens:

1. Dashboard
   - Shows total apps, active apps, provider accounts, monitoring status, failed webhooks, failed reconciliation, and live-mode gates.
   - Gives a clear needs-attention summary without requiring raw JSON.

2. Apps
   - Lists all registered apps.
   - Shows app ID, display name, provider account, sandbox/live status, last webhook, entitlement health, and onboarding stage.

3. App detail
   - Shows one app's registry configuration, origins, return contexts, plans, entitlements, provider mapping, and evidence links.
   - Clearly shows whether the app is sandbox-only, live-ready, or live-enabled.

4. App onboarding wizard
   - Guides the operator through adding a new app.
   - Captures app identity, company/provider account, URLs, return contexts, plans, lookup keys, entitlements, auth model, webhook setup, and sandbox proof.
   - Initially may generate a reviewable registry change instead of writing directly to production configuration.

5. Provider accounts
   - Shows provider aliases such as `nhl_global_solution`, linked apps, sandbox/live readiness, webhook configured status, and isolation checks.
   - Does not show secret values.

6. Plans and prices
   - Shows PayGate-authoritative plan keys, mode, amount in integer minor units, display amount, currency, lookup key, status, and entitlement set.
   - Makes clear that apps do not control price, currency, provider price IDs, or entitlement authority.

7. Webhooks
   - Shows endpoint URL, environment, provider account, latest events, processed/failed/retry/dead counts, and safe redelivery notes.

8. Entitlements and subscription state
   - Shows current user/app state, active plan, entitlement keys, source event, and last projection time.
   - Makes clear redirects do not grant access.

9. Portal and reconciliation
   - Allows safe portal creation for a selected app/user/environment when provider customer evidence exists.
   - Allows reconciliation only with idempotency, operator evidence, and environment/provider account visibility.

10. Refunds and disputes
    - Shows refund eligibility and evidence requirements.
    - Does not execute live refunds unless the controlled refund gate is explicitly approved.

11. Settings and readiness
    - Shows safe diagnostics for database, configured provider accounts, JWKS/auth, CORS origins, webhook readiness, live enable flags, and deployment commit.
    - Provides copyable setup guidance without exposing secrets.

Track 1 checklist:

- [x] Confirm operator UI is required before deeper app #2 onboarding.
- [x] Define primary operator screens.
- [x] Define screen-level safety boundaries.
- [x] Keep app onboarding behind registry authority and validation.
- [x] Preserve sandbox/live separation in every screen.
- [x] Preserve provider account isolation visibility.
- [x] Define no-secret display rule.
- [x] Define refund/live-operation approval guardrail.
- [x] Build first console information architecture/wireframe.
- [x] Decide implementation path after Track 1F blueprint acceptance: rebuild `/admin` as a dashboard/sidebar/workspace shell.
- [x] Add UI acceptance checklist before coding.
- [ ] Create Track 1 closeout evidence after deployed operator review.


## Track 1F - Operator Console UX Blueprint

Goal: separate Dashboard and Workspace into a proper operator app shell before further UI implementation.

Checklist:

- [x] Define sidebar navigation.
- [x] Define login/logout placement.
- [x] Define Dashboard as separate global health view.
- [x] Define Apps Directory as app selection view.
- [x] Define App Workspace as selected-app work area.
- [x] Define Provider Accounts, Webhooks, Reconciliation, Settings, and Add App future views.
- [x] Document screen responsibilities and non-authorized actions.
- [x] Mark raw JSON as Support/Debug only.
- [x] Operator accepts blueprint.
- [x] Rebuild `/admin` according to accepted blueprint.

## Track 1G - Rebuild Admin Shell Around Blueprint

Goal: turn `/admin` into the accepted operator console shell instead of a mixed diagnostic page.

Implemented scope:

- Login gate before dashboard access.
- Sidebar navigation after login.
- Dashboard as the default global health view.
- Apps Directory for multi-app selection.
- App Workspace for one selected app at a time.
- Provider Accounts, Webhooks, Reconciliation, Settings, and Support/Debug views.
- Add App visible but disabled as a future controlled draft workflow.

Checklist:

- [x] Remove permanent top token form from the working dashboard.
- [x] Keep token entry in login gate only.
- [x] Use protected admin session cookie after login.
- [x] Load registered apps from PayGate summary instead of requiring the operator to remember app IDs.
- [x] Separate Dashboard from App Workspace.
- [x] Keep Support/Debug JSON out of the normal operator workflow.
- [x] Preserve read-only safety boundary for this slice.
- [x] Validate with registry validation, TypeScript, and unit tests.

Next gate:

- [x] Operator requested identity UX correction before workspace tabs.
- [x] Clarify PayGate operator token versus app user JWT versus Stripe/provider account identity.
## Track 1H - Operator Identity UX

Goal: remove confusion around the console login by making identity ownership explicit before adding deeper app workspace features.

Identity model:

- PayGate operator identity belongs to PayGate. It opens admin, diagnostics, monitoring, evidence, and future setup workflows.
- App user identity belongs to each connected app. For AIntern, the app user uses the AIntern/Supabase JWT and can only act for their own `user_ref`.
- Provider identity belongs to the company payment account. For Stripe, PayGate routes through company-scoped aliases such as `nhl_global_solution`; provider secrets stay server-side.
- `OPERATOR_DIAGNOSTICS_TOKEN` is a temporary PayGate bootstrap/admin token, not an AIntern token and not a Stripe token.

Implemented scope:

- [x] Rename login field to `PayGate operator access token`.
- [x] Add plain-language explanation that the token belongs to PayGate, not AIntern, Stripe, or an app user.
- [x] Explain that the token is exchanged for a protected admin session cookie.
- [x] Add Settings identity cards for PayGate operator identity, app user identity, and provider identity.
- [x] Keep named operator accounts/roles as future target, not an unplanned auth migration in this slice.
- [x] Preserve read-only console behavior.

Future target:

- Replace token-first login with named operator accounts, roles, and audit trail.
- Keep `OPERATOR_DIAGNOSTICS_TOKEN` as an emergency/bootstrap fallback only.

Next gate:

- [x] Operator proceeded to Track 1I workspace tabs and app detail cards.
## Track 1I - Workspace Tabs and Better App Detail Cards

Goal: make the selected app workspace readable by separating the app evidence into clear tabs instead of one long mixed panel.

Implemented scope:

- [x] Add App Workspace tab bar.
- [x] Add Overview tab for provider mapping, current scope, and next safe action.
- [x] Add Plans tab for PayGate-owned plan details, price display, lookup configuration, and entitlements.
- [x] Add URLs tab for test/live return origins and registry allowlist boundary.
- [x] Add Customers tab for subscription and entitlement state.
- [x] Add Webhooks tab for verified provider event evidence.
- [x] Add Reconciliation tab for explicit reconciliation evidence.
- [x] Add Evidence tab for checkout sessions and the rule that redirects do not grant access.
- [x] Keep all workspace cards read-only.

Safety boundary:

- No registry edits.
- No secret display.
- No refund actions.
- No live payment actions.
- No entitlement mutation from browser redirects.

Next gate:

- [ ] Deploy and visually review `/admin` workspace tabs with the operator.
- [x] Operator proceeded to Track 1J draft add/edit app wizard.

## Track 1J - Draft Add/Edit App Wizard

Goal: let the operator prepare a reviewable registry draft for the next app without turning the browser into a production configuration editor.

Implemented scope:

- [x] Add active sidebar entry: Draft Add App.
- [x] Add app identity fields: app ID, display name, provider account alias, auth model, test origin, live origin.
- [x] Add first-plan fields: plan key, plan name, amount in minor units, currency, mode, Stripe lookup key.
- [x] Add entitlement list as one entitlement key per line.
- [x] Generate a copyable JSON draft preview for operator review.
- [x] Include required next steps in the preview: operator review, registry package creation, Stripe Product/Price lookup key setup, registry validation, full check, commit/deploy approval.
- [x] Add safety checklist: no secrets, PayGate owns commercial authority, draft-first workflow.
- [x] Keep the wizard non-mutating: no registry writes, no Stripe calls, no deployment actions, no live operations.

Safety boundary:

- This is a draft helper only.
- It does not create or edit registry files.
- It does not save secrets.
- It does not create Stripe products/prices.
- It does not deploy or mutate live state.

Next gate:

- [ ] Deploy and visually review `/admin` Draft Add App with the operator.
- [ ] Operator approves whether Track 1K should turn the draft preview into a validated registry-package generator or proceed directly to app #2 intake.
## Track 1K - Draft Wizard Validation and Export

Goal: make the draft app wizard safer before it is used for a real app onboarding package.

Implemented scope:

- [x] Add `Validate Draft` action.
- [x] Add validation summary panel.
- [x] Validate app ID and plan key format.
- [x] Validate test/live origins as HTTPS URLs.
- [x] Validate amount as a positive integer minor-unit value.
- [x] Validate uppercase 3-letter currency.
- [x] Validate plan mode as `payment` or `subscription`.
- [x] Reject Stripe provider price IDs in the lookup-key field.
- [x] Validate app-scoped dotted entitlement keys.
- [x] Warn when provider account alias is not currently known from loaded registry apps.
- [x] Add `Download JSON` export for valid drafts only.
- [x] Keep wizard non-mutating: no registry writes, no Stripe calls, no deployment actions, no live operations.

Safety boundary:

- Exported JSON is evidence/preparation only.
- Registry package creation remains a separate reviewed engineering step.
- Validation here is a UX guardrail; `npm run validate:registry` remains the authority before commit/deploy.

Next gate:

- [ ] Deploy and visually review Track 1K validation/export in `/admin`.
- [ ] Operator approves whether to start Track 2 app #2 intake.
## Track 2 - App #2 Intake and Classification

Goal: decide whether an app is ready to onboard.

Checklist:

- [x] Review exported sample draft artifact from Track 1K.
- [x] Classify `example_app` as sample rehearsal only, not real app #2.
- [x] Identify app #2 name and repository/location: pageCast at `../00 StoryBook/pageCast`.
- [x] Confirm app owner/operator: NHL Global Solution / EffortEdutech operator, pending final support/refund owner confirmation.
- [x] Confirm current URLs from pageCast checklist: reader `https://pagecast-nine.vercel.app`, studio `https://pagecast-studio.vercel.app`.
- [x] Confirm user identity provider and JWT/session strategy: Supabase JWT, project `zdlbcvscytujdomxzwei`, user_ref = Supabase user UUID.
- [x] Confirm payment model: mixed model today; direct per-book Stripe checkout exists, Cast Pass subscription is safest PayGate first slice, per-book checkout requires future PayGate item/SKU contract.
- [x] Draft company/provider account owner: `nhl_global_solution`, pending operator final confirmation.
- [ ] Confirm support/refund owner for pageCast.
- [x] Confirm whether app #2 can use existing PayGate contracts unchanged: Cast Pass can; per-book checkout cannot and needs future item/SKU contract.

Track 2 pageCast evidence note: `docs/PHASE_7_PAGECAST_PAYGATE_ONBOARDING.md`.

## Track 3 - Registry Package Creation

Goal: add app #2 to PayGate without giving the app commercial authority.

Checklist:

- [x] Create registry app package for `pagecast`.
- [x] Define app ID and display name: `pagecast`, pageCast.
- [x] Define provider ID and provider account alias: `stripe:nhl_global_solution` draft.
- [x] Define test and live origin allowlists: `https://pagecast-nine.vercel.app`.
- [x] Define allowed return contexts: `billing`, `cast`.
- [x] Define draft plans using integer minor units and uppercase currency.
- [x] Define provider lookup keys, not provider price IDs.
- [x] Define draft entitlements.
- [x] Run `npm run validate:registry`: passed for 3 application package(s).

## Track 4 - Provider Account and Stripe Setup

Goal: ensure app #2 bills through the correct company account.

Checklist:

- [ ] Confirm provider account alias is company-scoped.
- [ ] Confirm Stripe test account access.
- [ ] Create Stripe sandbox Products and Prices intentionally.
- [ ] Configure lookup keys matching registry.
- [ ] Configure sandbox webhook endpoint.
- [ ] Store secrets only in Vercel/server-side secret storage.
- [ ] Verify provider account isolation tests still pass.

## Track 5 - App Thin Payment Client

Goal: integrate app #2 as a PayGate consumer only.

Checklist:

- [x] Add thin payment service/client inside app #2 for Cast Pass checkout only; pageCast commit `5878eef`.
- [ ] App sends only app ID, user ref, plan key, return context, and environment.
- [ ] App never stores Stripe secret key or webhook secret.
- [ ] App never sends amount, price ID, customer ID, provider account, or entitlement keys.
- [ ] App handles checkout redirect URL returned by PayGate.
- [x] App reads subscription/entitlement state from PayGate via pageCast `/api/paygate/state`; deployment verification pending.
- [ ] App displays provider-neutral states only.

## Track 6 - App Authentication Boundary

Goal: ensure PayGate trusts app #2 requests safely.

Checklist:

- [ ] Define app #2 auth method: Supabase JWKS/JWT, backend proxy, or server token.
- [ ] Ensure browser-visible static PayGate tokens are not used in production.
- [ ] Enforce app ID claim binding.
- [ ] Enforce user_ref binding.
- [ ] Add negative tests for cross-app/cross-user requests.

## Track 7 - Sandbox E2E Proof

Goal: prove app #2 works in sandbox before live readiness.

Checklist:

- [x] Create sandbox checkout from app #2 for pageCast Cast Pass; Track 4E evidence accepted.
- [ ] Complete sandbox payment.
- [x] Verify signed webhook is processed for pageCast Cast Pass; processed `customer.subscription.created` and `checkout.session.completed`.
- [x] Verify entitlement projection for pageCast Cast Pass; active `plan:cast_pass_monthly` projected through 2026-10-11.
- [ ] Verify portal session.
- [ ] Run reconciliation.
- [ ] Confirm monitoring/admin visibility.
- [ ] Record evidence safely.

## Track 8 - Multi-App Operator Console Readiness

Goal: make the operator view useful as apps multiply.

Checklist:

- [ ] Filter admin summary by app.
- [ ] Filter monitoring by app and environment.
- [ ] Confirm app/provider account mapping is visible.
- [ ] Confirm no secrets are shown.
- [ ] Confirm failed webhook/reconciliation alerts identify app/provider account/environment.
- [ ] Document operator triage steps for app #2.

## Track 9 - Scale-Out Freeze and Repeatability

Goal: ensure app #3 can follow the same process.

Checklist:

- [ ] Update multi-app onboarding runbook with lessons learned from app #2.
- [ ] Update product roadmap if scope changes.
- [ ] Confirm all app #2 tests pass.
- [ ] Confirm PayGate tests pass.
- [ ] Create Phase 7 freeze note.
- [ ] Decide next app intake order.

## Stop Conditions

Stop and update the product plan before proceeding if app #2 requires:

- app-owned provider SDK logic;
- app-controlled price/amount/currency/provider account;
- arbitrary return URLs;
- entitlement mutation from redirect;
- sharing one provider account accidentally across companies;
- live payments before sandbox proof;
- changes to frozen Phase 0 contracts.

## Explicitly Not Authorized In Phase 7

- No live payment for a new app before its sandbox proof and operator approval.
- No new payment provider implementation unless separately planned.
- No weakening of AIntern or PayGate boundaries for convenience.
- No secrets committed to either PayGate or app repositories.

## Definition of Done

Phase 7 is complete only when:

- [ ] operator console supports guided multi-app setup safely;
- [ ] at least one additional app is onboarded through the runbook;
- [ ] app #2 sandbox proof is complete;
- [ ] provider account isolation still passes;
- [ ] admin/monitoring supports multi-app operation safely;
- [ ] onboarding runbook is updated from real app #2 evidence;
- [ ] Phase 7 freeze note is created.


## Phase 7 Track 4G - pageCast Cast Pass Access Enforcement Plan

- [x] Document Cast Pass access enforcement policy.
- [x] Keep Single Cast item-level unlock deferred pending PayGate item/SKU contract.
- [x] Define next implementation checklist for Track 4H.


## Phase 7 Track 4H - pageCast Cast Pass Access Enforcement

- [x] Update pageCast access API to allow `reason: cast_pass` from verified PayGate state.
- [x] Update book detail UI copy for Cast Pass access.
- [x] Keep Single Cast item-level unlock deferred pending PayGate item/SKU contract.
- [ ] Verify deployed paid-user and unpaid-user browser behavior.
