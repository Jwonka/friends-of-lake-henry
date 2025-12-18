import { defineMiddleware } from "astro/middleware";

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

    const token = m[1]; // do NOT decode unless you encoded when writing it
    const [secret, ts] = token.split(":");

    const cookieSecret = context.locals.runtime.env.ADMIN_COOKIE_SECRET;
    if (!cookieSecret) return isAdminApi ? unauthorized() : redirectToLogin(context.url.origin, pathname + search, "server");

    if (!secret || secret !== cookieSecret || !ts || !Number.isFinite(Number(ts))) {
        return isAdminApi ? unauthorized() : redirectToLogin(context.url.origin, pathname + search);
    }

    return next();
});