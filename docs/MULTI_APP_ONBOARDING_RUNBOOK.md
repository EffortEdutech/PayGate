# Multi-App Onboarding Runbook

**Purpose:** onboard each new application to the Central Payment Hub without weakening provider isolation, app boundaries, or entitlement authority.

This runbook applies after AIntern. App #2 must follow this checklist before it can create checkout sessions through PayGate.

## Architecture Rule

Every application integrates like this:

```text
Application -> Payment Hub -> registry-selected provider account -> payment provider
```

Never like this:

```text
Application -> Stripe SDK / provider dashboard values / hardcoded price IDs
```

Applications submit only:

- `app_id`
- `user_ref`
- `plan_key`
- `return_context`
- `environment`

Applications must never submit authoritative amount, currency, provider price ID, provider customer ID, provider subscription ID, provider account, or entitlement grants.

## Stage 0 - Operator Intake

Collect these facts before touching code:

- [ ] App name.
- [ ] Stable `app_id`, lowercase snake case, for example `workledger`.
- [ ] Owning company/legal billing entity.
- [ ] Provider account alias, for example `bina_jaya` or `nhl_global_solution`.
- [ ] Test app URL.
- [ ] Live app URL, even if live launch is deferred.
- [ ] Auth provider and JWT strategy.
- [ ] Stable user id value to use as `user_ref`.
- [ ] First paid plan names and prices.
- [ ] Required paid entitlement keys.
- [ ] Support email/refund policy owner.

Decision gate:

- [ ] Operator confirms which company/provider account receives the money.
- [ ] Operator confirms the app must use PayGate and must not integrate Stripe directly.

## Stage 1 - Registry Package

Create a new folder:

```text
registry/apps/<app_id>/
```

Required files:

```text
app.yaml
plans.yaml
integration.yaml
```

`app.yaml` must define:

- [ ] `app_id`
- [ ] display name
- [ ] provider type, initially `stripe`
- [ ] provider account alias
- [ ] test app URL
- [ ] live app URL

Example:

```yaml
app_id: workledger
name: WorkLedger
provider:
  type: stripe
  account: bina_jaya
application_urls:
  test: https://workledger-preview.example.com
  live: https://workledger.example.com
```

`plans.yaml` must define:

- [ ] `plan_key`
- [ ] display name
- [ ] plan type: `one_time` or subscription type accepted by the registry schema
- [ ] integer minor-unit amount, for example `3900`, never `39.00`
- [ ] uppercase ISO currency, for example `MYR`
- [ ] provider lookup key, never a provider price ID
- [ ] entitlement bundle
- [ ] status: draft first, then active only after provider price exists

`integration.yaml` must define:

- [ ] allowed return contexts only
- [ ] success path
- [ ] cancel path
- [ ] portal path

Return URLs must be derived from registry allowlists. The app must not send arbitrary redirect URLs.

Validation gate:

```powershell
npm run validate:registry
```

- [ ] Registry validation passes.
- [ ] Reviewer confirms no provider secret is present in registry files.
- [ ] Reviewer confirms no Stripe Price ID is used where lookup key is required.

## Stage 2 - Provider Account Setup

For each company/provider account, create or verify server-side environment variables in PayGate Vercel:

```ini
STRIPE_ACCOUNTS=<existing_alias>,<new_provider_alias>
STRIPE_ACCOUNT_<ALIAS>_SECRET_KEY=<Stripe test secret key>
STRIPE_ACCOUNT_<ALIAS>_WEBHOOK_SECRET=<Stripe test webhook signing secret>
```

Rules:

- [ ] Alias must be company-scoped, not generic `primary`.
- [ ] Sandbox/test secret keys must start with `sk_test_`.
- [ ] Webhook secrets must start with `whsec_`.
- [ ] Never commit secrets.
- [ ] Never paste secrets into app repositories.
- [ ] Test and live credentials must stay separate.

Provider isolation gate:

- [ ] Confirm app registry provider account equals the intended company account.
- [ ] Confirm no other app was accidentally remapped.
- [ ] Run full checks after env/schema changes.

## Stage 3 - Stripe Sandbox Product and Price Setup

Inside the correct Stripe sandbox account:

- [ ] Create Product for the app or plan family.
- [ ] Create one Price per PayGate plan.
- [ ] Set lookup key matching the registry `provider.lookup_key`.
- [ ] Confirm currency and amount match registry exactly.
- [ ] Confirm one-time vs recurring mode matches registry exactly.
- [ ] Keep Stripe Price IDs out of the app.
- [ ] Keep Stripe Price IDs out of app-facing API calls.

Activation gate:

- [ ] Only mark registry plan `active` after Stripe lookup key exists.
- [ ] Run `npm run validate:registry`.
- [ ] Run `npm run check` before push.

## Stage 4 - App Authentication Setup

Preferred browser app strategy:

- [ ] App sends its own authenticated user JWT to PayGate.
- [ ] PayGate verifies the app user token server-side.
- [ ] PayGate binds JWT subject to `user_ref`.
- [ ] Browser does not receive static PayGate app tokens.

For Supabase apps:

```ini
SUPABASE_JWKS_URL=<app Supabase JWKS URL>
SUPABASE_JWT_APP_ID=<app_id>
SUPABASE_JWT_ISSUER=<app Supabase issuer>
SUPABASE_JWT_AUDIENCE=authenticated
```

If the new app uses a different auth provider, define a new server-side authenticator before production-style proof.

Auth gate:

- [ ] Authenticated app cannot claim another `app_id`.
- [ ] Authenticated user cannot claim another `user_ref`.
- [ ] Tests cover the chosen auth path.

## Stage 5 - Thin App Client

The app client may call only PayGate APIs:

- [ ] `GET /v1/catalog`
- [ ] `POST /v1/checkout/sessions`
- [ ] `POST /v1/billing/portal-sessions`
- [ ] `GET /v1/subscriptions/current`
- [ ] `GET /v1/entitlements`

The app client must not:

- [ ] Import Stripe SDK.
- [ ] Know Stripe secret keys.
- [ ] Know webhook secrets.
- [ ] Send provider price IDs.
- [ ] Send arbitrary success/cancel URLs.
- [ ] Grant entitlements from browser redirects.

App environment variables should contain only public configuration, for example:

```ini
VITE_PAYMENT_HUB_BASE_URL=https://pay-gate-beta.vercel.app
VITE_PAYMENT_HUB_APP_ID=<app_id>
VITE_PAYMENT_HUB_ENVIRONMENT=test
```

Do not configure `VITE_PAYMENT_HUB_APP_TOKEN` for browser apps.

## Stage 6 - Sandbox End-to-End Proof

Proof sequence:

- [ ] Deploy PayGate green.
- [ ] Deploy app green.
- [ ] Confirm `GET /health` is public and healthy.
- [ ] Confirm protected diagnostics pass using operator token.
- [ ] Confirm admin console lists the app and plans.
- [ ] Create checkout from the app UI.
- [ ] Complete Stripe sandbox checkout.
- [ ] Confirm signed webhook is processed.
- [ ] Confirm app reads active Hub entitlement.
- [ ] Confirm portal session opens.
- [ ] Run reconciliation or inspect latest reconciliation state.
- [ ] Confirm admin console shows customer, checkout, webhook, entitlement, and reconciliation evidence.

Proof evidence to record:

- [ ] App URL.
- [ ] PayGate URL.
- [ ] App user ref.
- [ ] Plan key.
- [ ] Provider account alias.
- [ ] Checkout Session id.
- [ ] Webhook event id.
- [ ] Subscription/entitlement state from PayGate.
- [ ] Reconciliation run id if run.

## Stage 7 - Pre-Live Hold

No live payment is authorized by onboarding alone.

Before any live payment:

- [ ] Phase 4 Track 5 live-mode readiness must be complete.
- [ ] Phase 4 Track 6 monitoring/alerting baseline must be complete.
- [ ] Phase 4 Track 7 provider account isolation tests must pass.
- [ ] Operator must explicitly approve the live payment/refund test window.

## Dry-Run Checklist Before Checkout Is Enabled

The first checkout session for a new app is allowed only when all are true:

- [ ] Registry package exists and validates.
- [ ] Provider account alias is company-scoped and confirmed by operator.
- [ ] Stripe sandbox Product/Price lookup keys exist.
- [ ] Plans are active only after lookup keys exist.
- [ ] App auth path is verified.
- [ ] App client has no Stripe SDK dependency.
- [ ] Browser-visible PayGate static token is absent.
- [ ] Return contexts are allowlisted in registry.
- [ ] PayGate deployed health/ready/admin checks pass.
- [ ] Operator can see the app in `/admin`.
- [ ] Reviewer confirms no secrets are committed.

## App #2 Candidate Template

Use this block when choosing the next app:

```text
App name:
App id:
Owning company:
Provider account alias:
Test URL:
Live URL:
Auth provider:
User ref source:
Plans:
Entitlements:
Return contexts:
Operator approval:
```