# Phase 6 Live Pilot Approval Draft

Status: draft for operator completion; not approved for live execution until all placeholders are completed outside source control.
Created: 2026-09-07.

This draft pre-fills the information PayGate already knows. Do not add secret keys, webhook secrets, card numbers, or private passwords to this file.

## Pre-Filled Approval Record

| Field | Current value | Where to get or confirm it |
| --- | --- | --- |
| PayGate deployment URL | `https://pay-gate-beta.vercel.app` | Vercel project dashboard for PayGate, or open the deployed `/health` URL. |
| PayGate deployment commit SHA | `13e6b86` | GitHub commit history or Vercel deployment details. Must match the deployed commit before live test. |
| App ID | `aintern` | PayGate registry: `registry/apps/aintern/app.yaml`. |
| App production URL | `https://a-intern.vercel.app` | PayGate registry live URL. Confirm the domain is deployed and points to the real production app before testing. |
| Company / Stripe account owner | `NHL Global Solution` / account login previously identified as `nhl.global.solution@gmail.com` | Stripe Dashboard account/profile/business settings. Confirm legal entity before live payment. |
| Stripe account ID | `acct_1U4N5nDzGAfRwUx9` | Provided by operator; confirm in Stripe live dashboard before payment. |
| Provider account alias | `nhl_global_solution` | PayGate registry provider account alias and Vercel env var naming convention. |
| Environment | `live` | Fixed for Phase 6 controlled live pilot. |
| Plan key option 1 | `pass_3m` | PayGate registry: AIntern 3-Month Pass. |
| Plan key option 1 amount | `MYR 39.00` | PayGate registry: `3900` minor units. Confirm against live Stripe Price before approval. |
| Plan key option 1 checkout mode | `payment` / one-time | PayGate registry plan type: `one_time`. |
| Plan key option 1 Stripe lookup key | `aintern_pass_3m` | PayGate registry. Confirm a matching live Stripe Price lookup key exists. |
| Plan key option 2 | `pass_6m` | PayGate registry: AIntern 6-Month Pass. |
| Plan key option 2 amount | `MYR 59.00` | PayGate registry: `5900` minor units. Confirm against live Stripe Price before approval. |
| Plan key option 2 checkout mode | `payment` / one-time | PayGate registry plan type: `one_time`. |
| Plan key option 2 Stripe lookup key | `aintern_pass_6m` | PayGate registry. Confirm a matching live Stripe Price lookup key exists. |
| Expected user_ref | `b292ecfa-46c2-4d6c-bfef-8c32cd8c7bf7` | Provided from AIntern Supabase Auth user record. |
| Expected customer email | `effort.edutech@gmail.com` | Provided from AIntern Supabase Auth user record. |
| Approved payment method owner | `NHL Global Solution operator / company card owner` | Provided by operator. Do not write card numbers here. |
| Refund test approved | `yes` | Operator selected full refund for the controlled pilot. |
| Refund type | `full` | Operator selected full refund for the controlled pilot. |
| Refund amount if partial | `N/A` | Full refund selected. |
| Support / rollback owner | `NHL Global Solution operator` | Provided by operator. |
| Evidence storage location | `C:\Users\user\Documents\PayGate Phase 6 Evidence` | Provided by operator; store completed evidence outside Git/source control. |
| Live test time window | `2026-09-07 21:00-22:00 MYT` | Provided by operator. |

## Exact Approval Sentence to Complete Outside Source Control

Copy this to the external approval record and fill the TODOs before execution:

```text
I approve PayGate Phase 6 to run one controlled live Stripe checkout for aintern, provider account nhl_global_solution, plan pass_3m, amount MYR 39.00, user b292ecfa-46c2-4d6c-bfef-8c32cd8c7bf7, during 2026-09-07 21:00-22:00 MYT. I understand this uses real money. Refund scope is FULL.
```

## Where to Find the Missing Details

### Stripe account ID

Open Stripe Dashboard for the correct live account. Check either:

- the dashboard URL, which usually includes `acct_...`; or
- account/business/profile settings in Stripe Dashboard.

Important: confirm this while Stripe is in live mode, not only test mode.

### Live Product and Price

In Stripe Dashboard:

1. Switch to live mode.
2. Go to Product catalog.
3. Create or confirm AIntern 3-Month Pass and/or AIntern 6-Month Pass.
4. Confirm the live Price amount and currency exactly match PayGate:
   - `pass_3m`: MYR 39.00
   - `pass_6m`: MYR 59.00
5. Confirm the live Price lookup key matches:
   - `aintern_pass_3m`
   - `aintern_pass_6m`

### Expected user_ref

In AIntern Supabase:

1. Open the AIntern Supabase project.
2. Go to Authentication / Users.
3. Find the operator-controlled test user email.
4. Copy the user UUID. That UUID is the `user_ref`.

### Customer email

Use the same AIntern login email for the operator-controlled live test user. Avoid using an unrelated customer account.

### Live webhook endpoint

In Stripe Dashboard, create or confirm a live webhook endpoint pointing to:

```text
https://pay-gate-beta.vercel.app/v1/webhooks/stripe/nhl_global_solution/live
```

Store the resulting `whsec_...` only in Vercel environment variables. Do not paste it into docs or chat.

### Vercel live environment variables

In Vercel PayGate project settings, production environment should contain live-only variables like:

```text
STRIPE_LIVE_ACCOUNTS=nhl_global_solution
STRIPE_LIVE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY=<live Stripe secret key, server-side only>
STRIPE_LIVE_ACCOUNT_NHL_GLOBAL_SOLUTION_WEBHOOK_SECRET=<live webhook signing secret, server-side only>
```

Do not commit or paste the actual values.

## Stop Conditions

Stop before payment if:

- Stripe account ID does not match the approved company account;
- checkout amount/currency differs from this approval;
- the app is still pointing to sandbox/test environment;
- live webhook endpoint is missing or wrong;
- live secret key or webhook secret appears in browser code, GitHub, docs, or screenshots;
- the selected user_ref is not the approved AIntern user;
- refund scope is undecided.

## 2026-09-10 account correction

The operator confirmed Stripe dashboard test mode, sandbox, and live mode all show NHL Global Solution as account `acct_1U4N5nDzGAfRwUx9`. Any earlier reference to `acct_1U4N6cRgCMXjT1y6` is superseded historical evidence and should not be used as the active PayGate provider account record.
