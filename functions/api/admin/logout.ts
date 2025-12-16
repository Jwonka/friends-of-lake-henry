import type { PagesFunction } from "@cloudflare/workers-types/experimental";
type WorkerResponse = import("@cloudflare/workers-types/experimental").Response;

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

function redirect(urlStr: string, path: string): WorkerResponse {
    const url = new URL(urlStr);
    return new Response(null, {
        status: 303,
        headers: { location: `${url.origin}${path}`, ...SECURITY_HEADERS },
    }) as unknown as WorkerResponse;
}

export const onRequestPost: PagesFunction = async ({ request }) => {
    const res = redirect(request.url, "/");
    res.headers.set(
        "Set-Cookie",
        "admin_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    );
    return res as unknown as WorkerResponse;
};