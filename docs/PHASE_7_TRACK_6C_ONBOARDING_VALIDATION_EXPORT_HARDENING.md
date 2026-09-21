# Phase 7 Track 6C - Onboarding Workspace Validation and Export Hardening

Status: implemented as a non-mutating admin UI hardening slice.

## Objective

Harden the `/admin` UI-driven onboarding workspace so the exported draft is closer to a registry-package proposal, without giving the browser authority to mutate PayGate, Stripe, Vercel, the database, or app entitlements.

This track prepares the workflow for future UI-driven registry creation, but it does not create registry files yet.

## Implemented scope

Track 6C strengthens the Track 6B workspace with:

1. Visible per-step status badges:
   - `complete`
   - `review`
   - `blocked`
2. Stronger cross-field validation:
   - app ID format and duplicate loaded registry app check;
   - provider account alias format and loaded-registry warning;
   - HTTPS origin checks;
   - return context identifier checks;
   - Supabase JWT/JWKS URL and issuer checks;
   - plan amount, currency, mode, lookup key, and entitlement checks;
   - item/SKU namespace, lookup key, and amount checks;
   - secret-looking value detection for `sk_`, `whsec_`, and restricted-key patterns.
3. Hardened export artifact sections:
   - `environment_variable_names`
   - `registry_proposal`
   - `auth_checklist`
   - `stripe_setup_checklist`
   - `webhook_setup_checklist`
   - `sandbox_proof_checklist`
   - `required_next_steps`
4. Clearer operator language:
   - preview is now named `Onboarding artifact preview`;
   - workspace actions explicitly state Track 6C export hardening;
   - export remains browser-local and non-mutating.

## Safety boundaries preserved

- No registry file writes.
- No Stripe API calls.
- No provider secret entry or display.
- No webhook secret entry or display.
- No database credential entry or display.
- No Vercel environment mutation.
- No deployment action.
- No live checkout or live item checkout.
- No refund action.
- No entitlement mutation.
- No bypass of `npm run validate:registry`.

## Prepared UI-driven registry creation workflow

Track 6C prepares, but does not execute, the future registry creation flow:

1. Operator completes guided onboarding workspace.
2. Workspace validates the draft and shows step-level status.
3. Operator exports an onboarding artifact.
4. Engineering/operator reviews the artifact.
5. A later approved track may convert the artifact into a controlled registry proposal.
6. Registry proposal must still pass:
   - `npm run validate:registry`
   - `npm run check`
7. Commit/deploy remains a reviewed engineering action.

## Files changed

- `api/index.ts`
  - Added per-step status badges.
  - Added stronger validation and export structure.
  - Added secret-looking value detection.
  - Added environment variable name planning and registry proposal metadata.

- `tests/unit/vercel-diagnostics-auth.test.ts`
  - Locks the Track 6C admin shell labels and export contract.
  - Confirms the shell still does not embed the operator token.

- `docs/PHASE_7_MULTI_APP_SCALE_OUT_SPRINT_PLAN.md`
  - Marks Track 6C complete and adds the next controlled registry proposal track.

- `docs/PRODUCT_COMPLETION_CHECKLIST.md`
  - Marks Track 6C complete.

- `docs/PRODUCT_ROADMAP_GRAPH.md`
  - Updates the graph to show Track 6C complete and Track 6D next.

## Acceptance checklist

- [x] Add stronger cross-field validation for plans/items/auth/origins.
- [x] Add clearer export sections for env var names, Stripe setup, webhook setup, and sandbox proof.
- [x] Add provider-account alias warnings based on loaded registry apps.
- [x] Add visible completion status per onboarding step.
- [x] Keep the workflow non-mutating.
- [x] Lock admin shell behavior with tests.

## Next recommended track

Proceed to Phase 7 Track 6D - Controlled Registry Proposal Generation Plan.

Track 6D should define exactly how an exported onboarding artifact can become registry files safely. It should still avoid automatic registry mutation until the operator approves the controlled apply workflow.
