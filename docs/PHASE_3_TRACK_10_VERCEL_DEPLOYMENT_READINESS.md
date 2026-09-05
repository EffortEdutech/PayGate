# Phase 3 Track 10 — Vercel Deployment Readiness

Status: in progress, deployment-prepared, external web secrets pending.

## Deployment decision

- Payment Hub is deployed as one standalone Vercel project from `C:\Users\user\Documents\00 Payment Gateway`.
- AIntern remains a separate app project. It calls the Hub over HTTPS and never imports Stripe or controls amounts, currencies, price IDs, customer IDs, or entitlements.
- Recommended production domain: `payments.effortedutech.com`.
- Preview/sandbox proof can use the generated Vercel deployment URL until DNS is attached.
- Intended PayGate Supabase project URL: `https://apcqqyqpqyxbqlbqshog.supabase.co`. Use its Postgres connection string for `DATABASE_URL`; the public project URL alone is not enough for persistence.

## Vercel project structure

- Root package: Central Payment Hub.
- Serverless entrypoint: `api/index.ts`.
- Route mapping: all paths route to the Payment Hub handler through `vercel.json`.
- Runtime persistence: PostgreSQL via `DATABASE_URL`.
- Local development still uses the 301# port family; web deployment does not use local Docker Postgres.

## Required Vercel environment variables

Set these in the Vercel Payment Hub project. Do not commit values.

| Variable | Environment | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Production/Preview | `production` for deployed runtime. |
| `DATABASE_URL` | Production/Preview | Web-accessible PostgreSQL URL, not localhost. |
| `APP_AUTH_ISSUER` | Production/Preview | Hub issuer label. |
| `APP_AUTH_AUDIENCE` | Production/Preview | Hub audience label. |
| `APP_AUTH_TOKENS` | Preview only if needed | Static operator/local fallback tokens. Avoid browser use. |
| `SUPABASE_JWKS_URL` | Production/Preview | Supabase public JWKS discovery URL used to verify AIntern ES256 user JWTs. |
| `SUPABASE_JWT_APP_ID` | Production/Preview | `aintern`. |
| `SUPABASE_JWT_ISSUER` | Production/Preview | `https://wdhdjhvvngssnszqgiyk.supabase.co/auth/v1`. |
| `SUPABASE_JWT_AUDIENCE` | Production/Preview | Usually `authenticated`. |
| `PAYMENT_HUB_CORS_ALLOW_ORIGIN` | Production/Preview | AIntern deployed origin. Use preview origin for preview proof. |
| `STRIPE_ACCOUNTS` | Production/Preview | `effort_edutech` for AIntern sandbox proof. |
| `STRIPE_ACCOUNT_EFFORT_EDUTECH_SECRET_KEY` | Preview sandbox | Stripe test secret key for the Effort Edutech account. |
| `STRIPE_ACCOUNT_EFFORT_EDUTECH_WEBHOOK_SECRET` | Preview sandbox | Stripe webhook signing secret for the deployed endpoint. |
| `STRIPE_API_VERSION` | Production/Preview | Stripe API version used for adapter calls. |

## Stripe sandbox webhook endpoint

Configure this endpoint in Stripe test mode for the Effort Edutech Stripe account:

`https://<payment-hub-domain>/v1/webhooks/stripe/effort_edutech/test`

The webhook secret from this endpoint must be stored only in Vercel as `STRIPE_ACCOUNT_EFFORT_EDUTECH_WEBHOOK_SECRET`.

## Gate closure checklist

- [x] Vercel project structure chosen.
- [x] Vercel serverless entrypoint prepared.
- [x] Payment Hub deployed runtime uses PostgreSQL persistence.
- [x] Named provider account isolation exists in registry/config/router.
- [x] AIntern browser client no longer requires a browser-visible app token when a Supabase session exists.
- [x] AIntern user JWT is verified server-side by Payment Hub and bound to `user_ref`; modern Supabase ES256/JWKS keys are supported.
- [ ] Production domain confirmed by operator.
- [ ] Web-accessible PostgreSQL `DATABASE_URL` configured in Vercel.
- [ ] Stripe Effort Edutech sandbox secrets configured in Vercel.
- [ ] Stripe test webhook endpoint created for deployed URL.
- [ ] Payment Hub deployed to Vercel.
- [ ] Deployed `/health` and `/ready` pass.
- [ ] Deployed AIntern checkout session created.
- [ ] Deployed Stripe checkout completed in test mode.
- [ ] Deployed webhook proof accepted for `stripe:effort_edutech`.
- [ ] Deployed entitlement projection proof passes.
- [ ] Deployed portal session proof passes.
- [ ] Deployed reconciliation proof passes.

## Proof sequence after deployment

1. Open deployed AIntern with `VITE_PAYMENT_HUB_BASE_URL=https://<payment-hub-domain>`.
2. Sign in to AIntern so the browser has a Supabase access token.
3. Create checkout for `pass_3m` or `pass_6m`.
4. Complete Stripe test checkout.
5. Confirm Stripe sends `checkout.session.completed` and subscription/invoice events to the deployed webhook endpoint.
6. Confirm Hub entitlement state for the same Supabase user id.
7. Create billing portal session for the same user.
8. Run reconciliation for the same user and confirm the Hub state remains stable/idempotent.