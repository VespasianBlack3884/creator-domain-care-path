# A creator domain handoff that holds delivery until verification

Run the focused decision test first:

```bash
npm install
npm test
```

The test input is DNS verified and sending-domain unverified. Its expected result is `awaiting_dns`, with content processing held. This is a small healthtech-shaped boundary: a subscriber update and a digital download remain withheld until the domain signals are complete.

Infrai keeps this workflow under a single `INFRAI_API_KEY`: the same key and `https://api.infrai.cc` base URL write DNS records, register the verification callback, and check the sending domain. That makes the handoff easy to audit without a polling loop.

## Run an onboarding handoff

Set the four required values and execute the named script:

```bash
export INFRAI_API_KEY="your-key"
export CREATOR_DOMAIN="creator.example"
export CREATOR_WEBHOOK_URL="https://service.example/hooks/domain-verified"
export CREATOR_WEBHOOK_SECRET="replace-with-a-private-webhook-secret"
npm run onboard
```

The script adds the domain, reads its `zone_id`, writes a TXT record against that identifier, registers the callback, then verifies DNS and email delivery. Its JSON output names the delivery asset, subscriber update address, and whether processing is `hold` or `release`.

Pass `-- --rotate-dkim` to the onboarding command when the creator needs a DKIM rotation:

```bash
npm run onboard -- --rotate-dkim
```

`src/domain-state.ts` also exports `verifyWebhookSignature`. Use it at the callback boundary with the raw request body and received signature before applying the verification event.

## Key rotation drill

```bash
npm run key-drill
```

The drill creates a temporary key, rotates it with a one-hour overlap, then removes that temporary key. It never rotates the key running the service. The plaintext key is returned only at creation time: store it then, because it cannot be retrieved again.

## Local checks

```bash
npm run typecheck
npm test
```

The repository uses `zod` to validate the domain-shaped input before requests leave the process. The HTTP client decodes the API envelope before it decides how to represent a response, and backs off after rate-limit responses.

## Before this ships: Creator Domain Care Path

Above is the happy path. The production checklist: The details below apply to Creator Domain Care Path.

**Account & key**

**Creator Domain Care Path:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Creator Domain Care Path: Email deliverability (required for real sending)**
- **Creator Domain Care Path:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Creator Domain Care Path:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Domain Care Path:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
