# Phase 3 Track 10 — Vercel Deployment Readiness

Status: frozen — deployed sandbox readiness and proof gates closed on 2026-09-06.

## Deployment decision

- Payment Hub is deployed as one standalone Vercel project from `C:\Users\user\Documents\00 Payment Gateway`.
- Production/sandbox URL used for proof: `https://pay-gate-beta.vercel.app`.
- AIntern remains a separate app project. It calls the Hub over HTTPS and never imports Stripe or controls amounts, currencies, price IDs, customer IDs, or entitlements.
- AIntern deployed URL used for proof: `https://a-intern.vercel.app`.
- Recommended future production domain: `payments.effortedutech.com` or another operator-confirmed custom domain.
- PayGate Supabase project URL: `https://apcqqyqpqyxbqlbqshog.supabase.co`.
- `DATABASE_URL` must use the Supabase pooler Postgres URL, not the public Supabase API URL and not the direct `db.<project>.supabase.co` host.

## Vercel project structure

- Root package: Central Payment Hub.
- Serverless entrypoint: `api/index.ts`.
- Static output folder: `public`.
- Route mapping: all paths route to the Payment Hub handler through `vercel.json`.
- Runtime persistence: PostgreSQL via `DATABASE_URL`.
- Registry YAML files are explicitly bundled into the Vercel function through `includeFiles`.
- Local development still uses the 301# port family; Vercel serverless runtime is allowed to use Vercel-managed ports.

## Runtime endpoints proven

- `GET /health` returns deployed liveness without requiring full runtime boot.
- `GET /diagnostics/runtime` safely checks env variable shape without revealing secrets.
- `GET /diagnostics/ready` safely checks PostgreSQL connectivity and runtime creation without revealing secrets.
- `GET /ready` returns `status: ready` after env vars, Supabase pooler, and migrations are configured.
- Browser `GET` to Stripe webhook route returns `METHOD_NOT_ALLOWED`; real Stripe webhooks must use signed `POST` requests.

## Required Vercel environment variables

Set these in the Vercel Payment Hub project. Do not commit values.

| Variable | Environment | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Production/Preview | `production` for deployed runtime. |
| `DATABASE_URL` | Production/Preview | Supabase pooler Postgres URL, e.g. `postgresql://postgres.<project-ref>:<password>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true`. |
| `APP_AUTH_ISSUER` | Production/Preview | `https://pay-gate-beta.vercel.app` for current sandbox deployment. |
| `APP_AUTH_AUDIENCE` | Production/Preview | `payment-hub`. |
| `APP_AUTH_TOKENS` | Temporary operator proof only | Used once for reconciliation proof. Remove after proof. Browser apps must not use it. |
| `SUPABASE_JWKS_URL` | Production/Preview | `https://wdhdjhvvngssnszqgiyk.supabase.co/auth/v1/.well-known/jwks.json`. |
| `SUPABASE_JWT_APP_ID` | Production/Preview | `aintern`. |
| `SUPABASE_JWT_ISSUER` | Production/Preview | `https://wdhdjhvvngssnszqgiyk.supabase.co/auth/v1`. |
| `SUPABASE_JWT_AUDIENCE` | Production/Preview | `authenticated`. |
| `PAYMENT_HUB_CORS_ALLOW_ORIGIN` | Production/Preview | `https://a-intern.vercel.app`. |
| `STRIPE_ACCOUNTS` | Production/Preview | `nhl_global_solution` for AIntern sandbox proof. |
| `STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY` | Preview sandbox | Stripe test secret key for the nhl.global.solution@gmail.com Stripe account. |
| `STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_WEBHOOK_SECRET` | Preview sandbox | Stripe webhook signing secret for the deployed endpoint. |
| `STRIPE_API_VERSION` | Production/Preview | `2026-07-29.dahlia`. |

## Stripe sandbox webhook endpoint

Configured in Stripe test mode for the NHL Global Solution Stripe account:

`https://pay-gate-beta.vercel.app/v1/webhooks/stripe/nhl_global_solution/test`

The webhook secret from this endpoint is stored only in Vercel as `STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_WEBHOOK_SECRET`.

## Gate closure checklist

- [x] Production/custom domain decision deferred; sandbox domain confirmed as `https://pay-gate-beta.vercel.app`.
- [x] Vercel project structure chosen.
- [x] Vercel serverless entrypoint prepared.
- [x] Vercel public output folder configured.
- [x] Registry files bundled for serverless runtime.
- [x] Payment Hub deployed runtime uses PostgreSQL persistence.
- [x] Web-accessible PostgreSQL `DATABASE_URL` configured in Vercel through Supabase pooler.
- [x] PayGate database migrations `0001`, `0002`, and `0003` applied to Supabase PostgreSQL.
- [x] Stripe NHL Global Solution sandbox secrets configured in Vercel.
- [x] Stripe test webhook endpoint created for deployed URL.
- [x] Named provider account isolation exists in registry/config/router.
- [x] Provider alias renamed to `nhl_global_solution`.
- [x] AIntern browser client no longer requires a browser-visible app token when a Supabase session exists.
- [x] AIntern user JWT is verified server-side by Payment Hub and bound to `user_ref`; modern Supabase ES256/JWKS keys are supported.
- [x] Payment Hub deployed to Vercel.
- [x] Deployed `/health` and `/ready` pass.
- [x] Deployed AIntern checkout session created.
- [x] Deployed Stripe checkout completed in test mode.
- [x] Deployed webhook proof accepted for `stripe:nhl_global_solution`.
- [x] Deployed entitlement projection proof passes; AIntern read `active / pass_3m` from Payment Hub.
- [x] Deployed portal session proof passes; Stripe Billing Portal returned to `https://a-intern.vercel.app/profile?billing=portal_return`.
- [x] Deployed reconciliation endpoint proof passes; run id `6305311e-37db-405c-821a-bc9657bee930` returned existing Hub subscription `active / pass_3m`.

## Proof results

- Runtime diagnostics: `ready_diagnostics_ok`.
- Ready endpoint: `status: ready`.
- Checkout return URL corrected from local `http://127.0.0.1:4900` to deployed `https://a-intern.vercel.app`.
- AIntern profile after checkout showed Payment Hub state `active · 3-month pass · 1 entitlement(s)`.
- Portal proof opened Stripe Billing Portal successfully for NHL Global Solution sandbox.
- Reconciliation proof endpoint returned:
  - `reconciliation_run_id`: `6305311e-37db-405c-821a-bc9657bee930`
  - `app_id`: `aintern`
  - `status`: `no_provider_subscription`
  - existing Hub subscription: `active / pass_3m`

## Post-freeze cleanup

- Remove the temporary Vercel `APP_AUTH_TOKENS` value used for operator reconciliation proof, then redeploy PayGate.
- Rotate the Stripe sandbox secret key if it was exposed outside Stripe/Vercel during setup.
- Keep `/diagnostics/runtime` and `/diagnostics/ready` for sandbox support only; before live launch, protect diagnostics behind operator auth or remove them.

## Follow-up candidate: deeper Stripe reconciliation inspection

The reconciliation endpoint worked, but Stripe lookup returned `no_provider_subscription` while PayGate's verified webhook projection already held `active / pass_3m`.

This is not a Track 10 blocker. It means the current reconciliation implementation asks Stripe for an active subscription by customer and does not yet inspect all related Stripe objects that may explain the mismatch. A future hardening pass can inspect Checkout Session, Customer, Subscription, Invoice, PaymentIntent, and price metadata together, then explain whether the provider state is truly missing, delayed, one-time/payment-mode, canceled, or simply stored under a different relationship.