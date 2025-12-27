import type { KVNamespace } from "@cloudflare/workers-types";

type ThrottleOpts = {
    kv: KVNamespace;
    key: string;
    limit: number;      // max requests per window
    windowSec: number;  // TTL
};

export async function hitThrottle({ kv, key, limit, windowSec }: ThrottleOpts) {
    // naive counter using KV (good enough for small sites)
    const raw = await kv.get(key);
    const n = raw ? Number(raw) : 0;

    if (Number.isFinite(n) && n >= limit) return { ok: false, remaining: 0 };

    const next = n + 1;
    // keep ttl stable-ish by only setting expiration when creating the key
    if (!raw) {
        await kv.put(key, String(next), { expirationTtl: windowSec });
    } else {
        await kv.put(key, String(next), { expirationTtl: windowSec });
    }

    return { ok: true, remaining: Math.max(0, limit - next) };
}
