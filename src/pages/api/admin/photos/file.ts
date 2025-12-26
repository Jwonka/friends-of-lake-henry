import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import {SECURITY_HEADERS_NOSTORE, fileResponse, SECURITY_HEADERS_FILE} from "../../../../lib/http";

type Row = { r2_key: string; content_type: string; status: string };
const err = (msg: string, status: number) =>
    new Response(msg, { status, headers: SECURITY_HEADERS_NOSTORE });

export const GET: APIRoute = async ({ locals, url }) => {
    const id = url.searchParams.get("id");
    if (!id) return err("Missing id", 400);

    const env = (locals as any).runtime?.env as { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket } | undefined;
    const DB = env?.DB;
    const BUCKET = env?.PHOTOS_BUCKET;
    if (!DB || !BUCKET) return new Response("Server misconfigured", { status: 500, headers: SECURITY_HEADERS_NOSTORE });

    const row = (await DB.prepare(
        `SELECT r2_key, content_type, status FROM photos WHERE id = ?`
    )
        .bind(id)
        .first()) as Row | null;

    // admin preview endpoint: pending only
    if (!row || row.status !== "pending") return err("Not found", 404);

    const obj = await BUCKET.get(row.r2_key);
    if (!obj) return err("Not found", 404);
    const headers = new Headers(SECURITY_HEADERS_FILE);
    headers.set(
        "Content-Type",
        row.content_type || obj.httpMetadata?.contentType || "application/octet-stream"
    );
    headers.set("Cache-Control", "no-store");
    if (obj.httpEtag) headers.set("ETag", obj.httpEtag);

    return fileResponse(obj.body as any, headers, 200);
};
