# Phase 7 Track 4C - pageCast Supabase JWT Auth Boundary Evidence

Date: 2026-09-11
Status: verified on deployed PayGate.

## Purpose

Verify that PayGate can authenticate pageCast users with the pageCast Supabase JWT boundary without breaking the existing AIntern JWT boundary.

## Deployment Evidence

Operator ran protected diagnostics against:

`https://pay-gate-beta.vercel.app`

### `/diagnostics/ready`

Result: pass.

Key evidence:

- `DATABASE_CONNECT`: `ok: true`
- `RUNTIME_CREATE`: `ok: true`
- `supabase_jwks`: `true`
- `supabase_jwt_apps`: `aintern`, `pagecast`
- Stripe sandbox account configured: `nhl_global_solution`
- Stripe live account configured: `nhl_global_solution`

### `/diagnostics/runtime`

Result: pass.

Key evidence:

- `SUPABASE_JWT_AUTH`: `ok: true`
- Mode: `multi_app`
- App configured: `pagecast`
- `SUPABASE_JWT_PAGECAST_JWKS_URL`: `ok: true`
- `SUPABASE_JWT_PAGECAST_ISSUER`: `ok: true`
- `SUPABASE_JWT_PAGECAST_AUDIENCE`: `ok: true`

Runtime diagnostics intentionally list app-specific configured env entries. Readiness diagnostics confirms the runtime creates authenticators for both `aintern` and `pagecast`.

## Vercel Env Vars Verified

```ini
SUPABASE_JWT_APPS=pagecast
SUPABASE_JWT_PAGECAST_JWKS_URL=https://zdlbcvscytujdomxzwei.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_PAGECAST_ISSUER=https://zdlbcvscytujdomxzwei.supabase.co/auth/v1
SUPABASE_JWT_PAGECAST_AUDIENCE=authenticated
```

Existing AIntern Supabase JWT env vars remain configured and were not removed.

## Boundary Decision

PayGate now supports multiple Supabase JWT boundaries in the same deployment:

- AIntern remains bound to AIntern Supabase JWT configuration.
- pageCast is bound to pageCast Supabase JWT configuration.
- Browser callers still cannot choose provider account, amount, currency, lookup key, customer ID, or entitlement keys.
- `user_ref` remains bound to the JWT subject by PayGate app auth.

## Track 4C Checklist

- [x] Multi-app Supabase JWT config implemented.
- [x] AIntern and pageCast side-by-side JWT auth covered by automated tests.
- [x] PayGate deployment has pageCast Supabase JWT env vars.
- [x] Protected `/diagnostics/ready` confirms runtime includes `aintern` and `pagecast`.
- [x] Protected `/diagnostics/runtime` confirms pageCast JWT env vars are valid.
- [x] Track 4C auth boundary verified.

## Remaining Work

Proceed to Phase 7 Track 4D: wire pageCast thin PayGate client for Cast Pass checkout.