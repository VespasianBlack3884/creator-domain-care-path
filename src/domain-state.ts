import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const onboardingInput = z.object({
  domain: z.string().min(1),
  subscriberUpdateAddress: z.string().email(),
  deliveryAssetName: z.string().min(1),
});

export type OnboardingInput = z.infer<typeof onboardingInput>;

export type DomainState = "awaiting_dns" | "ready_for_delivery";

export function decideDomainState(dnsVerified: boolean, emailVerified: boolean): DomainState {
  return dnsVerified && emailVerified ? "ready_for_delivery" : "awaiting_dns";
}

export function deliveryPlan(input: OnboardingInput, state: DomainState) {
  return {
    state,
    asset: input.deliveryAssetName,
    subscriberUpdate: input.subscriberUpdateAddress,
    contentProcessing: state === "ready_for_delivery" ? "release" : "hold",
  };
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = Buffer.from(signature, "hex");
  const wanted = Buffer.from(expected, "hex");
  return received.length === wanted.length && timingSafeEqual(received, wanted);
}
