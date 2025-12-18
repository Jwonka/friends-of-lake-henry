import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

type Row = { r2_key: string; content_type: string; status: string };

export const GET: APIRoute = async ({ locals, url }) => {
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const env = (locals as any).runtime?.env as { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket } | undefined;
    const DB = env?.DB;
    const BUCKET = env?.PHOTOS_BUCKET;
    if (!DB || !BUCKET) return new Response("Server misconfigured", { status: 500 });

    const row = (await DB.prepare(
        `SELECT r2_key, content_type, status FROM photos WHERE id = ?`
    )
        .bind(id)
        .first()) as Row | null;

    // admin preview endpoint: pending only
    if (!row || row.status !== "pending") return new Response("Not found", { status: 404 });

    const obj = await BUCKET.get(row.r2_key);
    if (!obj) return new Response("Not found", { status: 404 });

    const buf = await obj.arrayBuffer();

    return new Response(buf, {
        headers: {
            "Content-Type": row.content_type || "application/octet-stream",
            "Cache-Control": "no-store",
        },
    });
};
