import type { APIRoute, APIContext } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { redirect, options } from "../../../lib/http";
import { verifyTurnstile } from "../../../lib/turnstile";


const ALLOWED_CATEGORIES = new Set([
    "Restoration",
    "Donations",
    "Community Events",
    "Raffles",
    "Scenery",
]);

function redirectTo(context: APIContext, pathWithQuery: string) {
    return redirect(new URL(pathWithQuery, context.url).toString());
}

function isAllowedImageType(type: string) {
    return (
        type === "image/jpeg" ||
        type === "image/png" ||
        type === "image/webp" ||
        type === "image/gif" ||
        type === "image/avif"
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
        case "image/avif":
            return "avif";
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
            return redirectTo(context, "/photos/submit?err=category");
        }

        if (!fileLike || typeof fileLike === "string") {
            return redirectTo(context, "/photos/submit?err=file");
        }

        const file = fileLike as File;

        if (alt.length < 5) { return redirectTo(context, "/photos/submit?err=alt"); }
        if (!isAllowedImageType(file.type)) { return redirectTo(context, "/photos/submit?err=type"); }

        const MAX_BYTES = 8 * 1024 * 1024;
        if (file.size <= 0 || file.size > MAX_BYTES) { return redirectTo(context, "/photos/submit?err=size"); }

        // Honeypot
        const company = String(form.get("company") ?? "").trim();
        if (company) return redirectTo(context, "/photos?submitted=1"); // act like success

        // Turnstile
        const token = String(form.get("cf-turnstile-response") ?? "").trim();
        if (!token) return redirectTo(context, "/photos/submit?err=captcha");

        const env = (context.locals as any).runtime?.env as
            | { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket; TURNSTILE_SECRET?: string }
            | undefined;

        const DB = env?.DB;
        const BUCKET = env?.PHOTOS_BUCKET;
        if (!DB || !BUCKET) return redirectTo(context, "/photos/submit?err=server");

        const secret = String(env?.TURNSTILE_SECRET ?? "").trim();
        if (!secret) return redirectTo(context, "/photos/submit?err=server");

        const okCaptcha = await verifyTurnstile({
            request: context.request,
            secret,
            token,
        });

        if (!okCaptcha) return redirectTo(context, "/photos/submit?err=captcha");

        const id = crypto.randomUUID();
        const ext = extFromContentType(file.type);
        const r2Key = `pending/${id}.${ext}`;

        const buf = await file.arrayBuffer();

        // upload to R2
        await BUCKET.put(r2Key, buf, { httpMetadata: { contentType: file.type } });

        try {
            await DB.prepare(
                `INSERT INTO photos
         (id, status, r2_key, content_type, category, title, caption, alt, submitted_by, submitted_at)
         VALUES
         (?, 'pending', ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
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

        return redirectTo(context, "/photos?submitted=1");
    } catch (e) {
        console.error(e);
        return redirectTo(context, "/photos/submit?err=server");
    }
};

export const OPTIONS: APIRoute = async () => options("GET,POST,OPTIONS");