import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

type PhotoRow = { r2_key: string; content_type: string | null; status: string };

export const GET: APIRoute = async ({ locals, url }) => {
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const env = (locals as any).runtime?.env as { DB: D1Database; PHOTOS_BUCKET: R2Bucket } | undefined;
    if (!env?.DB || !env?.PHOTOS_BUCKET) return new Response("Server misconfigured", { status: 500 });

    const row = (await env.DB
        .prepare(`SELECT r2_key, content_type, status FROM photos WHERE id = ?`)
        .bind(id)
        .first()) as PhotoRow | null;

    if (!row || row.status !== "approved") return new Response("Not found", { status: 404 });

    const obj = await env.PHOTOS_BUCKET.get(row.r2_key);
    if (!obj) return new Response("Not found", { status: 404 });

    const body = await obj.arrayBuffer();

    return new Response(body, {
        headers: {
            "Content-Type": row.content_type || "application/octet-stream",
            "Cache-Control": "public, max-age=3600",
        },
    });
};

