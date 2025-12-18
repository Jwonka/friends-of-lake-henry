import { defineMiddleware } from "astro/middleware";

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

function redirectToLogin(origin: string, nextPath: string, err = "auth") {
    const isLogin = /^\/admin\/login\/?$/.test(nextPath);
    const safeNext = isLogin ? "/admin" : nextPath;
    const next = encodeURIComponent(safeNext);
    const location = `${origin}/admin/login?err=${encodeURIComponent(err)}&next=${next}`;
    return new Response(null, { status: 302, headers: { location, ...SECURITY_HEADERS } });
}

async function nextResponse(next: () => Promise<Response | unknown>) {
    const result = await next();
    return result instanceof Response ? result : new Response(String(result));
}

export const onRequest = defineMiddleware(async (context, next) => {
    const { pathname, search } = context.url;

    const isAdminUi = pathname.startsWith("/admin");
    const isAdminApi = pathname.startsWith("/api/admin");

    // non-admin paths
    if (!isAdminUi && !isAdminApi) {
        return nextResponse(next);
    }

    // allow login UI
    if (pathname === "/admin/login" || pathname === "/admin/login/") {
        return nextResponse(next);
    }

    // allow login API
    if (pathname === "/api/admin/login") {
        return nextResponse(next);
    }

    const cookie = context.request.headers.get("cookie") ?? "";
    const m = cookie.match(/(?:^|;\s*)admin_auth=([^;]+)/);

    if (!m) {
        if (isAdminApi) {
            return new Response("Unauthorized", { status: 401, headers: SECURITY_HEADERS });
        }
        return redirectToLogin(context.url.origin, pathname + search, "auth");
    }

    const token = decodeURIComponent(m[1]);
    const [secret, ts] = token.split(":");

    const cookieSecret = context.locals.runtime.env.ADMIN_COOKIE_SECRET;
    if (!secret || secret !== cookieSecret || !ts || !Number.isFinite(Number(ts))) {
        if (isAdminApi) {
            return new Response("Unauthorized", { status: 401, headers: SECURITY_HEADERS });
        }
        return redirectToLogin(context.url.origin, pathname + search, "auth");
    }

    // authenticated admin paths
    return nextResponse(next);
});
