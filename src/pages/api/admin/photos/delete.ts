import type { APIRoute } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { redirect } from "../../../../lib/http";

type Row = { r2_key: string; status: string };

export const POST: APIRoute = async ({ locals, request, url }) => {
    const env = (locals as any).runtime?.env as { DB?: D1Database; PHOTOS_BUCKET?: R2Bucket } | undefined;
    const DB = env?.DB;
    const BUCKET = env?.PHOTOS_BUCKET;

    const base = `${url.origin}/admin/photos/approved`;
    if (!DB || !BUCKET) return redirect(`${base}?err=server`);

    const form = await request.formData();
    const id = String(form.get("id") ?? "").trim();
    if (!id) return redirect(`${base}?err=server`);

    const row = (await DB.prepare(`SELECT r2_key, status FROM photos WHERE id = ?`)
        .bind(id)
        .first()) as Row | null;

    if (!row || row.status !== "approved") return redirect(`${base}?err=notfound`);

    if (row.r2_key) {
        try { await BUCKET.delete(row.r2_key); } catch {}
    }

    await DB.prepare(`DELETE FROM photos WHERE id = ?`).bind(id).run();

    return redirect(`${base}?ok=deleted`);
};
