# Phase 7 pageCast PayGate Onboarding

Date: 2026-09-10
Status: draft registry package created and validated.

## Candidate

- App name: pageCast
- App ID: `pagecast`
- Repository: `C:\Users\user\Documents\00 StoryBook\pageCast`
- Reader app: `apps/reader-app`
- Creator app: `apps/creator-studio`
- Test/live reader URL currently known from pageCast checklist: `https://pagecast-nine.vercel.app`
- Studio URL currently known from pageCast checklist: `https://pagecast-studio.vercel.app`
- Auth provider: Supabase
- Supabase project ID from pageCast checklist: `zdlbcvscytujdomxzwei`
- User reference: Supabase user UUID
- Provider account alias selected for draft: `nhl_global_solution`

## Current Payment Discovery

pageCast currently has direct Stripe routes inside the reader app:

- `apps/reader-app/src/app/api/stripe/checkout/route.ts`
- `apps/reader-app/src/app/api/stripe/webhook/route.ts`

The current checkout route reads `book.price` from Supabase and creates a Stripe Checkout Session directly. This is not compatible with PayGate's authority rules because apps must not control amount, currency, provider lookup/price, provider account, webhook processing, or entitlement grants.

## Architecture Decision

The first safe PayGate setup for pageCast is app-wide Cast Pass billing, not per-book checkout.

Reason:

- Current PayGate contract accepts `app_id`, `user_ref`, `plan_key`, `return_context`, and `environment`.
- Current pageCast per-book purchase needs item-specific `book_id` proof.
- PayGate does not yet have an item/SKU purchase contract that can safely bind a provider event to a specific book entitlement.

Therefore:

- `cast_pass_monthly` can proceed as draft subscription plan.
- `single_cast_unlock` is recorded as draft placeholder only and must not be activated until PayGate supports item-specific checkout evidence.

## Registry Package Created

Created folder:

`registry/apps/pagecast/`

Files:

- `app.yaml`
- `plans.yaml`
- `entitlements.yaml`
- `integration.yaml`
- `files.manifest.yaml`
- `env.example`
- `integration-status.md`

## Draft Plans

| Plan key | Type | Amount | Status | Notes |
| --- | --- | ---: | --- | --- |
| `cast_pass_monthly` | subscription | USD 19.00/month | draft | Safe first PayGate integration slice. |
| `single_cast_unlock` | one-time | USD 3.99 | draft | Placeholder only; blocked until item-specific PayGate contract exists. |

## Draft Entitlements

- `pagecast.cast_pass`
- `pagecast.premium_casts`
- `pagecast.single_cast_unlock`

## Required PayGate Environment Setup Later

PayGate must verify pageCast Supabase JWTs server-side before browser-origin checkout is allowed:

```ini
SUPABASE_JWT_APPS=pagecast
SUPABASE_JWT_PAGECAST_JWKS_URL=https://zdlbcvscytujdomxzwei.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_PAGECAST_ISSUER=https://zdlbcvscytujdomxzwei.supabase.co/auth/v1
SUPABASE_JWT_PAGECAST_AUDIENCE=authenticated
```

PayGate now supports multi-app Supabase JWT config, so pageCast can be added without replacing the existing AIntern JWT settings.

## Required Stripe Sandbox Setup Later

In the selected Stripe sandbox account, create a Product/Price for:

- Product: pageCast Cast Pass
- Price lookup key: `pagecast_cast_pass_monthly`
- Price: USD 19.00/month
- Mode: subscription

Do not activate `single_cast_unlock` for production proof until item-specific PayGate support exists.

## Required pageCast App Changes Later

The pageCast reader app must stop using direct Stripe as the primary path and use PayGate instead:

- create thin PayGate client;
- create server proxy routes if needed for checkout and portal;
- replace `/api/stripe/checkout` usage in book/pricing UI for Cast Pass;
- keep direct per-book checkout disabled or behind a migration flag until PayGate item checkout exists;
- read PayGate entitlements for Cast Pass access;
- never grant access from browser redirects.

## Validation

`npm run validate:registry` passed after adding pageCast:

- Registry validation passed for 3 application package(s).

## Open Decisions

- [ ] Confirm provider account alias: keep `nhl_global_solution` or create a pageCast-specific company alias.
- [ ] Confirm Cast Pass price: currently draft USD 19.00/month.
- [ ] Confirm whether live URL should remain `https://pagecast-nine.vercel.app` or move to a custom domain.
- [ ] Confirm whether pageCast per-book checkout should wait for PayGate item/SKU contract.
- [ ] Confirm support/refund owner.

## Safety Boundary

No pageCast application code was changed in this step. No Stripe Product/Price was created. No Vercel environment variable was changed. No checkout was run. No entitlement mutation was performed.