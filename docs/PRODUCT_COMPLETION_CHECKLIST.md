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

Status: frozen with refund deferred by operator decision on 2026-09-21.

- [x] Phase 6 sprint plan documented.
- [x] Controlled live payment/refund gate documented.
- [ ] Operator approval packet completed outside source control.
- [x] Preflight verification passed.
  - [x] Public health/protection/registry checks recorded.
  - [x] Operator-side Vercel/Stripe/token checks completed.
- [x] One approved live checkout completed or pilot explicitly aborted.
- [x] Live webhook and entitlement proof complete.
- [x] Portal/reconciliation proof complete or intentionally deferred.
- [ ] Refund proof complete if approved in a future separate refund gate.
- [x] Evidence recorded safely enough to freeze current Phase 6 scope.
- [x] Phase 6 freeze note created with refund deferred; see `docs/PHASE_6_FREEZE_REFUND_DEFERRED.md`.

## Phase 7 - Operator Console and Multi-App Scale-Out

Status: governance cleanup active; pageCast remains sandbox/test, and app onboarding must become UI-driven before product completion.

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
- [x] Operator approves app #2 intake; pageCast selected and onboarded through sandbox/test evidence.
- [x] App #2 draft registry package created: `registry/apps/pagecast`.
- [x] pageCast per-book checkout item/SKU contract decision recorded as future PayGate extension.
- [x] pageCast provider/Stripe setup prep documented for `pagecast_cast_pass_monthly`.
- [x] App #2 Stripe sandbox Product/Price created for `pagecast_cast_pass_monthly`.
- [x] App #2 provider account alias confirmed for Stripe account used by pageCast Product/Price: `acct_1U4N5nDzGAfRwUx9`.
- [x] App #2 Cast Pass registry plan activated for `cast_pass_monthly`.
- [x] App #2 thin payment client integrated in pageCast reader app for Cast Pass checkout only; committed in pageCast as `5878eef`.
- [x] App #2 Supabase JWT auth boundary implemented in PayGate for project `zdlbcvscytujdomxzwei`.
- [x] App #2 Supabase JWT Vercel env vars configured and verified on deployment.
- [x] App #2 Cast Pass sandbox E2E proof complete; see `docs/PHASE_7_TRACK_4E_PAGECAST_SANDBOX_PROOF_EVIDENCE.md`.
- [x] App #2 reads PayGate entitlement state for pageCast Cast Pass; see `docs/PHASE_7_TRACK_4F_PAGECAST_ENTITLEMENT_STATE_EVIDENCE.md`.
- [x] App #2 Cast Pass access enforcement plan documented; see `docs/PHASE_7_TRACK_4G_PAGECAST_ACCESS_ENFORCEMENT_PLAN.md`.
- [x] App #2 Cast Pass access enforcement implemented and deployed browser verification accepted. See `docs/PHASE_7_TRACK_4H_PAGECAST_ACCESS_ENFORCEMENT_EVIDENCE.md`.
- [x] App #2 operator/admin evidence polish recorded for pageCast Cast Pass sandbox state. See docs/PHASE_7_TRACK_4I_PAGECAST_OPERATOR_ADMIN_EVIDENCE.md.
- [x] App #2 Single Cast item/SKU contract plan documented; runtime/payment activation remains deferred. See docs/PHASE_7_TRACK_4J_PAGECAST_SINGLE_CAST_ITEM_SKU_CONTRACT_PLAN.md.
- [x] App #2 pageCast Cast Pass onboarding closure/evidence packet recorded. See docs/PHASE_7_TRACK_4K_PAGECAST_ONBOARDING_CLOSURE_EVIDENCE_PACKET.md.
- [x] Multi-app admin/monitoring verified for pageCast/AIntern test admin view.
- [x] Onboarding runbook updated from app #2 evidence.
- [x] Phase 7 Track 4L operator verification accepted; see `docs/PHASE_7_TRACK_4L_MULTI_APP_ADMIN_MONITORING_FREEZE_PREP.md`.
- [x] pageCast sandbox go-forward accepted through Track 5J; live pageCast remains deferred. See `docs/PHASE_7_GOVERNANCE_CLEANUP_FREEZE_PREP.md`.
- [x] Track 5A item/SKU registry contract prepared for pageCast Single Cast; all items remain draft and runtime activation is blocked. See `docs/PHASE_7_TRACK_5A_PAGECAST_ITEM_SKU_REGISTRY_CONTRACT.md`.
- [x] Track 5B item registry loader/domain types implemented; item checkout remains disabled. See `docs/PHASE_7_TRACK_5B_PAYGATE_ITEM_REGISTRY_LOADER_DOMAIN_TYPES.md`.
- [x] Track 5C checkout API recognizes `item_ref` but blocks item checkout behind disabled gate. See `docs/PHASE_7_TRACK_5C_ITEM_REF_CHECKOUT_DISABLED_GATE.md`.
- [x] Track 5D item provider lookup resolution implemented while keeping item checkout disabled. See `docs/PHASE_7_TRACK_5D_ITEM_PROVIDER_LOOKUP_RESOLUTION.md`.
- [x] Track 5E item checkout/evidence persistence model implemented while keeping item entitlement projection disabled. See `docs/PHASE_7_TRACK_5E_ITEM_CHECKOUT_PERSISTENCE_EVIDENCE.md`.
- [x] Track 5F verified webhook projection for item-scoped entitlements implemented; item checkout creation remains disabled. See `docs/PHASE_7_TRACK_5F_ITEM_WEBHOOK_PROJECTION.md`.
- [x] Track 5G pageCast thin client sends Single Cast `item_ref` through PayGate and handles disabled item checkout safely. See `docs/PHASE_7_TRACK_5G_PAGECAST_SINGLE_CAST_THIN_CLIENT.md`.
- [x] Track 5H pageCast item entitlement access enforcement implemented; Single Cast payment activation remains gated. See `docs/PHASE_7_TRACK_5H_PAGECAST_ITEM_ENTITLEMENT_ACCESS_ENFORCEMENT.md`.
- [x] Track 5I controlled Single Cast sandbox E2E proof accepted behind exact test allowlist. See `docs/PHASE_7_TRACK_5I_SINGLE_CAST_SANDBOX_E2E_PROOF.md`.
- [x] Track 5J operator/admin item evidence and reconciliation review documented; item-specific reconciliation repair remains deferred. See `docs/PHASE_7_TRACK_5J_OPERATOR_ITEM_EVIDENCE_RECONCILIATION_REVIEW.md`.
- [x] Governance cleanup records: Phase 6 frozen with refund deferred, pageCast not live, and UI-driven onboarding required. See `docs/PHASE_7_GOVERNANCE_CLEANUP_FREEZE_PREP.md`.
- [x] Track 6A UI-driven App Onboarding Workspace Plan created. See `docs/PHASE_7_TRACK_6A_UI_DRIVEN_APP_ONBOARDING_WORKSPACE_PLAN.md`.
- [x] Track 6B UI-driven onboarding workspace shell implemented and verified. See `docs/PHASE_7_TRACK_6B_UI_DRIVEN_ONBOARDING_WORKSPACE_SHELL.md`.
- [x] Track 6C onboarding workspace validation and export hardening complete. See `docs/PHASE_7_TRACK_6C_ONBOARDING_VALIDATION_EXPORT_HARDENING.md`.
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

- [x] Track 6D controlled registry proposal generation plan complete. See `docs/PHASE_7_TRACK_6D_CONTROLLED_REGISTRY_PROPOSAL_PLAN.md`.

- [x] Track 6E controlled registry proposal generator dry-run complete. See `docs/PHASE_7_TRACK_6E_REGISTRY_PROPOSAL_DRY_RUN.md`.

- [x] Track 6F operator approval gate for registry proposal apply complete. See `docs/PHASE_7_TRACK_6F_OPERATOR_APPROVAL_APPLY_GATE.md`.

- [x] Track 6G end-to-end proposal apply rehearsal complete. See `docs/PHASE_7_TRACK_6G_E2E_PROPOSAL_APPLY_REHEARSAL.md`.

- [x] Track 6H real app onboarding operator runbook and UI handoff complete. See `docs/PHASE_7_TRACK_6H_REAL_APP_ONBOARDING_RUNBOOK_UI_HANDOFF.md`.
- [x] Track 6I UI-driven onboarding freeze prep and first real-app candidate gate complete. See `docs/PHASE_7_TRACK_6I_UI_DRIVEN_ONBOARDING_FREEZE_PREP.md`.
- [x] Track 6J first real-app candidate intake and dry-run proposal complete for MyExpensio. See `docs/PHASE_7_TRACK_6J_FIRST_REAL_APP_CANDIDATE_DRY_RUN.md`.
- [x] Track 6K MyExpensio pricing alignment and registry apply gate complete. See `docs/PHASE_7_TRACK_6K_MYEXPENSIO_PRICING_ALIGNMENT.md`.
- [x] Track 6L MyExpensio registry apply approval and validation complete. See `docs/PHASE_7_TRACK_6L_MYEXPENSIO_REGISTRY_APPLY_VALIDATION.md`.
- [x] Track 6M MyExpensio sandbox provider setup plan complete. See `docs/PHASE_7_TRACK_6M_MYEXPENSIO_SANDBOX_PROVIDER_SETUP_PLAN.md`.
- [x] Track 6N MyExpensio sandbox provider configuration evidence complete as a runbook/pre-code gate. See `docs/PHASE_7_TRACK_6N_MYEXPENSIO_SANDBOX_PROVIDER_CONFIGURATION_EVIDENCE.md`.
- [x] Track 6O MyExpensio thin PayGate client plan and code prep complete. See `docs/PHASE_7_TRACK_6O_MYEXPENSIO_THIN_PAYGATE_CLIENT_PLAN.md`.
- [ ] Track 6P MyExpensio Pro sandbox PayGate checkout proxy implemented.
