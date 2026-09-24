# Phase 7 - Operator Console and Multi-App Scale-Out Sprint Plan

Status: governance cleanup active; pageCast remains sandbox/test and app onboarding must become UI-driven before product completion.
Parent product plan: `docs/PRODUCT_PLAN.md`.
Related runbook: `docs/MULTI_APP_ONBOARDING_RUNBOOK.md`.
Current UX blueprint: `docs/PHASE_7_TRACK_1F_OPERATOR_CONSOLE_UX_BLUEPRINT.md`.

## Objective

Scale PayGate from the first proven app, AIntern, to a repeatable multi-app payment platform where the operator can onboard, verify, monitor, and support each app through a clear UI-backed workflow with correct company/provider account routing, registry-owned commercial authority, app-owned authentication, sandbox proof, monitoring, and production readiness gates.

## Core Guardrail

Phase 7 continues after Phase 6 is frozen with refund deferred by the operator. New apps must never copy AIntern-specific assumptions blindly. Every app must declare its own app ID, user identity strategy, provider account owner, return URL allowlist, plan catalog, entitlements, and deployment evidence.

The operator console is not allowed to weaken PayGate authority. It may guide, validate, display, and generate controlled changes, but apps must still submit only `app_id`, `user_ref`, `plan_key`, future non-commercial `item_ref`, `return_context`, and `environment`.

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
- [x] App reads subscription/entitlement state from PayGate via pageCast `/api/paygate/state`; local and deployed Cast Pass state verified.
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
- [x] Verify deployed paid-user and unpaid-user browser behavior.

## Phase 7 Track 4I - pageCast Operator/Admin Evidence Polish

- [x] Record pageCast operator/admin evidence expectations for app, provider, plan, webhook, customer, subscription, entitlement, and monitoring review.
- [x] Record accepted paid/unpaid Premium Cast browser evidence from Track 4H.
- [x] Keep Single Cast item/SKU checkout deferred.
- [x] Keep pageCast live payments blocked behind a separate live readiness gate.
- Evidence: `docs/PHASE_7_TRACK_4I_PAGECAST_OPERATOR_ADMIN_EVIDENCE.md`.
## Phase 7 Track 4J - pageCast Single Cast Item/SKU Contract Plan

- [x] Document why current `plan_key`-only checkout is insufficient for Single Cast.
- [x] Define future `item_ref` checkout contract direction.
- [x] Define proposed `registry/apps/pagecast/items.yaml` authority model.
- [x] Define item-scoped entitlement projection for books and bundles.
- [x] Define refund/revocation policy questions before activation.
- [x] Keep `single_cast_unlock` in draft/deferred status.
- Evidence: `docs/PHASE_7_TRACK_4J_PAGECAST_SINGLE_CAST_ITEM_SKU_CONTRACT_PLAN.md`.
## Phase 7 Track 4K - pageCast Onboarding Closure and Operator Evidence Packet

- [x] Consolidate pageCast registry, provider, Cast Pass, webhook, entitlement, and app access evidence.
- [x] Record explicit deferred items: Single Cast item/SKU, live mode, refunds, optional UX polish.
- [x] Confirm pageCast Cast Pass sandbox/test onboarding can be treated as closed.
- [x] Keep Phase 7 freeze pending broader multi-app admin/monitoring and onboarding runbook update.
- Evidence: `docs/PHASE_7_TRACK_4K_PAGECAST_ONBOARDING_CLOSURE_EVIDENCE_PACKET.md`.
## Phase 7 Track 4L - Multi-App Admin/Monitoring Verification and Freeze Prep

Status: accepted; operator API/admin evidence reviewed.

Goal: close the remaining Phase 7 gates before a pageCast/Phase 7 freeze decision.

Checklist:

- [x] Verify `/admin/summary?app_id=pagecast&environment=test` from the operator console/API. Evidence: `docs/PHASE_7_TRACK_4L_MULTI_APP_ADMIN_MONITORING_FREEZE_PREP.md`.
- [x] Verify `/admin/monitoring?app_id=pagecast&environment=test` has no critical alerts.
- [x] Verify multi-app admin view can show AIntern and pageCast without mixing provider/customer state.
- [x] Confirm pageCast onboarding runbook lessons are recorded.
- [x] Confirm no pageCast live-mode action is authorized.
- [x] Prepare Phase 7 pageCast onboarding freeze/go-forward note inputs.
### Why Single Cast and pageCast live remain deferred

- Single Cast is item-specific and requires the future item/SKU contract from Track 4J before activation.
- pageCast live payments require a separate live readiness gate and explicit operator approval because sandbox/test proof does not authorize real-money execution.
## Phase 7 Track 4M - pageCast Onboarding Freeze / Go-Forward Note

Status: prepared; operator acceptance pending.

- [x] Prepare pageCast Cast Pass onboarding freeze/go-forward note.
- [x] Confirm Track 4L evidence is accepted.
- [x] Confirm `single_cast_unlock` remains draft and requires item/SKU work before activation.
- [x] Define recommended next track: Track 5A - PayGate Item/SKU Registry Contract for pageCast Single Cast.
- Evidence: `docs/PHASE_7_TRACK_4M_PAGECAST_ONBOARDING_FREEZE_GO_FORWARD.md`.
## Phase 7 Track 5A - PayGate Item/SKU Registry Contract for pageCast Single Cast

Status: complete; runtime/payment activation not started.

- [x] Add dedicated pageCast PayGate sprint plan.
- [x] Add optional `items.yaml` schema.
- [x] Add draft pageCast single book and bundle item examples.
- [x] Add item unlock entitlement keys.
- [x] Validate item lookup key uniqueness and entitlement references.
- [x] Keep all item statuses `draft`.
- [x] Confirm no Stripe mutation, checkout runtime change, or payment activation.
- Evidence: `docs/PHASE_7_TRACK_5A_PAGECAST_ITEM_SKU_REGISTRY_CONTRACT.md`.

## Phase 7 Track 5B - Registry Loader and Domain Types for PayGate Items

Status: next recommended action.

Goal: teach PayGate runtime/domain code to load item registry definitions safely, without exposing item checkout yet.

Checklist:

- [x] Add registered item TypeScript domain types.
- [x] Load optional `items.yaml` into registry runtime.
- [x] Add lookup methods for item definitions and active-only item definitions.
- [x] Keep checkout API unchanged.
- [x] Keep item checkout disabled.
- [x] Add tests for item lookup and draft/active boundaries.
- Evidence: `docs/PHASE_7_TRACK_5B_PAYGATE_ITEM_REGISTRY_LOADER_DOMAIN_TYPES.md`.
## Phase 7 Track 5C - Checkout API Extension for `item_ref` Behind Disabled Gate

Status: complete; item checkout remains disabled.

Goal: extend request contracts and validation shape for `item_ref` without allowing item checkout to execute yet.

Checklist:

- [x] Add optional `item_ref` to checkout request schema/types.
- [x] Reject `item_ref` unless a future item-checkout gate explicitly enables item checkout.
- [x] Prove existing plan-only checkout still works.
- [x] Prove item checkout remains blocked while gate is disabled.
- [x] Do not create Stripe item checkout sessions yet.
- Evidence: `docs/PHASE_7_TRACK_5C_ITEM_REF_CHECKOUT_DISABLED_GATE.md`.

## Phase 7 Track 5D - Provider Lookup Resolution for Item Prices

Status: complete; item checkout remains disabled.

Goal: prepare item provider lookup resolution safely, still without creating item checkout sessions.

Checklist:

- [x] Resolve item provider lookup keys from registry only.
- [x] Respect test/live lookup separation.
- [x] Reject inactive/draft item checkout until explicit activation.
- [x] Keep provider session creation disabled for items.
- [x] Add tests for item lookup selection and live/test separation.
- Evidence: `docs/PHASE_7_TRACK_5D_ITEM_PROVIDER_LOOKUP_RESOLUTION.md`.

## Phase 7 Track 5E - Persistence Model for Item Checkout and Item Entitlement Evidence

Status: complete; item checkout and item entitlement projection remain disabled.

Goal: prepare database/repository contracts for item checkout evidence without activating item checkout.

Checklist:

- [x] Design item checkout persistence fields.
- [x] Design item entitlement evidence fields.
- [x] Preserve existing plan checkout records.
- [x] Avoid granting item access from browser redirects.
- [x] Add migration/tests only after schema is reviewed.
- Evidence: `docs/PHASE_7_TRACK_5E_ITEM_CHECKOUT_PERSISTENCE_EVIDENCE.md`.

## Phase 7 Track 5F - Webhook Projection for Item-Scoped Entitlements

Status: complete; item checkout creation remains disabled.

Goal: define and implement how verified provider events map item checkout evidence into item-scoped entitlements without granting access from browser redirects.

Checklist:

- [x] Extend normalized provider payload with item evidence fields.
- [x] Map item checkout/session metadata only after signature verification.
- [x] Project item entitlement keys/scopes from verified provider evidence only.
- [x] Preserve plan entitlement projection behavior.
- [x] Add tests for item webhook projection and refund/revocation behavior.
- Evidence: `docs/PHASE_7_TRACK_5F_ITEM_WEBHOOK_PROJECTION.md`.

## Phase 7 Track 5G - pageCast Thin Client for Single Cast Checkout

Status: complete; item checkout remains disabled.

Goal: prepare pageCast client-side request flow for Single Cast checkout while PayGate still blocks item checkout unless explicitly activated.

Checklist:

- [x] Add pageCast thin client request shape using `item_ref` only.
- [x] Do not send amount/currency/Stripe Price ID/entitlement key/provider account.
- [x] Handle `ITEM_CHECKOUT_DISABLED` as planned unavailable state.
- [x] Keep Cast Pass behavior unchanged.
- [x] Do not activate Single Cast checkout without operator approval.
- [x] Verify pageCast reader build.
- Evidence: `docs/PHASE_7_TRACK_5G_PAGECAST_SINGLE_CAST_THIN_CLIENT.md`.

## Phase 7 Track 5H - pageCast Item Entitlement Access Enforcement

Status: next recommended action.

Goal: let pageCast recognize verified PayGate item entitlement evidence for a matching book/bundle while still failing closed when item evidence is absent.

Checklist:

- [x] Extend pageCast PayGate state/read path for item entitlement evidence or scoped entitlement lookup.
- [x] Match `book:<bookId>` item entitlement to the current Premium Cast only.
- [x] Keep Cast Pass all-premium access unchanged.
- [x] Keep unpaid user locked unless free/guest/purchased/Cast Pass/item entitlement rules apply.
- [x] Do not grant access from checkout redirect.
- [x] Do not activate Single Cast payment until a controlled sandbox E2E gate.
- [ ] Decide whether to decommission or protect the legacy pageCast `/api/stripe/checkout` route after manifest approval.
## Phase 7 Track 5I - Single Cast Sandbox E2E Proof

Status: accepted; controlled sandbox proof completed.

Goal: prove one controlled Single Cast sandbox purchase from PayGate checkout through verified webhook projection into item entitlement access.

Checklist:

- [x] Operator approves preparing item checkout for one sandbox item only.
- [x] Activate exactly one pageCast item in registry for sandbox proof.
- [x] Confirm Stripe sandbox Price lookup key for that item.
- [x] Run one checkout from pageCast for the selected `item_ref` after Vercel env/deploy setup.
- [x] Complete Stripe sandbox payment.
- [x] Verify PayGate signed webhook projects `pagecast.single_cast_unlock` with matching scope.
- [x] Verify matching book opens as Single Cast.
- [x] Verify unpaid user remains locked without Cast Pass or matching item entitlement.
- [x] Record evidence and keep the single sandbox item active for operator review.
- [x] Add server-side sandbox allowlist gate `PAYGATE_ITEM_CHECKOUT_TEST_ALLOWLIST`.
- [x] Prove tests: unallowlisted item checkout blocked, allowlisted sandbox item checkout created, live item checkout blocked.
- Evidence: `docs/PHASE_7_TRACK_5I_SINGLE_CAST_SANDBOX_E2E_PROOF.md`.
## Phase 7 Track 5J - Operator/Admin Item Evidence and Reconciliation Review

Status: complete for controlled pageCast Single Cast sandbox proof.

Goal: close the Single Cast sandbox proof with operator/admin evidence rules and a clear reconciliation boundary for one-time item purchases.

Checklist:

- [x] Record item checkout evidence expectations for the controlled `pagecast` item.
- [x] Record processed webhook and scoped entitlement expectations.
- [x] Record paid-user and unpaid-user browser evidence.
- [x] Clarify that Single Cast is a one-time item purchase, not a subscription.
- [x] Clarify that missing subscription evidence is not by itself a Single Cast reconciliation failure.
- [x] Keep item-specific reconciliation repair deferred.
- [x] Keep live Single Cast payment and broad rollout deferred.
- Evidence: `docs/PHASE_7_TRACK_5J_OPERATOR_ITEM_EVIDENCE_RECONCILIATION_REVIEW.md`.
## Phase 7 Governance Cleanup / Freeze Prep

Status: accepted as current governance correction.

Operator decisions:

- [x] Freeze Phase 6 with refund deferred.
- [x] Keep pageCast Stripe/live mode not active.
- [x] Require app onboarding to become UI-driven before PayGate product completion.
- [x] Do not proceed automatically into Track 5K.
- [x] Keep Track 5K as deferred Single Cast live-readiness gate unless explicitly approved.

Evidence: `docs/PHASE_7_GOVERNANCE_CLEANUP_FREEZE_PREP.md`.

## Phase 7 Track 6A - UI-driven App Onboarding Workspace Plan

Status: complete; ready for operator acceptance and Track 6B implementation.

Goal: turn PayGate onboarding from a partially manual/document-driven workflow into a guided operator workspace that can prepare app onboarding safely without exposing secrets or bypassing registry authority.

Checklist:

- [x] Define onboarding workspace information architecture.
- [x] Define app identity and ownership step.
- [x] Define provider account selection step.
- [x] Define test/live origins and return contexts step.
- [x] Define plan and item catalog drafting step.
- [x] Define entitlement mapping step.
- [x] Define app auth/JWT setup checklist step.
- [x] Define Stripe Product/Price lookup-key checklist step.
- [x] Define webhook setup checklist step.
- [x] Define sandbox proof checklist step.
- [x] Define registry package export or pull-request-ready artifact boundary.
- [x] Define final admin evidence review and freeze/go-forward decision step.
- [x] Confirm no secrets, live payments, live refunds, or registry mutations are performed without a separate approved workflow.

Evidence: `docs/PHASE_7_TRACK_6A_UI_DRIVEN_APP_ONBOARDING_WORKSPACE_PLAN.md`.

Track 6A replaces Track 5K as the current planned path. Track 5K remains deferred until the operator explicitly approves pageCast Single Cast live-readiness planning.

## Phase 7 Track 6B - Build UI-driven Onboarding Workspace Shell

Status: implemented as a non-mutating admin UI shell.

Goal: implement the multi-step Add App / Onboarding workspace shell in `/admin` as a non-mutating UI.

Checklist:

- [x] Add onboarding workspace navigation steps.
- [x] Add per-step operator guidance and safety boundaries.
- [x] Add intake/provider/URLs/auth/plans/items/Stripe/webhook/sandbox/export panels.
- [x] Preserve current admin login/session model.
- [x] Keep all data browser-local until export.
- [x] Do not write registry files.
- [x] Do not call Stripe.
- [x] Do not store or display secrets.
- [x] Do not enable live payment, live refund, or live item checkout.
- [x] Verify admin shell tests and full project check pass.

Evidence: `docs/PHASE_7_TRACK_6B_UI_DRIVEN_ONBOARDING_WORKSPACE_SHELL.md`.

## Phase 7 Track 6C - Onboarding Workspace Validation and Export Hardening

Status: implemented and verified.

Goal: strengthen the generated onboarding artifact and validation feedback so it is closer to a registry-package proposal.

Checklist:

- [x] Add stronger cross-field validation for plans/items/auth/origins.
- [x] Add clearer export sections for env var names, Stripe setup, webhook setup, and sandbox proof.
- [x] Add provider-account alias warnings based on loaded registry apps.
- [x] Add visible completion status per onboarding step.
- [x] Keep the workflow non-mutating.

Evidence: `docs/PHASE_7_TRACK_6C_ONBOARDING_VALIDATION_EXPORT_HARDENING.md`.

## Phase 7 Track 6D - Controlled Registry Proposal Generation Plan

Status: planned and accepted.

Goal: define the safe path from exported onboarding artifact to reviewed registry package files without giving the browser direct mutation authority.

Checklist:

- [x] Define registry proposal file mapping from onboarding artifact.
- [x] Define operator approval gate before writing files.
- [x] Define validation commands required before commit/deploy.
- [x] Define rollback/review expectations for proposed registry changes.
- [x] Keep Stripe, Vercel env vars, live mode, refunds, and entitlements outside automatic apply.

Evidence: `docs/PHASE_7_TRACK_6D_CONTROLLED_REGISTRY_PROPOSAL_PLAN.md`.

## Phase 7 Track 6E - Controlled Registry Proposal Generator Dry-Run

Status: next recommended implementation track.

Goal: create a dry-run proposal tool or admin workflow that transforms an exported onboarding artifact into reviewable registry file proposals without writing files by default.

Checklist:

- [ ] Parse exported onboarding artifact safely.
- [ ] Generate proposed `app.yaml`, `plans.yaml`, `entitlements.yaml`, `env.example`, integration docs, and optional `items.yaml`.
- [ ] Show/write dry-run output without mutating registry by default.
- [ ] Add explicit operator approval requirement for any future write mode.
- [ ] Run validation/check commands after any approved write mode.
Evidence: `docs/PHASE_7_TRACK_6E_REGISTRY_PROPOSAL_DRY_RUN.md`.

## Phase 7 Track 6F - Operator Approval Gate for Registry Proposal Apply

Status: next recommended planning/implementation track.

Goal: define and/or implement the explicit operator approval boundary required before a dry-run proposal can write files into `registry/apps`.

Checklist:

- [ ] Define exact approval phrase or UI control for write mode.
- [ ] Require dry-run preview before apply.
- [ ] Refuse overwriting existing app packages unless update mode is explicit.
- [ ] Run `npm run validate:registry` and `npm run check` after approved apply.
- [ ] Keep Stripe, Vercel env vars, live mode, refunds, deployments, and entitlements outside automatic apply.
Evidence: `docs/PHASE_7_TRACK_6F_OPERATOR_APPROVAL_APPLY_GATE.md`.

## Phase 7 Track 6G - End-to-End Proposal Apply Rehearsal

Status: next recommended implementation track.

Goal: rehearse the dry-run -> approved apply -> validation cycle using a throwaway app artifact and isolated root/output, before using the flow for a real app.

Checklist:

- [ ] Create or generate a throwaway onboarding artifact.
- [ ] Run proposal dry-run and review proposed files.
- [ ] Apply with the exact approval phrase into an isolated root.
- [ ] Run registry validation/checks against the isolated proposal.
- [ ] Confirm no Stripe, Vercel, live-mode, refund, deployment, or entitlement mutation occurs.
Evidence: `docs/PHASE_7_TRACK_6G_E2E_PROPOSAL_APPLY_REHEARSAL.md`.

## Phase 7 Track 6H - Real App Onboarding Operator Runbook and UI Handoff

Status: complete.

Goal: convert the proven dry-run/apply rehearsal into the operator-facing process for onboarding the next real app safely.

Checklist:

- [x] Define operator steps from `/admin` export to proposal dry-run.
- [x] Define where proposal review artifacts are stored.
- [x] Define when approved apply is allowed for a real app.
- [x] Define post-apply validation, commit, deploy, and sandbox proof sequence.
- [x] Keep live payments, refunds, Stripe mutation, Vercel env mutation, and entitlement grants in separate approval gates.
Evidence: `docs/PHASE_7_TRACK_6H_REAL_APP_ONBOARDING_RUNBOOK_UI_HANDOFF.md`.

## Phase 7 Track 6I - UI-Driven Onboarding Freeze Prep and First Real-App Candidate Gate

Status: complete.

Goal: decide whether the UI-driven onboarding workflow is ready to freeze for operator use, then select the next real app candidate for a sandbox-only onboarding run.

Checklist:

- [x] Review Track 6H runbook against current `/admin` onboarding UI.
- [x] Confirm the UI export includes every field required by the proposal generator.
- [x] Confirm operator evidence folder convention is accepted.
- [x] Define the first real-app candidate gate for the next controlled sandbox-only onboarding.
- [x] Confirm no live payment, refund, provider mutation, or Vercel env mutation is bundled into the candidate gate.
Evidence: `docs/PHASE_7_TRACK_6I_UI_DRIVEN_ONBOARDING_FREEZE_PREP.md`.

## Phase 7 Track 6J - First Real-App Candidate Intake and Dry-Run Proposal

Status: complete.

Goal: choose one real app candidate, complete the candidate gate, export a fresh onboarding artifact from `/admin`, and run the non-mutating registry proposal dry-run for review.

Checklist:

- [x] Select one real app candidate: MyExpensio.
- [x] Complete candidate gate fields: owner, app_id, provider account, URLs, auth model, first safe payment slice, deferred scope.
- [x] Create operator-approved onboarding artifact for the selected candidate.
- [x] Store artifact in the candidate review folder.
- [x] Run non-mutating proposal dry-run with output pointing to the review folder.
- [x] Review generated package output and stop before approved apply unless operator explicitly authorizes the exact apply phrase.
Evidence/worksheet: `docs/PHASE_7_TRACK_6J_FIRST_REAL_APP_CANDIDATE_DRY_RUN.md`.
External review folder: `C:\Users\user\Documents\PayGate Proposal Reviews\myexpensio\2026-09-24\`.

## Phase 7 Track 6K - MyExpensio Pricing Alignment and Registry Apply Gate

Status: complete.

Goal: resolve the MyExpensio plan naming/pricing mismatch before any registry apply, then decide whether to apply the reviewed draft registry package.

Checklist:

- [x] Decide whether `pro_monthly` should be MYR 29/month, or whether it should remain MYR 18/month as currently documented in the MyExpensio repo.
- [x] Decide whether MYR 29/month should instead be `premium_monthly`.
- [x] Regenerate the onboarding artifact and dry-run proposal with corrected plan amount.
- [x] Confirm Stripe sandbox lookup key to create/use after the registry decision: `myexpensio_pro_monthly`.
- [x] Stop before registry apply unless operator explicitly authorizes `APPLY REGISTRY PROPOSAL myexpensio`.
Evidence: `docs/PHASE_7_TRACK_6K_MYEXPENSIO_PRICING_ALIGNMENT.md`.
External review folder: `C:\Users\user\Documents\PayGate Proposal Reviews\myexpensio\2026-09-24\`.

## Phase 7 Track 6L - MyExpensio Registry Apply Approval and Validation

Status: complete.

Goal: apply the reviewed MyExpensio draft registry package only if the operator explicitly approves the exact apply phrase, then validate before any deployment or sandbox checkout work.

Checklist:

- [x] Obtain exact operator approval phrase: `APPLY REGISTRY PROPOSAL myexpensio`.
- [x] Apply the reviewed proposal into `registry/apps/myexpensio`.
- [x] Run `npm run validate:registry`.
- [x] Run `npm run check`.
- [x] Confirm no Stripe product/price, Vercel env var, live payment, refund, deployment, or entitlement mutation occurs in this track.
Evidence: `docs/PHASE_7_TRACK_6L_MYEXPENSIO_REGISTRY_APPLY_VALIDATION.md`.

## Phase 7 Track 6M - MyExpensio Sandbox Provider Setup Plan

Status: complete.

Goal: prepare the sandbox-only provider and app integration setup plan for MyExpensio Pro monthly without live payment, deployment, provider mutation, or MyExpensio app code changes in this track.

Checklist:

- [x] Confirm or create Stripe sandbox Product/Price requirements with lookup key `myexpensio_pro_monthly` and amount MYR 18/month.
- [x] Confirm PayGate sandbox provider account `nhl_global_solution` remains the selected provider alias.
- [x] Confirm MyExpensio Supabase JWT boundary values needed by PayGate.
- [x] Prepare MyExpensio thin-client migration plan from direct Stripe routes to PayGate.
- [x] Keep Premium, ORG subscriptions, live payment, refunds, deployment, and provider mutation in separate gates.
Evidence: `docs/PHASE_7_TRACK_6M_MYEXPENSIO_SANDBOX_PROVIDER_SETUP_PLAN.md`.

## Phase 7 Track 6N - MyExpensio Sandbox Provider Configuration Evidence

Status: next recommended operator evidence track.

Goal: collect proof that the sandbox provider, lookup key, webhook endpoint, and PayGate MyExpensio Supabase JWT configuration are ready before touching MyExpensio app code.

Checklist:

- [ ] Confirm or create Stripe sandbox Product/Price lookup key `myexpensio_pro_monthly` at MYR 18/month.
- [ ] Add/confirm PayGate Vercel MyExpensio Supabase JWT variables.
- [ ] Preserve existing multi-app `SUPABASE_JWT_APPS` values while adding `myexpensio`.
- [ ] Redeploy PayGate only if Vercel env vars changed.
- [ ] Run protected `/diagnostics/ready` and `/diagnostics/runtime` and confirm MyExpensio auth readiness.
- [ ] Stop before MyExpensio app code changes until provider/auth boundary is green.