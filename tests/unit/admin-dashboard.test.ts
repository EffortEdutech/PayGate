import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import type { CheckoutResult, PaymentProviderAdapter, PortalResult, ProviderCapabilities, ProviderSubscriptionSnapshot, ResolvedCheckoutCommand, ResolvedPortalCommand, ResolvedReconciliationCommand, VerifiedProviderEvent } from "@payment-hub/contracts";
import { InMemoryPaymentRepository, PaymentHubService, Registry, StaticTokenAppAuthenticator, StripeAdapterSkeleton, createPaymentHubHttpServer } from "../../payment-hub/src/index.js";

const app = {
  appId: "app_test",
  name: "Test",
  providerId: "stripe",
  providerAccount: "primary",
  origins: { test: new URL("https://test.example.com"), live: new URL("https://example.com") },
  returnContexts: { billing: { successPath: "/success", cancelPath: "/cancel", portalPath: "/billing" } },
  plans: new Map([["growth_monthly", { planKey: "growth_monthly", name: "Growth", mode: "subscription" as const, amountMinor: 4900, currency: "USD" as const, interval: "month" as const, providerLookupKeys: { stripe: "app_test_growth_monthly" }, entitlements: ["analytics.export"], status: "active" as const }]]),
};

class FakeProvider implements PaymentProviderAdapter {
  readonly providerId = "stripe";
  capabilities(): ProviderCapabilities { return new StripeAdapterSkeleton().capabilities(); }
  async createCheckout(_command: ResolvedCheckoutCommand): Promise<CheckoutResult> { return { checkoutSessionId: "cs_test_123", redirectUrl: new URL("https://checkout.stripe.com/c/test"), status: "open", expiresAt: new Date("2026-08-26T12:00:00.000Z"), providerCustomerRef: "cus_test_123" }; }
  async createPortalSession(_command: ResolvedPortalCommand): Promise<PortalResult> { return { portalSessionId: "bps_test", redirectUrl: new URL("https://billing.stripe.com/p/session") }; }
  async verifyWebhook(input: { readonly rawBody: Uint8Array; readonly signature: string; readonly account: string; readonly environment: "test" | "live" }): Promise<VerifiedProviderEvent> {
    if (input.signature !== "valid") throw new Error("Invalid signature");
    return { providerId: "stripe", providerAccount: input.account, environment: input.environment, providerEventId: "evt_test_123", providerCreatedAt: new Date("2026-08-26T12:00:00.000Z"), eventType: "checkout.completed", payload: { appId: "app_test", userRef: "user_1", planKey: "growth_monthly", providerCustomerRef: "cus_test_123", providerSubscriptionRef: "sub_test_123", subscriptionState: "active", rawType: "checkout.session.completed", evidence: { id: "cs_test_123" } } };
  }
  async reconcileCustomer(command: ResolvedReconciliationCommand): Promise<ProviderSubscriptionSnapshot> { return { providerId: "stripe", providerAccount: command.providerAccount, environment: command.environment, providerCustomerRef: command.providerCustomerRef, providerSubscriptionRef: "sub_test_123", observedAt: new Date("2026-08-26T12:00:00.000Z"), state: "active", planKey: "growth_monthly", evidence: { classification: "in_sync_candidate" } }; }
}

test("admin dashboard snapshot exposes safe operator state", async () => {
  const repository = new InMemoryPaymentRepository();
  const service = new PaymentHubService(new Registry([app]), repository, new FakeProvider());
  await service.createCheckout({ requestId: "req_checkout", appId: "app_test", userRef: "user_1", planKey: "growth_monthly", returnContext: "billing", environment: "test" });
  await service.acceptWebhook({ rawBody: Buffer.from("{}"), signature: "valid", providerAccount: "primary", environment: "test" });
  await service.reconcile({ requestId: "req_reconcile", appId: "app_test", userRef: "user_1", environment: "test" });

  const snapshot = await service.adminDashboard({ appId: "app_test", environment: "test" }) as {
    apps: Array<{ app_id: string; plans: Array<{ provider_lookup_configured: boolean }> }>;
    customers: Array<{ provider_customers: unknown[]; subscription: { state: string }; entitlements: unknown[] }>;
    checkout_sessions: unknown[];
    webhooks: Array<{ status: string }>;
    reconciliation_runs: Array<{ classification?: string }>;
  };

  assert.equal(snapshot.apps[0]?.app_id, "app_test");
  assert.equal(snapshot.apps[0]?.plans[0]?.provider_lookup_configured, true);
  assert.equal(snapshot.customers[0]?.subscription.state, "active");
  assert.equal(snapshot.customers[0]?.provider_customers.length, 1);
  assert.equal(snapshot.customers[0]?.entitlements.length, 1);
  assert.equal(snapshot.checkout_sessions.length, 1);
  assert.equal(snapshot.webhooks[0]?.status, "processed");
  assert.equal(snapshot.reconciliation_runs[0]?.classification, "in_sync_candidate");
  assert.doesNotMatch(JSON.stringify(snapshot), /secret|whsec|sk_test/i);
});

test("local admin summary route stays behind ordinary app authentication", async () => {
  const server = createPaymentHubHttpServer({ service: new PaymentHubService(new Registry([app]), new InMemoryPaymentRepository(), new FakeProvider()), authenticator: new StaticTokenAppAuthenticator({ app_test: "secret" }) });
  server.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/admin/summary`, { headers: { authorization: "Bearer secret" } });
    assert.equal(response.status, 404);
  } finally {
    server.close();
  }
});
test("monitoring summary reports reconciliation warnings without exposing secrets", async () => {
  const repository = new InMemoryPaymentRepository();
  const service = new PaymentHubService(new Registry([app]), repository, new FakeProvider());
  await service.createCheckout({ requestId: "req_checkout", appId: "app_test", userRef: "user_1", planKey: "growth_monthly", returnContext: "billing", environment: "test" });
  await service.acceptWebhook({ rawBody: Buffer.from("{}"), signature: "valid", providerAccount: "primary", environment: "test" });
  await service.reconcile({ requestId: "req_reconcile", appId: "app_test", userRef: "user_1", environment: "test" });

  const monitoring = await service.monitoringSummary({ appId: "app_test", environment: "test" }) as {
    status: string;
    checks: { webhook_inbox: { pending: number; unprocessed: number }; reconciliation: { noProviderSubscription: number } };
    alerts: Array<{ code: string; severity: string }>;
  };

  assert.equal(monitoring.status, "ok");
  assert.equal(monitoring.checks.webhook_inbox.pending, 0);
  assert.equal(monitoring.checks.webhook_inbox.unprocessed, 0);
  assert.equal(monitoring.checks.reconciliation.noProviderSubscription, 0);
  assert.doesNotMatch(JSON.stringify(monitoring), /secret|whsec|sk_test/i);
});