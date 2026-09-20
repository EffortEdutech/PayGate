# pageCast PayGate Integration Status

Status: Cast Pass registry active; one controlled Single Cast sandbox item proof accepted behind PayGate allowlist; live/broad Single Cast remains blocked.


## Pricing page review

The live pageCast pricing page currently presents ranges:

- Starter Pass: `$0` start here.
- Single Cast Unlock: `$3-$9` per Cast.
- Cast Pass: `$9-$19` per month.

PayGate requires fixed registry prices. The first prepared sandbox price is `cast_pass_monthly` at USD 19.00/month. The operator may change this before activation, but the Stripe Price amount, currency, interval, and registry values must match exactly.

## Current pageCast payment model

pageCast currently uses direct Stripe in the reader app:

- `apps/reader-app/src/app/api/stripe/checkout/route.ts`
- `apps/reader-app/src/app/api/stripe/webhook/route.ts`

The existing checkout reads `book.price` from Supabase and sends a dynamic amount to Stripe. That is not compatible with PayGate's current app contract, because PayGate intentionally owns amount, currency, provider account, provider lookup key, return URL, and entitlements.

## Safe first PayGate slice

The first safe pageCast PayGate slice is app-wide Cast Pass billing:

- `plan_key`: `cast_pass_monthly`
- `mode`: subscription
- `amount`: USD 19.00/month active
- `entitlements`: `pagecast.cast_pass`, `pagecast.premium_casts`

This can be integrated with current PayGate checkout/portal/entitlement APIs after Stripe sandbox lookup key creation and pageCast JWT verification setup.

## Blocked / future contract

Per-book checkout is not safe to activate through current PayGate yet because pageCast must identify which `book_id` is being purchased, while PayGate currently accepts only `plan_key` and projects plan-level entitlements.

Required future PayGate extension before per-book purchase activation:

- registry-owned item/SKU catalog or controlled metadata contract;
- app submits non-commercial item reference only, for example `item_ref=book_uuid`;
- PayGate resolves allowed price/lookup key and records item-specific entitlement evidence;
- pageCast access route reads verified PayGate item entitlement or bridge projection.

## Activation gates

- [x] Operator confirms final pageCast pricing; confirmed prepared Cast Pass value is USD 19.00/month, matching the top of the published `$9-$19` range.
- [x] Stripe sandbox Product/Price exists for `pagecast_cast_pass_monthly` with fixed USD 19.00/month.
- [x] Confirmed Stripe account `acct_1U4N5nDzGAfRwUx9` maps to PayGate alias `stripe:nhl_global_solution` for pageCast.
- [x] PayGate registry marks `cast_pass_monthly` active.
- [x] Stripe sandbox Product/Price exists for controlled Single Cast lookup key `pagecast_book_a2020000_single_unlock`; broad item rollout remains blocked.
- [x] PayGate Vercel auth env vars configured and verified for pageCast Supabase JWTs: `SUPABASE_JWT_APPS`, `SUPABASE_JWT_PAGECAST_JWKS_URL`, `SUPABASE_JWT_PAGECAST_ISSUER`, `SUPABASE_JWT_PAGECAST_AUDIENCE`.
- [x] pageCast reader app uses PayGate checkout as the primary Cast Pass payment path; implemented in pageCast commit `5878eef`.
- [x] pageCast controlled per-book Single Cast checkout now routes through PayGate for the allowlisted sandbox item only.
- [x] pageCast reads PayGate entitlements for Cast Pass display through `/api/paygate/state`; local and deployed verification accepted.
- [x] Sandbox E2E proof completed for one controlled Single Cast item.


## Phase 7 Track 4E sandbox proof

Accepted on 2026-09-11. PayGate admin evidence shows processed customer.subscription.created and checkout.session.completed webhooks for pagecast, active subscription state for cast_pass_monthly, and active plan:cast_pass_monthly entitlement projection through 2026-10-11.


## Phase 7 Track 4F entitlement display

Implemented in pageCast commit c6d8d19. pageCast now reads PayGate subscription and entitlement state server-side and displays active Cast Pass status on the pricing and billing success screens. This is display/read behavior only; per-book Single Cast unlock remains future item/SKU contract work.


## Phase 7 Track 4G access enforcement plan

Accepted planning direction: active PayGate Cast Pass should unlock all current Premium Cast reading/listening access in pageCast. Single Cast remains deferred until a future PayGate item/SKU contract exists. Next implementation track is Phase 7 Track 4H.


## Phase 7 Track 4H access enforcement implementation

Implemented in pageCast commit `acfef27`. The book access API now returns `reason: cast_pass` when verified PayGate Cast Pass state is active, and the book detail page displays Cast Pass-specific access copy. Deployment verification accepted on Premium Cast `a2020000-0000-4000-8000-000000000001`: unpaid state showed `Unlock Cast for $9.99` plus `Get Cast Pass`; paid Cast Pass state showed `Read with Cast Pass` and opened `/reader/a2020000-0000-4000-8000-000000000001`. Single Cast remains deferred until item/SKU contract work.


## Phase 7 Track 4I operator/admin evidence polish

Completed for sandbox/test Cast Pass evidence. Operator review should use `/admin` or protected admin APIs filtered by `app_id=pagecast&environment=test` to confirm app registry, Cast Pass plan, processed webhook evidence, customer/subscription/entitlement evidence, and clean monitoring state. Single Cast remains deferred and pageCast live payments remain blocked behind a separate live readiness gate.

## Phase 7 Track 4J Single Cast item/SKU contract plan

Documented the future item/SKU contract required before pageCast Single Cast Unlock can move from draft to active. The contract direction requires registry-owned `item_ref` resolution, PayGate-owned price/lookup authority, item-scoped entitlement projection, refund/revocation policy, reconciliation support, and operator/admin evidence. No runtime API, pageCast app code, Stripe catalog, or payment activation was changed.

## Phase 7 Track 4K onboarding closure

pageCast Cast Pass sandbox/test onboarding is closed with an operator evidence packet. Closed scope includes registry package, provider account mapping, active Cast Pass plan, Supabase JWT boundary, PayGate checkout, processed sandbox webhooks, active subscription/entitlement projection, app-side Cast Pass display, and Premium Cast access enforcement. Deferred scope remains Single Cast item/SKU implementation, pageCast live readiness, live payment/refund proof, and broader Phase 7 freeze.

## Phase 7 Track 4L multi-app admin/monitoring verification

Accepted. Protected admin summary and monitoring outputs for `app_id=pagecast&environment=test` were reviewed on 2026-09-14. Monitoring status is `ok` with no alerts. The all-apps test summary lists AIntern and pageCast separately, with provider account aliases preserved. Single Cast remains draft and pageCast live payments remain blocked.

## Phase 7 Track 4M onboarding freeze / go-forward

Freeze/go-forward note prepared. pageCast Cast Pass sandbox/test onboarding is ready to freeze pending operator acceptance. `single_cast_unlock` is ready for the next item/SKU registry contract sequence but remains draft and not payment-authorized. Recommended next track: Phase 7 Track 5A - PayGate Item/SKU Registry Contract for pageCast Single Cast.

## Phase 7 Track 5A item/SKU registry contract

Completed as registry-contract-only work. Added optional `items.yaml` schema, draft pageCast item catalog examples for one Premium Cast and one bundle, item-scoped entitlement keys, and registry validation for item entitlement references and lookup key uniqueness. No Stripe catalog mutation, checkout runtime change, or payment activation was performed. All pageCast item entries remain `draft`.

## Phase 7 Track 5B item registry loader

Completed. PayGate runtime now loads optional `items.yaml` catalogs into registered app item maps, exposes item lookup and active-only item lookup, and tests prove pageCast draft items load without activating checkout. Item checkout remains disabled.

## Phase 7 Track 5D - Item Provider Lookup Resolution

- PayGate can resolve item provider lookup keys from registry definitions only.
- Draft/inactive item checkout remains rejected.
- Provider checkout session creation remains disabled for items.
- Evidence: docs/PHASE_7_TRACK_5D_ITEM_PROVIDER_LOOKUP_RESOLUTION.md.


## Phase 7 Track 5E - Item Checkout Persistence Evidence

- PayGate can persist future item checkout intent fields.
- PayGate can persist item entitlement evidence separately from projected entitlements.
- Item checkout and item entitlement projection remain disabled.
- Evidence: docs/PHASE_7_TRACK_5E_ITEM_CHECKOUT_PERSISTENCE_EVIDENCE.md.


## Phase 7 Track 5F - Item Webhook Projection

- Verified provider events can project scoped item entitlements from server-side item metadata.
- Full refund/dispute-style cancellation evidence can revoke scoped item entitlements.
- Item checkout creation remains disabled.
- Evidence: docs/PHASE_7_TRACK_5F_ITEM_WEBHOOK_PROJECTION.md.
## Phase 7 Track 5G - pageCast Single Cast Thin Client

- pageCast Premium Cast unlock CTA now calls the PayGate proxy path with `item_ref=book:<bookId>`.
- pageCast does not submit amount, currency, Stripe Price ID, provider account, provider customer, or entitlement key.
- PayGate remains the commercial authority and still blocks item checkout creation until a separate activation gate.
- `ITEM_CHECKOUT_DISABLED` and `ITEM_NOT_AVAILABLE` are displayed as a planned unavailable Single Cast state.
- Cast Pass checkout and Cast Pass access behavior remain unchanged.
- Verification: pageCast `npm run build --prefix apps/reader-app` passed.
- Evidence: docs/PHASE_7_TRACK_5G_PAGECAST_SINGLE_CAST_THIN_CLIENT.md.
## Phase 7 Track 5H - pageCast Item Entitlement Access Enforcement

- pageCast can now unlock a matching Premium Cast when PayGate returns an active `pagecast.single_cast_unlock` entitlement with matching item scope.
- Cast Pass access remains unchanged and continues to unlock all Premium Casts.
- Unmatched Premium Casts remain locked unless free/guest/purchase/subscription/Cast Pass rules apply.
- Browser redirects still do not grant access.
- Single Cast checkout activation remains deferred.
- Verification: pageCast `npm run build --prefix apps/reader-app` passed.
- Evidence: docs/PHASE_7_TRACK_5H_PAGECAST_ITEM_ENTITLEMENT_ACCESS_ENFORCEMENT.md.
## Phase 7 Track 5I - Controlled Single Cast Sandbox E2E Proof

- Exactly one pageCast item is active for sandbox proof: `book:a2020000-0000-4000-8000-000000000001`.
- PayGate item checkout remains disabled by default and only opens for `test` when `PAYGATE_ITEM_CHECKOUT_TEST_ALLOWLIST=pagecast|book:a2020000-0000-4000-8000-000000000001` is configured server-side.
- Live item checkout remains blocked.
- Stripe checkout metadata now carries item reference, entitlement key, and scope so verified webhooks can project `pagecast.single_cast_unlock` for the matching book only.
- Operator/admin summary can expose item checkout and scoped entitlement evidence safely.
- Verification: PayGate `npm run check` passed with 72 tests.
- External proof accepted: Stripe sandbox Price lookup key confirmed, Vercel allowlist/deploy completed, one sandbox checkout completed, webhook/item entitlement evidence projected, paid user unlocked, unpaid user remained locked.
- Evidence: docs/PHASE_7_TRACK_5I_SINGLE_CAST_SANDBOX_E2E_PROOF.md.
## Phase 7 Track 5J - Operator/Admin Item Evidence and Reconciliation Review

- Operator/admin item evidence review is documented for the controlled Single Cast sandbox proof.
- One-time item purchases are not subscription purchases; missing subscription evidence must not be treated as a Single Cast failure by itself.
- For Track 5J, verified Stripe webhook evidence with item metadata is the authoritative entitlement source.
- Future item-specific reconciliation repair remains deferred.
- Evidence: docs/PHASE_7_TRACK_5J_OPERATOR_ITEM_EVIDENCE_RECONCILIATION_REVIEW.md.
