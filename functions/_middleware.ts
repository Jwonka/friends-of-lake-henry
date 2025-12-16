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
    const next = encodeURIComponent(nextPath);
    const location = `${url.origin}/admin/login?err=${encodeURIComponent(err)}&next=${next}`;

    return new Response(null, {
        status: 302,
        headers: { location, ...SECURITY_HEADERS },
    }) as unknown as WorkerResponse;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
    const url = new URL(request.url);

    // Only guard /admin routes
    if (!url.pathname.startsWith("/admin")) return next() as unknown as WorkerResponse;

    // Allow login page and login API
    if (url.pathname === "/admin/login" || url.pathname === "/api/admin/login") {
        return next() as unknown as WorkerResponse;
    }

    const cookie = request.headers.get("cookie") || "";
    const m = cookie.match(/(?:^|;\s*)admin_auth=([^;]+)/);
    if (!m) return redirectToLogin(request.url, url.pathname + url.search);

    const token = decodeURIComponent(m[1]);
    const [secret] = token.split(":");
    if (!secret || secret !== env.ADMIN_COOKIE_SECRET) {
        return redirectToLogin(request.url, url.pathname + url.search);
    }

    return next() as unknown as WorkerResponse;
};
