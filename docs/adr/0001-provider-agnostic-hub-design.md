# ADR 0001: Provider-neutral Hub with capability-declaring adapters

## Status

Accepted — 2026-08-26

## Decision

Applications use stable Hub contracts. Provider SDKs and terminology remain inside adapters. Each adapter publishes structured capabilities and constraints; the Hub rejects unsupported operations explicitly rather than reducing all providers to a lowest-common-denominator API.

Stripe is the initial provider. This decision does not require speculative implementation of a second provider.

