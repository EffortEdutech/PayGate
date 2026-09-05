export type Environment = "test" | "live";
export type Currency = Uppercase<string>;
export type CheckoutMode = "payment" | "subscription";
export type EntitlementState = "active" | "inactive" | "grace" | "expired" | "revoked";
export type SubscriptionState = "trial" | "active" | "past_due" | "paused" | "cancel_pending" | "cancelled" | "expired";

export interface Money {
  readonly amountMinor: number;
  readonly currency: Currency;
}

export interface AppUserIdentity {
  readonly appId: string;
  readonly userRef: string;
}

export interface HubErrorShape {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
}
