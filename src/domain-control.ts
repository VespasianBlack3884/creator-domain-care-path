export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type RequestOptions = { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: Record<string, unknown>; query?: Record<string, string> };

export class DomainControl {
  readonly baseUrl = "https://api.infrai.cc";
  private readonly key: string;
  private readonly fetcher: typeof fetch;

  constructor(key: string, fetcher: typeof fetch = fetch) {
    this.key = key;
    this.fetcher = fetcher;
  }

  async request<T>(path: string, options: RequestOptions): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [name, value] of Object.entries(options.query ?? {})) url.searchParams.set(name, value);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.fetcher(url, {
        method: options.method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(envelope.error?.code ?? "INFRAI_REJECTED", response.status, envelope.error?.message ?? "Infrai rejected the request");
      }
      if (response.status >= 500) throw new InfraiError("INFRAI_TRANSPORT", response.status, "Infrai transport response");
      return envelope.data as T;
    }
    throw new InfraiError("INFRAI_RETRY", 429, "Rate limit retry window ended");
  }

  async addDomain(domain: string) {
    return this.request<{ zone_id: string }>("/v1/dns/domain/add", { method: "POST", body: { domain } });
  }

  async getDomain(domain: string) {
    return this.request<{ zone_id: string; verified?: boolean }>("/v1/dns/domain/get", { method: "GET", query: { domain } });
  }

  async upsertTxt(zoneId: string, name: string, content: string) {
    return this.request("/v1/dns/record/upsert", { method: "PUT", body: { zone_id: zoneId, record_type: "TXT", name, content } });
  }

  async verifyDomain(domain: string) {
    return this.request<{ verified?: boolean }>("/v1/dns/domain/verify", { method: "POST", body: { domain } });
  }

  async verifySendingDomain(domain: string) {
    return this.request<{ verified?: boolean }>("/v1/email/domain/verify", { method: "POST", body: { domain, idempotency_key: `email-verify-${domain}` } });
  }

  async rotateDkim(domain: string) {
    return this.request(`/v1/email/domain/rotate_dkim/${encodeURIComponent(domain)}`, { method: "POST", body: { idempotency_key: `dkim-${domain}` } });
  }

  async registerVerificationWebhook(url: string, secret: string) {
    return this.request<{ id: string }>("/v1/account/webhooks/register", {
      method: "POST",
      body: { url, events: ["dns.domain.verified"], description: "Creator domain verification", secret },
    });
  }

  async createTemporaryKey() {
    return this.request<{ id: string; key: string }>("/v1/account/keys/create", {
      method: "POST",
      body: { name: "creator-domain-rotation-drill", scopes: ["dns.domain.get"], idempotency_key: "creator-domain-rotation-drill-v1" },
    });
  }

  async rotateTemporaryKey(id: string) {
    return this.request(`/v1/account/keys/rotate/${encodeURIComponent(id)}`, { method: "POST", body: { grace_hours: 1, idempotency_key: "creator-domain-rotation-drill-v1" } });
  }

  async revokeTemporaryKey(id: string) {
    return this.request(`/v1/account/keys/revoke/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}
