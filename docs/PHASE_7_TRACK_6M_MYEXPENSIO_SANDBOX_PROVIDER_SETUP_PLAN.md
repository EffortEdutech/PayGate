# Phase 7 Track 6M - MyExpensio Sandbox Provider Setup Plan

Status: complete.

Purpose: define the sandbox-only setup path that lets MyExpensio use PayGate for the first controlled Pro monthly checkout without mutating Stripe, Vercel, live payment, refund, or MyExpensio application code in this track.

## Scope locked for Track 6M

Track 6M is a plan and readiness package only. It prepares the next operator/app work and confirms the exact boundary values PayGate will need.

Included:

- MyExpensio Pro monthly sandbox setup plan.
- Stripe sandbox Product/Price checklist.
- PayGate Vercel environment variable checklist for MyExpensio Supabase JWT auth.
- MyExpensio thin-client migration outline.
- Verification checklist for the later sandbox E2E proof.

Excluded:

- No Stripe Product/Price creation from this repository.
- No Vercel environment variable mutation.
- No deployment.
- No MyExpensio repository mutation.
- No live payment.
- No refund.
- No entitlement grant.
- No Premium or ORG/workspace subscription activation.

## Current applied registry baseline

The MyExpensio draft registry package now exists at `registry/apps/myexpensio`.

App:

```yaml
app_id: myexpensio
name: MyExpensio
status: draft
provider:
  type: stripe
  account: nhl_global_solution
application_urls:
  test: https://myexpensio-jade.vercel.app
  live: https://myexpensio-jade.vercel.app
identity:
  user_reference: supabase_user_id
```

First PayGate plan slice:

```yaml
plan_key: pro_monthly
name: MyExpensio Pro Monthly
type: subscription
pricing:
  currency: MYR
  unit_amount_minor: 1800
  interval: month
provider:
  stripe:
    lookup_key: myexpensio_pro_monthly
entitlement_bundle:
  - myexpensio.exports
status: draft
```

Confirmed pricing policy:

- Pro = MYR 18/month.
- Premium = MYR 29/month.
- Track 6M prepares Pro only.
- Premium remains deferred until Pro sandbox proof passes.

## Stripe sandbox setup checklist

The operator should use the Stripe account currently represented in PayGate as provider account alias `nhl_global_solution`.

Create or confirm this sandbox/test Product and Price in Stripe Dashboard:

| Field | Required value |
| --- | --- |
| Product name | `MyExpensio Pro Monthly` or equivalent operator-friendly name |
| Price type | Recurring subscription |
| Billing interval | Monthly |
| Amount | MYR 18.00 |
| Currency | MYR |
| Lookup key | `myexpensio_pro_monthly` |
| Environment | Stripe sandbox/test only |

Operator evidence to capture later:

- Stripe account ID visible in Dashboard.
- Price ID beginning with `price_`.
- Lookup key screenshot/text showing `myexpensio_pro_monthly`.
- Product/Price mode is test/sandbox, not live.

Do not paste Stripe secret keys into docs, chat, registry files, or MyExpensio source.

## PayGate Vercel environment checklist

PayGate already has the shared provider account alias `nhl_global_solution`. For MyExpensio auth, PayGate needs app-specific Supabase JWT routing added to its existing multi-app auth configuration.

Observed non-secret MyExpensio Supabase project URL from the MyExpensio repo:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://bzpmrcfxkawkuhyocemu.supabase.co
```

Required PayGate Vercel variables for MyExpensio:

```ini
SUPABASE_JWT_APPS=pagecast,myexpensio
SUPABASE_JWT_MYEXPENSIO_JWKS_URL=https://bzpmrcfxkawkuhyocemu.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_MYEXPENSIO_ISSUER=https://bzpmrcfxkawkuhyocemu.supabase.co/auth/v1
SUPABASE_JWT_MYEXPENSIO_AUDIENCE=authenticated
```

If `SUPABASE_JWT_APPS` already includes other apps, preserve them and append `myexpensio`; do not replace the list with only MyExpensio.

PayGate provider variables expected to already exist for sandbox/test:

```ini
STRIPE_ACCOUNTS=nhl_global_solution
STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY=<server-side sandbox/test secret key only>
STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_WEBHOOK_SECRET=<server-side sandbox/test webhook secret only>
```

Required webhook endpoint for sandbox/test events:

```text
https://pay-gate-beta.vercel.app/v1/webhooks/stripe/nhl_global_solution/test
```

PayGate must continue to receive signed POST webhooks. A browser GET to the webhook route is not proof of webhook delivery.

## MyExpensio migration plan

Current MyExpensio state found during inspection:

- `apps/user/app/api/billing/checkout/route.ts` creates Stripe Checkout directly.
- `apps/user/app/api/billing/webhook/route.ts` processes Stripe webhooks directly.
- Direct MyExpensio env names include `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PREMIUM`, and `STRIPE_WEBHOOK_SECRET`.

Target PayGate direction:

- MyExpensio should stop creating Stripe Checkout directly for the first Pro slice.
- MyExpensio should call PayGate checkout with:
  - `app_id: myexpensio`
  - `user_ref: <Supabase user id / JWT subject>`
  - `plan_key: pro_monthly`
  - `environment: test`
  - `return_context: billing`
- PayGate resolves amount, currency, provider account, lookup key, Stripe price, return URL, customer, subscription, webhook evidence, and entitlement projection.
- MyExpensio should read PayGate state/entitlements instead of trusting browser redirects.

Thin-client implementation should be a later track and should start with the web app only, preferably behind a feature flag or route-local gate.

## Deferred scope

The following are intentionally not part of Track 6M:

- `premium_monthly` registry activation.
- ORG/workspace subscriptions.
- Billing portal migration.
- Live payment.
- Refund automation.
- Direct mutation of MyExpensio `subscriptions` table from browser redirects.
- Removing legacy MyExpensio Stripe routes before PayGate sandbox proof succeeds.

## Track 6M checklist

- [x] Confirm PayGate registry has MyExpensio draft app package.
- [x] Confirm first slice is `pro_monthly` at MYR 18/month.
- [x] Define Stripe sandbox Product/Price requirements.
- [x] Define required lookup key: `myexpensio_pro_monthly`.
- [x] Confirm PayGate provider account alias remains `nhl_global_solution`.
- [x] Identify MyExpensio Supabase JWT boundary values from non-secret repo configuration.
- [x] Define required PayGate Vercel env vars for MyExpensio JWT auth.
- [x] Document current direct Stripe routes in MyExpensio and target PayGate migration path.
- [x] Keep Premium, ORG/workspace subscriptions, live payment, refunds, deployments, and provider mutations outside this track.

## Next documented step

Proceed to Phase 7 Track 6N - MyExpensio Sandbox Provider Configuration Evidence.

Track 6N should guide the operator through confirming or creating the Stripe sandbox Price lookup key `myexpensio_pro_monthly`, adding the MyExpensio Supabase JWT env vars to PayGate Vercel, redeploying PayGate if needed, and proving `/diagnostics/ready` plus `/diagnostics/runtime` show MyExpensio auth readiness. It should still avoid MyExpensio app code changes until the provider/auth boundary is green.
