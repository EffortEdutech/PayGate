import type { EntitlementProjection, ProviderSubscriptionSnapshot, ReconciliationResult, SubscriptionProjection, VerifiedProviderEvent } from "@payment-hub/contracts";
import type { PaymentRepository, CheckoutSessionRecord, ReconciliationRunInput } from "./repository.js";

export class InMemoryPaymentRepository implements PaymentRepository {
  readonly #applications = new Map<string, string>();
  readonly #providerCustomers = new Map<string, string>();
  readonly #checkoutSessions = new Map<string, CheckoutSessionRecord>();
  readonly #webhooks = new Set<string>();
  readonly #subscriptions = new Map<string, SubscriptionProjection>();
  readonly #entitlements = new Map<string, EntitlementProjection>();
  readonly #reconciliationRuns = new Map<string, ReconciliationRunInput>();

  async ensureApplication(input: { readonly appId: string; readonly registryVersion: string; readonly status: string }): Promise<string> {
    const id = this.#applications.get(input.appId) ?? `app_${this.#applications.size + 1}`;
    this.#applications.set(input.appId, id);
    return id;
  }

  async findProviderCustomer(input: Parameters<PaymentRepository["findProviderCustomer"]>[0]): Promise<string | undefined> { return this.#providerCustomers.get(customerKey(input)); }
  async saveProviderCustomer(input: Parameters<PaymentRepository["saveProviderCustomer"]>[0]): Promise<void> { this.#providerCustomers.set(customerKey(input), input.providerCustomerRef); }
  async saveCheckoutSession(record: CheckoutSessionRecord): Promise<void> { this.#checkoutSessions.set(record.checkoutSessionId, record); }

  async insertWebhookEvent(event: VerifiedProviderEvent, _payloadHash: string): Promise<"inserted" | "duplicate"> {
    const key = `${event.providerId}:${event.providerAccount}:${event.environment}:${event.providerEventId}`;
    if (this.#webhooks.has(key)) return "duplicate";
    this.#webhooks.add(key);
    return "inserted";
  }

  async applyVerifiedEvent(event: VerifiedProviderEvent): Promise<void> {
    const payload = event.payload;
    if (!payload.appId || !payload.userRef) return;
    if (payload.providerCustomerRef) await this.saveProviderCustomer({ appId: payload.appId, userRef: payload.userRef, providerId: event.providerId, providerAccount: event.providerAccount, environment: event.environment, providerCustomerRef: payload.providerCustomerRef });
    const state = payload.subscriptionState ?? "active";
    this.#subscriptions.set(`${payload.appId}:${payload.userRef}`, { appId: payload.appId, userRef: payload.userRef, state, ...(payload.planKey ? { planKey: payload.planKey } : {}), ...(payload.currentPeriodEnd ? { currentPeriodEnd: payload.currentPeriodEnd } : {}) });
    if (payload.planKey) this.projectPlanEntitlement(payload.appId, payload.userRef, payload.planKey, state === "active" || state === "trial" ? "active" : "revoked", payload.currentPeriodEnd);
  }

  async applyReconciliationSnapshot(input: { readonly appId: string; readonly userRef: string; readonly snapshot: ProviderSubscriptionSnapshot }): Promise<SubscriptionProjection> {
    const projection: SubscriptionProjection = { appId: input.appId, userRef: input.userRef, state: input.snapshot.state, ...(input.snapshot.planKey ? { planKey: input.snapshot.planKey } : {}), ...(input.snapshot.currentPeriodEnd ? { currentPeriodEnd: input.snapshot.currentPeriodEnd } : {}) };
    this.#subscriptions.set(`${input.appId}:${input.userRef}`, projection);
    if (input.snapshot.planKey) this.projectPlanEntitlement(input.appId, input.userRef, input.snapshot.planKey, input.snapshot.state === "active" || input.snapshot.state === "trial" ? "active" : "revoked", input.snapshot.currentPeriodEnd);
    return projection;
  }

  async recordReconciliationRun(input: ReconciliationRunInput): Promise<string> {
    const runId = `recon_${this.#reconciliationRuns.size + 1}`;
    this.#reconciliationRuns.set(runId, input);
    return runId;
  }

  async currentSubscription(appId: string, userRef: string): Promise<SubscriptionProjection> { return this.#subscriptions.get(`${appId}:${userRef}`) ?? { appId, userRef, state: "none" }; }
  async currentEntitlements(appId: string, userRef: string): Promise<EntitlementProjection> { return this.#entitlements.get(`${appId}:${userRef}`) ?? { appId, userRef, entitlements: [] }; }

  private projectPlanEntitlement(appId: string, userRef: string, planKey: string, state: "active" | "revoked", effectiveUntil?: Date): void {
    this.#entitlements.set(`${appId}:${userRef}`, { appId, userRef, entitlements: [{ key: `plan:${planKey}`, state, ...(effectiveUntil ? { effectiveUntil } : {}) }] });
  }
}

function customerKey(input: { readonly appId: string; readonly userRef: string; readonly providerId: string; readonly providerAccount: string; readonly environment: string }): string {
  return `${input.appId}:${input.userRef}:${input.providerId}:${input.providerAccount}:${input.environment}`;
}
