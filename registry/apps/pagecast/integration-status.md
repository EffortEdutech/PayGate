# pageCast PayGate Integration Status

Status: draft registry package created; provider/Stripe setup prepared.


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
- `amount`: USD 19.00/month draft
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

- [ ] Operator confirms final pageCast pricing; confirmed prepared Cast Pass value is USD 19.00/month, matching the top of the published `$9-$19` range.
- [ ] Stripe sandbox Product/Price exists for `pagecast_cast_pass_monthly` with fixed USD 19.00/month.
- [ ] Optional: Stripe sandbox Product/Price exists for `pagecast_single_cast_unlock`, but keep inactive until item-specific contract exists.
- [ ] PayGate Vercel auth env vars configured for pageCast Supabase JWTs.
- [ ] pageCast reader app removes direct Stripe checkout as the primary payment path.
- [ ] pageCast uses PayGate checkout and entitlements.
- [ ] Sandbox E2E proof completed.