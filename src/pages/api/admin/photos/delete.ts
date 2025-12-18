import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

type Row = { r2_key: string; status: string };

export const POST: APIRoute = async ({ locals, request, url }) => {
    const env = (locals as any).runtime?.env as { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket } | undefined;
    const DB = env?.DB;
    const BUCKET = env?.PHOTOS_BUCKET;
    if (!DB || !BUCKET) return new Response("Server misconfigured", { status: 500 });

    const form = await request.formData();
    const id = String(form.get("id") ?? "").trim();
    if (!id) return new Response("Missing id", { status: 400 });

    const row = (await DB.prepare(`SELECT r2_key, status FROM photos WHERE id = ?`)
        .bind(id)
        .first()) as Row | null;

    if (!row) return new Response("Not found", { status: 404 });
    if (row.status !== "approved") return new Response("Not approved", { status: 409 });

    if (row.r2_key) await BUCKET.delete(row.r2_key);
    await DB.prepare(`DELETE FROM photos WHERE id = ?`).bind(id).run();

    return Response.redirect(`${url.origin}/admin/photos`, 303);
};
