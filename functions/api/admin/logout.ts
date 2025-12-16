import type { PagesFunction } from "@cloudflare/workers-types/experimental";
type WorkerResponse = import("@cloudflare/workers-types/experimental").Response;

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

export const onRequestPost: PagesFunction = async ({ request }) => {
    const url = new URL(request.url);
    const location = `${url.origin}/`;

    const res = new Response(null, {
        status: 303,
        headers: { location, ...SECURITY_HEADERS },
    }) as unknown as WorkerResponse;

    res.headers.set("Set-Cookie", "admin_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
    return res;
};
