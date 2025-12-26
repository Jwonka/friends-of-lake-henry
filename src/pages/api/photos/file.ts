import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { SECURITY_HEADERS_FILE, SECURITY_HEADERS_NOSTORE  } from "../../../lib/http";

type PhotoRow = { r2_key: string; content_type: string | null; status: string };

export const GET: APIRoute = async ({ locals, url }) => {
    const id = url.searchParams.get("id")?.trim();
    if (!id) return new Response("Missing id", { status: 400, headers: SECURITY_HEADERS_NOSTORE });

    const env = (locals as any).runtime?.env as { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket } | undefined;
    if (!env?.DB || !env?.PHOTOS_BUCKET) {
        return new Response("Server misconfigured", { status: 500, headers: SECURITY_HEADERS_NOSTORE });
    }
    const row = (await env.DB
        .prepare(`SELECT r2_key, content_type, status FROM photos WHERE id = ?`)
        .bind(id)
        .first()) as PhotoRow | null;

    if (!row || row.status !== "approved") {
        return new Response("Not found", { status: 404, headers: SECURITY_HEADERS_NOSTORE });
    }

    const obj = await env.PHOTOS_BUCKET.get(row.r2_key);
    if (!obj) return new Response("Not found", { status: 404, headers: SECURITY_HEADERS_NOSTORE });

    const headers = new Headers(SECURITY_HEADERS_FILE);
    headers.set("Content-Type", row.content_type || obj.httpMetadata?.contentType || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=3600");
    if (obj.httpEtag) headers.set("ETag", obj.httpEtag);

    return new Response(obj.body as any, { status: 200, headers });
};

