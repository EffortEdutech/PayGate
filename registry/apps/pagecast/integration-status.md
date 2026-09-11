# pageCast PayGate Integration Status

Status: Cast Pass registry active; Single Cast remains draft pending item/SKU contract.


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
- [ ] Optional: Stripe sandbox Product/Price exists for `pagecast_single_cast_unlock`, but keep inactive until item-specific contract exists.
- [x] PayGate Vercel auth env vars configured and verified for pageCast Supabase JWTs: `SUPABASE_JWT_APPS`, `SUPABASE_JWT_PAGECAST_JWKS_URL`, `SUPABASE_JWT_PAGECAST_ISSUER`, `SUPABASE_JWT_PAGECAST_AUDIENCE`.
- [x] pageCast reader app uses PayGate checkout as the primary Cast Pass payment path; implemented in pageCast commit `5878eef`.
- [ ] pageCast per-book direct Stripe checkout remains pending future PayGate item/SKU contract.
- [ ] pageCast reads PayGate entitlements for Cast Pass access after deployed sandbox proof. Track 4E sandbox proof is complete; Track 4F will wire display/read behavior.
- [ ] Sandbox E2E proof completed.


## Phase 7 Track 4E sandbox proof

Accepted on 2026-09-11. PayGate admin evidence shows processed customer.subscription.created and checkout.session.completed webhooks for pagecast, active subscription state for cast_pass_monthly, and active plan:cast_pass_monthly entitlement projection through 2026-10-11.
