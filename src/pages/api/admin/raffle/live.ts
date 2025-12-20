import type { APIRoute } from "astro";

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

type LiveConfig = {
    latestVideoUrl: string | null;
    updatedAt: string | null; // ISO
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

function isValidFacebookVideoUrl(url: string): boolean {
    // Keep it strict to avoid reels and weird URLs that won't embed reliably.
    // Accepts: https://www.facebook.com/<pageId or name>/videos/<id>
    try {
        const u = new URL(url);
        if (u.hostname !== "www.facebook.com" && u.hostname !== "facebook.com") return false;
        return /\/videos\/\d+/.test(u.pathname);
    } catch {
        return false;
    }
}

async function getConfig(env: any): Promise<LiveConfig> {
    const raw = await env.CONFIG?.get(KEY);
    if (!raw) return { latestVideoUrl: null, updatedAt: null };

    try {
        const parsed = JSON.parse(raw) as LiveConfig;
        return {
            latestVideoUrl: parsed.latestVideoUrl ?? null,
            updatedAt: parsed.updatedAt ?? null,
        };
    } catch {
        return { latestVideoUrl: null, updatedAt: null };
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

    // Allow clearing the value
    let latestVideoUrl: string | null = null;
    if (urlRaw.length) {
        if (!isValidFacebookVideoUrl(urlRaw)) {
            return json(
                {
                    ok: false,
                    error:
                        "Please paste a Facebook video URL like https://www.facebook.com/<page>/videos/<id> (reels are not supported reliably).",
                },
                400
            );
        }
        latestVideoUrl = urlRaw;
    }

    const updatedAt = new Date().toISOString();
    const cfg: LiveConfig = { latestVideoUrl, updatedAt };

    await env.CONFIG.put(KEY, JSON.stringify(cfg));
    return json({ ok: true, config: cfg });
};
