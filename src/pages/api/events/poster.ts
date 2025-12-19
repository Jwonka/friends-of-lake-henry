import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export const GET: APIRoute = async ({ locals, url }) => {
    const id = url.searchParams.get("id")?.trim();
    if (!id) return new Response("Missing id", { status: 400 });

    const env = (locals as any).runtime?.env as
        | { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket }
        | undefined;

    const DB = env?.DB;
    const BUCKET = env?.PHOTOS_BUCKET;
    if (!DB || !BUCKET) return new Response("Server misconfigured", { status: 500 });

    const row = await DB.prepare(`
    SELECT poster_key
    FROM events
    WHERE id = ? AND status = 'published'
  `).bind(id).first<{ poster_key: string | null }>();

    const key = row?.poster_key;
    if (!key) return new Response("Not found", { status: 404 });

    const obj = await BUCKET.get(key);
    if (!obj) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=86400"); // 1 day cache
    if (obj.httpEtag) headers.set("ETag", obj.httpEtag);

    return new Response(obj.body as any, { status: 200, headers });
};
