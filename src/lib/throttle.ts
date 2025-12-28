import type { KVNamespace } from "@cloudflare/workers-types";

type ThrottleOpts = {
    kv: KVNamespace;
    key: string;
    limit: number;
    windowSec: number;
};

type ThrottleState = {
    n: number;
    resetAt: number; // unix seconds
};

export async function hitThrottle({ kv, key, limit, windowSec }: ThrottleOpts) {
    const now = Math.floor(Date.now() / 1000);

    const raw = await kv.get(key);
    let state: ThrottleState | null = null;

    if (raw) {
        try {
            // support both new JSON and legacy numeric string
            if (raw.trim().startsWith("{")) state = JSON.parse(raw) as ThrottleState;
            else state = { n: Number(raw) || 0, resetAt: now + windowSec };
        } catch {
            state = { n: 0, resetAt: now + windowSec };
        }
    }

    if (!state || !Number.isFinite(state.resetAt) || now >= state.resetAt) {
        state = { n: 0, resetAt: now + windowSec };
    }

    if (state.n >= limit) {
        return { ok: false, remaining: 0, resetAt: state.resetAt };
    }

    state.n += 1;

    // IMPORTANT: preserve resetAt by using absolute expiration
    await kv.put(key, JSON.stringify(state), { expiration: state.resetAt });

    return { ok: true, remaining: Math.max(0, limit - state.n), resetAt: state.resetAt };
}
