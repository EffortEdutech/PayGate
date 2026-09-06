import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyStripeReconciliationEvidence } from "../../payment-hub/src/providers/stripe/stripe-adapter.js";

const command = { appId: "aintern", userRef: "user_1" };

test("Stripe reconciliation classification detects payment-mode checkout without subscription", () => {
  const classification = classifyStripeReconciliationEvidence(command, [], [{
    id: "cs_test_payment",
    mode: "payment",
    status: "complete",
    metadata: { cph_app_id: "aintern", cph_user_ref: "user_1" },
  }]);

  assert.equal(classification, "checkout_payment_mode_without_subscription");
});

test("Stripe reconciliation classification detects completed subscription checkout missing provider subscription", () => {
  const classification = classifyStripeReconciliationEvidence(command, [], [{
    id: "cs_test_subscription",
    mode: "subscription",
    status: "complete",
    subscription_id: null,
    metadata: { cph_app_id: "aintern", cph_user_ref: "user_1" },
  }]);

  assert.equal(classification, "checkout_completed_subscription_missing");
});

test("Stripe reconciliation classification detects metadata mismatch before repairing state", () => {
  const classification = classifyStripeReconciliationEvidence(command, [{
    id: "sub_other_user",
    status: "active",
    metadata: { cph_app_id: "aintern", cph_user_ref: "other_user" },
    price_lookup_key: "aintern_pass_3m",
  }], []);

  assert.equal(classification, "provider_customer_app_metadata_mismatch");
});

test("Stripe reconciliation classification requires plan evidence for active subscriptions", () => {
  const missingPlan = classifyStripeReconciliationEvidence(command, [{
    id: "sub_no_plan",
    status: "active",
    metadata: { cph_app_id: "aintern", cph_user_ref: "user_1" },
    price_lookup_key: null,
  }], []);

  const withPlan = classifyStripeReconciliationEvidence(command, [{
    id: "sub_with_plan",
    status: "active",
    metadata: { cph_app_id: "aintern", cph_user_ref: "user_1", cph_plan_key: "pass_3m" },
    price_lookup_key: null,
  }], []);

  assert.equal(missingPlan, "missing_plan_metadata");
  assert.equal(withPlan, "in_sync_candidate");
});

test("Stripe reconciliation classification distinguishes inactive subscriptions from no provider history", () => {
  assert.equal(classifyStripeReconciliationEvidence(command, [{ id: "sub_canceled", status: "canceled", metadata: {} }], []), "inactive_subscription_only");
  assert.equal(classifyStripeReconciliationEvidence(command, [], []), "no_provider_subscription");
});