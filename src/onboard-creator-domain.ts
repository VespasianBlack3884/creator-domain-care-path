import { DomainControl } from "./domain-control.js";
import { decideDomainState, deliveryPlan, onboardingInput } from "./domain-state.js";

const key = process.env.INFRAI_API_KEY;

if (!key) {
  throw new Error("Set INFRAI_API_KEY");
}

const infrai = new DomainControl(key);

async function onboard() {
  const webhookUrl = process.env.CREATOR_WEBHOOK_URL;
  const webhookSecret = process.env.CREATOR_WEBHOOK_SECRET;
  const domain = process.env.CREATOR_DOMAIN;
  if (!webhookUrl || !webhookSecret || !domain) {
    throw new Error("Set CREATOR_WEBHOOK_URL, CREATOR_WEBHOOK_SECRET, and CREATOR_DOMAIN");
  }
  const input = onboardingInput.parse({
    domain,
    subscriberUpdateAddress: process.env.SUBSCRIBER_UPDATE_ADDRESS ?? "members@creator.example",
    deliveryAssetName: process.env.DELIVERY_ASSET_NAME ?? "creator-download.zip",
  });
  const added = await infrai.addDomain(input.domain);
  const existing = await infrai.getDomain(input.domain);
  const zoneId = existing.zone_id || added.zone_id;
  await infrai.upsertTxt(zoneId, "_creator-verify", "creator-domain-onboarding");
  await infrai.registerVerificationWebhook(webhookUrl, webhookSecret);
  const dns = await infrai.verifyDomain(input.domain);
  const email = await infrai.verifySendingDomain(input.domain);
  if (process.argv.includes("--rotate-dkim")) await infrai.rotateDkim(input.domain);
  const state = decideDomainState(dns.verified === true, email.verified === true);
  const plan = deliveryPlan(input, state);
  console.log(JSON.stringify({
    domain: input.domain,
    zone_id: zoneId,
    state: plan.state,
    asset: plan.asset,
    subscriberUpdate: plan.subscriberUpdate,
    contentProcessing: plan.contentProcessing,
  }, null, 2));
}

async function keyDrill() {
  const temporary = await infrai.createTemporaryKey();
  console.log("Store the returned plaintext temporary key now; it cannot be retrieved again.");
  await infrai.rotateTemporaryKey(temporary.id);
  await infrai.revokeTemporaryKey(temporary.id);
  console.log("Temporary key rotation drill complete.");
}

await (process.argv.includes("--key-drill") ? keyDrill() : onboard());
