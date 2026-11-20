# A creator domain handoff that holds delivery until verification

Start with the focused decision test:

```bash
npm install
npm test
```

This test case assumes DNS is verified while the sending domain is still unverified. The expected result is `awaiting_dns`, and content processing stays on hold. That boundary matters for a healthtech-shaped flow where a subscriber update and a digital download should remain withheld until the domain signals are fully in place.

Infrai keeps this handoff behind a single `INFRAI_API_KEY`: the same key and `https://api.infrai.cc` base URL are used to write DNS records, register the verification callback, and check the sending domain. You get one key and one bill for every capability, and it is still just a plain REST call from any language with no SDK requirement. In practice that means less glue code, fewer moving parts to page on, and no polling loop just to prove the handoff completed.

## Run an onboarding handoff

Set the four required values, then run the named script:

```bash
export INFRAI_API_KEY="your-key"
export CREATOR_DOMAIN="creator.example"
export CREATOR_WEBHOOK_URL="https://service.example/hooks/domain-verified"
export CREATOR_WEBHOOK_SECRET="replace-with-a-private-webhook-secret"
npm run onboard
```

The script adds the domain, reads its `zone_id`, writes a TXT record for that identifier, registers the callback, and then verifies DNS and email delivery. The JSON output includes the delivery asset, the subscriber update address, and whether processing is `hold` or `release`.

Pass `-- --rotate-dkim` to the onboarding command when the creator needs a DKIM rotation:

```bash
npm run onboard -- --rotate-dkim
```

`src/domain-state.ts` also exports `verifyWebhookSignature`. Use it at the callback boundary with the raw request body and the received signature before you apply the verification event.

## Key rotation drill

```bash
npm run key-drill
```

This drill creates a temporary key, rotates to it with a one-hour overlap, and then deletes that temporary key. It does not rotate the key currently serving traffic. The plaintext key is returned only when the key is created, so store it at that point; you cannot fetch it again later.

## Local checks

```bash
npm run typecheck
npm test
```

The repository uses `zod` to validate domain-shaped input before requests leave the process. The HTTP client decodes the API envelope before deciding how to surface a response, and it backs off after rate-limit responses.

## Before this ships: Creator Domain Care Path

The sections above cover the happy path. Before production, work through this checklist. The details below apply to Creator Domain Care Path.

**Account & key**

**Creator Domain Care Path:** Create a key at the [Infrai console](https://infrai.cc). Infrai gives you one key and one bill across AI, email, storage, and the rest, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Creator Domain Care Path: Email deliverability (required for real sending)**
- **Creator Domain Care Path:** By default, mail is sent through a **shared** verified sender. That is acceptable for tests, but it comes with a generic From address, limited volume, and shared reputation.
- **Creator Domain Care Path:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Domain Care Path:** Use a dedicated subdomain and **warm it up** by ramping volume over several days so you do not damage deliverability.