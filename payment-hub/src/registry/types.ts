import type { CheckoutMode, Currency } from "@payment-hub/types";

export interface RegisteredPlan {
  readonly planKey: string;
  readonly name: string;
  readonly mode: CheckoutMode;
  readonly amountMinor: number;
  readonly currency: Currency;
  readonly interval?: "day" | "week" | "month" | "year";
  readonly providerLookupKeys: Readonly<Record<string, string>>;
  readonly providerLiveLookupKeys?: Readonly<Record<string, string>>;
  readonly entitlements: readonly string[];
  readonly status: "draft" | "active" | "archived";
}

export interface RegisteredApplication {
  readonly appId: string;
  readonly name: string;
  readonly providerId: string;
  readonly providerAccount: string;
  readonly origins: { readonly test: URL; readonly live: URL };
  readonly returnContexts: Readonly<Record<string, { readonly successPath: string; readonly cancelPath: string; readonly portalPath: string }>>;
  readonly plans: ReadonlyMap<string, RegisteredPlan>;
}
