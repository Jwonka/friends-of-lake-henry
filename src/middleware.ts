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

export const onRequest = defineMiddleware(async (context, next) => {
    const { pathname, search } = context.url;
    // diagnostics
    if (pathname === "/__health") {
        return new Response("health-ok", { headers: { "content-type": "text/plain" } });
    }
    if (pathname === "/__ping") {
        return new Response("<!doctype html><p>ping</p>", {
            headers: { "content-type": "text/html" },
        });
    }
    if (pathname === "/__debug-next") {
        const r: any = await next();

        const isResponseLike =
            r &&
            typeof r === "object" &&
            typeof r.headers?.get === "function" &&
            typeof r.text === "function" &&
            typeof r.clone === "function";

        return new Response(
            JSON.stringify(
                {
                    typeof: typeof r,
                    ctor: r?.constructor?.name ?? null,
                    isResponseLike,
                    hasHeadersGet: typeof r?.headers?.get === "function",
                    status: r?.status ?? null,
                    contentType: r?.headers?.get?.("content-type") ?? null,
                },
                null,
                2
            ),
            { status: 200, headers: { "content-type": "application/json; charset=utf-8" } }
        );
    }

    const isAdminUi = pathname.startsWith("/admin");
    const isAdminApi = pathname.startsWith("/api/admin");

    // non-admin: PASS THROUGH
    if (!isAdminUi && !isAdminApi) {
        return await next();
    }

    // allow login routes
    if (
        pathname === "/admin/login" ||
        pathname === "/admin/login/" ||
        pathname === "/api/admin/login"
    ) {
        return await next();
    }

    const cookie = context.request.headers.get("cookie") ?? "";
    const m = cookie.match(/(?:^|;\s*)admin_auth=([^;]+)/);

    if (!m) {
        if (isAdminApi) return new Response("Unauthorized", { status: 401 });
        return redirectToLogin(context.url.origin, pathname + search);
    }

    const token = decodeURIComponent(m[1]);
    const [secret, ts] = token.split(":");

    const cookieSecret = context.locals.runtime.env.ADMIN_COOKIE_SECRET;
    if (!secret || secret !== cookieSecret || !ts || !Number.isFinite(Number(ts))) {
        if (isAdminApi) return new Response("Unauthorized", { status: 401 });
        return redirectToLogin(context.url.origin, pathname + search);
    }

    return await next();
});
