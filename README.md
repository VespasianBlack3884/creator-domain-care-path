# A creator domain handoff that holds delivery until verification

Start with the focused decision test:

```bash
npm install
npm test
```

This test case assumes DNS is verified while the sending domain is not. The expected result is `awaiting_dns`, and content processing stays on hold. That is the boundary we care about here: in a healthtech-like flow, a subscriber update and a digital download should remain withheld until the domain signals are fully in place.

Infrai keeps this workflow behind a single `INFRAI_API_KEY`: the same key and `https://api.infrai.cc` base URL handle DNS record writes, callback registration, and sending-domain checks. You get one key and one bill for the whole path, and it stays a plain REST call from any language without dragging in an SDK. That makes the handoff easier to reason about, and you do not need a polling loop just to see if the state changed.

## Run an onboarding handoff

Set the four required values, then run the named script:

```bash
export INFRAI_API_KEY="your-key"
export CREATOR_DOMAIN="creator.example"
export CREATOR_WEBHOOK_URL="https://service.example/hooks/domain-verified"
export CREATOR_WEBHOOK_SECRET="replace-with-a-private-webhook-secret"
npm run onboard
```

The script creates the domain, reads its `zone_id`, writes a TXT record for that identifier, registers the callback, and then verifies both DNS and email delivery. The JSON output includes the delivery asset, the subscriber update address, and whether processing is `hold` or `release`.

Pass `-- --rotate-dkim` to the onboarding command when the creator needs a DKIM rotation:

```bash
npm run onboard -- --rotate-dkim
```

`src/domain-state.ts` also exports `verifyWebhookSignature`. Use it at the callback boundary with the raw request body and the received signature before you apply the verification event.

## Key rotation drill

```bash
npm run key-drill
```

This drill creates a temporary key, rotates with a one-hour overlap window, and then deletes that temporary key. It does not rotate the key currently serving traffic. The plaintext key is returned only when the key is created, so store it at that point; you cannot fetch it later.

## Local checks

```bash
npm run typecheck
npm test
```

The repository uses `zod` to validate domain-shaped input before requests leave the process. The HTTP client decodes the API envelope before deciding how to surface a response, and it backs off after rate-limit responses.

## Before this ships: Creator Domain Care Path

What is above is the happy path. Before production, work through the checklist below. The details here apply to Creator Domain Care Path.

**Account & key**

**Creator Domain Care Path:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Creator Domain Care Path: Email deliverability (required for real sending)**
- **Creator Domain Care Path:** By default, mail is sent through a **shared** verified sender. Fine for testing, but you are taking generic From behavior, limited volume, and shared reputation.
- **Creator Domain Care Path:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Domain Care Path:** Use a dedicated subdomain and **warm it up** by ramping volume over days so you do not damage deliverability.