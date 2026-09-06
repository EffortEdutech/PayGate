# Refund and Chargeback Policy

Status: implemented for Phase 5 Track 5 on 2026-09-06.

## Objective

PayGate reacts to verified provider events for refunds and disputes without letting applications become payment authorities. Phase 5 does not create refunds and does not authorize live refund execution.

## Policy

### Full refund

When Stripe sends a verified full-refund signal for a paid plan, PayGate normalizes it to `refund.full` and revokes the projected plan entitlement.

Current Stripe source event:

- `charge.refunded` where the charge is fully refunded, either `refunded=true` or `amount_refunded >= amount`.

### Partial refund

When Stripe sends a partial-refund signal, PayGate normalizes it to `refund.partial`. The event is processed and retained, but PayGate does not automatically revoke entitlement.

Reason: a partial refund may represent a goodwill adjustment, tax correction, discount correction, or operator-specific commercial decision. Entitlement impact requires explicit operator policy or a later reconciliation decision.

### Dispute / chargeback

When Stripe sends a dispute or chargeback opening signal, PayGate normalizes it to `dispute.opened` and revokes the projected plan entitlement.

Current Stripe source event:

- `charge.dispute.*`

## Boundaries

- Browser redirects never grant or revoke access.
- Apps never submit refund IDs, charge IDs, amounts, currencies, provider accounts, or entitlement keys.
- Refund/dispute mutations require a verified provider webhook or explicit reconciliation result.
- PayGate stores Hub-safe event types and minimal evidence; it does not expose raw Stripe objects to apps.
- Live refund creation remains blocked until Phase 6 controlled live pilot approval.

## Event Mapping

| Stripe event | Hub event | Entitlement outcome |
| --- | --- | --- |
| `charge.refunded` full | `refund.full` | revoke plan entitlement |
| `charge.refunded` partial | `refund.partial` | no automatic entitlement change |
| `refund.*` without full-charge context | `refund.partial` | no automatic entitlement change |
| `charge.dispute.*` | `dispute.opened` | revoke plan entitlement |

## Verification

The Phase 5 Track 5 tests prove:

- Stripe full refund normalizes to `refund.full` with cancelled projection state.
- Stripe partial refund normalizes to `refund.partial` without projection state.
- Stripe dispute normalizes to `dispute.opened` with cancelled projection state.
- A verified partial refund does not revoke an active entitlement.
- A verified full refund revokes an active entitlement.