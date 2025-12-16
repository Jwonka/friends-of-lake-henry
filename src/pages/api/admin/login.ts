import type { APIRoute } from "astro";

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

function redirect(origin: string, pathWithQuery: string) {
    return new Response(null, {
        status: 303,
        headers: { location: `${origin}${pathWithQuery}`, ...SECURITY_HEADERS },
    });
}

export const POST: APIRoute = async (context) => {
    try {
        const form = await context.request.formData();
        const username = String(form.get("username") ?? "").trim();
        const password = String(form.get("password") ?? "").trim();
        const next = String(form.get("next") ?? "/admin").trim();

        const env = context.locals.runtime.env;

        if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_COOKIE_SECRET) {
            return redirect(context.url.origin, "/admin/login?err=server");
        }

        if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
            return redirect(context.url.origin, `/admin/login?err=1&next=${encodeURIComponent(next)}`);
        }

        const safeNext = next.startsWith("/admin") ? next : "/admin";
        const token = `${env.ADMIN_COOKIE_SECRET}:${Date.now()}`;

        const res = redirect(context.url.origin, safeNext);
        res.headers.append(
            "Set-Cookie",
            `admin_auth=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 8}`
        );
        return res;
    } catch {
        return redirect(context.url.origin, "/admin/login?err=server");
    }
};

