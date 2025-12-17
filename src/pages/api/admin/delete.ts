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
        const id = Number(String(form.get("id") ?? "").trim());

        if (!Number.isFinite(id) || id <= 0) {
            return redirect(context.url.origin, "/admin/donors?err=input");
        }

        const env = context.locals.runtime.env;
        await env.DB.prepare(`DELETE FROM donors WHERE id = ?`).bind(id).run();

        return redirect(context.url.origin, "/admin/donors?ok=deleted");
    } catch {
        return redirect(context.url.origin, "/admin/donors?err=server");
    }
};
