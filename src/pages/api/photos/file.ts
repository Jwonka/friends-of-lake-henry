import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { SECURITY_HEADERS_FILE, SECURITY_HEADERS_NOSTORE, fileResponse } from "../../../lib/http";

type PhotoRow = { r2_key: string; content_type: string | null; status: string };

const err = (msg: string, status: number) =>
    new Response(msg, { status, headers: SECURITY_HEADERS_NOSTORE });

const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
]);

function safeFilename(name: string) {
    // keep it simple; avoid header injection / weird chars
    return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "photo";
}

function guessContentTypeFromKey(key: string): string | null {
    const k = key.toLowerCase();
    if (k.endsWith(".jpg") || k.endsWith(".jpeg")) return "image/jpeg";
    if (k.endsWith(".png")) return "image/png";
    if (k.endsWith(".webp")) return "image/webp";
    if (k.endsWith(".gif")) return "image/gif";
    if (k.endsWith(".avif")) return "image/avif";
    return null;
}

function normalizeAllowedImageContentType(ct: string | null | undefined): string | null {
    if (!ct) return null;
    const base = ct.trim().toLowerCase().split(";")[0].trim();
    return ALLOWED_IMAGE_TYPES.has(base) ? base : null;
}

export const GET: APIRoute = async ({ locals, url }) => {
    const id = url.searchParams.get("id")?.trim();
    if (!id) return err("Missing id", 400);

    const env = (locals as any).runtime?.env as { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket } | undefined;
    const DB = env?.DB;
    const BUCKET = env?.PHOTOS_BUCKET;
    if (!DB || !BUCKET) return err("Server misconfigured", 500);

    const row = (await DB
        .prepare(`SELECT r2_key, content_type, status FROM photos WHERE id = ?`)
        .bind(id)
        .first()) as PhotoRow | null;

    if (!row || row.status !== "approved") return err("Not found", 404);

    const obj = await BUCKET.get(row.r2_key);
    if (!obj) return err("Not found", 404);

    const headers = new Headers(SECURITY_HEADERS_FILE);
    const contentType =
        normalizeAllowedImageContentType(row.content_type) ||
        normalizeAllowedImageContentType(obj.httpMetadata?.contentType) ||
        guessContentTypeFromKey(row.r2_key);

    if (!contentType) return err("Unsupported image type", 415);

    const ext = contentType === "image/jpeg" ? "jpg"
        : contentType === "image/png" ? "png"
            : contentType === "image/webp" ? "webp"
                : contentType === "image/gif" ? "gif"
                    : contentType === "image/avif" ? "avif"
                        : "img";

    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `inline; filename="${safeFilename(id)}.${ext}"`);
    headers.set("Cache-Control", "public, max-age=3600");
    if (obj.httpEtag) headers.set("ETag", obj.httpEtag);

    return fileResponse(obj.body as any, headers, 200);
};

