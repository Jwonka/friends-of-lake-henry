import type { PagesFunction } from "@cloudflare/workers-types/experimental";
type WorkerResponse = import("@cloudflare/workers-types/experimental").Response;

export interface Env {
    ADMIN_COOKIE_SECRET: string;
}

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

function redirectToLogin(requestUrl: string, nextPath: string, err = "auth"): WorkerResponse {
    const url = new URL(requestUrl);

    // Prevent redirect-loop: never set next to the login page itself
    const safeNext =
        nextPath.startsWith("/admin/login") ? "/admin" : nextPath;

    const next = encodeURIComponent(safeNext);
    const location = `${url.origin}/admin/login?err=${encodeURIComponent(err)}&next=${next}`;

    return new Response(null, {
        status: 302,
        headers: { location, ...SECURITY_HEADERS },
    }) as unknown as WorkerResponse;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
    const url = new URL(request.url);
    const path = url.pathname;

    // Only guard /admin routes
    if (!path.startsWith("/admin")) return next() as unknown as WorkerResponse;

    // Allow login page (with or without trailing slash)
    if (path === "/admin/login" || path === "/admin/login/") {
        return next() as unknown as WorkerResponse;
    }

    // Allow login API
    if (path === "/api/admin/login") {
        return next() as unknown as WorkerResponse;
    }

    const cookie = request.headers.get("cookie") || "";
    const m = cookie.match(/(?:^|;\s*)admin_auth=([^;]+)/);
    if (!m) return redirectToLogin(request.url, path + url.search);

    const token = decodeURIComponent(m[1]);
    const [secret] = token.split(":");
    if (!secret || secret !== env.ADMIN_COOKIE_SECRET) {
        return redirectToLogin(request.url, path + url.search);
    }

    return next() as unknown as WorkerResponse;
};
