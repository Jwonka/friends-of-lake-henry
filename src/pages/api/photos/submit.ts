import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

const ALLOWED_CATEGORIES = new Set([
    "Restoration",
    "Donations",
    "Community Events",
    "Raffles",
    "Scenery",
]);

function redirect(origin: string, pathWithQuery: string) {
    return new Response(null, {
        status: 303,
        headers: { location: `${origin}${pathWithQuery}`, ...SECURITY_HEADERS },
    });
}

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
        const category = String(form.get("category") ?? "").trim();
        const title = String(form.get("title") ?? "").trim() || null;
        const caption = String(form.get("caption") ?? "").trim() || null;
        const alt = String(form.get("alt") ?? "").trim();
        const submittedBy = String(form.get("submittedBy") ?? "").trim() || null;
        const fileLike = form.get("photo");

        if (!ALLOWED_CATEGORIES.has(category)) {
            return redirect(context.url.origin, "/photos/submit?err=category");
        }

        if (!fileLike || typeof fileLike === "string") {
            return redirect(context.url.origin, "/photos/submit?err=file");
        }

        const file = fileLike as File;

        if (alt.length < 5) {
            return redirect(context.url.origin, "/photos/submit?err=alt");
        }

        if (!isAllowedImageType(file.type)) {
            return redirect(context.url.origin, "/photos/submit?err=type");
        }

        const MAX_BYTES = 8 * 1024 * 1024;
        if (file.size <= 0 || file.size > MAX_BYTES) {
            return redirect(context.url.origin, "/photos/submit?err=size");
        }

        const env = (context.locals as any).runtime?.env as
            | { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket }
            | undefined;

        const DB = env?.DB;
        const BUCKET = env?.PHOTOS_BUCKET;
        if (!DB || !BUCKET) return redirect(context.url.origin, "/photos/submit?err=server");

        const id = crypto.randomUUID();
        const ext = extFromContentType(file.type);
        const r2Key = `pending/${id}.${ext}`;

        const buf = await file.arrayBuffer();

        // upload to R2
        await BUCKET.put(r2Key, buf, {
            httpMetadata: { contentType: file.type },
        });

        try {
            await DB.prepare(
                `INSERT INTO photos
         (id, status, r2_key, content_type, category, title, caption, alt, submitted_by, submitted_at)
         VALUES
         (?, 'pending', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
            )
                .bind(
                    id,
                    r2Key,
                    file.type,
                    category,
                    title,
                    caption,
                    alt,
                    submittedBy
                )
                .run();
        } catch (e) {
            // prevent orphaned objects
            await BUCKET.delete(r2Key);
            throw e;
        }

        return redirect(context.url.origin, "/photos?submitted=1");
    } catch (e) {
        console.error(e);
        return redirect(context.url.origin, "/photos/submit?err=server");
    }
};
