# Phase 6 Track 2 - Preflight Verification

Status: complete; preflight passed for the approved controlled live pilot.
Date: 2026-09-07; updated with operator evidence on 2026-09-08.

This document records the Phase 6 preflight evidence before any live checkout, real payment, live refund, or live reconciliation is attempted.

## Approved Live Pilot Scope

| Field | Value |
| --- | --- |
| PayGate URL | `https://pay-gate-beta.vercel.app` |
| Local repository commit checked | `166ff94` |
| App ID | `aintern` |
| App live URL from registry | `https://a-intern.vercel.app` |
| Provider account alias | `nhl_global_solution` |
| Stripe account ID | `acct_1U4N5nDzGAfRwUx9` |
| Environment | `live` |
| Plan key | `pass_3m` |
| Amount | `MYR 39.00` |
| Checkout mode | `payment` / one-time |
| Stripe lookup key | `aintern_pass_3m` |
| user_ref | `b292ecfa-46c2-4d6c-bfef-8c32cd8c7bf7` |
| Customer email | `effort.edutech@gmail.com` |
| Refund scope | `full` |
| Support / rollback owner | `NHL Global Solution operator` |
| Evidence location | `C:\Users\user\Documents\PayGate Phase 6 Evidence` |
| Live test window | `2026-09-07 21:00-22:00 MYT` |

## Checks Completed by Codex

| Check | Result | Evidence |
| --- | --- | --- |
| Local worktree clean before preflight | Pass | `git status --short` returned no changes. |
| Local commit identified | Pass | `166ff94 Complete Phase 6 approval draft scope`. |
| Registry app mapping reviewed | Pass | AIntern maps to `stripe:nhl_global_solution`. |
| Registry live URL reviewed | Pass | `https://a-intern.vercel.app`. |
| Registry plan reviewed | Pass | `pass_3m`, MYR 39.00, one-time, lookup key `aintern_pass_3m`. |
| PayGate public health | Pass | `https://pay-gate-beta.vercel.app/health` returned `status=ok`, `runtime=vercel`. |
| Diagnostics anonymous protection | Pass | `https://pay-gate-beta.vercel.app/diagnostics/ready` returned HTTP 401 without token. |
| Admin anonymous protection | Pass | `https://pay-gate-beta.vercel.app/admin/summary` returned HTTP 401 without token. |
| Monitoring anonymous protection | Pass | `https://pay-gate-beta.vercel.app/admin/monitoring?app_id=aintern` returned HTTP 401 without token. |


## Operator Evidence Received on 2026-09-08

| Check | Result | Evidence / note |
| --- | --- | --- |
| Vercel production deployment commit | Pass | Production deployments showed `7339a33` and `166ff94`; both are at or newer than the approved baseline `166ff94`. |
| Protected diagnostics with valid token | Pass | `/diagnostics/ready` returned `ready_diagnostics_ok`. |
| Admin summary with valid token | Pass | Admin summary showed `aintern` mapped to provider account `nhl_global_solution`. |
| Monitoring with valid token | Conditional pass | Monitoring returned `attention_required` with warning alerts for historical reconciliation runs: `RECONCILIATION_NO_PROVIDER_CUSTOMER` and `RECONCILIATION_NO_PROVIDER_SUBSCRIPTION`. No critical alert was reported in the pasted evidence. |
| Stripe live Product/Price | Pass by operator confirmation | Operator confirmed live `aintern_pass_3m` price at MYR 39.00. |
| Stripe live webhook endpoint | Pass by operator confirmation | Operator confirmed the live webhook endpoint exists. |
| Database backup/rollback | Conditional pass | Manual rollback plan accepted for this single-user low-value pilot. |
| Evidence folder | Pass | `C:\Users\user\Documents\PayGate Phase 6 Evidence` created and `Test-Path` returned `True`. |
| Vercel live Stripe environment variables | Pass | `/diagnostics/runtime` showed `STRIPE_LIVE_ACCOUNTS`, `STRIPE_LIVE_ACCOUNT_ALIAS:nhl_global_solution`, `STRIPE_LIVE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY`, and `STRIPE_LIVE_ACCOUNT_NHL_GLOBAL_SOLUTION_WEBHOOK_SECRET` as `ok=True` without exposing secret values. |
## Checks Still Required Before Live Execution

These checks require operator access to Vercel, Stripe, or the operator token. They must be completed before any live checkout is created.

| Check | Required action | Where to verify |
| --- | --- | --- |
| Deployed commit SHA matches approved commit | Complete. Current evidence shows production deployment at approved baseline or newer. | Vercel PayGate project -> Deployments -> current Production deployment -> Source commit. |
| Protected diagnostics with valid token | Complete. Operator evidence returned `ready_diagnostics_ok`. | PowerShell with `Authorization: Bearer <OPERATOR_TOKEN>`, or browser/admin tool if supported. |
| Admin summary with valid token | Complete. Operator evidence showed `aintern` and `nhl_global_solution`. | PayGate admin console or API with operator token. |
| Monitoring with valid token | Conditional complete. No critical alert reported; historical reconciliation warnings must be accepted or cleared before live checkout. | `/admin/monitoring?app_id=aintern` with operator token. |
| Live provider env vars exist | Complete. Live-only env vars are present and diagnostic checks pass. | Vercel Project Settings -> Environment Variables. |
| Live Stripe Product and Price exist | Complete by operator confirmation: `aintern_pass_3m`, MYR 39.00. | Stripe Dashboard in live mode -> Product catalog -> AIntern 3-Month Pass -> Price. |
| Live webhook endpoint exists | Complete by operator confirmation. Must be rechecked after live webhook env var is added. | Stripe Dashboard in live mode -> Developers -> Webhooks. |
| Live webhook secret stored server-side | Complete. Diagnostic prefix check passed without exposing the value. | Vercel env vars; do not paste value into docs/chat. |
| Live secret key stored server-side | Complete. Diagnostic prefix check passed without exposing the value. | Vercel env vars; do not paste value into docs/chat. |
| Database backup/restore readiness | Conditional complete. Manual rollback accepted for single-user pilot. | Supabase PayGate project -> Database backups/settings. |
| Evidence folder exists | Complete. Folder created and verified. | Local Windows Explorer or PowerShell. |

## PowerShell Commands for Operator-Side Preflight

Use these only after setting the operator token in the current PowerShell session. Do not paste the token into chat.

```powershell
$operatorToken = "PASTE_OPERATOR_TOKEN_HERE"
$headers = @{ Authorization = "Bearer $operatorToken" }

Invoke-RestMethod -Uri "https://pay-gate-beta.vercel.app/diagnostics/ready" -Headers $headers
Invoke-RestMethod -Uri "https://pay-gate-beta.vercel.app/admin/summary" -Headers $headers
Invoke-RestMethod -Uri "https://pay-gate-beta.vercel.app/admin/monitoring?app_id=aintern" -Headers $headers
```

Expected result:

- diagnostics returns `status: ready`;
- admin summary lists AIntern and provider alias `nhl_global_solution` without secrets;
- monitoring has no critical alerts before live checkout.

## Phase 6 Track 2 Decision

Current decision: not ready for live execution yet.

Reason: Codex verified public/protection/registry checks, but operator-side checks requiring Vercel, Stripe live dashboard, and operator token remain pending.

## Stop Rule

Proceed to Phase 6 Track 3 only within the approved scope: one live checkout for AIntern `pass_3m`, MYR 39.00, user `b292ecfa-46c2-4d6c-bfef-8c32cd8c7bf7`, full refund scope, during the approved window. Stop if any detail differs.

## 2026-09-10 account correction

The operator confirmed Stripe dashboard test mode, sandbox, and live mode all show NHL Global Solution as account `acct_1U4N5nDzGAfRwUx9`. Any earlier reference to `acct_1U4N6cRgCMXjT1y6` is superseded historical evidence and should not be used as the active PayGate provider account record.
