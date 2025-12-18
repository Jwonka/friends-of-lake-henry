import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

type Row = { r2_key: string; content_type: string; status: string };

function bad(msg: string, status = 400) {
    return new Response(msg, { status });
}

export const POST: APIRoute = async ({ locals, request, url }) => {
    const env = (locals as any).runtime?.env as { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket } | undefined;
    const DB = env?.DB;
    const BUCKET = env?.PHOTOS_BUCKET;
    if (!DB || !BUCKET) return bad("Server misconfigured", 500);

    const form = await request.formData();
    const id = String(form.get("id") ?? "").trim();
    const alt = String(form.get("alt") ?? "").trim();
    const title = String(form.get("title") ?? "").trim() || null;
    const caption = String(form.get("caption") ?? "").trim() || null;

    if (!id) return bad("Missing id");
    if (alt.length < 5) return bad("Alt too short");

    const row = (await DB.prepare(
        `SELECT r2_key, content_type, status FROM photos WHERE id = ?`
    )
        .bind(id)
        .first()) as Row | null;

    if (!row || row.status !== "pending") return bad("Not found", 404);

    const srcKey = row.r2_key;
    const dstKey = srcKey.replace(/^pending\//, "approved/");
    if (dstKey === srcKey) return bad("Bad key", 500);

    const obj = await BUCKET.get(srcKey);
    if (!obj) return bad("Missing object", 404);

    // copy then delete (R2 has no rename)
    const bytes = await obj.arrayBuffer();

    await BUCKET.put(dstKey, bytes, {
        httpMetadata: { contentType: row.content_type || "application/octet-stream" },
    });
    await BUCKET.delete(srcKey);

    await DB.prepare(`
    UPDATE photos
    SET status = 'approved',
        r2_key = ?,
        alt = ?,
        title = ?,
        caption = ?,
        approved_at = datetime('now')
    WHERE id = ?
  `).bind(dstKey, alt, title, caption, id).run();

    return Response.redirect(`${url.origin}/admin/photos/pending?ok=approved`, 303);
};
