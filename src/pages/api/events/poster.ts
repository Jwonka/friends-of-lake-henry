import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { SECURITY_HEADERS_FILE, SECURITY_HEADERS_NOSTORE } from "../../../lib/http";

const err = (msg: string, status: number) =>
    new Response(msg, { status, headers: SECURITY_HEADERS_NOSTORE });

export const GET: APIRoute = async ({ locals, url }) => {
    const id = url.searchParams.get("id")?.trim();
    if (!id) return err("Missing id", 400);

    const env = (locals as any).runtime?.env as
        | { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket }
        | undefined;

    const DB = env?.DB;
    const BUCKET = env?.PHOTOS_BUCKET;
    if (!DB || !BUCKET) return err("Server misconfigured", 500);

    const row = await DB.prepare(`
    SELECT poster_key
    FROM events
    WHERE id = ? AND status = 'published'
  `).bind(id).first<{ poster_key: string | null }>();

    const key = row?.poster_key;
    if (!key) return err("Not found", 404);

    const obj = await BUCKET.get(key);
    if (!obj) return err("Not found", 404);

    const headers = new Headers(SECURITY_HEADERS_FILE);
    headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=86400");
    if (obj.httpEtag) headers.set("ETag", obj.httpEtag);

    return new Response(obj.body as any, { status: 200, headers });
};

