# Phase 7 Track 4 - pageCast Provider Account and Stripe Setup Prep

Date: 2026-09-10
Status: prepared; Stripe dashboard action pending operator.

## Purpose

Prepare pageCast for PayGate-controlled Stripe sandbox setup without weakening the authority boundary. This track does not create Stripe objects directly, does not edit Vercel environment variables, and does not change pageCast application code.

## Pricing Source Reviewed

pageCast pricing page currently presents ranges:

- Starter Pass: `$0` start here
- Single Cast Unlock: `$3-$9` per Cast
- Cast Pass: `$9-$19` per month

PayGate cannot use a range as an authoritative price. PayGate registry requires fixed plan amounts in integer minor units. Therefore, every Stripe Price created for PayGate must map to one exact registry `plan_key` and one exact lookup key.

## Provider Account Decision

Draft provider account alias:

`stripe:nhl_global_solution`

Reason: this is the existing Stripe account alias already proven with AIntern. Operator may still choose to create a pageCast-specific company alias later. If that changes, update `registry/apps/pagecast/app.yaml` before Stripe setup.

## Stripe Sandbox Product/Price Plan

### Product 1 - pageCast Cast Pass

Create in Stripe sandbox under the selected provider account:

- Product name: `pageCast Cast Pass`
- Price type: recurring
- Billing period: monthly
- Currency: `USD`
- Amount: `900` minor units, shown as USD 9.00/month
- Lookup key: `pagecast_cast_pass_monthly`
- PayGate plan key: `cast_pass_monthly`
- Registry status today: `draft`

This is the safe first PayGate checkout slice because it maps to app-wide entitlements:

- `pagecast.cast_pass`
- `pagecast.premium_casts`

### Product 2 - pageCast Single Cast Unlock

Do not activate this for PayGate E2E yet.

Current registry placeholder:

- Product name: `pageCast Single Cast Unlock`
- Price type: one-time
- Currency: `USD`
- Amount: `399` minor units, shown as USD 3.99
- Lookup key: `pagecast_single_cast_unlock`
- PayGate plan key: `single_cast_unlock`
- Registry status today: `draft`

Reason for hold: pageCast per-book checkout needs a verified `book_id` entitlement. Current PayGate checkout is plan-level only. Activating this now would risk granting broad or ambiguous access.

## Stripe Dashboard Steps

1. Open Stripe dashboard in test/sandbox mode for the selected company account.
2. Go to Product catalog.
3. Create product `pageCast Cast Pass`.
4. Add recurring monthly price:
   - USD 9.00
   - lookup key `pagecast_cast_pass_monthly`
5. Do not create or activate per-book lookup keys unless operator explicitly approves the future item/SKU contract work.
6. Record evidence:
   - product name
   - lookup key
   - amount/currency
   - recurring interval
   - Stripe account ID

## PayGate Registry Activation After Stripe Setup

After the Stripe sandbox lookup key exists:

- update `registry/apps/pagecast/plans.yaml` and set `cast_pass_monthly` to `active`;
- keep `single_cast_unlock` as `draft`;
- run `npm run validate:registry`;
- run `npm run check`;
- deploy PayGate;
- confirm `/admin` shows pageCast and the Cast Pass plan.

## PayGate Auth Prep

pageCast uses Supabase project:

`zdlbcvscytujdomxzwei`

Potential PayGate Vercel settings for pageCast JWT verification:

```ini
SUPABASE_JWKS_URL=https://zdlbcvscytujdomxzwei.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_APP_ID=pagecast
SUPABASE_JWT_ISSUER=https://zdlbcvscytujdomxzwei.supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated
```

Important: current PayGate Supabase JWT config appears single-app oriented. Before AIntern and pageCast both use browser Supabase JWTs concurrently in the same PayGate deployment, implement or confirm multi-app JWT issuer/JWKS routing.

## pageCast App Integration Prep

Do not modify pageCast yet because its working tree already has existing uncommitted changes.

When ready, the safe app-code slice is:

- add a thin PayGate client in reader app;
- add a server-side checkout proxy route if needed;
- wire Cast Pass button on `/pricing` to PayGate `plan_key=cast_pass_monthly`;
- keep per-book unlock on direct Stripe disabled or unchanged behind a migration decision until PayGate item/SKU support exists;
- never grant access from `?billing=success` redirect alone;
- read PayGate entitlement state before unlocking Cast Pass benefits.

## Track 4 Checklist

- [x] Confirm pageCast pricing page model and price ranges.
- [x] Confirm PayGate requires fixed registry prices, not ranges.
- [x] Select draft provider account alias: `nhl_global_solution`.
- [x] Prepare Stripe sandbox product/price instructions for `pagecast_cast_pass_monthly`.
- [x] Keep `single_cast_unlock` blocked pending item/SKU contract.
- [ ] Operator creates Stripe sandbox Product/Price for `pagecast_cast_pass_monthly`.
- [ ] Operator confirms final Cast Pass launch price.
- [ ] PayGate registry marks `cast_pass_monthly` active after lookup key exists.
- [ ] PayGate auth config supports pageCast Supabase JWTs.
- [ ] PayGate deployment/admin confirms pageCast catalog visibility.

## Safety Boundary

No Stripe object was created by this documentation update. No Vercel environment variable was changed. No pageCast app file was edited. No checkout was run. No entitlement was granted.