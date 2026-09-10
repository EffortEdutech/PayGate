# Phase 7 Track 4 - pageCast Provider Account and Stripe Setup Prep

Date: 2026-09-10
Status: sandbox Product/Price created; provider account alias confirmed.

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
- Amount: `1900` minor units, shown as USD 19.00/month
- Lookup key: `pagecast_cast_pass_monthly`
- PayGate plan key: `cast_pass_monthly`
- Registry status today: `active`

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
   - USD 19.00
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

## Operator Evidence Received

Date: 2026-09-10

The operator created a Stripe sandbox Product/Price:

- Product: `pageCast Cast Pass`
- Product status: active
- Price: USD 19.00/month
- Stripe Price ID: `price_1UE8vTDzGAfRwUx9N40687aK`
- Stripe dashboard account shown in evidence: `acct_1U4N5nDzGAfRwUx9`

Important boundary note: PayGate maps pageCast to provider alias `stripe:nhl_global_solution`. The operator confirmed on 2026-09-10 that test mode, sandbox, and live mode all show NHL Global Solution as Stripe account `acct_1U4N5nDzGAfRwUx9`. Earlier references to `acct_1U4N6cRgCMXjT1y6` are treated as superseded historical evidence, not the active provider account record.

## PayGate Auth Prep

pageCast uses Supabase project:

`zdlbcvscytujdomxzwei`

Potential PayGate Vercel settings for pageCast JWT verification:

```ini
SUPABASE_JWT_APPS=pagecast
SUPABASE_JWT_PAGECAST_JWKS_URL=https://zdlbcvscytujdomxzwei.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_PAGECAST_ISSUER=https://zdlbcvscytujdomxzwei.supabase.co/auth/v1
SUPABASE_JWT_PAGECAST_AUDIENCE=authenticated
```

PayGate now supports multi-app Supabase JWT issuer/JWKS routing. Keep the existing AIntern single-app env vars until migrated, and add pageCast using the `SUPABASE_JWT_APPS` app-specific env var set.

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
- [x] Operator creates Stripe sandbox Product/Price for `pagecast_cast_pass_monthly`.
- [x] Operator confirms final Cast Pass launch price: USD 19.00/month.
- [x] Operator confirms Stripe account ID/provider alias alignment for pageCast: `acct_1U4N5nDzGAfRwUx9`.
- [x] PayGate registry marks `cast_pass_monthly` active after lookup key exists.
- [x] PayGate auth config supports pageCast Supabase JWTs via multi-app JWT routing.
- [ ] PayGate deployment/admin confirms pageCast catalog visibility.

## Safety Boundary

No Stripe object was created by this documentation update. No Vercel environment variable was changed. No pageCast app file was edited. No checkout was run. No entitlement was granted.

## Phase 7 Track 4C evidence

pageCast Supabase JWT auth boundary was verified on deployed PayGate on 2026-09-11. See docs/PHASE_7_TRACK_4C_PAGECAST_SUPABASE_JWT_EVIDENCE.md.
