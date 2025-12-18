import { defineMiddleware } from "astro/middleware";

const MAX_SESSION_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours
const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

function unauthorized() {
    return new Response("Unauthorized", { status: 401, headers: SECURITY_HEADERS });
}

function redirectToLogin(origin: string, nextPath: string, err = "auth") {
    const isLogin = /^\/admin\/login\/?$/.test(nextPath);
    const safeNext = isLogin ? "/admin" : nextPath;
    const next = encodeURIComponent(safeNext);
    const location = `${origin}/admin/login?err=${encodeURIComponent(err)}&next=${next}`;
    return new Response(null, { status: 302, headers: { location, ...SECURITY_HEADERS } });
}

export const onRequest = defineMiddleware(async (context, next) => {
    const { pathname, search } = context.url;

    const isAdminUi = pathname.startsWith("/admin");
    const isAdminApi = pathname.startsWith("/api/admin");
    if (!isAdminUi && !isAdminApi) return next();

    // allow auth endpoints
    if (
        pathname === "/admin/login" ||
        pathname === "/admin/login/" ||
        pathname === "/api/admin/login" ||
        pathname === "/admin/logout" ||
        pathname === "/api/admin/logout"
    ) {
        return next();
    }

    const cookie = context.request.headers.get("cookie") ?? "";
    const m = cookie.match(/(?:^|;\s*)admin_auth=([^;]+)/);
    if (!m) return isAdminApi ? unauthorized() : redirectToLogin(context.url.origin, pathname + search);

    let token = m[1];
    try {
        token = decodeURIComponent(token);
    } catch {
        return isAdminApi ? unauthorized() : redirectToLogin(context.url.origin, pathname + search);
    }

    const [secret, tsRaw] = token.split(":");
    const ts = Number(tsRaw);

    const cookieSecret = context.locals.runtime.env.ADMIN_COOKIE_SECRET;
    if (!cookieSecret) {
        return isAdminApi
            ? unauthorized()
            : redirectToLogin(context.url.origin, pathname + search, "server");
    }

    // Validate secret
    if (!secret || secret !== cookieSecret) {
        return isAdminApi ? unauthorized() : redirectToLogin(context.url.origin, pathname + search);
    }

    // Validate timestamp
    if (!Number.isFinite(ts)) {
        return isAdminApi ? unauthorized() : redirectToLogin(context.url.origin, pathname + search);
    }

    const age = Date.now() - ts;
    if (age < 0 || age > MAX_SESSION_AGE_MS) {
        // expired or clock-skewed token
        return isAdminApi
            ? unauthorized()
            : redirectToLogin(context.url.origin, pathname + search, "auth");
    }

    return next();
});