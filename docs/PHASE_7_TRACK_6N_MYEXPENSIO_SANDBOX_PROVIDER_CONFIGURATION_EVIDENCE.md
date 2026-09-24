# Phase 7 Track 6N - MyExpensio Sandbox Provider Configuration Evidence

Status: complete as a configuration evidence runbook and pre-code gate.

Purpose: define the exact operator evidence needed to prove MyExpensio sandbox provider configuration is ready before PayGate touches MyExpensio application code or runs a checkout proof.

Track 6N does not perform external provider mutation from this repository. It tells the operator exactly what to confirm, where to confirm it, what values must match, and what diagnostics must be captured after configuration.

## Scope boundary

Included in Track 6N:

- Stripe sandbox Product/Price evidence requirements.
- PayGate Vercel environment variable evidence requirements.
- PayGate protected diagnostics commands.
- Admin catalog evidence commands.
- Explicit pass/fail criteria before MyExpensio app-code work.

Excluded from Track 6N:

- No Stripe Product/Price creation by code.
- No Vercel env var mutation by code.
- No PayGate deployment by code.
- No MyExpensio app code changes.
- No checkout creation.
- No webhook proof.
- No entitlement projection.
- No live payment.
- No refund.

## Known target values

Registry app:

```text
app_id: myexpensio
provider: stripe:nhl_global_solution
environment: test only for this gate
```

First sandbox plan:

```text
plan_key: pro_monthly
mode: subscription
amount: MYR 18.00/month
amount_minor: 1800
lookup_key: myexpensio_pro_monthly
```

MyExpensio Supabase project boundary:

```ini
SUPABASE_JWT_MYEXPENSIO_JWKS_URL=https://bzpmrcfxkawkuhyocemu.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_MYEXPENSIO_ISSUER=https://bzpmrcfxkawkuhyocemu.supabase.co/auth/v1
SUPABASE_JWT_MYEXPENSIO_AUDIENCE=authenticated
```

Multi-app auth list requirement:

```ini
SUPABASE_JWT_APPS=pagecast,myexpensio
```

If the existing value already contains other app ids, preserve them and append `myexpensio`. Do not remove `pagecast` or future app ids.

## Operator evidence pack location

Recommended evidence folder:

```text
C:\Users\user\Documents\PayGate Proposal Reviews\myexpensio\2026-09-25\track-6n-provider-evidence\
```

Store screenshots or copied command output for:

- Stripe sandbox Product/Price lookup key.
- PayGate Vercel env var names, with secret values hidden.
- PayGate deployment timestamp/commit after env changes, if any.
- `/diagnostics/ready` output.
- `/diagnostics/runtime` output.
- `/admin/summary?app_id=myexpensio&environment=test` output.

## Stripe sandbox evidence checklist

In Stripe Dashboard, sandbox/test mode, confirm or create the Price:

| Field | Required evidence |
| --- | --- |
| Account | NHL Global Solution / PayGate provider alias `nhl_global_solution` |
| Mode | test/sandbox, not live |
| Product | MyExpensio Pro Monthly, or an equivalent clearly named product |
| Price | MYR 18.00/month recurring |
| Lookup key | `myexpensio_pro_monthly` |
| Price ID | starts with `price_` |
| Active | active/enabled for checkout |

Do not use `price_...` directly in the app registry or MyExpensio client. The registry owns the lookup key. PayGate resolves provider price authority server-side.

## Vercel env evidence checklist

In the PayGate Vercel project, Production environment unless an explicit Preview-only run is chosen, confirm these env var names exist:

```ini
SUPABASE_JWT_APPS=pagecast,myexpensio
SUPABASE_JWT_MYEXPENSIO_JWKS_URL=https://bzpmrcfxkawkuhyocemu.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_MYEXPENSIO_ISSUER=https://bzpmrcfxkawkuhyocemu.supabase.co/auth/v1
SUPABASE_JWT_MYEXPENSIO_AUDIENCE=authenticated
```

Also confirm existing provider env vars remain present without exposing values:

```ini
STRIPE_ACCOUNTS=nhl_global_solution
STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY=<present, hidden>
STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_WEBHOOK_SECRET=<present, hidden>
```

If env vars are changed, redeploy PayGate once before diagnostics.

## Protected diagnostics commands

Run from PowerShell after setting your PayGate operator token locally:

```powershell
$operatorToken = "<your PayGate operator token>"
$headers = @{ Authorization = "Bearer $operatorToken" }

Invoke-RestMethod `
  -Uri "https://pay-gate-beta.vercel.app/diagnostics/ready" `
  -Headers $headers | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Uri "https://pay-gate-beta.vercel.app/diagnostics/runtime" `
  -Headers $headers | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Uri "https://pay-gate-beta.vercel.app/admin/summary?app_id=myexpensio&environment=test" `
  -Headers $headers | ConvertTo-Json -Depth 10
```

Expected `/diagnostics/ready`:

- `status` is ready or ready diagnostics ok.
- database check is ok.
- runtime create check is ok.
- `stripe_accounts` includes `nhl_global_solution`.
- `supabase_jwt_apps` includes `myexpensio`.

Expected `/diagnostics/runtime`:

- `SUPABASE_JWT_AUTH` mode is multi_app.
- `apps` includes `myexpensio`.
- MyExpensio app checks are ok:
  - `SUPABASE_JWT_MYEXPENSIO_JWKS_URL`
  - `SUPABASE_JWT_MYEXPENSIO_ISSUER`
  - `SUPABASE_JWT_MYEXPENSIO_AUDIENCE`
- Stripe sandbox account config still passes prefix/presence checks for `nhl_global_solution`.
- No secret values are returned.

Expected `/admin/summary`:

- app list includes `myexpensio`.
- provider is `stripe:nhl_global_solution`.
- plan list includes `pro_monthly`.
- amount is MYR 18/month from registry.
- status remains draft until the controlled app-integration track explicitly changes it.

## Pass/fail gate

Track 6N is considered green only when:

- Stripe sandbox lookup key evidence exists for `myexpensio_pro_monthly`.
- PayGate diagnostics prove MyExpensio Supabase JWT routing is loaded.
- PayGate admin summary shows MyExpensio registry data.
- No live payment env, live checkout, refund, or MyExpensio code mutation occurred.

If any diagnostic is red, do not proceed to MyExpensio app wiring. Fix provider/env readiness first.

## What to do after this evidence is green

The next implementation track should be Phase 7 Track 6O - MyExpensio Thin PayGate Client Plan and Code Prep.

Track 6O should prepare the MyExpensio app migration away from its direct Stripe routes for the first Pro sandbox slice. It should remain behind a safe gate and should not delete existing direct Stripe code until PayGate sandbox checkout, webhook, entitlement state, portal, and reconciliation proof are accepted.

## Track 6N checklist

- [x] Define the Stripe sandbox evidence requirements for `myexpensio_pro_monthly`.
- [x] Define the PayGate Vercel env evidence requirements for MyExpensio JWT auth.
- [x] Define protected diagnostics commands and expected outputs.
- [x] Define admin summary evidence for the MyExpensio registry package.
- [x] Define pass/fail gate before MyExpensio app wiring.
- [x] Confirm no Stripe/Vercel/deployment/MyExpensio code mutation happens in this track.
