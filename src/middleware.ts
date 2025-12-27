import { defineMiddleware } from "astro/middleware";
import { SECURITY_HEADERS_NOSTORE } from "./lib/http";

const BASE_SECURITY_HEADERS: Record<string, string> = {
    // Transport
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",

    // Hardening
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",

    // Clickjacking defense (legacy + CSP frame-ancestors below)
    "X-Frame-Options": "DENY",
};

const BASE_CSP = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "connect-src 'self' https://challenges.cloudflare.com https://api.resend.com",
    "frame-src https://challenges.cloudflare.com",
].join("; ");

const SESSION_COOKIE = "admin_session";
const SESSION_PREFIX = "admin_sess:";

function unauthorized() {
    return new Response("Unauthorized", { status: 401, headers: SECURITY_HEADERS_NOSTORE });
}

function redirectToLogin(origin: string, nextPath: string, err = "auth") {
    const isLogin = /^\/admin\/login\/?$/.test(nextPath);
    const safeNext = isLogin ? "/admin" : nextPath;
    const next = encodeURIComponent(safeNext);
    const location = `${origin}/admin/login?err=${encodeURIComponent(err)}&next=${next}`;
    const res = new Response(null, { status: 302, headers: { location, ...SECURITY_HEADERS_NOSTORE },});

    // clear legacy cookie on redirect so old auth cannot linger.
    res.headers.append("Set-Cookie", `admin_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` );

    // clear the session cookie too, so a dead cookie doesn't stick around
    res.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    );
    return res;
}

function getCookieValue(cookieHeader: string, name: string): string | null {
    // Simple cookie parsing; avoids regex pitfalls with similarly-named cookies.
    const parts = cookieHeader.split(";");
    for (const part of parts) {
        const [k, ...rest] = part.trim().split("=");
        if (k === name) return rest.join("=") || "";
    }
    return null;
}

function forbidden() {
    return new Response("Forbidden", { status: 403, headers: SECURITY_HEADERS_NOSTORE });
}

function isMutationMethod(method: string) {
    return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function passesCsrf(context: Parameters<typeof defineMiddleware>[0] extends (ctx: infer C, next: any) => any ? C : never) {
    // same-origin browser requests.
    const origin = context.request.headers.get("origin");
    const referer = context.request.headers.get("referer");
    const siteOrigin = context.url.origin;

    // Prefer Origin when present (most modern browsers send it on POST)
    if (origin) return origin === siteOrigin;

    // Fall back to Referer (common for form posts)
    if (referer) return referer.startsWith(siteOrigin + "/") || referer === siteOrigin + "/";

    // If neither is present, fail closed for admin mutations.
    return false;
}

export const onRequest = defineMiddleware(async (context, next) => {
    const { pathname, search } = context.url;

    const isAdminUi = pathname.startsWith("/admin");
    const isAdminApi = pathname.startsWith("/api/admin");

    // Allow auth endpoints through (login/logout)
    if (
        pathname === "/admin/login" ||
        pathname === "/admin/login/" ||
        pathname === "/api/admin/login"
    ) {
        return next();
    }

    // allow OPTIONS preflight to pass through for admin APIs
    if (isAdminApi && context.request.method === "OPTIONS") { return next(); }

    // CSRF protection for admin API mutations
    if (isAdminApi && isMutationMethod(context.request.method)) {
        if (!passesCsrf(context)) return forbidden();
    }

    const env = context.locals.runtime.env as any;

    // Require KV binding
    if (!env.SESSION) {
        return isAdminApi
            ? unauthorized()
            : redirectToLogin(context.url.origin, pathname + search, "server");
    }

    const cookieHeader = context.request.headers.get("cookie") ?? "";
    const sessionId = getCookieValue(cookieHeader, SESSION_COOKIE);

    if (!sessionId) {
        return isAdminApi
            ? unauthorized()
            : redirectToLogin(context.url.origin, pathname + search);
    }

    // Look up server-side session
    const key = `${SESSION_PREFIX}${sessionId}`;
    const raw = await env.SESSION.get(key);

    if (!raw) {
        // Missing/expired/invalid session
        return isAdminApi
            ? unauthorized()
            : redirectToLogin(context.url.origin, pathname + search);
    }

    // check on stored session shape
    // (KV TTL already enforces expiry; this protects against bad values)
    try {
        const parsed = JSON.parse(raw);
        if (parsed?.role !== "admin") {
            return isAdminApi
                ? unauthorized()
                : redirectToLogin(context.url.origin, pathname + search);
        }
    } catch {
        return isAdminApi
            ? unauthorized()
            : redirectToLogin(context.url.origin, pathname + search);
    }

    const res = await next();

    // Baseline security headers for ALL HTML responses (public + admin).
    const ct = res.headers.get("Content-Type") || "";
    if (ct.includes("text/html")) {
        for (const [k, v] of Object.entries(BASE_SECURITY_HEADERS)) {
            // Don't clobber if something upstream already set it.
            if (!res.headers.has(k)) res.headers.set(k, v);
        }

        // CSP is additive; set if not already present.
        if (!res.headers.has("Content-Security-Policy")) {
            res.headers.set("Content-Security-Policy", BASE_CSP);
        }

        // Only for Admin UI HTML (not /api/admin and not /admin assets like images/css/js)
        if (isAdminUi && !isAdminApi) {
            res.headers.set("Cache-Control", "no-store");
            res.headers.set("Pragma", "no-cache");
            res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
        }
    }

    return res;
});
