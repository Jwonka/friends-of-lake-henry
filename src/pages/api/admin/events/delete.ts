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
        if (!id) return redirectTo(url.origin, "/admin/events?err=notfound");

        const env = (locals as any).runtime?.env as { DB?: D1Database } | undefined;
        const DB = env?.DB;
        if (!DB) { return redirectTo(url.origin, "/admin/events?err=server"); }

        const res = await DB.prepare(`DELETE FROM events WHERE id = ?`).bind(id).run();
        // @ts-ignore D1 returns changes sometimes
        const changed = (res?.meta?.changes ?? 0) as number;

        return redirectTo(url.origin, changed ? "/admin/events?ok=deleted" : "/admin/events?err=notfound");
    } catch {
        return redirectTo(url.origin, "/admin/events?err=server");
    }
};
