import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { redirect, SECURITY_HEADERS_NOSTORE} from "../../../../lib/http";

type PhotoRow = { r2_key: string; status: string };

function go(origin: string, path: string) {
    return redirect(`${origin}${path}`, 303);
}

export const POST: APIRoute = async ({ locals, request, url }) => {
    try {
        const env = (locals as any).runtime?.env as
            | { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket }
            | undefined;

        const DB = env?.DB;
        const BUCKET = env?.PHOTOS_BUCKET;
        if (!DB || !BUCKET) return go(url.origin, "/admin/photos/pending?err=server");

        const form = await request.formData();
        const id = String(form.get("id") ?? "").trim();
        if (!id) return go(url.origin, "/admin/photos/pending?err=missing");

        const row = (await DB.prepare(`SELECT r2_key, status FROM photos WHERE id = ?`)
            .bind(id)
            .first()) as PhotoRow | null;

        if (!row) return go(url.origin, "/admin/photos/pending?err=notfound");
        if (row.status !== "pending") return go(url.origin, "/admin/photos/pending?err=notpending");

        if (row.r2_key) {
            try {
                await BUCKET.delete(row.r2_key);
            } catch {
                // best-effort
            }
        }

        await DB.prepare(`DELETE FROM photos WHERE id = ?`).bind(id).run();
        return go(url.origin, "/admin/photos/pending?ok=rejected");
    } catch {
        return go(url.origin, "/admin/photos/pending?err=server");
    }
};
