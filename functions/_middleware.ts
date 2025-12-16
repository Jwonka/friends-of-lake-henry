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

    const isAdminUi = path.startsWith("/admin");
    const isAdminApi = path.startsWith("/api/admin");

    // If it's not admin UI or admin API, don't guard it
    if (!isAdminUi && !isAdminApi) return next() as unknown as WorkerResponse;

    // Allow login page (with or without trailing slash)
    if (path === "/admin/login" || path === "/admin/login/") {
        return next() as unknown as WorkerResponse;
    }

    // Allow login API (must be reachable without auth)
    if (path === "/api/admin/login") {
        return next() as unknown as WorkerResponse;
    }

    // ---- AUTH CHECK STARTS HERE ----
    const cookie = request.headers.get("cookie") || "";
    const m = cookie.match(/(?:^|;\s*)admin_auth=([^;]+)/);

    // If not authed:
    if (!m) {
        // API calls should NOT redirect to HTML login
        if (isAdminApi) {
            return new Response("Unauthorized", {
                status: 401,
                headers: { ...SECURITY_HEADERS },
            }) as unknown as WorkerResponse;
        }

        // UI pages redirect to login
        return redirectToLogin(request.url, path + url.search);
    }

    const token = decodeURIComponent(m[1]);
    const [secret] = token.split(":");

    if (!secret || secret !== env.ADMIN_COOKIE_SECRET) {
        if (isAdminApi) {
            return new Response("Unauthorized", {
                status: 401,
                headers: { ...SECURITY_HEADERS },
            }) as unknown as WorkerResponse;
        }
        return redirectToLogin(request.url, path + url.search);
    }
    // ---- AUTH CHECK ENDS HERE ----

    return next() as unknown as WorkerResponse;
};