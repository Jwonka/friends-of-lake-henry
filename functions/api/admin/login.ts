import type { PagesFunction } from "@cloudflare/workers-types/experimental";
type WorkerResponse = import("@cloudflare/workers-types/experimental").Response;

export interface Env {
    ADMIN_USERNAME: string;
    ADMIN_PASSWORD: string;
    ADMIN_COOKIE_SECRET: string;
}

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

function redirect(urlStr: string, pathWithQuery: string): WorkerResponse {
    const url = new URL(urlStr);
    const location = `${url.origin}${pathWithQuery}`;
    return new Response(null, {
        status: 303,
        headers: { location, ...SECURITY_HEADERS },
    }) as unknown as WorkerResponse;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    const form = await request.formData();
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    const next = String(form.get("next") ?? "/admin");

    // 1) server misconfig
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_COOKIE_SECRET) {
        return redirect(request.url, "/admin/login?err=server");
    }

    // 2) invalid credentials (single generic outcome)
    if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
        return redirect(request.url, `/admin/login?err=1&next=${encodeURIComponent(next)}`);
    }

    const token = `${env.ADMIN_COOKIE_SECRET}:${Date.now()}`;

    const res = redirect(request.url, next.startsWith("/admin") ? next : "/admin");
    res.headers.set(
        "Set-Cookie",
        `admin_auth=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 8}`
    );
    return res;
};

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            "access-control-allow-methods": "POST,OPTIONS",
            "access-control-allow-headers": "content-type",
            ...SECURITY_HEADERS,
        },
    }) as unknown as WorkerResponse;
};
