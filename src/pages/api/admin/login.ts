import type { APIRoute } from "astro";

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
   "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

const SESSION_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function redirect(origin: string, pathWithQuery: string) {
    return new Response(null, {
        status: 303,
        headers: { location: `${origin}${pathWithQuery}`, ...SECURITY_HEADERS },
    });
}

function toBase64Url(bytes: Uint8Array) {
    // btoa expects binary string
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const b64 = btoa(bin);
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomSessionId() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return toBase64Url(bytes);
}


export const POST: APIRoute = async (context) => {
    try {
        const form = await context.request.formData();
        const username = String(form.get("username") ?? "").trim();
        const password = String(form.get("password") ?? "").trim();
        const next = String(form.get("next") ?? "/admin").trim();

        const env = context.locals.runtime.env;

        // Required bindings
        if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.SESSION) {
            return redirect(context.url.origin, "/admin/login?err=server");
        }

        if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
            return redirect(
                context.url.origin,
                `/admin/login?err=1&next=${encodeURIComponent(next)}`
            );
        }

        const safeNext = next.startsWith("/admin") ? next : "/admin";

        // Create server-side session
        const sessionId = randomSessionId();
        const now = Date.now();
        const expiresAt = new Date(now + SESSION_TTL_SECONDS * 1000).toISOString();

        const key = `admin_sess:${sessionId}`;
        const value = JSON.stringify({
            role: "admin",
            createdAt: new Date(now).toISOString(),
            expiresAt,
        });

        // Cloudflare KV supports expirationTtl in seconds
        await env.SESSION.put(key, value, { expirationTtl: SESSION_TTL_SECONDS });

        const res = redirect(context.url.origin, safeNext);
        res.headers.append(
            "Set-Cookie",
            `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`
        );

        // actively clear the legacy cookie if it exists, so old sessions don’t linger
        res.headers.append(
            "Set-Cookie",
            `admin_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
        );

        return res;
    } catch {
        return redirect(context.url.origin, "/admin/login?err=server");
    }
};
