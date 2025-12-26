import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { redirect, SECURITY_HEADERS_NOSTORE } from "../../../../lib/http";

type Row = { r2_key: string; content_type: string; status: string };

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
        const alt = String(form.get("alt") ?? "").trim();
        const title = String(form.get("title") ?? "").trim() || null;
        const caption = String(form.get("caption") ?? "").trim() || null;
        const category = String(form.get("category") ?? "").trim();

        if (!id) return go(url.origin, "/admin/photos/pending?err=missing");
        if (!category) return go(url.origin, `/admin/photos/pending?err=category`);
        if (alt.length < 5) return go(url.origin, `/admin/photos/pending?err=alt`);

        const row = (await DB.prepare(
            `SELECT r2_key, content_type, status FROM photos WHERE id = ?`
        )
            .bind(id)
            .first()) as Row | null;

        if (!row || row.status !== "pending") return go(url.origin, "/admin/photos/pending?err=notfound");

        const srcKey = row.r2_key;
        const dstKey = srcKey.replace(/^pending\//, "approved/");
        if (dstKey === srcKey) return go(url.origin, "/admin/photos/pending?err=key");

        const obj = await BUCKET.get(srcKey);
        if (!obj) return go(url.origin, "/admin/photos/pending?err=missingfile");

        const bytes = await obj.arrayBuffer();

        await BUCKET.put(dstKey, bytes, {
            httpMetadata: { contentType: row.content_type || "application/octet-stream" },
        });

        // delete pending object once (best effort)
        try {
            await BUCKET.delete(srcKey);
        } catch {
            // best-effort
        }

        const r = await DB.prepare(`
      UPDATE photos
      SET status = 'approved',
          r2_key = ?,
          alt = ?,
          title = ?,
          caption = ?,
          category = ?,
          approved_at = datetime('now')
      WHERE id = ? AND status = 'pending'
    `).bind(dstKey, alt, title, caption, category, id).run();

        if (!r.success || (r.meta?.changes ?? 0) !== 1) {
            // rollback approved object
            try {
                await BUCKET.delete(dstKey);
            } catch {
                // best-effort
            }
            return go(url.origin, "/admin/photos/pending?err=update");
        }

        return go(url.origin, "/admin/photos/pending?ok=approved");
    } catch {
        return go(url.origin, "/admin/photos/pending?err=server");
    }
};