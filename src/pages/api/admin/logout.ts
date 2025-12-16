import type { APIRoute } from "astro";

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

export const POST: APIRoute = async (context) => {
    const res = new Response(null, {
        status: 303,
        headers: { location: `${context.url.origin}/admin/login`, ...SECURITY_HEADERS },
    });

    // expire cookie
    res.headers.append(
        "Set-Cookie",
        `admin_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    );

    return res;
};
