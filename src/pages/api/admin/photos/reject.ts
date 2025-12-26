import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { redirect, SECURITY_HEADERS_NOSTORE} from "../../../../lib/http";

type PhotoRow = { r2_key: string; status: string };

export const POST: APIRoute = async ({ locals, request, url }) => {
    const env = (locals as any).runtime?.env as { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket } | undefined;
    const DB = env?.DB;
    const BUCKET = env?.PHOTOS_BUCKET;
    if (!DB || !BUCKET) return new Response("Server misconfigured", { status: 500, headers: SECURITY_HEADERS_NOSTORE });

    const form = await request.formData();
    const id = String(form.get("id") ?? "").trim();
    if (!id) return new Response("Missing id", { status: 400, headers: SECURITY_HEADERS_NOSTORE });

    const row = (await DB.prepare(`SELECT r2_key, status FROM photos WHERE id = ?`)
        .bind(id)
        .first()) as PhotoRow | null;

    if (!row) return new Response("Not found", { status: 404, headers: SECURITY_HEADERS_NOSTORE });
    if (row.status !== "pending") return new Response("Not pending", { status: 409, headers: SECURITY_HEADERS_NOSTORE });

    if (row.r2_key) {
        try { await BUCKET.delete(row.r2_key); } catch {}
    }
    await DB.prepare(`DELETE FROM photos WHERE id = ?`).bind(id).run();
    return redirect(`${url.origin}/admin/photos/pending?ok=rejected`, 303);
};
