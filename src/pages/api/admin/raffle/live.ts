import type { APIRoute } from "astro";

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

type LiveConfig = {
    latestVideoUrl: string | null;
    previousVideoUrl: string | null; // for old KV records
    updatedAt: string | null;
};

const KEY = "raffle_live";

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...SECURITY_HEADERS,
            "Content-Type": "application/json; charset=utf-8",
        },
    });
}

function extractFacebookVideoId(input: string): string | null {
    try {
        const u = new URL(input);

        // Accept common hosts
        const host = u.hostname.replace(/^www\./, "");
        if (host !== "facebook.com" && host !== "m.facebook.com") return null;

        // 1) /<page>/videos/<id> or /videos/<id>
        const m1 = u.pathname.match(/\/videos\/(\d+)/);
        if (m1?.[1]) return m1[1];

        // 2) /watch/?v=<id>
        const v = u.searchParams.get("v");
        if (v && /^\d+$/.test(v)) return v;

        return null;
    } catch {
        return null;
    }
}

function normalizeFacebookVideoUrl(input: string): string | null {
    const id = extractFacebookVideoId(input);
    if (!id) return null;

    // Canonical URL that FB embed reliably accepts
    return `https://www.facebook.com/61552199315213/videos/${id}/`;
}

async function getConfig(env: any): Promise<LiveConfig> {
    const raw = await env.CONFIG?.get(KEY);
    if (!raw) return { latestVideoUrl: null, previousVideoUrl: null, updatedAt: null };

    try {
        const parsed = JSON.parse(raw) as Partial<LiveConfig>;
        return {
            latestVideoUrl: typeof parsed.latestVideoUrl === "string" ? parsed.latestVideoUrl : null,
            previousVideoUrl: typeof parsed.previousVideoUrl === "string" ? parsed.previousVideoUrl : null,
            updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
        };
    } catch {
        return { latestVideoUrl: null, previousVideoUrl: null, updatedAt: null };
    }
}

export const GET: APIRoute = async (context) => {
    const env = context.locals.runtime.env;
    if (!env.CONFIG) return json({ ok: false, error: "KV not bound (CONFIG)" }, 500);

    const cfg = await getConfig(env);
    return json({ ok: true, config: cfg });
};

export const POST: APIRoute = async (context) => {
    const env = context.locals.runtime.env;
    if (!env.CONFIG) return json({ ok: false, error: "KV not bound (CONFIG)" }, 500);

    let body: any;
    try {
        body = await context.request.json();
    } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const urlRaw = String(body.latestVideoUrl ?? "").trim();

    // read existing config so we can roll "previous"
    const existing = await getConfig(env);

    let nextLatest: string | null = null;
    if (urlRaw.length) {
        const normalized = normalizeFacebookVideoUrl(urlRaw);
        if (!normalized) {
            return json(
                { ok: false, error: "Please paste a Facebook video URL (example: https://www.facebook.com/<page>/videos/<id> or https://www.facebook.com/watch/?v=<id>)." },
                400
            );
        }
        nextLatest = normalized;
    }

    // If admin is saving a new non-empty latest, roll the old latest into previous
    const nextPrevious =
        nextLatest && existing.latestVideoUrl && existing.latestVideoUrl !== nextLatest
            ? existing.latestVideoUrl
            : (existing.previousVideoUrl ?? null);

    const updatedAt = new Date().toISOString();
    const cfg: LiveConfig = { latestVideoUrl: nextLatest, previousVideoUrl: nextPrevious, updatedAt };

    await env.CONFIG.put(KEY, JSON.stringify(cfg));
    return json({ ok: true, config: cfg });
};

