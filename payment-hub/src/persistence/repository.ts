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

export interface AdminDashboardSnapshot {
  readonly generatedAt: Date;
  readonly customers: readonly {
    readonly appId: string;
    readonly userRef: string;
    readonly createdAt: Date;
    readonly providerCustomers: readonly {
      readonly providerId: string;
      readonly providerAccount: string;
      readonly environment: Environment;
      readonly providerCustomerRef: string;
      readonly createdAt: Date;
    }[];
    readonly subscription?: SubscriptionProjection;
    readonly entitlements: EntitlementProjection["entitlements"];
  }[];
  readonly checkoutSessions: readonly {
    readonly appId: string;
    readonly userRef: string;
    readonly planKey: string;
    readonly providerId: string;
    readonly providerAccount: string;
    readonly environment: Environment;
    readonly providerCheckoutSessionRef: string;
    readonly status: string;
    readonly expiresAt: Date;
    readonly createdAt: Date;
  }[];
  readonly webhooks: readonly {
    readonly providerId: string;
    readonly providerAccount: string;
    readonly environment: Environment;
    readonly providerEventId: string;
    readonly eventType?: string;
    readonly appId?: string;
    readonly userRef?: string;
    readonly status: string;
    readonly attemptCount: number;
    readonly receivedAt: Date;
    readonly processedAt?: Date;
    readonly lastErrorCode?: string;
  }[];
  readonly reconciliationRuns: readonly {
    readonly id: string;
    readonly appId: string;
    readonly userRef?: string;
    readonly providerId: string;
    readonly providerAccount: string;
    readonly environment: Environment;
    readonly status: ReconciliationResult["status"];
    readonly classification?: string;
    readonly requestId: string;
    readonly completedAt: Date;
  }[];
}
export interface MonitoringSnapshot {
  readonly generatedAt: Date;
  readonly webhookInbox: {
    readonly failed: number;
    readonly pending: number;
    readonly retryable: number;
    readonly deadLetter: number;
    readonly unprocessed: number;
  };
  readonly reconciliation: {
    readonly failed: number;
    readonly noProviderCustomer: number;
    readonly noProviderSubscription: number;
  };
  readonly database: {
    readonly reachable: boolean;
  };
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
  adminDashboardSnapshot(input?: { readonly appId?: string; readonly environment?: Environment; readonly limit?: number }): Promise<AdminDashboardSnapshot>;
  monitoringSnapshot(input?: { readonly appId?: string; readonly environment?: Environment }): Promise<MonitoringSnapshot>;
}
