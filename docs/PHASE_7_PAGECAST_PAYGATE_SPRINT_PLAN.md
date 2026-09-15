# Phase 7 pageCast PayGate Sprint Plan

Status: active pageCast-specific sprint plan.
Parent sprint: `docs/PHASE_7_MULTI_APP_SCALE_OUT_SPRINT_PLAN.md`.

## Objective

Onboard pageCast to PayGate safely, starting with Cast Pass and then preparing Single Cast item-specific purchases without breaking PayGate's provider-neutral authority model.

## Core architecture rule

pageCast is a payment consumer. PayGate is the commercial authority.

pageCast may send:

- `app_id`
- `user_ref`
- `plan_key`
- future non-commercial `item_ref`
- `return_context`
- `environment`

pageCast must not send:

- amount;
- currency;
- Stripe Price ID;
- provider account;
- provider customer ID;
- entitlement key;
- arbitrary return URL.

## Completed Cast Pass track

- [x] Track 4A - Cast Pass USD 19/month and Stripe sandbox setup prepared.
- [x] Track 4B - pageCast Cast Pass registry activated and admin catalog verified.
- [x] Track 4C - pageCast Supabase JWT boundary verified.
- [x] Track 4D - pageCast thin PayGate checkout client wired.
- [x] Track 4E - sandbox checkout/webhook/subscription/entitlement proof accepted.
- [x] Track 4F - entitlement state read/display accepted.
- [x] Track 4G - Cast Pass access enforcement plan accepted.
- [x] Track 4H - Premium Cast access enforcement verified.
- [x] Track 4I - operator/admin evidence polish recorded.
- [x] Track 4J - Single Cast item/SKU contract plan documented.
- [x] Track 4K - onboarding closure packet recorded.
- [x] Track 4L - multi-app admin/monitoring verification accepted.
- [ ] Track 4M - pageCast onboarding freeze/go-forward note accepted by operator.

## Current Single Cast preparation track

### Track 5A - PayGate Item/SKU Registry Contract for pageCast Single Cast

Goal: create the registry contract shape for item-specific purchases without activating checkout.

Checklist:

- [x] Add optional registry schema for `items.yaml`.
- [x] Add draft pageCast item examples for one book and one bundle.
- [x] Add validation for item entitlement keys and lookup key uniqueness.
- [x] Keep all item statuses `draft`.
- [x] Do not mutate Stripe catalog.
- [x] Do not change checkout runtime.
- [x] Do not activate `single_cast_unlock`.

## Future Single Cast implementation tracks

These are not started yet:

1. Track 5B - registry loader/domain types for items. Done
2. Track 5C - checkout API extension for `item_ref`. Done
3. Track 5D - provider lookup resolution for item prices. Done
4. Track 5E - persistence model for item checkout and item entitlement evidence. Done
5. Track 5F - webhook projection for item-scoped entitlements. Done
6. Track 5G - pageCast thin client for Single Cast checkout. Done
7. Track 5H - pageCast access enforcement for matching book/bundle entitlement. Done
8. Track 5I - sandbox E2E proof for one controlled Single Cast. Prepared; external proof pending
9. Track 5J - operator/admin item evidence and reconciliation review.
10. Track 5K - live readiness gate if operator later approves real-money Single Cast.

## Stop conditions

Stop and re-plan if any implementation tries to:

- activate Single Cast before item-scoped entitlement projection exists;
- let pageCast submit price, currency, Stripe Price ID, provider account, or entitlement key;
- grant access from browser redirect;
- skip webhook signature verification;
- skip registry validation;
- use live Stripe mode before a separate live gate.

## Track 5B - Registry Loader and Domain Types for PayGate Items

Status: complete.

- [x] Add registered item TypeScript domain types.
- [x] Load optional `items.yaml` into registry runtime.
- [x] Add lookup methods for item definitions and active-only item definitions.
- [x] Keep checkout API unchanged.
- [x] Keep item checkout disabled.
- [x] Add tests for item lookup and draft/active boundary.

## Track 5C - Checkout API Extension for `item_ref` Behind Disabled Gate

Status: complete.

- [x] Add optional `item_ref` to checkout request schema/types.
- [x] Reject `item_ref` unless a future item-checkout gate explicitly enables item checkout.
- [x] Prove existing plan-only checkout still works.
- [x] Prove item checkout remains blocked while disabled.
- [x] Do not create Stripe item checkout sessions yet.

## Track 5D - Provider Lookup Resolution for Item Prices

Status: complete.

- [x] Resolve item provider lookup keys from registry only.
- [x] Respect test/live lookup separation.
- [x] Reject inactive/draft item checkout until explicit activation.
- [x] Keep provider session creation disabled for items.
- [x] Add tests for item lookup selection and live/test separation.

## Track 5E - Persistence Model for Item Checkout and Item Entitlement Evidence

Status: complete.

- [x] Design item checkout persistence fields.
- [x] Design item entitlement evidence fields.
- [x] Preserve existing plan checkout records.
- [x] Avoid granting item access from browser redirects.
- [x] Add migration and repository tests.

## Track 5F - Webhook Projection for Item-Scoped Entitlements

Status: complete.

- [x] Extend normalized provider payload with item evidence fields.
- [x] Map item checkout/session metadata only after signature verification.
- [x] Project item entitlement keys/scopes from verified provider evidence only.
- [x] Preserve plan entitlement projection behavior.
- [x] Add tests for item webhook projection and refund/revocation behavior.

## Track 5G - pageCast Thin Client for Single Cast Checkout

Status: complete; item checkout remains disabled at PayGate.

- [x] Extend pageCast PayGate client request shape to support `item_ref`.
- [x] Update pageCast checkout API proxy so Single Cast sends only `item_ref`.
- [x] Update Premium Cast CTA to call PayGate instead of direct Stripe for paid Single Cast unlock.
- [x] Keep Cast Pass checkout behavior unchanged.
- [x] Handle `ITEM_CHECKOUT_DISABLED` and `ITEM_NOT_AVAILABLE` as a planned unavailable state.
- [x] Do not send amount, currency, Stripe Price ID, provider account, provider customer, or entitlement key from pageCast.
- [x] Do not activate Single Cast checkout without operator approval.
- [x] Verify pageCast reader app build passes.

Evidence:

- pageCast touched files:
  - `apps/reader-app/src/lib/paymentHub/client.ts`
  - `apps/reader-app/src/app/api/paygate/checkout/route.ts`
  - `apps/reader-app/src/app/book/[id]/page.tsx`
- Verification: `npm run build --prefix apps/reader-app` passed.

## Next action after Track 5G

Proceed to Track 5H: pageCast access enforcement for matching book/bundle item entitlement. This should read verified PayGate item entitlement evidence when it exists, but must not grant access from browser redirects or from the disabled checkout attempt.

## Track 5H - pageCast Item Entitlement Access Enforcement

Status: complete; Single Cast payment activation remains disabled.

- [x] Extend pageCast PayGate entitlement type to include item scope.
- [x] Match active `pagecast.single_cast_unlock` entitlements to the current book only.
- [x] Preserve Cast Pass all-premium access behavior.
- [x] Preserve free, guest, existing purchase, and existing subscription rules.
- [x] Keep unmatched Premium Casts locked.
- [x] Do not grant access from checkout redirects.
- [x] Verify pageCast reader app build passes.

Evidence: `docs/PHASE_7_TRACK_5H_PAGECAST_ITEM_ENTITLEMENT_ACCESS_ENFORCEMENT.md`.

## Next action after Track 5H

Track 5I is prepared for one controlled Single Cast sandbox proof. External proof remains pending Stripe sandbox Price confirmation, PayGate Vercel allowlist env setup, deploy, checkout completion, webhook evidence, and matching-book access verification.
## Track 5I - Controlled Single Cast Sandbox E2E Proof

Status: implementation prepared; external Stripe sandbox proof pending.

- [x] Operator approved proceeding into controlled Single Cast sandbox E2E proof preparation.
- [x] Activate exactly one pageCast item for sandbox proof: `book:a2020000-0000-4000-8000-000000000001`.
- [x] Keep bundle item and broad item rollout inactive.
- [x] Add server-side allowlist gate: `PAYGATE_ITEM_CHECKOUT_TEST_ALLOWLIST`.
- [x] Allow item checkout only in `test` environment for the exact `pagecast|book:a2020000-0000-4000-8000-000000000001` pair.
- [x] Keep live item checkout blocked even when the sandbox allowlist is present.
- [x] Attach item metadata for verified Stripe webhook projection.
- [x] Expose item checkout and scoped entitlement evidence in safe operator/admin summary output.
- [x] Verify PayGate registry validation, typecheck, and tests pass.
- [ ] Confirm Stripe sandbox Price lookup key `pagecast_book_a2020000_single_unlock` exists at USD 9.99 one-time.
- [ ] Add PayGate Vercel env `PAYGATE_ITEM_CHECKOUT_TEST_ALLOWLIST=pagecast|book:a2020000-0000-4000-8000-000000000001` and redeploy.
- [ ] Run one pageCast unpaid-user Single Cast checkout from the selected Premium Cast.
- [ ] Verify processed webhook evidence and scoped item entitlement.
- [ ] Verify selected Premium Cast opens and another Premium Cast remains locked.

Evidence: `docs/PHASE_7_TRACK_5I_SINGLE_CAST_SANDBOX_E2E_PROOF.md`.

Next action after Track 5I preparation: operator/deployment sandbox proof execution. Do not proceed to Track 5J until the external proof evidence is captured.