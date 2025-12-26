import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { redirect } from "../../../../lib/http";

function isAllowedImageType(type: string) {
    return (
        type === "image/jpeg" ||
        type === "image/png" ||
        type === "image/webp" ||
        type === "image/gif"
    );
}

function extFromContentType(type: string) {
    switch (type) {
        case "image/jpeg":
            return "jpg";
        case "image/png":
            return "png";
        case "image/webp":
            return "webp";
        case "image/gif":
            return "gif";
        default:
            return "bin";
    }
}

export const POST: APIRoute = async (context) => {
    try {
        const form = await context.request.formData();
        const id = String(form.get("id") ?? "").trim();
        const alt = String(form.get("alt") ?? "").trim();
        const fileLike = form.get("poster");

        if (!id) return redirect(`${context.url.origin}/admin/events?err=invalid`);
        if (alt.length < 5) return redirect(`${context.url.origin}/admin/events/${encodeURIComponent(id)}?err=alt`);

        if (!fileLike || typeof fileLike === "string") {
            return redirect(`${context.url.origin}/admin/events/${encodeURIComponent(id)}?err=file`);
        }

        const file = fileLike as File;

        if (!isAllowedImageType(file.type)) {
            return redirect(`${context.url.origin}/admin/events/${encodeURIComponent(id)}?err=type`);
        }

        const MAX_BYTES = 8 * 1024 * 1024;
        if (file.size <= 0 || file.size > MAX_BYTES) {
            return redirect(`${context.url.origin}/admin/events/${encodeURIComponent(id)}?err=size`);
        }

        const env = (context.locals as any).runtime?.env as
            | { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket }
            | undefined;

        const DB = env?.DB;
        const BUCKET = env?.PHOTOS_BUCKET;
        if (!DB || !BUCKET) return redirect(`${context.url.origin}/admin/events/${encodeURIComponent(id)}?err=server`);

        // Ensure event exists and get existing poster_key
        const existing = await DB.prepare(`
      SELECT poster_key
      FROM events
      WHERE id = ?
    `).bind(id).first<{ poster_key: string | null }>();

        if (!existing) return redirect(`${context.url.origin}/admin/events?err=notfound`);

        const ext = extFromContentType(file.type);
        const r2Key = `events/posters/${id}.${ext}`;

        const buf = await file.arrayBuffer();

        // Upload poster to R2 (overwrite is fine)
        await BUCKET.put(r2Key, buf, {
            httpMetadata: { contentType: file.type },
        });

        try {
            await DB.prepare(`
        UPDATE events
        SET poster_key = ?, poster_alt = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(r2Key, alt, id).run();
        } catch (e) {
            // prevent orphaned object if DB write fails
            await BUCKET.delete(r2Key);
            throw e;
        }

        // Delete old poster object if it was different (optional cleanup)
        if (existing.poster_key && existing.poster_key !== r2Key) {
            await BUCKET.delete(existing.poster_key);
        }

        return redirect(`${context.url.origin}/admin/events/${encodeURIComponent(id)}?ok=poster`);
    } catch (e) {
        console.error(e);
        return redirect(`${context.url.origin}/admin/events?err=server`);
    }
};
