import type { APIRoute } from "astro";

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

function redirect(origin: string, path: string) {
    return new Response(null, { status: 303, headers: { location: `${origin}${path}`, ...SECURITY_HEADERS } });
}

export const POST: APIRoute = async ({ request, locals, url }) => {
    try {
        const form = await request.formData();
        const id = String(form.get("id") ?? "").trim();
        if (!id) return redirect(url.origin, "/admin/events?err=notfound");

        const DB = (locals as any).runtime.env.DB;
        const res = await DB.prepare(`DELETE FROM events WHERE id = ?`).bind(id).run();
        // @ts-ignore D1 returns changes sometimes
        const changed = (res?.meta?.changes ?? 0) as number;

        return redirect(url.origin, changed ? "/admin/events?ok=deleted" : "/admin/events?err=notfound");
    } catch {
        return redirect(url.origin, "/admin/events?err=server");
    }
};
