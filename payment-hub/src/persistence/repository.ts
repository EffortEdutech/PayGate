import type { CheckoutResult, EntitlementProjection, ProviderSubscriptionSnapshot, ReconciliationResult, SubscriptionProjection, VerifiedProviderEvent } from "@payment-hub/contracts";
import type { Environment } from "@payment-hub/types";

export interface CheckoutSessionRecord extends CheckoutResult {
  readonly appId: string;
  readonly userRef: string;
  readonly planKey: string;
  readonly providerId: string;
  readonly providerAccount: string;
  readonly environment: Environment;
}

export interface ReconciliationRunInput {
  readonly appId: string;
  readonly userRef: string;
  readonly providerId: string;
  readonly providerAccount: string;
  readonly environment: Environment;
  readonly status: ReconciliationResult["status"];
  readonly evidence: unknown;
  readonly requestId: string;
}

export interface PaymentRepository {
  ensureApplication(input: { readonly appId: string; readonly registryVersion: string; readonly status: string }): Promise<string>;
  findProviderCustomer(input: { readonly appId: string; readonly userRef: string; readonly providerId: string; readonly providerAccount: string; readonly environment: Environment }): Promise<string | undefined>;
  saveProviderCustomer(input: { readonly appId: string; readonly userRef: string; readonly providerId: string; readonly providerAccount: string; readonly environment: Environment; readonly providerCustomerRef: string }): Promise<void>;
  saveCheckoutSession(record: CheckoutSessionRecord): Promise<void>;
  insertWebhookEvent(event: VerifiedProviderEvent, payloadHash: string): Promise<"inserted" | "duplicate">;
  applyVerifiedEvent(event: VerifiedProviderEvent): Promise<void>;
  applyReconciliationSnapshot(input: { readonly appId: string; readonly userRef: string; readonly snapshot: ProviderSubscriptionSnapshot }): Promise<SubscriptionProjection>;
  recordReconciliationRun(input: ReconciliationRunInput): Promise<string>;
  currentSubscription(appId: string, userRef: string): Promise<SubscriptionProjection>;
  currentEntitlements(appId: string, userRef: string): Promise<EntitlementProjection>;
}
