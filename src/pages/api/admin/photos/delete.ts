import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

type Row = { r2_key: string; status: string };

export const POST: APIRoute = async ({ locals, request, url }) => {
    const env = (locals as any).runtime?.env as { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket } | undefined;
    const DB = env?.DB;
    const BUCKET = env?.PHOTOS_BUCKET;
    if (!DB || !BUCKET) return Response.redirect(`${url.origin}/admin/photos/approved?err=server`, 303);

    const form = await request.formData();
    const id = String(form.get("id") ?? "").trim();
    if (!id) return Response.redirect(`${url.origin}/admin/photos/approved?err=server`, 303);

    const row = (await DB.prepare(`SELECT r2_key, status FROM photos WHERE id = ?`)
        .bind(id)
        .first()) as Row | null;

    if (!row) return Response.redirect(`${url.origin}/admin/photos/approved?err=notfound`, 303);
    if (row.status !== "approved") return Response.redirect(`${url.origin}/admin/photos/approved?err=notfound`, 303);

    if (row.r2_key) {
        try { await BUCKET.delete(row.r2_key); } catch {}
    }

    await DB.prepare(`DELETE FROM photos WHERE id = ?`).bind(id).run();

    return Response.redirect(`${url.origin}/admin/photos/approved?ok=deleted`, 303);
};
