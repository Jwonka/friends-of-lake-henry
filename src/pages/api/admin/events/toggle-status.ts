import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { redirect } from "../../../../lib/http";

function redirectTo(origin: string, path: string) {
    return redirect(`${origin}${path}`, 303);
}

export const POST: APIRoute = async ({ request, locals, url }) => {
    try {
        const form = await request.formData();
        const id = String(form.get("id") ?? "").trim();
        const next = String(form.get("next") ?? "").trim();

        if (!id) return redirectTo(url.origin, "/admin/events?err=notfound");

        const status = next === "published" ? "published" : "draft";

        const env = (locals as any).runtime?.env as { DB?: D1Database } | undefined;
        const DB = env?.DB;
        if (!DB) return redirectTo(url.origin, "/admin/events?err=server");

        const res = await DB
            .prepare(`UPDATE events SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
            .bind(status, id)
            .run();
        // @ts-ignore
        const changed = (res?.meta?.changes ?? 0) as number;

        return redirectTo(url.origin, changed ? "/admin/events?ok=toggled" : "/admin/events?err=notfound");
    } catch {
        return redirectTo(url.origin, "/admin/events?err=server");
    }
};
