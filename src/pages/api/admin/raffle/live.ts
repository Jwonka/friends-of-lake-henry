import type { APIRoute } from "astro";
import { json } from "../../../../lib/http";

type LiveConfig = {
    latestVideoUrl: string | null;
    updatedAt: string | null;
};

const KEY = "raffle_live";

function canonicalizeFacebookUrl(input: string): string | null {
    try {
        const u = new URL(input.trim());

        // Accept common hosts
        const host = u.hostname.replace(/^www\./, "");
        if (host !== "facebook.com" && host !== "m.facebook.com") return null;

        // Normalize host
        u.hostname = "www.facebook.com";

        // Strip tracking params; keep only v for /watch
        const keepV = u.pathname.startsWith("/watch") ? u.searchParams.get("v") : null;
        u.search = "";
        if (keepV) u.searchParams.set("v", keepV);

        // /videos/<id>
        const mVideo = u.pathname.match(/\/videos\/(\d+)/);
        if (mVideo?.[1]) {
            return `https://www.facebook.com/61552199315213/videos/${mVideo[1]}/`;
        }

        // /watch?v=<id>
        if (u.pathname.startsWith("/watch")) {
            const v = u.searchParams.get("v");
            if (v && /^\d+$/.test(v)) {
                return `https://www.facebook.com/61552199315213/videos/${v}/`;
            }
            return null;
        }

        // /reel/<id>  (IMPORTANT: keep as reel)
        const mReel = u.pathname.match(/\/reel\/(\d+)/);
        if (mReel?.[1]) {
            return `https://www.facebook.com/reel/${mReel[1]}`;
        }

        return null;
    } catch {
        return null;
    }
}

async function getConfig(env: any): Promise<LiveConfig> {
    const raw = await env.CONFIG?.get(KEY);
    if (!raw) return { latestVideoUrl: null, updatedAt: null };

    try {
        const parsed = JSON.parse(raw) as any;
        const latest = typeof parsed.latestVideoUrl === "string" ? parsed.latestVideoUrl.trim() : "";
        return {
            latestVideoUrl: latest.length ? latest : null,
            updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
        };
    } catch {
        return { latestVideoUrl: null, updatedAt: null };
    }
}

export const GET: APIRoute = async (context) => {
    const env = (context.locals as any).runtime?.env as any;
    if (!env.CONFIG) return json({ ok: false, error: "KV not bound (CONFIG)" }, 500);

    const cfg = await getConfig(env);
    return json({ ok: true, config: cfg }, 200);
};

export const POST: APIRoute = async (context) => {
    const env = (context.locals as any).runtime?.env as any;
    if (!env.CONFIG) return json({ ok: false, error: "KV not bound (CONFIG)" }, 500);

    let body: any;
    try {
        body = await context.request.json();
    } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const latestRaw = String(body.latestVideoUrl ?? "").trim();
    let nextLatest: string | null = null;
    if (latestRaw.length) {
        const canon = canonicalizeFacebookUrl(latestRaw);
        if (!canon) {
            return json(
                { ok: false, error: "Paste a Facebook video or reel URL (videos/<id>, watch?v=<id>, or reel/<id>)." },
                400
            );
        }
        nextLatest = canon;
    }

    const updatedAt = new Date().toISOString();
    const cfg: LiveConfig = { latestVideoUrl: nextLatest, updatedAt };

    await env.CONFIG.put(KEY, JSON.stringify(cfg));
    return json({ ok: true, config: cfg }, 200);
};

