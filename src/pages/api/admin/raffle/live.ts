import type { APIRoute } from "astro";
import { json } from "../../../../lib/http";

type LiveConfig = {
    latestVideoUrl: string | null;
    updatedAt: string | null;
};

const KEY = "raffle_live";

async function canonicalizeFacebookUrl(input: string, depth = 0): Promise<string | null> {
  if (depth > 3) return null;

  try {
    const u = new URL(input.trim());
    const host = u.hostname.replace(/^www\./, "");

    // l.facebook.com redirect wrapper: /l.php?u=<encoded>
    if (host === "l.facebook.com" && u.pathname === "/l.php") {
      const wrapped = u.searchParams.get("u");
      if (!wrapped) return null;
      return canonicalizeFacebookUrl(decodeURIComponent(wrapped), depth + 1);
    }

    // fb.watch short links require redirect resolution to get the final facebook.com URL
    if (host === "fb.watch") {
      const resolved = await resolveRedirectChain(u.toString());
      if (!resolved) return null;
      return canonicalizeFacebookUrl(resolved, depth + 1);
    }

    // Accept common hosts
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

    // /reel/<id>
    const mReel = u.pathname.match(/\/reel\/(\d+)/);
    if (mReel?.[1]) {
      return `https://www.facebook.com/reel/${mReel[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

async function resolveRedirectChain(url: string): Promise<string | null> {
  let cur = url;

  for (let i = 0; i < 5; i++) {
    const res = await fetch(cur, { redirect: "manual" });
    const loc = res.headers.get("location");

    if (!loc) {
      // no redirect; if we ended on a real URL, use it
      return res.ok ? cur : null;
    }

    // handle relative redirects
    cur = new URL(loc, cur).toString();
  }

  return null;
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
        const canon = await canonicalizeFacebookUrl(latestRaw);
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

