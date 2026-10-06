import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { decideDomainState, deliveryPlan, verifyWebhookSignature } from "./domain-state.js";

test("holds a creator download until both DNS and sending-domain checks pass", () => {
  const state = decideDomainState(true, false);
  const plan = deliveryPlan({
    domain: "creator.example",
    subscriberUpdateAddress: "members@creator.example",
    deliveryAssetName: "mobility-guide.pdf",
  }, state);

  assert.equal(plan.state, "awaiting_dns");
  assert.equal(plan.contentProcessing, "hold");
});

test("accepts a verification callback only when its signature matches", () => {
  const body = '{"event":"dns.domain.verified"}';
  const secret = "local-test-secret";
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  assert.equal(verifyWebhookSignature(body, signature, secret), true);
  assert.equal(verifyWebhookSignature(body, signature, "other-secret"), false);
});
