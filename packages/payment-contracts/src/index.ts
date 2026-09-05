import type { AppUserIdentity, CheckoutMode, EntitlementState, Environment, Money, SubscriptionState } from "@payment-hub/types";

export interface CapabilitySupport {
  readonly supported: boolean;
}

export interface ProviderCapabilities {
  readonly contractVersion: "1.0";
  readonly providerId: string;
  readonly hostedCheckout: CapabilitySupport & { readonly modes: readonly CheckoutMode[] };
  readonly customerPortal: CapabilitySupport;
  readonly nativeSubscriptions: CapabilitySupport & { readonly intervals: readonly string[]; readonly trials: boolean };
  readonly refunds: CapabilitySupport & { readonly partial: boolean };
  readonly recurringMandates: CapabilitySupport;
  readonly webhookSignatures: CapabilitySupport;
  readonly reconciliation: CapabilitySupport;
}

export interface CheckoutCommand extends AppUserIdentity {
  readonly requestId: string;
  readonly planKey: string;
  readonly returnContext: string;
  readonly environment: Environment;
}

export interface ResolvedCheckoutCommand extends CheckoutCommand {
  readonly providerAccount: string;
  readonly providerLookupKey: string;
  readonly mode: CheckoutMode;
  readonly money: Money;
  readonly successUrl: URL;
  readonly cancelUrl: URL;
}

export interface CheckoutResult {
  readonly checkoutSessionId: string;
  readonly redirectUrl: URL;
  readonly status: "open";
  readonly expiresAt: Date;
  readonly providerCustomerRef?: string;
}

export interface PortalCommand extends AppUserIdentity {
  readonly requestId: string;
  readonly returnContext: string;
  readonly environment: Environment;
}

export interface ResolvedPortalCommand extends PortalCommand {
  readonly providerAccount: string;
  readonly providerCustomerRef: string;
  readonly returnUrl: URL;
}

export interface PortalResult {
  readonly portalSessionId: string;
  readonly redirectUrl: URL;
}

export interface EntitlementProjection {
  readonly appId: string;
  readonly userRef: string;
  readonly entitlements: readonly { readonly key: string; readonly state: EntitlementState; readonly effectiveUntil?: Date }[];
}

export interface SubscriptionProjection {
  readonly appId: string;
  readonly userRef: string;
  readonly state: SubscriptionState | "none";
  readonly planKey?: string;
  readonly currentPeriodEnd?: Date;
}

export type HubProviderEventType =
  | "checkout.completed"
  | "subscription.active"
  | "subscription.trial"
  | "subscription.past_due"
  | "subscription.paused"
  | "subscription.cancelled"
  | "invoice.payment_succeeded"
  | "invoice.payment_failed"
  | "refund.updated"
  | "provider.event_ignored";

export interface NormalizedProviderEventPayload {
  readonly appId?: string;
  readonly userRef?: string;
  readonly planKey?: string;
  readonly providerCustomerRef?: string;
  readonly providerSubscriptionRef?: string;
  readonly subscriptionState?: SubscriptionState;
  readonly currentPeriodEnd?: Date;
  readonly rawType: string;
  readonly evidence: unknown;
}

export interface VerifiedProviderEvent {
  readonly providerId: string;
  readonly providerAccount: string;
  readonly environment: Environment;
  readonly providerEventId: string;
  readonly providerCreatedAt: Date;
  readonly eventType: HubProviderEventType;
  readonly payload: NormalizedProviderEventPayload;
}

export interface ReconciliationCommand extends AppUserIdentity {
  readonly requestId: string;
  readonly environment: Environment;
}

export interface ResolvedReconciliationCommand extends ReconciliationCommand {
  readonly providerAccount: string;
  readonly providerCustomerRef: string;
}

export interface ProviderSubscriptionSnapshot {
  readonly providerId: string;
  readonly providerAccount: string;
  readonly environment: Environment;
  readonly providerCustomerRef: string;
  readonly providerSubscriptionRef: string;
  readonly observedAt: Date;
  readonly state: SubscriptionState | "none";
  readonly planKey?: string;
  readonly currentPeriodEnd?: Date;
  readonly evidence: unknown;
}

export interface ReconciliationResult {
  readonly runId: string;
  readonly appId: string;
  readonly userRef: string;
  readonly status: "repaired" | "in_sync" | "no_provider_customer" | "no_provider_subscription" | "failed";
  readonly subscription: SubscriptionProjection;
}

export interface PaymentProviderAdapter {
  readonly providerId: string;
  capabilities(): ProviderCapabilities;
  createCheckout(command: ResolvedCheckoutCommand): Promise<CheckoutResult>;
  createPortalSession(command: ResolvedPortalCommand): Promise<PortalResult>;
  verifyWebhook(input: {
    readonly rawBody: Uint8Array;
    readonly signature: string;
    readonly account: string;
    readonly environment: Environment;
  }): Promise<VerifiedProviderEvent>;
  reconcileCustomer(command: ResolvedReconciliationCommand): Promise<ProviderSubscriptionSnapshot>;
}
