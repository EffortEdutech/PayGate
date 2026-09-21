# Phase 7 Track 6B - UI-driven Onboarding Workspace Shell

Status: implemented as a non-mutating admin UI shell.

## Objective

Build the first UI-driven onboarding workspace inside `/admin` so the operator can prepare a new app onboarding package through guided steps instead of command-first documentation.

This track implements the shell only. It does not write registry files, call Stripe, deploy, save secrets, create live payments, create refunds, or grant entitlements.

## Implemented scope

The `/admin` Draft Add App area is now a guided onboarding workspace with these steps:

1. Intake
2. Provider
3. URLs
4. Auth
5. Plans
6. Items / SKU
7. Stripe setup
8. Webhooks
9. Sandbox proof
10. Export / review

Each step shows the operator what information is required and which safety boundary applies.

## Draft state and export

- Draft data is kept in browser memory only.
- Step navigation preserves entered draft values while the operator moves through the workspace.
- The workspace can generate a draft preview JSON.
- The workspace can validate the draft.
- The workspace can download an onboarding draft JSON artifact.
- The export remains `draft_preview_only` and requires engineering/operator review.

## Safety boundaries preserved

- No registry file writes.
- No Stripe API calls.
- No provider secret entry or display.
- No webhook secret entry or display.
- No database credential entry or display.
- No deployment action.
- No live checkout or live item checkout.
- No refund action.
- No entitlement mutation.
- No bypass of `npm run validate:registry`.

## Files changed

- `api/index.ts`
  - Added onboarding workspace styling.
  - Replaced the single draft form with a multi-step onboarding shell.
  - Added browser-local draft state persistence across steps.
  - Expanded draft export structure for auth, Stripe setup, webhooks, sandbox proof, plans, and item/SKU preparation.

- `tests/unit/vercel-diagnostics-auth.test.ts`
  - Locks the admin shell labels and safety boundary text.
  - Confirms the shell still does not embed the operator token.

## Acceptance checklist

- [x] Add onboarding workspace navigation steps.
- [x] Add per-step operator guidance.
- [x] Add intake/provider/URLs/auth/plans/items/Stripe/webhook/sandbox/export panels.
- [x] Preserve current admin login/session model.
- [x] Keep all draft data browser-local until export.
- [x] Do not write registry files.
- [x] Do not call Stripe.
- [x] Do not store or display secrets.
- [x] Do not enable live payment, live refund, or live item checkout.
- [x] Update admin shell tests.

## Next recommended track

Proceed to Phase 7 Track 6C - Onboarding Workspace Validation and Export Hardening.

Track 6C should improve the generated artifact and validation quality. It should still remain non-mutating unless a later track explicitly approves controlled registry proposal generation.
